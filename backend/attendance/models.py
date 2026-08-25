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
    FACE = 'FACE', 'Face Recognition'
    FINGERPRINT = 'FINGERPRINT', 'Fingerprint Biometric'
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
    attendance_method = models.CharField(max_length=20, choices=AttendanceMethod.choices, default=AttendanceMethod.FACE)

    # Verification metadata
    face_verified = models.BooleanField(default=False)
    liveness_verified = models.BooleanField(default=False)
    location_verified = models.BooleanField(default=False)

    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)

    device_id = models.CharField(max_length=50, blank=True, null=True)
    taken_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='recorded_attendances')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['employee', 'date']
        ordering = ['-date', '-check_in']

    def __str__(self):
        return f"{self.employee.full_name} - {self.date} [{self.get_status_display()}]"

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

class Task(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='tasks')
    date = models.DateField(default=timezone.localdate)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    planned_tasks = models.TextField(blank=True, null=True, help_text="What the employee is supposed / planned to do on this date")
    completed_tasks = models.TextField(blank=True, null=True, help_text="What the employee actually accomplished / did on this date")
    blockers = models.TextField(blank=True, null=True, help_text="Blockers or impediments encountered")
    status = models.CharField(max_length=20, choices=[('TODO', 'To Do'), ('IN_PROGRESS', 'In Progress'), ('DONE', 'Done')], default='TODO')
    hours_spent = models.DecimalField(max_digits=4, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.employee.full_name} - {self.title} ({self.status})"
