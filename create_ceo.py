import sys
from django.contrib.auth import get_user_model

def create_or_update_ceo():
    try:
        User = get_user_model()
        email = 'ceo@frgattendance.com'
        password = 'Password123!'
        
        user = User.objects.filter(email=email).first()
        if user:
            user.set_password(password)
            user.role = 'CEO'
            user.save()
            print('SUCCESS: Updated existing CEO user')
        else:
            user = User.objects.create_superuser(email=email, password=password)
            user.role = 'CEO'
            user.first_name = 'CEO'
            user.last_name = 'User'
            user.save()
            print('SUCCESS: Created new CEO user')
    except Exception as e:
        print(f'ERROR: {e}')

create_or_update_ceo()
