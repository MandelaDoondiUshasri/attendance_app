from django.db import models
from django.conf import settings
from django.utils import timezone
from employees.models import Employee

class AttendanceStatus(models.TextChoices):
    PRESENT = 'PRESENT', 'Present'
    LATE = 'LATE', 'Late Arrival'
    HALF_DAY = 'HALF_DAY', 'Half Day'
    ABSENT = 'ABSENT', 'Absent'
    LEAVE = 'LEAVE', 'On Leave'
    WFH = 'WFH', 'Work From Home'

class AttendanceWorkMode(models.TextChoices):
    OFFICE = 'OFFICE', 'Office'
    WFH = 'WFH', 'Work From Home'

class AttendanceMethod(models.TextChoices):
    MANUAL_CORRECTION = 'MANUAL_CORRECTION', 'Manual Correction'
    WEB_PORTAL = 'WEB_PORTAL', 'Web Portal Clock'

class CorrectionStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'

class Attendance(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='attendances')
    date = models.DateField(db_index=True)
    check_in = models.DateTimeField(db_index=True)
    check_out = models.DateTimeField(blank=True, null=True)
    working_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=AttendanceStatus.choices, default=AttendanceStatus.PRESENT)
    work_mode = models.CharField(max_length=20, choices=AttendanceWorkMode.choices, default=AttendanceWorkMode.OFFICE)
    attendance_method = models.CharField(max_length=20, choices=AttendanceMethod.choices, default=AttendanceMethod.WEB_PORTAL)

    # Verification metadata
    location_verified = models.BooleanField(default=False)

    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)

    device_id = models.CharField(max_length=50, blank=True, null=True)
    taken_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='recorded_attendances')

    # Submission status
    is_submitted = models.BooleanField(default=False)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='submitted_attendances')
    submitted_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['employee', 'date']
        ordering = ['-date', '-check_in']

    @property
    def early_pass(self):
        return self.early_passes.order_by('-created_at').first()

    @property
    def has_approved_early_pass(self):
        ep = self.early_pass
        return bool(ep and ep.status == 'APPROVED')

    @property
    def has_pending_early_pass(self):
        ep = self.early_pass
        return bool(ep and ep.status == 'PENDING')

    def get_display_status(self):
        ep = self.early_pass
        if ep:
            if ep.status == 'APPROVED':
                return 'Present – Approved Early Exit'
            elif ep.status == 'PENDING' and self.check_out:
                return 'Early Exit – Approval Pending'
        return self.get_status_display()

    def __str__(self):
        return f"{self.employee.full_name} - {self.date} [{self.get_display_status()}]"

class AttendanceCorrectionRequest(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='correction_requests')
    date = models.DateField()
    attendance = models.ForeignKey(Attendance, on_delete=models.SET_NULL, null=True, blank=True, related_name='corrections')
    original_check_in = models.DateTimeField(blank=True, null=True)
    original_check_out = models.DateTimeField(blank=True, null=True)
    requested_check_in = models.DateTimeField()
    requested_check_out = models.DateTimeField(blank=True, null=True)
    reason = models.TextField()
    attachment = models.FileField(upload_to='corrections/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=CorrectionStatus.choices, default=CorrectionStatus.PENDING)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_corrections')
    rejection_reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Correction Request: {self.employee.full_name} ({self.date})"

class ShiftReport(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='shift_reports')
    date = models.DateField(default=timezone.localdate)
    report_content = models.TextField(help_text="Detailed report of the employee's work for the day")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']
        unique_together = ['employee', 'date']

    def __str__(self):
        return f"Report: {self.employee.full_name} - {self.date}"

class FestivalType(models.TextChoices):
    GENERAL = 'GENERAL', 'General Holiday'
    OPTIONAL = 'OPTIONAL', 'Optional Festival Leave'

class FestivalHoliday(models.Model):
    name = models.CharField(max_length=100)
    date = models.DateField(unique=True)
    festival_type = models.CharField(max_length=20, choices=FestivalType.choices, default=FestivalType.GENERAL)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['date']
        
    def __str__(self):
        return f"{self.name} ({self.date}) - {self.get_festival_type_display()}"

class DailyAttendanceSubmission(models.Model):
    department = models.ForeignKey('employees.Department', on_delete=models.CASCADE, related_name='daily_submissions')
    date = models.DateField(db_index=True)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='dept_attendance_submissions')
    submitted_at = models.DateTimeField(auto_now_add=True)
    total_workers = models.PositiveIntegerField(default=0)
    present_count = models.PositiveIntegerField(default=0)
    absent_count = models.PositiveIntegerField(default=0)
    late_count = models.PositiveIntegerField(default=0)
    leave_count = models.PositiveIntegerField(default=0)
    half_day_count = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ['department', 'date']
        ordering = ['-date', '-submitted_at']

    def __str__(self):
        return f"{self.department.name} Attendance Submission - {self.date}"

class BreakType(models.TextChoices):
    LUNCH = 'LUNCH', 'Lunch Break'
    TEA = 'TEA', 'Tea Break'
    GENERAL = 'GENERAL', 'General Break'

class AttendanceBreak(models.Model):
    employee = models.ForeignKey('employees.Employee', on_delete=models.CASCADE, related_name='breaks')
    attendance = models.ForeignKey(Attendance, on_delete=models.CASCADE, null=True, blank=True, related_name='breaks')
    break_type = models.CharField(max_length=20, choices=BreakType.choices, default=BreakType.LUNCH)
    start_time = models.DateTimeField(db_index=True)
    end_time = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)
    initiated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='initiated_breaks')
    notes = models.CharField(max_length=255, blank=True, null=True)

    resume_latitude = models.FloatField(null=True, blank=True)
    resume_longitude = models.FloatField(null=True, blank=True)
    resume_distance_meters = models.FloatField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_time']

    def end_break(self, end_dt=None, resume_lat=None, resume_lng=None, distance=None):
        if not self.is_active:
            return
        self.end_time = end_dt or timezone.now()
        self.is_active = False
        duration = (self.end_time - self.start_time).total_seconds() / 60.0
        self.duration_minutes = max(0, int(round(duration)))
        if resume_lat is not None:
            self.resume_latitude = resume_lat
        if resume_lng is not None:
            self.resume_longitude = resume_lng
        if distance is not None:
            self.resume_distance_meters = distance
        self.save()

    def __str__(self):
        return f"{self.employee.full_name} - {self.get_break_type_display()} ({'Active' if self.is_active else 'Completed'})"


class MaintenanceGeofence(models.Model):
    department = models.OneToOneField('employees.Department', on_delete=models.CASCADE, null=True, blank=True, related_name='geofence_setting')
    site_name = models.CharField(max_length=150, default="Maintenance Worksite")
    latitude = models.FloatField(default=17.385044)
    longitude = models.FloatField(default=78.486671)
    radius_meters = models.PositiveIntegerField(default=100, help_text="Allowed radius in meters")
    is_active = models.BooleanField(default=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_geofences')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def calculate_distance_meters(self, user_lat, user_lng):
        """
        Calculates the great-circle distance between the worksite center and a given point using the Haversine formula.
        """
        if user_lat is None or user_lng is None:
            return float('inf')

        try:
            u_lat = float(user_lat)
            u_lng = float(user_lng)
        except (ValueError, TypeError):
            return float('inf')

        import math
        earth_radius = 6371000.0  # Earth's radius in meters
        phi1 = math.radians(self.latitude)
        phi2 = math.radians(u_lat)
        delta_phi = math.radians(u_lat - self.latitude)
        delta_lambda = math.radians(u_lng - self.longitude)

        a = math.sin(delta_phi / 2.0) ** 2 + \
            math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return earth_radius * c

    def is_inside_geofence(self, user_lat, user_lng):
        """
        Returns (is_inside: bool, distance_meters: float, allowed_radius: int)
        """
        if not self.is_active:
            return True, 0.0, self.radius_meters

        dist = self.calculate_distance_meters(user_lat, user_lng)
        return (dist <= self.radius_meters), dist, self.radius_meters

    def __str__(self):
        return f"{self.site_name} Geofence ({self.latitude}, {self.longitude}, {self.radius_meters}m)"


class EarlyPassStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'
    CANCELLED = 'CANCELLED', 'Cancelled'


class EarlyPassRequest(models.Model):
    """
    EarlyPass allows employees to leave work before completing the standard working hours (e.g. 8h)
    without salary deduction, subject to approval from authorized CEO or HR.
    Preserves actual attendance hours while marking an approved payroll exception.
    """
    pass_reference = models.CharField(max_length=64, unique=True, db_index=True)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='early_pass_requests')
    attendance = models.ForeignKey(Attendance, on_delete=models.SET_NULL, null=True, blank=True, related_name='early_passes')
    request_date = models.DateField(db_index=True)
    check_in_time = models.DateTimeField(null=True, blank=True)
    requested_exit_time = models.DateTimeField()
    actual_exit_time = models.DateTimeField(null=True, blank=True)

    required_hours = models.DecimalField(max_digits=4, decimal_places=2, default=8.00)
    actual_working_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    missing_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)

    reason = models.TextField()
    remarks = models.TextField(blank=True, default='')
    attachment = models.FileField(upload_to='early_pass/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=EarlyPassStatus.choices, default=EarlyPassStatus.PENDING, db_index=True)

    # Review metadata & audit
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_early_passes')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='rejected_early_passes')
    rejected_at = models.DateTimeField(null=True, blank=True)
    approval_remarks = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-request_date', '-created_at']

    def save(self, *args, **kwargs):
        if not self.pass_reference:
            month_str = self.request_date.strftime('%Y%m') if self.request_date else timezone.now().strftime('%Y%m')
            count = EarlyPassRequest.objects.filter(
                request_date__year=self.request_date.year,
                request_date__month=self.request_date.month
            ).count() + 1
            self.pass_reference = f"EP-{month_str}-{count:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.pass_reference} - {self.employee.full_name} ({self.request_date}) [{self.get_status_display()}]"


class EarlyPassAuditLog(models.Model):
    """
    Audit log tracking all state transitions and management actions on EarlyPass requests.
    """
    early_pass = models.ForeignKey(EarlyPassRequest, on_delete=models.CASCADE, related_name='audit_trails')
    action = models.CharField(max_length=50)  # SUBMITTED, APPROVED, REJECTED, CANCELLED
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='early_pass_audits')
    actor_name = models.CharField(max_length=150, blank=True)
    actor_role = models.CharField(max_length=50, blank=True)
    previous_status = models.CharField(max_length=20, blank=True, null=True)
    new_status = models.CharField(max_length=20)
    remarks = models.TextField(blank=True, default='')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.timestamp.strftime('%Y-%m-%d %H:%M')}] {self.early_pass.pass_reference}: {self.previous_status} -> {self.new_status} by {self.actor_name}"



