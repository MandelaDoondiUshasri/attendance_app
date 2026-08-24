from django.db import models
from employees.models import Employee

class DeviceType(models.TextChoices):
    FACE = 'FACE', 'Face Recognition Terminal'
    FINGERPRINT = 'FINGERPRINT', 'Fingerprint Biometric Device'

class FaceProfile(models.Model):
    employee = models.OneToOneField(Employee, on_delete=models.CASCADE, related_name='face_profile')
    template_hash = models.TextField(help_text="Secure hash/embedding of face biometric features")
    liveness_enrolled = models.BooleanField(default=True)
    enrolled_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"FaceProfile: {self.employee.full_name}"

class FingerprintProfile(models.Model):
    employee = models.OneToOneField(Employee, on_delete=models.CASCADE, related_name='fingerprint_profile')
    template_hash = models.TextField(help_text="Secure hash/embedding of fingerprint biometric features")
    enrolled_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"FingerprintProfile: {self.employee.full_name}"

class BiometricDevice(models.Model):
    device_id = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    device_type = models.CharField(max_length=20, choices=DeviceType.choices, default=DeviceType.FACE)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    is_online = models.BooleanField(default=True)
    location_name = models.CharField(max_length=100, default='Main Office Entrance')
    last_sync = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.device_id}) - {self.get_device_type_display()}"
