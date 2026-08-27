import sys
import os
import django

# Setup django environment manually to run as a standalone script
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

def create_super_admin():
    User = get_user_model()
    email = 'admin@frgattendance.com'
    password = 'SuperAdminPassword123!'
    
    # Try to fetch existing or create new
    user = User.objects.filter(email=email).first()
    if user:
        user.set_password(password)
        user.role = 'CEO'
        user.is_superuser = True
        user.is_staff = True
        user.save()
        print('SUCCESS: Updated existing admin user')
    else:
        user = User.objects.create_superuser(
            email=email, 
            password=password,
            first_name='Super',
            last_name='Admin'
        )
        user.role = 'CEO'
        user.save()
        print('SUCCESS: Created new admin user')

create_super_admin()
