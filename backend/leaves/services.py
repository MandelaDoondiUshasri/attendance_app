import calendar
from datetime import date
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Q

from employees.models import Employee
from leaves.models import LeaveType, LeaveRequest, LeaveStatus, AdditionalLeaveStatus

class CasualLeavePolicyEngine:
    """
    Centralized business logic engine for:
    1. Annual Casual Leave (12 CL / year = 1 CL / month)
    2. Dynamic carry-forward (Previous Unused CL = N)
    3. Normal CL Allowance = N + 1
    4. Current-month CL usage restriction
    5. Split leave requests (Normal CL + Additional Leave requiring higher authority)
    6. Daily Salary calculation based strictly on actual calendar days in month
    """

    @classmethod
    def get_month_calendar_days(cls, year: int, month: int) -> int:
        """Returns the actual number of calendar days in the specified month (e.g. 28, 29, 30, 31)."""
        _, total_days = calendar.monthrange(year, month)
        return total_days

    @classmethod
    def calculate_daily_salary(cls, employee: Employee, year: int, month: int) -> Decimal:
        """
        Daily Salary = Monthly Salary / Actual Calendar Days in Month.
        Sundays and second Saturdays are paid and never subtracted from the divisor.
        """
        total_days = cls.get_month_calendar_days(year, month)
        monthly_salary = Decimal(str(employee.salary or Decimal('0.00')))
        if monthly_salary == 0 and hasattr(employee, 'salary_record') and employee.salary_record:
            monthly_salary = Decimal(str(employee.salary_record.current_salary or Decimal('0.00')))
            
        if total_days > 0 and monthly_salary > 0:
            return (monthly_salary / Decimal(str(total_days))).quantize(Decimal('0.01'))
        return Decimal('0.00')

    @classmethod
    def calculate_cl_allowance(cls, employee: Employee, year: int, month: int) -> dict:
        """
        Calculates dynamic carry-forward and monthly CL allowance for an employee:
        - N = Unused CL carried forward from previous months in the same year
        - Current month allocation = 1 CL
        - Normal CL allowance = N + 1
        - Current month status (Available vs Used)
        """
        joining = employee.joining_date
        if joining and (joining.year > year or (joining.year == year and joining.month > month)):
            # Employee has not joined yet in this month
            return {
                'year': year,
                'month': month,
                'month_name': calendar.month_name[month],
                'previous_unused_cl': 0.0,
                'current_month_cl': 0.0,
                'normal_cl_allowance': 0.0,
                'total_available_cl': 0.0,
                'cl_used_current_month': 0.0,
                'current_month_cl_used': False,
                'current_month_cl_status': 'NOT_JOINED',
                'is_cl_disabled': True,
                'disable_reason': 'Employee has not joined yet.',
                'cl_used_ytd': 0.0,
                'remaining_cl_annual': 0.0,
            }

        start_month = 1
        if joining and joining.year == year:
            start_month = joining.month

        # Find Casual Leave type
        cl_type = LeaveType.objects.filter(
            Q(code__iexact='CL') | Q(name__icontains='casual')
        ).first()

        # 1. Total CL used in previous months of the current year (start_month <= m < month)
        cl_used_in_prev_months = 0.0
        if month > start_month and cl_type:
            prev_requests = LeaveRequest.objects.filter(
                employee=employee,
                leave_type=cl_type,
                status=LeaveStatus.APPROVED,
                start_date__year=year,
                start_date__month__lt=month,
                start_date__month__gte=start_month
            )
            for req in prev_requests:
                # Use cl_days if tracked, else number_of_days
                cl_used_in_prev_months += float(req.cl_days if req.cl_days > 0 else req.number_of_days)

        # Accrued months prior to this month in the current year
        months_elapsed = max(0, month - start_month)
        # N = Unused CL carried forward from previous months
        previous_unused_cl = max(0.0, float(months_elapsed) - float(cl_used_in_prev_months))

        # Current month allocation = 1.0 (if employee active)
        current_month_cl = 1.0 if month >= start_month else 0.0

        # Normal CL allowance = N + 1
        normal_cl_allowance = previous_unused_cl + current_month_cl

        # 2. Check current month usage
        cl_used_current_month = 0.0
        cl_pending_current_month = 0.0
        if cl_type:
            curr_approved = LeaveRequest.objects.filter(
                employee=employee,
                leave_type=cl_type,
                status=LeaveStatus.APPROVED,
                start_date__year=year,
                start_date__month=month
            )
            for req in curr_approved:
                cl_used_current_month += float(req.cl_days if req.cl_days > 0 else req.number_of_days)

            curr_pending = LeaveRequest.objects.filter(
                employee=employee,
                leave_type=cl_type,
                status=LeaveStatus.PENDING,
                start_date__year=year,
                start_date__month=month
            )
            for req in curr_pending:
                cl_pending_current_month += float(req.cl_days if req.cl_days > 0 else req.number_of_days)

        # Total available in current month = Normal Allowance - Already Approved in current month
        total_available_cl = max(0.0, normal_cl_allowance - cl_used_current_month)

        # Current month CL usage status
        # If the employee already has an approved or pending CL leave in this month,
        # the current month CL is considered utilized for new applications.
        current_month_cl_used = (cl_used_current_month > 0 or cl_pending_current_month > 0)
        current_month_cl_status = 'USED' if current_month_cl_used else 'AVAILABLE'

        # Casual Leave is disabled for new requests if current month's CL has already been used
        is_cl_disabled = current_month_cl_used
        disable_reason = None
        if is_cl_disabled:
            disable_reason = (
                f"Casual Leave for {calendar.month_name[month]} has already been utilized. "
                "Any further leave must be requested under Loss of Pay (LOP)."
            )

        # Annual YTD tracking
        cl_used_ytd = cl_used_in_prev_months + cl_used_current_month
        remaining_cl_annual = max(0.0, 12.0 - cl_used_ytd)

        return {
            'year': year,
            'month': month,
            'month_name': calendar.month_name[month],
            'previous_unused_cl': round(previous_unused_cl, 1),
            'current_month_cl': round(current_month_cl, 1),
            'normal_cl_allowance': round(normal_cl_allowance, 1),
            'total_available_cl': round(total_available_cl, 1),
            'cl_used_current_month': round(cl_used_current_month, 1),
            'cl_pending_current_month': round(cl_pending_current_month, 1),
            'current_month_cl_used': current_month_cl_used,
            'current_month_cl_status': current_month_cl_status,
            'is_cl_disabled': is_cl_disabled,
            'disable_reason': disable_reason,
            'cl_used_ytd': round(cl_used_ytd, 1),
            'remaining_cl_annual': round(remaining_cl_annual, 1),
        }

    @classmethod
    def evaluate_leave_request(cls, employee: Employee, leave_type: LeaveType, start_date: date, requested_days: float) -> dict:
        """
        Evaluates a requested leave and determines:
        - If CL is allowed or disabled for the month
        - Split between CL days and Additional days requiring higher-authority approval
        - Daily salary rate and expected LOP deduction
        """
        year = start_date.year
        month = start_date.month

        calendar_days = cls.get_month_calendar_days(year, month)
        daily_salary = cls.calculate_daily_salary(employee, year, month)

        is_lop = not getattr(leave_type, 'is_paid', True) or 'LOP' in (leave_type.code or '').upper() or 'loss of pay' in (leave_type.name or '').lower()
        is_cl = 'CL' in (leave_type.code or '').upper() or 'casual' in (leave_type.name or '').lower()

        if is_lop:
            # Entire leave is LOP
            deduction = (Decimal(str(requested_days)) * daily_salary).quantize(Decimal('0.01'))
            return {
                'is_cl': False,
                'is_lop': True,
                'cl_days': 0.0,
                'lop_days': requested_days,
                'additional_leave_days': 0.0,
                'additional_leave_status': AdditionalLeaveStatus.NONE,
                'calendar_days': calendar_days,
                'daily_salary_rate': daily_salary,
                'expected_lop_deduction': deduction,
                'requires_higher_authority': False,
                'message': f"Loss of Pay leave: {requested_days} days @ ₹{daily_salary}/day = ₹{deduction} deduction upon approval."
            }

        if is_cl:
            allowance = cls.calculate_cl_allowance(employee, year, month)
            if allowance['is_cl_disabled']:
                raise ValueError(
                    f"Casual Leave for {allowance['month_name']} has already been utilized. "
                    "Casual Leave is disabled for the remainder of this month. Please apply under Loss of Pay (LOP)."
                )

            available = allowance['total_available_cl']
            if requested_days <= available:
                # Entire leave fits within Normal CL allowance
                return {
                    'is_cl': True,
                    'is_lop': False,
                    'cl_days': requested_days,
                    'lop_days': 0.0,
                    'additional_leave_days': 0.0,
                    'additional_leave_status': AdditionalLeaveStatus.NONE,
                    'calendar_days': calendar_days,
                    'daily_salary_rate': daily_salary,
                    'expected_lop_deduction': Decimal('0.00'),
                    'requires_higher_authority': False,
                    'message': f"Request within available CL allowance ({requested_days} of {available} days available)."
                }
            else:
                # Split request: Normal CL allowance + Additional days requiring higher authority approval
                cl_part = available
                additional_part = round(requested_days - available, 1)
                deduction = (Decimal(str(additional_part)) * daily_salary).quantize(Decimal('0.01'))

                return {
                    'is_cl': True,
                    'is_lop': False,
                    'cl_days': cl_part,
                    'lop_days': 0.0, # Not LOP until approved!
                    'additional_leave_days': additional_part,
                    'additional_leave_status': AdditionalLeaveStatus.PENDING,
                    'calendar_days': calendar_days,
                    'daily_salary_rate': daily_salary,
                    'expected_lop_deduction': deduction,
                    'requires_higher_authority': True,
                    'message': (
                        f"Request exceeds normal CL allowance ({available} days). "
                        f"Split: {cl_part} CL + {additional_part} additional days requiring higher-authority approval. "
                        f"If approved, {additional_part} day(s) will be Loss of Pay (₹{deduction})."
                    )
                }

        # Other paid leave (e.g. Optional Festival Leave)
        return {
            'is_cl': False,
            'is_lop': False,
            'cl_days': 0.0,
            'lop_days': 0.0,
            'additional_leave_days': 0.0,
            'additional_leave_status': AdditionalLeaveStatus.NONE,
            'calendar_days': calendar_days,
            'daily_salary_rate': daily_salary,
            'expected_lop_deduction': Decimal('0.00'),
            'requires_higher_authority': False,
            'message': 'Standard leave request.'
        }
