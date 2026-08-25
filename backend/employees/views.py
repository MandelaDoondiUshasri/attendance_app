from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from employees.models import Employee, Department, Designation, EmploymentStatus
from employees.serializers import EmployeeSerializer, CreateEmployeeSerializer, DepartmentSerializer, DesignationSerializer
from accounts.permissions import IsCEO, IsHR
from accounts.models import Role
from audit.services import AuditService

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all().order_by('name')
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsHR()]
        return [permissions.IsAuthenticated()]

class DesignationViewSet(viewsets.ModelViewSet):
    queryset = Designation.objects.all().order_by('title')
    serializer_class = DesignationSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsHR()]
        return [permissions.IsAuthenticated()]

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all().order_by('-created_at')
    serializer_class = EmployeeSerializer

    def get_permissions(self):
        if self.action in ['create', 'destroy', 'deactivate']:
            return [IsHR()]
        elif self.action in ['update', 'partial_update']:
            return [IsHR()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.role in [Role.CEO, Role.HR]:
            return Employee.objects.all().order_by('-created_at')
        # Standard employees can view basic employee list or their own details
        return Employee.objects.filter(employment_status=EmploymentStatus.ACTIVE).order_by('full_name')

    def create(self, request, *args, **kwargs):
        serializer = CreateEmployeeSerializer(data=request.data)
        if serializer.is_valid():
            employee = serializer.save()
            AuditService.log_action(
                actor=request.user,
                action='CREATE_EMPLOYEE',
                target_model='Employee',
                target_id=str(employee.id),
                new_values={'employee_id': employee.employee_id, 'full_name': employee.full_name, 'email': employee.email},
                reason=f"Employee account created for {employee.full_name}",
                request=request
            )
            return Response(EmployeeSerializer(employee).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsHR])
    def deactivate(self, request, pk=None):
        employee = self.get_object()
        employee.employment_status = EmploymentStatus.INACTIVE
        employee.user.is_active = False
        employee.user.save()
        employee.save()

        AuditService.log_action(
            actor=request.user,
            action='DEACTIVATE_EMPLOYEE',
            target_model='Employee',
            target_id=str(employee.id),
            reason=f"Deactivated employee account {employee.employee_id}",
            request=request
        )
        return Response({'message': f"Employee {employee.full_name} deactivated successfully"}, status=status.HTTP_200_OK)
