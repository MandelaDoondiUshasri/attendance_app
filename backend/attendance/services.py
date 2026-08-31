from datetime import datetime, time, timedelta, date
from django.utils import timezone
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
        Returns exact required shift duration in hours (e.g. 8.0h for full-day, 4.0h for half-day).
        """
        settings = OrganizationSettings.get_settings()
        if employee and getattr(employee, 'is_half_day', False):
            return float(settings.half_day_threshold_hours or 4.0)
        return float(settings.required_working_hours or 8.0)

    @staticmethod
    def get_clock_out_unlock_time(attendance):
        """
        Returns the exact datetime when the employee is eligible to clock out.
        Unlock Time = check_in + required_working_hours
        """
        if not attendance or not attendance.check_in:
            return None
        req_hours = AttendanceEngine.get_required_working_hours(attendance.employee)
        return attendance.check_in + timedelta(hours=req_hours)

    @staticmethod
    def can_clock_out(attendance, now=None):
        """
        Determines whether the employee has met the shift duration and can clock out.
        Returns: (can_clock_out: bool, unlock_time: datetime, remaining_seconds: int, required_hours: float)
        """
        if not attendance or not attendance.check_in:
            return False, None, 0, 8.0

        now = now or timezone.now()
        req_hours = AttendanceEngine.get_required_working_hours(attendance.employee)
        unlock_time = attendance.check_in + timedelta(hours=req_hours)

        if now >= unlock_time:
            return True, unlock_time, 0, req_hours
        
        remaining_seconds = max(0, int((unlock_time - now).total_seconds()))
        return False, unlock_time, remaining_seconds, req_hours

    @staticmethod
    def calculate_status(check_in_dt, work_mode=AttendanceWorkMode.OFFICE):
        if work_mode == AttendanceWorkMode.WFH:
            return AttendanceStatus.WFH

        settings = OrganizationSettings.get_settings()
        office_start_str = str(settings.office_start_time or "09:00")
        grace_mins = int(settings.grace_period_minutes or 15)

        try:
            parts = office_start_str.split(':')
            start_h = int(parts[0]) if len(parts) > 0 else 9
            start_m = int(parts[1]) if len(parts) > 1 else 0
        except Exception:
            start_h, start_m = 9, 0

        check_in_time = check_in_dt.time()

        # Calculate threshold time with grace period for late mark
        threshold_m = start_m + grace_mins
        threshold_h = (start_h + (threshold_m // 60)) % 24
        threshold_m = threshold_m % 60
        threshold_time = time(threshold_h, threshold_m)

        if check_in_time > threshold_time:
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
            date=date_val
        ).exists()
