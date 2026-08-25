from datetime import datetime, time
from django.utils import timezone
from attendance.models import Attendance, AttendanceStatus, AttendanceWorkMode
from leaves.models import LeaveRequest, LeaveStatus
from wfh.models import WFHRequest, WFHStatus
from core.models import OrganizationSettings

class AttendanceEngine:
    @staticmethod
    def calculate_status(check_in_dt, work_mode=AttendanceWorkMode.OFFICE):
        if work_mode == AttendanceWorkMode.WFH:
            return AttendanceStatus.WFH

        settings = OrganizationSettings.get_settings()
        office_start_str = settings.office_start_time # e.g. "09:00"
        grace_mins = settings.grace_period_minutes # e.g. 15

        start_h, start_m = map(int, office_start_str.split(':'))
        check_in_time = check_in_dt.time()

        # Calculate threshold time with grace period
        threshold_m = start_m + grace_mins
        threshold_h = start_h + (threshold_m // 60)
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
        req_hours = float(settings.required_working_hours)
        hd_threshold = float(settings.half_day_threshold_hours)

        # If the employee is half-day, scale the thresholds by half
        if attendance.employee.is_half_day:
            req_hours = req_hours / 2.0
            hd_threshold = hd_threshold / 2.0

        hours = float(attendance.working_hours)

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
    def check_wfh_approval(employee, date_val):
        """Returns True if employee has an APPROVED WFH request for this date."""
        return WFHRequest.objects.filter(
            employee=employee,
            status=WFHStatus.APPROVED,
            date=date_val
        ).exists()
