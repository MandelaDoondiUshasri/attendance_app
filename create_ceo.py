import sys
from django.contrib.auth import get_user_model

def create_or_update_ceo():
    try:
        User = get_user_model()
        ceo_accounts = [
            {
                'email': 'nani.reddy225@gmail.com',
                'password': 'Mypswd@225',
                'first_name': 'Nani',
                'last_name': 'Reddy',
            },
            {
                'email': 'ceo@frgattendance.com',
                'password': 'Password123!',
                'first_name': 'CEO',
                'last_name': 'User',
            }
        ]

        for acc in ceo_accounts:
            email = acc['email']
            password = acc['password']
            user = User.objects.filter(email=email).first()
            if user:
                user.set_password(password)
                user.role = 'CEO'
                user.is_staff = True
                user.is_superuser = True
                user.is_active = True
                user.save()
                print(f'SUCCESS: Updated existing CEO user ({email})')
            else:
                user = User.objects.create_superuser(
                    email=email,
                    password=password,
                    first_name=acc['first_name'],
                    last_name=acc['last_name'],
                    role='CEO'
                )
                user.save()
                print(f'SUCCESS: Created new CEO user ({email})')
    except Exception as e:
        print(f'ERROR: {e}')

create_or_update_ceo()
