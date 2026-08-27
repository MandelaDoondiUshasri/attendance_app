from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager

class Role(models.TextChoices):
    SYSTEM_ADMIN = 'SYSTEM_ADMIN', 'System Admin'
    CEO = 'CEO', 'CEO'
    HR = 'HR', 'HR / Admin'
    EMPLOYEE = 'EMPLOYEE', 'Employee'

class UserManager(BaseUserManager):
    def create_user(self, email, username=None, password=None, role=Role.EMPLOYEE, **extra_fields):
        if not email:
            raise ValueError('Email address is required')
        email = self.normalize_email(email)
        username = username or email.split('@')[0]
        extra_fields.setdefault('role', role)
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username=None, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', Role.CEO)
        return self.create_user(email, username, password, **extra_fields)

class User(AbstractUser):
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=20, null=True, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    role = models.CharField(max_length=25, choices=Role.choices, default=Role.EMPLOYEE, db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return f"{self.email} ({self.get_role_display()})"

    @property
    def is_ceo(self):
        return self.role in [Role.CEO, Role.SYSTEM_ADMIN]

    @property
    def is_hr(self):
        return self.role in [Role.CEO, Role.HR, Role.SYSTEM_ADMIN]
