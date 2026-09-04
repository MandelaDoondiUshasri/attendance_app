import calendar
from datetime import date, datetime, timedelta
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Q

from core.models import OrganizationSettings, Holiday, SalaryDenominatorPolicy
from attendance.models import Attendance, AttendanceStatus, AttendanceWorkMode, FestivalHoliday, FestivalType
from leaves.models import LeaveRequest, LeaveStatus, LeaveType, LeaveBalance
from tracking.models import EmployeeScreenTime
from employees.models import Employee, EmploymentStatus


class MonthlyAttendanceSalaryEngine:
    """
    Central calculation engine for Monthly Employee Attendance, Working Hours,
    Screen Time, Leave, and Salary Reports.
    """

    @classmethod
    def get_month_calendar_info(cls, year: int, month: int):
        """
        Calculates dynamic calendar structure for given year & month.
        - Calendar Days (28, 29, 30, or 31)
        - Sundays (dynamically counted)
        - 2nd Saturday (Saturday falling on day 8-14)
        - Company Holidays (General Holidays from Holiday or FestivalHoliday)
        - Scheduled Company Working Days: Calendar Days - Sundays - 2nd Sat - Holidays
        """
        _, num_days = calendar.monthrange(year, month)
        month_start = date(year, month, 1)
        month_end = date(year, month, num_days)

        sundays = []
        second_saturdays = []
        company_holidays = []
        working_days = []
        day_map = {}

        # Fetch official company holidays in this month
        general_core_holidays = {
            h.date: h.title for h in Holiday.objects.filter(date__range=[month_start, month_end], is_optional=False)
        }
        general_fest_holidays = {
            fh.date: fh.name for fh in FestivalHoliday.objects.filter(date__range=[month_start, month_end], festival_type=FestivalType.GENERAL)
        }
        all_general_holidays = {**general_core_holidays, **general_fest_holidays}

        # Optional festival holidays defined
        optional_core_holidays = {
            h.date: h.title for h in Holiday.objects.filter(date__range=[month_start, month_end], is_optional=True)
        }
        optional_fest_holidays = {
            fh.date: fh.name for fh in FestivalHoliday.objects.filter(date__range=[month_start, month_end], festival_type=FestivalType.OPTIONAL)
        }
        all_optional_holidays = {**optional_core_holidays, **optional_fest_holidays}

        for day_num in range(1, num_days + 1):
            curr_date = date(year, month, day_num)
            weekday = curr_date.weekday()  # Monday=0, ... Saturday=5, Sunday=6
            is_sun = (weekday == 6)
            is_2nd_sat = (weekday == 5 and 8 <= day_num <= 14)
            is_comp_hol = (curr_date in all_general_holidays)
            is_opt_hol = (curr_date in all_optional_holidays)

            if is_sun:
                day_type = 'SUNDAY'
                holiday_title = 'Sunday (Weekly Off)'
                sundays.append(curr_date)
                is_working = False
            elif is_2nd_sat:
                day_type = 'SECOND_SATURDAY'
                holiday_title = '2nd Saturday (Mandatory Holiday)'
                second_saturdays.append(curr_date)
                is_working = False
            elif is_comp_hol:
                day_type = 'COMPANY_HOLIDAY'
                holiday_title = all_general_holidays[curr_date]
                company_holidays.append(curr_date)
                is_working = False
            else:
                day_type = 'WORKING_DAY'
                holiday_title = all_optional_holidays.get(curr_date) if is_opt_hol else None
                working_days.append(curr_date)
                is_working = True

            day_map[curr_date] = {
                'date': curr_date,
                'date_str': curr_date.isoformat(),
                'day_num': day_num,
                'day_name': curr_date.strftime('%A'),
                'is_working_day': is_working,
                'day_type': day_type,
                'holiday_title': holiday_title,
                'is_optional_holiday': is_opt_hol,
            }

        return {
            'year': year,
            'month': month,
            'month_name': calendar.month_name[month],
            'total_calendar_days': num_days,
            'total_sundays': len(sundays),
            'total_second_saturdays': len(second_saturdays),
            'total_company_holidays': len(company_holidays),
            'company_working_days': len(working_days),
            'sundays': sundays,
            'second_saturdays': second_saturdays,
            'company_holidays': company_holidays,
            'working_days': working_days,
            'day_map': day_map,
        }

    @classmethod
    def get_employee_annual_leave_summary(cls, employee: Employee, year: int):
        """
        Computes Annual Leave Balances (Entitlement, Used YTD, Remaining)
        for Optional Leave and Casual Leave for an employee.
        """
        settings = OrganizationSettings.get_settings()
        opt_entitlement = float(settings.optional_leave_annual_entitlement or 1.0)
        cas_entitlement = float(settings.casual_leave_annual_entitlement or 12.0)

        # Approved leaves for employee in the current calendar year
        ytd_leaves = LeaveRequest.objects.filter(
            employee=employee,
            status=LeaveStatus.APPROVED,
            start_date__year=year
        ).select_related('leave_type')

        opt_used_ytd = 0.0
        cas_used_ytd = 0.0
        other_paid_used_ytd = 0.0

        for l in ytd_leaves:
            code = (l.leave_type.code or '').upper()
            name = (l.leave_type.name or '').lower()
            days = float(l.number_of_days or 1.0)
            if 'OPT' in code or 'optional' in name or 'festival' in name:
                opt_used_ytd += days
            elif 'CL' in code or 'casual' in name:
                cas_used_ytd += days
            else:
                other_paid_used_ytd += days

        opt_remaining = max(0.0, opt_entitlement - opt_used_ytd)
        cas_remaining = max(0.0, cas_entitlement - cas_used_ytd)

        return {
            'optional_leave_entitlement': opt_entitlement,
            'optional_leave_used_ytd': opt_used_ytd,
            'optional_leave_remaining': opt_remaining,
            'casual_leave_entitlement': cas_entitlement,
            'casual_leave_used_ytd': cas_used_ytd,
            'casual_leave_remaining': cas_remaining,
            'other_paid_used_ytd': other_paid_used_ytd,
        }

    @classmethod
    def calculate_employee_monthly_report(cls, employee: Employee, year: int, month: int, cal_info=None):
        """
        Generates the complete monthly attendance, work hours, screen time,
        leave, and salary report for a single employee.
        """
        if not cal_info:
            cal_info = cls.get_month_calendar_info(year, month)

        settings = OrganizationSettings.get_settings()
        standard_daily_hours = float(settings.standard_daily_work_hours or settings.required_working_hours or 8.0)

        # Month bounds
        num_days = cal_info['total_calendar_days']
        month_start = date(year, month, 1)
        month_end = date(year, month, num_days)

        # Base Monthly Salary
        monthly_salary = Decimal(str(employee.salary or Decimal('0.00')))
        if monthly_salary == 0 and hasattr(employee, 'salary_record') and employee.salary_record:
            monthly_salary = Decimal(str(employee.salary_record.current_salary or Decimal('0.00')))

        # Fetch Attendance records in month
        attendances = {
            att.date: att for att in Attendance.objects.filter(
                employee=employee,
                date__range=[month_start, month_end]
            )
        }

        # Fetch Screen Time records in month
        screen_times = {
            st.date: st for st in EmployeeScreenTime.objects.filter(
                employee=employee,
                date__range=[month_start, month_end]
            )
        }

        # Fetch Approved Leaves overlapping month
        approved_leaves = LeaveRequest.objects.filter(
            employee=employee,
            status=LeaveStatus.APPROVED
        ).filter(
            Q(start_date__lte=month_end) & Q(end_date__gte=month_start)
        ).select_related('leave_type')

        # Map leaves to dates (only for working days in month)
        leave_day_map = {}
        for l in approved_leaves:
            code = (l.leave_type.code or '').upper()
            name = (l.leave_type.name or '').lower()
            if 'OPT' in code or 'optional' in name or 'festival' in name:
                category = 'OPTIONAL'
            elif 'CL' in code or 'casual' in name:
                category = 'CASUAL'
            elif 'UNPAID' in code or 'lwp' in name:
                category = 'UNPAID'
            else:
                category = 'OTHER_PAID'

            eff_start = max(l.start_date, month_start)
            eff_end = min(l.end_date, month_end)
            curr = eff_start
            while curr <= eff_end:
                # Do NOT count non-working days as leave
                if cal_info['day_map'][curr]['is_working_day']:
                    leave_day_map[curr] = {
                        'category': category,
                        'leave_name': l.leave_type.name,
                        'is_half_day': l.is_half_day,
                        'leave_weight': 0.5 if l.is_half_day else 1.0,
                        'reason': l.reason
                    }
                curr += timedelta(days=1)

        # Tenure boundaries
        emp_joining = employee.joining_date
        is_active = (employee.employment_status == EmploymentStatus.ACTIVE)

        # Accumulators
        present_days = 0.0
        optional_leave_used = 0.0
        casual_leave_used = 0.0
        other_paid_leave_used = 0.0
        unpaid_absence_days = 0.0
        total_actual_working_hours = 0.0
        total_actual_screen_hours = 0.0
        missing_checkout_count = 0
        missing_screentime_count = 0
        pre_joining_working_days = 0

        daily_breakdown = []

        for day_num in range(1, num_days + 1):
            curr_date = date(year, month, day_num)
            c_day = cal_info['day_map'][curr_date]

            att = attendances.get(curr_date)
            st = screen_times.get(curr_date)
            l_info = leave_day_map.get(curr_date)

            is_working_day = c_day['is_working_day']
            is_before_joining = (emp_joining and curr_date < emp_joining)

            day_status = 'OFF'
            display_day_type = c_day['day_type']
            display_leave_type = '-'
            is_paid_status = '-'
            day_work_hours = 0.0
            day_screen_hours = 0.0
            missing_checkout = False
            missing_screen = False

            if is_before_joining:
                display_day_type = 'PRE_JOINING'
                day_status = 'Pre-Joining'
                if is_working_day:
                    pre_joining_working_days += 1
            elif not is_working_day:
                # Weekend / Holiday
                display_day_type = c_day['day_type']
                day_status = c_day['holiday_title'] or 'Holiday'
                is_paid_status = 'Paid'
                if att and att.working_hours:
                    day_work_hours = float(att.working_hours)
                    total_actual_working_hours += day_work_hours
                if st and st.active_seconds:
                    day_screen_hours = round(st.active_seconds / 3600.0, 2)
                    total_actual_screen_hours += day_screen_hours
            else:
                # Company Working Day within employee tenure
                # 1. Screen Time
                if st and st.active_seconds:
                    day_screen_hours = round(st.active_seconds / 3600.0, 2)
                    total_actual_screen_hours += day_screen_hours
                
                # 2. Check Attendance
                if att:
                    if att.check_in and att.check_out:
                        day_work_hours = float(att.working_hours or 0.0)
                    elif att.check_in and not att.check_out:
                        missing_checkout = True
                        missing_checkout_count += 1
                        day_work_hours = float(att.working_hours or 0.0)

                    total_actual_working_hours += day_work_hours

                    # Evaluate Attendance Status
                    if att.status in [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.WFH]:
                        present_days += 1.0
                        day_status = 'Present' if att.status != AttendanceStatus.LATE else 'Late Arrival'
                        if att.work_mode == AttendanceWorkMode.WFH:
                            day_status = 'WFH Present'
                        display_day_type = 'Working Day'
                        is_paid_status = 'Paid'
                        if day_screen_hours == 0.0 and day_work_hours > 0:
                            missing_screen = True
                            missing_screentime_count += 1

                    elif att.status == AttendanceStatus.HALF_DAY:
                        present_days += 0.5
                        display_day_type = 'Half Day'
                        day_status = 'Half Day'
                        is_paid_status = 'Half Paid'
                        # Remaining 0.5 day
                        if l_info:
                            display_leave_type = l_info['leave_name']
                            if l_info['category'] == 'OPTIONAL':
                                optional_leave_used += 0.5
                            elif l_info['category'] == 'CASUAL':
                                casual_leave_used += 0.5
                            elif l_info['category'] == 'OTHER_PAID':
                                other_paid_leave_used += 0.5
                            else:
                                unpaid_absence_days += 0.5
                        else:
                            unpaid_absence_days += 0.5

                    elif att.status == AttendanceStatus.LEAVE:
                        if l_info:
                            display_leave_type = l_info['leave_name']
                            weight = l_info['leave_weight']
                            if l_info['category'] == 'OPTIONAL':
                                optional_leave_used += weight
                                is_paid_status = 'Paid'
                                day_status = 'Optional Leave'
                                display_day_type = 'Optional Leave'
                            elif l_info['category'] == 'CASUAL':
                                casual_leave_used += weight
                                is_paid_status = 'Paid'
                                day_status = 'Casual Leave'
                                display_day_type = 'Casual Leave'
                            elif l_info['category'] == 'OTHER_PAID':
                                other_paid_leave_used += weight
                                is_paid_status = 'Paid'
                                day_status = 'Paid Leave'
                                display_day_type = 'Other Paid Leave'
                            else:
                                unpaid_absence_days += weight
                                is_paid_status = 'Unpaid'
                                day_status = 'Unpaid Leave'
                                display_day_type = 'Unpaid Absence'
                        else:
                            unpaid_absence_days += 1.0
                            is_paid_status = 'Unpaid'
                            day_status = 'Unpaid Leave'
                            display_day_type = 'Unpaid Absence'

                    elif att.status == AttendanceStatus.ABSENT:
                        unpaid_absence_days += 1.0
                        is_paid_status = 'Unpaid'
                        day_status = 'Absent'
                        display_day_type = 'Unpaid Absence'

                else:
                    # No Attendance record for working day
                    if l_info:
                        display_leave_type = l_info['leave_name']
                        weight = l_info['leave_weight']
                        if l_info['category'] == 'OPTIONAL':
                            optional_leave_used += weight
                            is_paid_status = 'Paid'
                            day_status = 'Optional Leave'
                            display_day_type = 'Optional Leave'
                        elif l_info['category'] == 'CASUAL':
                            casual_leave_used += weight
                            is_paid_status = 'Paid'
                            day_status = 'Casual Leave'
                            display_day_type = 'Casual Leave'
                        elif l_info['category'] == 'OTHER_PAID':
                            other_paid_leave_used += weight
                            is_paid_status = 'Paid'
                            day_status = 'Paid Leave'
                            display_day_type = 'Other Paid Leave'
                        else:
                            unpaid_absence_days += weight
                            is_paid_status = 'Unpaid'
                            day_status = 'Unpaid Leave'
                            display_day_type = 'Unpaid Absence'

                        if weight == 0.5:
                            # If only 0.5 was approved leave and employee didn't attend other 0.5
                            unpaid_absence_days += 0.5
                    else:
                        unpaid_absence_days += 1.0
                        is_paid_status = 'Unpaid'
                        day_status = 'Unpaid Absence'
                        display_day_type = 'Unpaid Absence'

            daily_breakdown.append({
                'date': curr_date.isoformat(),
                'date_formatted': curr_date.strftime('%b %d'),
                'day_name': curr_date.strftime('%A'),
                'day_num': day_num,
                'is_working_day': is_working_day,
                'day_type': display_day_type,
                'check_in': att.check_in.strftime('%H:%M:%S') if att and att.check_in else None,
                'check_out': att.check_out.strftime('%H:%M:%S') if att and att.check_out else None,
                'working_hours': day_work_hours,
                'screen_hours': day_screen_hours,
                'attendance_status': day_status,
                'leave_type': display_leave_type,
                'paid_unpaid': is_paid_status,
                'missing_checkout': missing_checkout,
                'missing_screentime': missing_screen,
            })

        # Summary Metrics
        company_working_days = cal_info['company_working_days']
        total_paid_leave_used = optional_leave_used + casual_leave_used + other_paid_leave_used

        # Working Hours
        expected_working_hours = round(max(0.0, (company_working_days - total_paid_leave_used - pre_joining_working_days) * standard_daily_hours), 2)
        total_actual_working_hours = round(total_actual_working_hours, 2)
        working_hour_difference = round(total_actual_working_hours - expected_working_hours, 2)

        # Screen Time
        expected_screen_time = round(max(0.0, (company_working_days - total_paid_leave_used - pre_joining_working_days) * standard_daily_hours), 2)
        total_actual_screen_hours = round(total_actual_screen_hours, 2)
        screen_time_difference = round(total_actual_screen_hours - expected_screen_time, 2)

        # Average hours per present day
        avg_working_hours_per_present = round((total_actual_working_hours / present_days), 2) if present_days > 0 else 0.0
        avg_screen_time_per_present = round((total_actual_screen_hours / present_days), 2) if present_days > 0 else 0.0

        # Reconciliation Equation: Present + Paid Leave + Unpaid Absence == Working Days
        accounted_days = round(present_days + total_paid_leave_used + unpaid_absence_days, 2)
        expected_tenure_working_days = round(company_working_days - pre_joining_working_days, 2)

        is_reconciled = (abs(accounted_days - expected_tenure_working_days) < 0.01)
        inconsistency_warning = None
        if not is_reconciled:
            inconsistency_warning = (
                f"Data Inconsistency: Present ({present_days}) + Paid Leave ({total_paid_leave_used}) "
                f"+ Unpaid Absence ({unpaid_absence_days}) = {accounted_days} days, "
                f"which does not match Scheduled Working Days ({expected_tenure_working_days})."
            )
        elif pre_joining_working_days > 0:
            inconsistency_warning = f"Note: Employee joined on {emp_joining.strftime('%b %d, %Y')} ({pre_joining_working_days} working days before joining)."

        # Salary Denominator Policy
        policy = settings.salary_denominator_policy or SalaryDenominatorPolicy.EFFECTIVE_WORKING_DAYS
        if policy == SalaryDenominatorPolicy.EFFECTIVE_WORKING_DAYS:
            # Effective Payable Days = Company Working Days - Paid Leave Days
            effective_payable_days = max(1.0, float(company_working_days) - float(total_paid_leave_used))
        elif policy == SalaryDenominatorPolicy.SCHEDULED_WORKING_DAYS:
            effective_payable_days = max(1.0, float(company_working_days))
        elif policy == SalaryDenominatorPolicy.CALENDAR_DAYS:
            effective_payable_days = max(1.0, float(cal_info['total_calendar_days']))
        elif policy == SalaryDenominatorPolicy.FIXED_26:
            effective_payable_days = 26.0
        elif policy == SalaryDenominatorPolicy.FIXED_30:
            effective_payable_days = 30.0
        else:
            effective_payable_days = max(1.0, float(company_working_days) - float(total_paid_leave_used))

        effective_payable_days = round(effective_payable_days, 2)

        # Per-Day Salary = Monthly Salary / Effective Payable Days
        if effective_payable_days > 0 and monthly_salary > 0:
            per_day_salary = (monthly_salary / Decimal(str(effective_payable_days))).quantize(Decimal('0.01'))
        else:
            per_day_salary = Decimal('0.00')

        # Salary Deduction = Unpaid Absence Days * Per-Day Salary
        salary_deduction = (Decimal(str(unpaid_absence_days)) * per_day_salary).quantize(Decimal('0.01'))

        # Salary Payable = Monthly Salary - Salary Deduction (never negative)
        salary_payable = max(Decimal('0.00'), monthly_salary - salary_deduction)

        # Final Attendance Percentage
        attendance_percentage = round((present_days / company_working_days * 100.0), 1) if company_working_days > 0 else 100.0

        # Annual Leave tracking for Employee
        annual_leave_summary = cls.get_employee_annual_leave_summary(employee, year)

        return {
            'employee_id': employee.employee_id,
            'employee_pk': employee.id,
            'employee_name': employee.full_name,
            'email': employee.email,
            'department': employee.department.name if employee.department else 'Unassigned',
            'department_id': employee.department.id if employee.department else None,
            'designation': employee.designation.title if employee.designation else 'Unassigned',
            'profile_photo': employee.profile_photo.url if employee.profile_photo else None,
            'joining_date': employee.joining_date.isoformat() if employee.joining_date else None,
            'month': month,
            'year': year,
            'month_name': cal_info['month_name'],

            # Calendar & Schedule
            'monthly_salary': float(monthly_salary),
            'calendar_days': cal_info['total_calendar_days'],
            'sundays': cal_info['total_sundays'],
            'second_saturdays': cal_info['total_second_saturdays'],
            'company_holidays': cal_info['total_company_holidays'],
            'company_working_days': company_working_days,

            # Attendance & Leave Counts
            'present_days': present_days,
            'optional_leave_used': optional_leave_used,
            'casual_leave_used': casual_leave_used,
            'other_paid_leave_used': other_paid_leave_used,
            'total_paid_leave_used': total_paid_leave_used,
            'unpaid_absence_days': unpaid_absence_days,
            'final_attendance_percentage': attendance_percentage,

            # Work Hours
            'expected_working_hours': expected_working_hours,
            'actual_working_hours': total_actual_working_hours,
            'working_hour_difference': working_hour_difference,
            'avg_working_hours_per_present': avg_working_hours_per_present,

            # Screen Time
            'expected_screen_time': expected_screen_time,
            'actual_screen_time': total_actual_screen_hours,
            'screen_time_difference': screen_time_difference,
            'avg_screen_time_per_present': avg_screen_time_per_present,
            'missing_checkout_count': missing_checkout_count,
            'missing_screentime_count': missing_screentime_count,

            # Salary Math
            'salary_policy': policy,
            'effective_payable_days': effective_payable_days,
            'per_day_salary': float(per_day_salary),
            'salary_deduction': float(salary_deduction),
            'salary_payable': float(salary_payable),

            # Reconciliation
            'is_reconciled': is_reconciled,
            'inconsistency_warning': inconsistency_warning,

            # Annual Leave Balances
            'leave_balances': annual_leave_summary,

            # Daily Breakdown
            'daily_breakdown': daily_breakdown,
        }

    @classmethod
    def get_monthly_company_report(cls, year: int, month: int, department_id=None, search=None):
        """
        Generates aggregate company monthly report across all active employees.
        """
        cal_info = cls.get_month_calendar_info(year, month)

        employees = Employee.objects.filter(
            employment_status=EmploymentStatus.ACTIVE
        ).select_related('department', 'designation', 'salary_record')

        if department_id:
            employees = employees.filter(department_id=department_id)

        if search:
            employees = employees.filter(
                Q(full_name__icontains=search) |
                Q(employee_id__icontains=search) |
                Q(email__icontains=search)
            )

        employee_reports = []
        total_payroll_base = Decimal('0.00')
        total_payroll_payable = Decimal('0.00')
        total_salary_deductions = Decimal('0.00')
        total_present_days = 0.0
        total_paid_leave_days = 0.0
        total_unpaid_absence_days = 0.0
        total_actual_work_hours = 0.0
        total_actual_screen_hours = 0.0
        total_expected_work_hours = 0.0
        reconciled_count = 0
        inconsistent_count = 0

        for emp in employees:
            report = cls.calculate_employee_monthly_report(emp, year, month, cal_info=cal_info)
            employee_reports.append(report)

            total_payroll_base += Decimal(str(report['monthly_salary']))
            total_payroll_payable += Decimal(str(report['salary_payable']))
            total_salary_deductions += Decimal(str(report['salary_deduction']))
            total_present_days += report['present_days']
            total_paid_leave_days += report['total_paid_leave_used']
            total_unpaid_absence_days += report['unpaid_absence_days']
            total_actual_work_hours += report['actual_working_hours']
            total_actual_screen_hours += report['actual_screen_time']
            total_expected_work_hours += report['expected_working_hours']

            if report['is_reconciled']:
                reconciled_count += 1
            else:
                inconsistent_count += 1

        total_employees = len(employee_reports)
        avg_attendance_pct = round(
            sum(r['final_attendance_percentage'] for r in employee_reports) / total_employees, 1
        ) if total_employees > 0 else 0.0

        return {
            'year': year,
            'month': month,
            'month_name': cal_info['month_name'],
            'calendar': {
                'calendar_days': cal_info['total_calendar_days'],
                'sundays': cal_info['total_sundays'],
                'second_saturdays': cal_info['total_second_saturdays'],
                'company_holidays': cal_info['total_company_holidays'],
                'company_working_days': cal_info['company_working_days'],
            },
            'summary': {
                'total_employees': total_employees,
                'avg_attendance_percentage': avg_attendance_pct,
                'total_present_days': round(total_present_days, 1),
                'total_paid_leave_days': round(total_paid_leave_days, 1),
                'total_unpaid_absence_days': round(total_unpaid_absence_days, 1),
                'total_payroll_base': float(total_payroll_base),
                'total_payroll_payable': float(total_payroll_payable),
                'total_salary_deductions': float(total_salary_deductions),
                'total_actual_work_hours': round(total_actual_work_hours, 1),
                'total_expected_work_hours': round(total_expected_work_hours, 1),
                'total_actual_screen_hours': round(total_actual_screen_hours, 1),
                'reconciled_count': reconciled_count,
                'inconsistent_count': inconsistent_count,
            },
            'employees': employee_reports,
        }
