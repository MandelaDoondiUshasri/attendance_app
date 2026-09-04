from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from decimal import Decimal
from datetime import date
from django.db.models import Sum
from salaries.models import Salary, SalaryHistory, SalaryChangeType
from salaries.serializers import SalarySerializer, SalaryHistorySerializer, SalaryChangeRequestSerializer
from employees.models import Employee, EmploymentStatus
from accounts.permissions import IsCEO
from accounts.models import Role
from audit.services import AuditService
from notifications.services import NotificationService
from leaves.models import LeaveRequest, LeaveStatus
from wfh.models import WFHRequest, WFHStatus
from attendance.models import Attendance, AttendanceStatus

class IncrementSalaryView(APIView):
    permission_classes = [IsCEO]

    def post(self, request):
        serializer = SalaryChangeRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        if not serializer.validated_data['confirmed']:
            return Response({'error': 'Confirmation is required to save salary increment.'}, status=status.HTTP_400_BAD_REQUEST)

        emp_pk = serializer.validated_data['employee_id']
        amount = serializer.validated_data['amount']
        reason = serializer.validated_data['reason']
        effective_date = serializer.validated_data['effective_date']

        employee = Employee.objects.filter(pk=emp_pk).first()
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        previous_salary = employee.salary or Decimal('0.00')
        new_salary = previous_salary + amount
        percentage = round((amount / previous_salary * Decimal('100.00')), 2) if previous_salary > 0 else Decimal('100.00')

        # Update Employee current salary
        employee.salary = new_salary
        employee.save()

        salary_rec, _ = Salary.objects.get_or_create(employee=employee, defaults={'current_salary': new_salary})
        salary_rec.current_salary = new_salary
        salary_rec.effective_date = effective_date
        salary_rec.save()

        # Immutable SalaryHistory record
        history = SalaryHistory.objects.create(
            employee=employee,
            previous_salary=previous_salary,
            change_type=SalaryChangeType.INCREMENT,
            amount=amount,
            percentage=percentage,
            new_salary=new_salary,
            reason=reason,
            effective_date=effective_date,
            changed_by=request.user
        )

        NotificationService.create_notification(
            recipient=employee.user,
            title="Salary Increment Approved",
            message=f"Congratulations! Your salary has been INCREMENTED by ₹{amount} to ₹{new_salary}.",
            notification_type='SALARY_INCREMENT'
        )

        AuditService.log_action(
            actor=request.user,
            action='SALARY_INCREMENT',
            target_model='SalaryHistory',
            target_id=str(history.id),
            old_values={'previous_salary': str(previous_salary)},
            new_values={'new_salary': str(new_salary), 'amount': str(amount), 'reason': reason},
            reason=f"Salary increment applied for {employee.full_name}",
            request=request
        )

        return Response({
            'message': f"Salary INCREMENTED for {employee.full_name} from ₹{previous_salary} to ₹{new_salary}",
            'history': SalaryHistorySerializer(history).data
        }, status=status.HTTP_200_OK)

class DecrementSalaryView(APIView):
    permission_classes = [IsCEO]

    def post(self, request):
        serializer = SalaryChangeRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        if not serializer.validated_data['confirmed']:
            return Response({'error': 'Confirmation is required to save salary decrement.'}, status=status.HTTP_400_BAD_REQUEST)

        emp_pk = serializer.validated_data['employee_id']
        amount = serializer.validated_data['amount']
        reason = serializer.validated_data['reason']
        effective_date = serializer.validated_data['effective_date']

        employee = Employee.objects.filter(pk=emp_pk).first()
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        previous_salary = employee.salary or Decimal('0.00')
        new_salary = max(Decimal('0.00'), previous_salary - amount)
        percentage = round((amount / previous_salary * Decimal('100.00')), 2) if previous_salary > 0 else Decimal('0.00')

        employee.salary = new_salary
        employee.save()

        salary_rec, _ = Salary.objects.get_or_create(employee=employee, defaults={'current_salary': new_salary})
        salary_rec.current_salary = new_salary
        salary_rec.effective_date = effective_date
        salary_rec.save()

        history = SalaryHistory.objects.create(
            employee=employee,
            previous_salary=previous_salary,
            change_type=SalaryChangeType.DECREMENT,
            amount=amount,
            percentage=percentage,
            new_salary=new_salary,
            reason=reason,
            effective_date=effective_date,
            changed_by=request.user
        )

        NotificationService.create_notification(
            recipient=employee.user,
            title="Salary Adjustment Notice",
            message=f"Notice: Your salary has been adjusted to ₹{new_salary}.",
            notification_type='SALARY_DECREMENT'
        )

        AuditService.log_action(
            actor=request.user,
            action='SALARY_DECREMENT',
            target_model='SalaryHistory',
            target_id=str(history.id),
            old_values={'previous_salary': str(previous_salary)},
            new_values={'new_salary': str(new_salary), 'amount': str(amount), 'reason': reason},
            reason=f"Salary decrement applied for {employee.full_name}",
            request=request
        )

        return Response({
            'message': f"Salary DECREMENTED for {employee.full_name} from ₹{previous_salary} to ₹{new_salary}",
            'history': SalaryHistorySerializer(history).data
        }, status=status.HTTP_200_OK)

class SalaryViewSet(viewsets.ModelViewSet):
    queryset = Salary.objects.all()
    serializer_class = SalarySerializer
    permission_classes = [IsCEO]

    def get_queryset(self):
        user = self.request.user
        if user.role in [Role.CEO, Role.SYSTEM_ADMIN]:
            return Salary.objects.all()
        return Salary.objects.none()

class SalaryHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SalaryHistory.objects.all().order_by('-created_at')
    serializer_class = SalaryHistorySerializer
    permission_classes = [IsCEO]

    def get_queryset(self):
        user = self.request.user
        if user.role in [Role.CEO, Role.SYSTEM_ADMIN]:
            emp_id = self.request.query_params.get('employee')
            if emp_id:
                return SalaryHistory.objects.filter(employee_id=emp_id).order_by('-created_at')
            return SalaryHistory.objects.all().order_by('-created_at')
        return SalaryHistory.objects.none()

class PayrollCalculationView(APIView):
    """
    CEO-exclusive automated Monthly Payroll, Financial Calculations & Deductions Engine.
    Policy rules:
    - 1 Sick Leave (SL) allowed free/month. Excess > 1 deducted.
    - 1 Casual Leave (CL) allowed free/month. Excess > 1 deducted.
    - 4 WFH allowed free/month. Excess > 4 deducted.
    - Half-day penalty (Full day working <8h, Half day working <4h).
    """
    permission_classes = [IsCEO]

    def get(self, request):
        today = date.today()
        try:
            month = int(request.query_params.get('month', today.month))
            year = int(request.query_params.get('year', today.year))
        except (ValueError, TypeError):
            month = today.month
            year = today.year

        employees = Employee.objects.filter(employment_status=EmploymentStatus.ACTIVE).select_related('user', 'department', 'designation')
        payroll_records = []
        total_base = Decimal('0.00')
        total_deductions = Decimal('0.00')
        total_net = Decimal('0.00')
        penalized_count = 0

        for emp in employees:
            base_sal = emp.salary or Decimal('0.00')
            daily_rate = (base_sal / Decimal('30.00')).quantize(Decimal('0.01')) if base_sal > 0 else Decimal('0.00')
            half_day_rate = (daily_rate / Decimal('2.00')).quantize(Decimal('0.01'))

            # 1. Leaves in month
            approved_leaves = LeaveRequest.objects.filter(
                employee=emp,
                status=LeaveStatus.APPROVED,
                start_date__year=year,
                start_date__month=month
            ).select_related('leave_type')

            sl_days = 0
            cl_days = 0
            for l in approved_leaves:
                code = (l.leave_type.code or '').upper()
                name = (l.leave_type.name or '').lower()
                if 'SL' in code or 'sick' in name:
                    sl_days += l.number_of_days
                else:
                    cl_days += l.number_of_days

            # Policy: 1 SL free, 1 CL free
            excess_sl = max(0, sl_days - 1)
            sl_deduction = (Decimal(excess_sl) * daily_rate).quantize(Decimal('0.01'))

            excess_cl = max(0, cl_days - 1)
            cl_deduction = (Decimal(excess_cl) * daily_rate).quantize(Decimal('0.01'))

            # 2. WFH in month (Policy: 4 days free)
            wfh_aggr = WFHRequest.objects.filter(
                employee=emp,
                status=WFHStatus.APPROVED,
                start_date__year=year,
                start_date__month=month
            ).aggregate(total_wfh_days=Sum('number_of_days'))
            approved_wfh_days = wfh_aggr['total_wfh_days'] or 0.0

            excess_wfh = max(0, approved_wfh_days - 4)
            wfh_deduction = (Decimal(excess_wfh) * daily_rate).quantize(Decimal('0.01'))

            # 3. Attendance penalties (Half-days / Absences)
            attendances = Attendance.objects.filter(
                employee=emp,
                date__year=year,
                date__month=month
            )
            is_half_day_emp = getattr(emp, 'is_half_day', False)
            if is_half_day_emp:
                # Half-day employee: works 1st half of the day as regular schedule.
                # Regular half-day attendance is their standard shift; do NOT penalize or deduct salary.
                half_days_count = 0
                half_day_deduction = Decimal('0.00')
            else:
                half_days_count = attendances.filter(status=AttendanceStatus.HALF_DAY).count()
                half_day_deduction = (Decimal(half_days_count) * half_day_rate).quantize(Decimal('0.01'))

            absent_days_count = attendances.filter(status=AttendanceStatus.ABSENT).count()
            absent_deduction = (Decimal(absent_days_count) * daily_rate).quantize(Decimal('0.01'))

            emp_total_deduction = sl_deduction + cl_deduction + wfh_deduction + half_day_deduction + absent_deduction
            net_sal = max(Decimal('0.00'), base_sal - emp_total_deduction)

            if emp_total_deduction > 0:
                penalized_count += 1

            total_base += base_sal
            total_deductions += emp_total_deduction
            total_net += net_sal

            payroll_records.append({
                'employee_id': emp.id,
                'employee_code': emp.employee_id,
                'full_name': emp.full_name,
                'department': emp.department.name if emp.department else 'Unassigned',
                'designation': emp.designation.title if emp.designation else 'Unassigned',
                'is_half_day': emp.is_half_day,
                'base_salary': str(base_sal),
                'daily_rate': str(daily_rate),
                'sick_leaves_taken': sl_days,
                'excess_sick_leaves': excess_sl,
                'sick_leave_deduction': str(sl_deduction),
                'casual_leaves_taken': cl_days,
                'excess_casual_leaves': excess_cl,
                'casual_leave_deduction': str(cl_deduction),
                'wfh_days_taken': approved_wfh_days,
                'excess_wfh_days': excess_wfh,
                'wfh_deduction': str(wfh_deduction),
                'half_days_count': half_days_count,
                'half_day_deduction': str(half_day_deduction),
                'absent_days_count': absent_days_count,
                'absent_deduction': str(absent_deduction),
                'total_deduction': str(emp_total_deduction),
                'net_payable_salary': str(net_sal)
            })

        return Response({
            'month': month,
            'year': year,
            'summary': {
                'total_base_payroll': str(total_base),
                'total_deductions': str(total_deductions),
                'total_net_payroll': str(total_net),
                'total_employees': len(payroll_records),
                'penalized_employees': penalized_count
            },
            'records': payroll_records
        }, status=status.HTTP_200_OK)
