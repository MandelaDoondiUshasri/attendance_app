from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from decimal import Decimal
from datetime import date
import calendar
import os
from django.db.models import Sum, Q, Max
from django.http import HttpResponse, Http404
from django.core.files.base import ContentFile
from django.utils import timezone
from salaries.models import Salary, SalaryHistory, SalaryChangeType, Payslip, PayslipStatus
from salaries.serializers import (
    SalarySerializer, SalaryHistorySerializer, SalaryChangeRequestSerializer,
    PayslipSerializer, PayslipDetailSerializer
)
from salaries.pdf_generator import PayslipPDFGenerator
from core.models import OrganizationSettings
from employees.models import Employee, EmploymentStatus
from reports.services import MonthlyAttendanceSalaryEngine
from accounts.permissions import IsCEO, IsHR
from accounts.models import Role
from audit.services import AuditService
from notifications.models import NotificationType
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

            # 3. Attendance penalties
            # Policy Cutoff: All half-day deductions previously up to today (date <= 2026-09-21) are removed.
            # From now on (date > 2026-09-21), anyone not maintaining the 8h window has half-day salary cut.
            cutoff_date = date(2026, 9, 21)

            attendances = Attendance.objects.filter(
                employee=emp,
                date__year=year,
                date__month=month
            )

            is_half_day_emp = getattr(emp, 'is_half_day', False)
            if is_half_day_emp:
                half_days_count = 0
                half_day_deduction = Decimal('0.00')
            else:
                # Only count half days occurring AFTER the cutoff date (i.e. starting from now)
                half_days_count = attendances.filter(
                    status=AttendanceStatus.HALF_DAY,
                    date__gt=cutoff_date
                ).count()
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


def _generate_payslip_record(employee, year, month, generated_by, force_version=False):
    """
    Helper function to calculate payroll and generate or update a Payslip model instance
    and its official PDF file. Uses MonthlyAttendanceSalaryEngine as the single source of truth.
    """
    if not employee:
        raise ValueError("Invalid employee.")

    # 1. Fetch source-of-truth calculations
    report = MonthlyAttendanceSalaryEngine.calculate_employee_monthly_report(employee, year, month)

    monthly_salary = Decimal(str(report.get('monthly_salary', 0)))
    per_day_salary = Decimal(str(report.get('per_day_salary', 0)))
    salary_deduction = Decimal(str(report.get('salary_deduction', 0)))
    net_salary = Decimal(str(report.get('salary_payable', 0)))

    # Metrics
    total_calendar_days = report.get('calendar_days', 30)
    company_working_days = Decimal(str(report.get('company_working_days', 0)))
    present_days = Decimal(str(report.get('present_days', 0)))
    paid_leave_days = Decimal(str(report.get('total_paid_leave_used', 0)))
    casual_leave_days = Decimal(str(report.get('casual_leave_used', 0)))
    optional_leave_days = Decimal(str(report.get('optional_leave_used', 0)))
    lop_days = Decimal(str(report.get('unpaid_absence_days', 0)))

    # Determine version & reference
    existing_payslips = Payslip.objects.filter(employee=employee, year=year, month=month).order_by('-version')
    latest_payslip = existing_payslips.first()

    if latest_payslip:
        if latest_payslip.status == PayslipStatus.RELEASED and not force_version:
            raise ValueError(f"Payslip for {employee.full_name} ({month}/{year}) is already RELEASED. To regenerate, create a revision.")

        if latest_payslip.status == PayslipStatus.RELEASED and force_version:
            version = latest_payslip.version + 1
            payslip_ref = f"PAY-{year}-{month:02d}-{employee.employee_id}-V{version}"
            payslip = Payslip(
                employee=employee,
                year=year,
                month=month,
                version=version,
                payslip_reference=payslip_ref
            )
        else:
            payslip = latest_payslip
    else:
        version = 1
        payslip_ref = f"PAY-{year}-{month:02d}-{employee.employee_id}"
        payslip = Payslip(
            employee=employee,
            year=year,
            month=month,
            version=version,
            payslip_reference=payslip_ref
        )

    payslip.monthly_salary = monthly_salary
    payslip.per_day_salary = per_day_salary
    payslip.gross_salary = monthly_salary
    payslip.total_deductions = salary_deduction
    payslip.net_salary = net_salary

    payslip.total_calendar_days = total_calendar_days
    payslip.company_working_days = company_working_days
    payslip.present_days = present_days
    payslip.paid_leave_days = paid_leave_days
    payslip.casual_leave_days = casual_leave_days
    payslip.optional_leave_days = optional_leave_days
    payslip.lop_days = lop_days
    payslip.lop_deduction = salary_deduction

    payslip.snapshot_data = report
    payslip.status = PayslipStatus.GENERATED
    payslip.generated_by = generated_by
    payslip.generated_at = timezone.now()
    payslip.save()

    # Generate and store official PDF
    pdf_bytes = PayslipPDFGenerator.generate_pdf(payslip)
    filename = f"{payslip.payslip_reference}.pdf"
    payslip.pdf_file.save(filename, ContentFile(pdf_bytes), save=True)

    return payslip


class PayslipManagementViewSet(viewsets.ModelViewSet):
    """
    CEO and HR management ViewSet for employee monthly payslips.
    Full lifecycle: Generate -> Preview -> Verify -> Release -> Revoke -> Download.
    """
    permission_classes = [IsHR]
    serializer_class = PayslipSerializer
    queryset = Payslip.objects.all().select_related(
        'employee', 'employee__department', 'employee__designation',
        'generated_by', 'verified_by', 'released_by', 'revoked_by'
    )

    def get_queryset(self):
        qs = super().get_queryset()
        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        dept = self.request.query_params.get('department')
        stat = self.request.query_params.get('status')
        search = self.request.query_params.get('search')
        released = self.request.query_params.get('released')

        if year:
            try:
                qs = qs.filter(year=int(year))
            except (ValueError, TypeError):
                pass
        if month:
            try:
                qs = qs.filter(month=int(month))
            except (ValueError, TypeError):
                pass
        if dept:
            qs = qs.filter(employee__department_id=dept)
        if stat:
            qs = qs.filter(status=stat)
        if released is not None:
            if str(released).lower() in ['true', '1']:
                qs = qs.filter(status=PayslipStatus.RELEASED)
            elif str(released).lower() in ['false', '0']:
                qs = qs.exclude(status=PayslipStatus.RELEASED)
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(employee__full_name__icontains=search) |
                Q(employee__employee_id__icontains=search) |
                Q(payslip_reference__icontains=search)
            )
        return qs.order_by('-year', '-month', 'employee__employee_id')

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Generate a single employee payslip."""
        emp_id = request.data.get('employee_id')
        year = request.data.get('year')
        month = request.data.get('month')
        force_version = bool(request.data.get('force_version', False))

        if not emp_id or not year or not month:
            return Response({'error': 'employee_id, year, and month are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            year = int(year)
            month = int(month)
        except (ValueError, TypeError):
            return Response({'error': 'year and month must be valid integers.'}, status=status.HTTP_400_BAD_REQUEST)

        employee = Employee.objects.filter(pk=emp_id).first()
        if not employee:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            payslip = _generate_payslip_record(employee, year, month, request.user, force_version=force_version)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Failed to generate payslip: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        AuditService.log_action(
            actor=request.user,
            action='PAYSLIP_GENERATED',
            target_model='Payslip',
            target_id=str(payslip.id),
            new_values={'reference': payslip.payslip_reference, 'net_salary': str(payslip.net_salary)},
            reason=f"Generated payslip {payslip.payslip_reference} for {employee.full_name}",
            request=request
        )

        return Response(PayslipSerializer(payslip).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='bulk-generate')
    def bulk_generate(self, request):
        """Bulk generate payslips for all active non-maintenance employees for a month."""
        year = request.data.get('year')
        month = request.data.get('month')
        dept_id = request.data.get('department_id')
        employee_ids = request.data.get('employee_ids')

        if not year or not month:
            return Response({'error': 'year and month are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            year = int(year)
            month = int(month)
        except (ValueError, TypeError):
            return Response({'error': 'year and month must be integers.'}, status=status.HTTP_400_BAD_REQUEST)

        employees_qs = Employee.objects.filter(employment_status=EmploymentStatus.ACTIVE)
        # Exclude maintenance staff if department is Maintenance
        employees_qs = employees_qs.exclude(department__name__iexact='Maintenance')

        if dept_id:
            employees_qs = employees_qs.filter(department_id=dept_id)
        if employee_ids and isinstance(employee_ids, list):
            employees_qs = employees_qs.filter(id__in=employee_ids)

        generated_list = []
        errors = []

        for emp in employees_qs:
            try:
                p = _generate_payslip_record(emp, year, month, request.user, force_version=False)
                generated_list.append(p.payslip_reference)
            except Exception as e:
                errors.append({'employee_id': emp.id, 'employee_name': emp.full_name, 'error': str(e)})

        AuditService.log_action(
            actor=request.user,
            action='PAYSLIP_BULK_GENERATED',
            target_model='Payslip',
            new_values={'year': year, 'month': month, 'generated_count': len(generated_list), 'error_count': len(errors)},
            reason=f"Bulk generated {len(generated_list)} payslips for {month}/{year}",
            request=request
        )

        return Response({
            'message': f"Bulk generation completed: {len(generated_list)} generated, {len(errors)} skipped/errored.",
            'generated_count': len(generated_list),
            'generated_payslips': generated_list,
            'errors': errors
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Mark payslip as VERIFIED after HR/CEO review."""
        payslip = self.get_object()
        if payslip.status == PayslipStatus.RELEASED:
            return Response({'error': 'Payslip is already released.'}, status=status.HTTP_400_BAD_REQUEST)

        payslip.status = PayslipStatus.VERIFIED
        payslip.verified_by = request.user
        payslip.verified_at = timezone.now()
        payslip.save()

        AuditService.log_action(
            actor=request.user,
            action='PAYSLIP_VERIFIED',
            target_model='Payslip',
            target_id=str(payslip.id),
            new_values={'status': PayslipStatus.VERIFIED},
            reason=f"Verified payslip {payslip.payslip_reference} for {payslip.employee.full_name}",
            request=request
        )

        return Response(PayslipSerializer(payslip).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def release(self, request, pk=None):
        """Release payslip to employee dashboard."""
        payslip = self.get_object()

        # Ensure PDF exists
        if not payslip.pdf_file or not os.path.exists(payslip.pdf_file.path):
            pdf_bytes = PayslipPDFGenerator.generate_pdf(payslip)
            filename = f"{payslip.payslip_reference}.pdf"
            payslip.pdf_file.save(filename, ContentFile(pdf_bytes), save=False)

        payslip.status = PayslipStatus.RELEASED
        payslip.released_by = request.user
        payslip.released_at = timezone.now()
        if not payslip.verified_at:
            payslip.verified_by = request.user
            payslip.verified_at = timezone.now()
        payslip.save()

        # In-app notification to employee
        if payslip.employee.user:
            m_name = calendar.month_name[payslip.month]
            NotificationService.create_notification(
                recipient=payslip.employee.user,
                title="Monthly Payslip Released",
                message=f"Your official payslip for {m_name} {payslip.year} has been released (Net Salary: ₹{payslip.net_salary:,.2f}). You can now view and download it from your dashboard.",
                notification_type=NotificationType.PAYSLIP_RELEASED
            )

        AuditService.log_action(
            actor=request.user,
            action='PAYSLIP_RELEASED',
            target_model='Payslip',
            target_id=str(payslip.id),
            new_values={'status': PayslipStatus.RELEASED, 'net_salary': str(payslip.net_salary)},
            reason=f"Released payslip {payslip.payslip_reference} to employee {payslip.employee.full_name}",
            request=request
        )

        return Response(PayslipSerializer(payslip).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='bulk-release')
    def bulk_release(self, request):
        """Bulk release verified payslips for a given year & month."""
        year = request.data.get('year')
        month = request.data.get('month')
        payslip_ids = request.data.get('payslip_ids')

        if not year or not month:
            return Response({'error': 'year and month are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            year = int(year)
            month = int(month)
        except (ValueError, TypeError):
            return Response({'error': 'year and month must be integers.'}, status=status.HTTP_400_BAD_REQUEST)

        qs = Payslip.objects.filter(year=year, month=month, status=PayslipStatus.VERIFIED)
        if payslip_ids and isinstance(payslip_ids, list):
            qs = qs.filter(id__in=payslip_ids)

        released_count = 0
        now = timezone.now()
        m_name = calendar.month_name[month]

        for p in qs:
            if not p.pdf_file or not os.path.exists(p.pdf_file.path):
                pdf_bytes = PayslipPDFGenerator.generate_pdf(p)
                p.pdf_file.save(f"{p.payslip_reference}.pdf", ContentFile(pdf_bytes), save=False)
            p.status = PayslipStatus.RELEASED
            p.released_by = request.user
            p.released_at = now
            p.save()
            released_count += 1

            if p.employee.user:
                NotificationService.create_notification(
                    recipient=p.employee.user,
                    title="Monthly Payslip Released",
                    message=f"Your official payslip for {m_name} {p.year} has been released. You can now view and download it from your dashboard.",
                    notification_type=NotificationType.PAYSLIP_RELEASED
                )

        AuditService.log_action(
            actor=request.user,
            action='PAYSLIP_BULK_RELEASED',
            target_model='Payslip',
            new_values={'year': year, 'month': month, 'released_count': released_count},
            reason=f"Bulk released {released_count} verified payslips for {month}/{year}",
            request=request
        )

        return Response({'message': f"Successfully released {released_count} payslips.", 'released_count': released_count}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """Revoke a payslip (unrelease it from employee view) with mandatory reason."""
        payslip = self.get_object()
        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({'error': 'A reason is required to revoke a payslip.'}, status=status.HTTP_400_BAD_REQUEST)

        payslip.status = PayslipStatus.REVOKED
        payslip.revoked_by = request.user
        payslip.revoked_at = timezone.now()
        payslip.revoke_reason = reason
        payslip.save()

        AuditService.log_action(
            actor=request.user,
            action='PAYSLIP_REVOKED',
            target_model='Payslip',
            target_id=str(payslip.id),
            new_values={'status': PayslipStatus.REVOKED, 'revoke_reason': reason},
            reason=f"Revoked payslip {payslip.payslip_reference}: {reason}",
            request=request
        )

        return Response(PayslipSerializer(payslip).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        """Preview payslip calculation data and snapshot breakdown."""
        payslip = self.get_object()
        return Response(PayslipDetailSerializer(payslip).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download or view payslip PDF for HR/CEO."""
        payslip = self.get_object()

        # Dynamically check if company settings were updated after this PDF was generated
        settings_obj = OrganizationSettings.get_settings()
        force_regen = request.query_params.get('fresh') == 'true' or request.query_params.get('regenerate') == 'true'
        pdf_exists = bool(payslip.pdf_file and os.path.exists(payslip.pdf_file.path))
        is_stale = False
        if pdf_exists and payslip.updated_at and settings_obj.updated_at:
            if settings_obj.updated_at > payslip.updated_at:
                is_stale = True

        if not pdf_exists or is_stale or force_regen:
            pdf_data = PayslipPDFGenerator.generate_pdf(payslip)
            filename = f"{payslip.payslip_reference}.pdf"
            payslip.pdf_file.save(filename, ContentFile(pdf_data), save=True)
        else:
            with open(payslip.pdf_file.path, 'rb') as f:
                pdf_data = f.read()

        is_inline = request.query_params.get('inline') == 'true' or request.query_params.get('view') == 'true'
        disp_type = 'inline' if is_inline else 'attachment'
        response = HttpResponse(pdf_data, content_type='application/pdf')
        response['Content-Disposition'] = f'{disp_type}; filename="{payslip.payslip_reference}.pdf"'

        AuditService.log_action(
            actor=request.user,
            action='PAYSLIP_DOWNLOADED',
            target_model='Payslip',
            target_id=str(payslip.id),
            reason=f"Payslip {payslip.payslip_reference} viewed/downloaded by management ({request.user.email})",
            request=request
        )

        return response


class EmployeePayslipViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Secure employee endpoint for viewing and downloading released payslips.
    Strictly restricted to the authenticated user's employee profile and status=RELEASED.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PayslipSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Payslip.objects.none()

        emp = getattr(user, 'employee_profile', None)
        if not emp:
            return Payslip.objects.none()

        # CRITICAL SECURITY: Strictly only RELEASED payslips belonging to this employee
        qs = Payslip.objects.filter(
            employee=emp,
            status=PayslipStatus.RELEASED
        ).select_related('employee', 'employee__department', 'employee__designation')

        year = self.request.query_params.get('year')
        month = self.request.query_params.get('month')
        if year:
            try:
                qs = qs.filter(year=int(year))
            except (ValueError, TypeError):
                pass
        if month:
            try:
                qs = qs.filter(month=int(month))
            except (ValueError, TypeError):
                pass

        return qs.order_by('-year', '-month')

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        user = request.user
        emp = getattr(user, 'employee_profile', None)
        if not emp:
            return Response({'error': 'No employee profile linked to user account.'}, status=status.HTTP_403_FORBIDDEN)

        payslip = Payslip.objects.filter(pk=pk).first()
        if not payslip:
            return Response({'error': 'Payslip not found.'}, status=status.HTTP_404_NOT_FOUND)

        # STRICT VERIFICATION: Employee ownership and RELEASED status
        if payslip.employee != emp:
            return Response({'error': 'Access denied: You cannot access payslips belonging to another employee.'}, status=status.HTTP_403_FORBIDDEN)

        if payslip.status != PayslipStatus.RELEASED:
            return Response({'error': 'Access denied: This payslip has not been released yet.'}, status=status.HTTP_403_FORBIDDEN)

        # PDF retrieval or dynamic regeneration if settings were modified
        settings_obj = OrganizationSettings.get_settings()
        force_regen = request.query_params.get('fresh') == 'true' or request.query_params.get('regenerate') == 'true'
        pdf_exists = bool(payslip.pdf_file and os.path.exists(payslip.pdf_file.path))
        is_stale = False
        if pdf_exists and payslip.updated_at and settings_obj.updated_at:
            if settings_obj.updated_at > payslip.updated_at:
                is_stale = True

        if not pdf_exists or is_stale or force_regen:
            pdf_data = PayslipPDFGenerator.generate_pdf(payslip)
            filename = f"{payslip.payslip_reference}.pdf"
            payslip.pdf_file.save(filename, ContentFile(pdf_data), save=True)
        else:
            with open(payslip.pdf_file.path, 'rb') as f:
                pdf_data = f.read()

        is_inline = request.query_params.get('inline') == 'true' or request.query_params.get('view') == 'true'
        disp_type = 'inline' if is_inline else 'attachment'
        response = HttpResponse(pdf_data, content_type='application/pdf')
        response['Content-Disposition'] = f'{disp_type}; filename="{payslip.payslip_reference}.pdf"'

        # Audit download
        AuditService.log_action(
            actor=request.user,
            action='PAYSLIP_DOWNLOADED',
            target_model='Payslip',
            target_id=str(payslip.id),
            reason=f"Payslip {payslip.payslip_reference} downloaded by employee {emp.full_name}",
            request=request
        )

        return response

