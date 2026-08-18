from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from decimal import Decimal
from salaries.models import Salary, SalaryHistory, SalaryChangeType
from salaries.serializers import SalarySerializer, SalaryHistorySerializer, SalaryChangeRequestSerializer
from employees.models import Employee
from accounts.permissions import IsCEO, IsHR
from accounts.models import Role
from audit.services import AuditService
from notifications.services import NotificationService

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

    def get_permissions(self):
        # Attendance operators barred completely
        return [IsCEO()]

    def get_queryset(self):
        user = self.request.user
        if user.role == Role.CEO:
            return Salary.objects.all()
        return Salary.objects.none()

class SalaryHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SalaryHistory.objects.all().order_by('-created_at')
    serializer_class = SalaryHistorySerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == Role.CEO:
            emp_id = self.request.query_params.get('employee')
            if emp_id:
                return SalaryHistory.objects.filter(employee_id=emp_id).order_by('-created_at')
            return SalaryHistory.objects.all().order_by('-created_at')

        # Employee can view own salary history
        if hasattr(user, 'employee_profile'):
            return SalaryHistory.objects.filter(employee=user.employee_profile).order_by('-created_at')

        return SalaryHistory.objects.none()
