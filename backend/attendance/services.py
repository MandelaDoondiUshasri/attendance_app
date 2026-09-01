import calendar
from datetime import datetime, time, timedelta, date
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Q
from attendance.models import Attendance, AttendanceStatus, AttendanceWorkMode
from leaves.models import LeaveRequest, LeaveStatus
from wfh.models import WFHRequest, WFHStatus
from core.models import OrganizationSettings, Holiday


class HolidayEngine:
    """
    Unified holiday and weekend calculation engine.
    - All Sundays of every month are mandatory holidays.
    - Every 2nd Saturday of each month (Saturdays falling on days 8–14) is a mandatory holiday.
    - Official database holidays from OrganizationSettings / Holiday model.
    """

    @staticmethod
    def is_second_saturday(date_val):
        d = date_val.date() if hasattr(date_val, 'date') and callable(date_val.date) else date_val
        # Python weekday: Monday=0 ... Saturday=5, Sunday=6
        # 2nd Saturday always falls between 8th and 14th day of any month
        return d.weekday() == 5 and (8 <= d.day <= 14)

    @staticmethod
    def is_sunday(date_val):
        d = date_val.date() if hasattr(date_val, 'date') and callable(date_val.date) else date_val
        return d.weekday() == 6

    @classmethod
    def get_holiday_info(cls, date_val):
        """
        Returns (is_holiday: bool, title: str | None, holiday_type: str | None)
        """
        d = date_val.date() if hasattr(date_val, 'date') and callable(date_val.date) else date_val

        if cls.is_sunday(d):
            return True, "Sunday (Weekly Off)", "WEEKEND_HOLIDAY"

        if cls.is_second_saturday(d):
            return True, "2nd Saturday (Mandatory Holiday)", "WEEKEND_HOLIDAY"

        db_holiday = Holiday.objects.filter(date=d).first()
        if db_holiday:
            return True, db_holiday.title, "OFFICIAL_HOLIDAY"

        return False, None, None


class AttendanceEngine:
    @staticmethod
    def get_required_working_hours(employee):
        """
        Returns expected daily working hours (e.g. 8.0h for full-day, 4.0h for half-day employees).
        """
        settings = OrganizationSettings.get_settings()
        if employee and getattr(employee, 'is_half_day', False):
            return float(settings.half_day_threshold_hours or 4.0)
        return float(settings.required_working_hours or 8.0)

    @staticmethod
    def calculate_status(check_in_dt, work_mode=AttendanceWorkMode.OFFICE):
        if work_mode == AttendanceWorkMode.WFH:
            return AttendanceStatus.WFH

        settings = OrganizationSettings.get_settings()
        office_start_str = str(settings.office_start_time or "09:00")

        try:
            parts = office_start_str.split(':')
            start_h = int(parts[0]) if len(parts) > 0 else 9
            start_m = int(parts[1]) if len(parts) > 1 else 0
        except Exception:
            start_h, start_m = 9, 0

        check_in_time = check_in_dt.time()
        start_time = time(start_h, start_m)

        if check_in_time > start_time:
            return AttendanceStatus.LATE
        return AttendanceStatus.PRESENT

    @staticmethod
    def calculate_working_hours(check_in_dt, check_out_dt):
        if not check_in_dt or not check_out_dt:
            return 0.00
        duration = check_out_dt - check_in_dt
        hours = duration.total_seconds() / 3600.0
        return round(hours, 2)

    @staticmethod
    def calculate_final_status(attendance):
        if attendance.status == AttendanceStatus.LEAVE:
            return AttendanceStatus.LEAVE

        settings = OrganizationSettings.get_settings()
        req_hours = AttendanceEngine.get_required_working_hours(attendance.employee)
        hd_threshold = float(settings.half_day_threshold_hours or 4.0)

        if attendance.employee.is_half_day:
            hd_threshold = req_hours / 2.0

        hours = float(attendance.working_hours or 0.0)

        if hours < hd_threshold:
            return AttendanceStatus.ABSENT
        elif hours < req_hours:
            return AttendanceStatus.HALF_DAY
        else:
            if attendance.status == AttendanceStatus.WFH:
                return AttendanceStatus.WFH
            if attendance.status == AttendanceStatus.LATE:
                return AttendanceStatus.LATE
            return AttendanceStatus.PRESENT

    @staticmethod
    def check_leave_conflict(employee, date_val):
        """Returns True if employee has an APPROVED leave request for this date."""
        return LeaveRequest.objects.filter(
            employee=employee,
            status=LeaveStatus.APPROVED,
            start_date__lte=date_val,
            end_date__gte=date_val
        ).exists()

    @staticmethod
    def get_approved_leave_for_date(employee, date_val):
        """Returns the LeaveRequest instance if employee has an approved leave today."""
        return LeaveRequest.objects.filter(
            employee=employee,
            status=LeaveStatus.APPROVED,
            start_date__lte=date_val,
            end_date__gte=date_val
        ).select_related('leave_type').first()

    @staticmethod
    def check_wfh_approval(employee, date_val):
        """Returns True if employee has an APPROVED WFH request for this date."""
        return WFHRequest.objects.filter(
            employee=employee,
            status=WFHStatus.APPROVED,
            start_date__lte=date_val,
            end_date__gte=date_val
        ).exists()


class MonthlyWorkingHoursEngine:
    """
    Dynamically calculates monthly expected and actual working hours for an employee.
    
    Expected hours are based on:
    - Actual calendar days in the month
    - Excluding Sundays (dynamically counted)
    - Excluding 2nd Saturdays (via HolidayEngine)
    - Excluding company-declared holidays (from core.Holiday model)
    - Excluding approved full-day leaves (reduces expected by 8 hours each)
    - Half-day leaves reduce expected by 4 hours each
    
    Actual hours come from the sum of Attendance.working_hours records.
    """

    STANDARD_DAILY_HOURS = 8.0
    HALF_DAY_HOURS = 4.0

    @classmethod
    def get_month_calendar_info(cls, year, month):
        """
        Iterates through every day of the given month and classifies each day.
        Returns a dict with aggregate counts and a per-day list.
        """
        _, num_days = calendar.monthrange(year, month)

        total_sundays = 0
        total_weekend_holidays = 0  # 2nd Saturdays
        total_company_holidays = 0
        working_days = 0
        day_details = []

        for day_num in range(1, num_days + 1):
            curr_date = date(year, month, day_num)
            is_holiday, holiday_title, holiday_type = HolidayEngine.get_holiday_info(curr_date)

            day_info = {
                'date': curr_date.isoformat(),
                'day_name': curr_date.strftime('%A'),
                'day_num': day_num,
                'is_working_day': True,
                'is_sunday': False,
                'is_weekend_holiday': False,
                'is_company_holiday': False,
                'holiday_title': None,
            }

            if HolidayEngine.is_sunday(curr_date):
                day_info['is_sunday'] = True
                day_info['is_working_day'] = False
                day_info['holiday_title'] = 'Sunday (Weekly Off)'
                total_sundays += 1
            elif is_holiday and holiday_type == "WEEKEND_HOLIDAY":
                day_info['is_weekend_holiday'] = True
                day_info['is_working_day'] = False
                day_info['holiday_title'] = holiday_title
                total_weekend_holidays += 1
            elif is_holiday and holiday_type == "OFFICIAL_HOLIDAY":
                day_info['is_company_holiday'] = True
                day_info['is_working_day'] = False
                day_info['holiday_title'] = holiday_title
                total_company_holidays += 1

            if day_info['is_working_day']:
                working_days += 1

            day_details.append(day_info)

        return {
            'year': year,
            'month': month,
            'total_calendar_days': num_days,
            'total_sundays': total_sundays,
            'total_weekend_holidays': total_weekend_holidays,
            'total_company_holidays': total_company_holidays,
            'total_working_days': working_days,
            'day_details': day_details,
        }

    @classmethod
    def get_employee_leaves_in_month(cls, employee, year, month):
        """
        Returns approved leaves for the employee that overlap with the given month.
        Calculates full-day and half-day leave counts within the month boundaries.
        """
        _, num_days = calendar.monthrange(year, month)
        month_start = date(year, month, 1)
        month_end = date(year, month, num_days)

        approved_leaves = LeaveRequest.objects.filter(
            employee=employee,
            status=LeaveStatus.APPROVED,
        ).filter(
            Q(start_date__lte=month_end) & Q(end_date__gte=month_start)
        ).select_related('leave_type')

        full_day_leave_dates = set()
        half_day_leave_dates = set()

        for leave in approved_leaves:
            # Clamp leave range to this month
            effective_start = max(leave.start_date, month_start)
            effective_end = min(leave.end_date, month_end)

            curr = effective_start
            while curr <= effective_end:
                # Only count leaves on actual working days
                is_holiday, _, _ = HolidayEngine.get_holiday_info(curr)
                if not is_holiday:
                    if leave.is_half_day:
                        half_day_leave_dates.add(curr)
                    else:
                        full_day_leave_dates.add(curr)
                curr += timedelta(days=1)

        # If a date appears in both full and half, full takes precedence
        half_day_leave_dates -= full_day_leave_dates

        return {
            'full_day_leave_dates': full_day_leave_dates,
            'half_day_leave_dates': half_day_leave_dates,
            'total_full_day_leaves': len(full_day_leave_dates),
            'total_half_day_leaves': len(half_day_leave_dates),
            'leave_records': list(approved_leaves),
        }

    @classmethod
    def get_employee_actual_hours(cls, employee, year, month):
        """
        Sums the actual working_hours from Attendance records for the employee in the given month.
        """
        result = Attendance.objects.filter(
            employee=employee,
            date__year=year,
            date__month=month,
        ).aggregate(total_hours=Sum('working_hours'))

        return float(result['total_hours'] or 0.0)

    @classmethod
    def get_employee_attendance_map(cls, employee, year, month):
        """
        Returns a dict mapping date -> Attendance record for the employee in the given month.
        """
        attendances = Attendance.objects.filter(
            employee=employee,
            date__year=year,
            date__month=month,
        ).order_by('date')

        return {att.date: att for att in attendances}

    @classmethod
    def get_monthly_summary(cls, employee, year, month):
        """
        Comprehensive monthly working hours summary for an employee.
        
        Returns a dict with:
        - Calendar info (days, sundays, holidays)
        - Leave info (full-day, half-day)
        - Expected vs actual working hours
        - Extra/short hours
        - Per-day breakdown
        """
        # 1. Get calendar info for the month
        cal_info = cls.get_month_calendar_info(year, month)

        # 2. Get employee leave info
        leave_info = cls.get_employee_leaves_in_month(employee, year, month)

        # 3. Calculate expected working days and hours
        scheduled_working_days = cal_info['total_working_days']
        full_day_leaves = leave_info['total_full_day_leaves']
        half_day_leaves = leave_info['total_half_day_leaves']

        expected_working_days = scheduled_working_days - full_day_leaves
        expected_working_hours = (expected_working_days * cls.STANDARD_DAILY_HOURS) - (half_day_leaves * cls.HALF_DAY_HOURS)

        # 4. Get actual working hours
        actual_working_hours = round(cls.get_employee_actual_hours(employee, year, month), 2)

        # 5. Calculate extra/short hours
        extra_hours = round(actual_working_hours - expected_working_hours, 2)

        # 6. Build per-day breakdown
        att_map = cls.get_employee_attendance_map(employee, year, month)
        daily_breakdown = []

        for day_info in cal_info['day_details']:
            day_date = date.fromisoformat(day_info['date'])
            att = att_map.get(day_date)

            day_record = {
                'date': day_info['date'],
                'day_name': day_info['day_name'],
                'actual_hours': round(float(att.working_hours or 0.0), 2) if att else 0.0,
                'check_in': att.check_in.isoformat() if att and att.check_in else None,
                'check_out': att.check_out.isoformat() if att and att.check_out else None,
                'status': att.status if att else None,
                'expected_hours': 0.0,
                'daily_extra': 0.0,
                'day_type': 'WORKING',
            }

            # Determine day type and expected hours
            if day_info['is_sunday']:
                day_record['day_type'] = 'SUNDAY'
                day_record['expected_hours'] = 0.0
            elif day_info['is_weekend_holiday']:
                day_record['day_type'] = 'WEEKEND_HOLIDAY'
                day_record['expected_hours'] = 0.0
            elif day_info['is_company_holiday']:
                day_record['day_type'] = 'COMPANY_HOLIDAY'
                day_record['holiday_title'] = day_info['holiday_title']
                day_record['expected_hours'] = 0.0
            elif day_date in leave_info['full_day_leave_dates']:
                day_record['day_type'] = 'FULL_DAY_LEAVE'
                day_record['expected_hours'] = 0.0
            elif day_date in leave_info['half_day_leave_dates']:
                day_record['day_type'] = 'HALF_DAY_LEAVE'
                day_record['expected_hours'] = cls.HALF_DAY_HOURS
            else:
                day_record['day_type'] = 'WORKING'
                day_record['expected_hours'] = cls.STANDARD_DAILY_HOURS

            # Calculate daily extra/short
            day_record['daily_extra'] = round(day_record['actual_hours'] - day_record['expected_hours'], 2)

            daily_breakdown.append(day_record)

        return {
            # Calendar info
            'year': year,
            'month': month,
            'month_name': calendar.month_name[month],
            'total_calendar_days': cal_info['total_calendar_days'],
            'total_sundays': cal_info['total_sundays'],
            'total_weekend_holidays': cal_info['total_weekend_holidays'],
            'total_company_holidays': cal_info['total_company_holidays'],
            'total_scheduled_working_days': scheduled_working_days,

            # Leave info
            'total_full_day_leaves': full_day_leaves,
            'total_half_day_leaves': half_day_leaves,
            'total_leave_days': full_day_leaves + (half_day_leaves * 0.5),

            # Working hours
            'expected_working_days': expected_working_days,
            'expected_working_hours': expected_working_hours,
            'actual_working_hours': actual_working_hours,
            'extra_hours': extra_hours,

            # Per-day breakdown
            'daily_breakdown': daily_breakdown,
        }
