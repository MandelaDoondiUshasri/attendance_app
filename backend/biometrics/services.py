import os
import hashlib
import logging
from abc import ABC, abstractmethod
from employees.models import Employee, EmploymentStatus
from biometrics.models import FingerprintProfile

logger = logging.getLogger(__name__)

class BaseFaceProvider(ABC):
    @abstractmethod
    def verify_face(self, image_data, employee_id=None):
        """
        Verify face against employee profile.
        Returns: (success: bool, employee: Employee, confidence: float, liveness_passed: bool, error_message: str)
        """
        pass

class BaseFingerprintProvider(ABC):
    @abstractmethod
    def verify_fingerprint(self, biometric_id):
        """
        Verify fingerprint template from dedicated hardware device bridge.
        Returns: (success: bool, employee: Employee, error_message: str)
        """
        pass

    @abstractmethod
    def verify_fingerprint_by_hash(self, template_hash):
        """
        Verify employee identity by matched fingerprint template hash.
        Returns: (success: bool, employee: Employee, error_message: str)
        """
        pass

class MockFaceProvider(BaseFaceProvider):
    def verify_face(self, image_data, employee_id=None):
        if not image_data or len(image_data) < 20:
            return False, None, 0.0, False, "Face not detected. Please position your face clearly in front of the camera."

        # Perform mock liveness check simulation
        # Check if base64 contains valid image marker or mock indicator
        if "invalid" in image_data.lower() or "spoof" in image_data.lower():
            return False, None, 0.45, False, "Liveness verification failed. Photo or video spoof detected."

        if employee_id:
            employee = Employee.objects.filter(employee_id=employee_id, employment_status=EmploymentStatus.ACTIVE).first()
            if not employee:
                return False, None, 0.0, False, f"Employee with ID '{employee_id}' not found or inactive."
        else:
            # Match first active employee with enrolled face profile or default demo employee
            employee = Employee.objects.filter(employment_status=EmploymentStatus.ACTIVE).first()
            if not employee:
                return False, None, 0.0, False, "No active employee found for face matching."

        # High confidence match
        return True, employee, 0.98, True, None

class MockFingerprintProvider(BaseFingerprintProvider):
    def verify_fingerprint(self, biometric_id):
        if not biometric_id:
            return False, None, "Fingerprint template missing or invalid."

        employee = Employee.objects.filter(biometric_id=biometric_id, employment_status=EmploymentStatus.ACTIVE).first()
        if not employee:
            # Fallback search by employee_id if biometric_id matches employee_id
            employee = Employee.objects.filter(employee_id=biometric_id, employment_status=EmploymentStatus.ACTIVE).first()

        if not employee:
            return False, None, f"Fingerprint verification failed. No employee found for Biometric ID '{biometric_id}'."

        return True, employee, None

    def verify_fingerprint_by_hash(self, template_hash):
        if not template_hash:
            return False, None, "Fingerprint template missing or invalid."

        profile = FingerprintProfile.objects.filter(
            template_hash=template_hash, 
            employee__employment_status=EmploymentStatus.ACTIVE
        ).first()

        if not profile:
            return False, None, "Fingerprint verification failed. No matching employee enrolled with this fingerprint."

        return True, profile.employee, None

# Provider Factory
def get_face_provider():
    provider_name = os.getenv('FACE_PROVIDER', 'mock').lower()
    if provider_name == 'real':
        # Pluggable for RealFaceProvider SDK integration
        raise NotImplementedError("RealFaceProvider hardware SDK requires proprietary API credentials in .env")
    return MockFaceProvider()

def get_fingerprint_provider():
    return MockFingerprintProvider()
