import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client
from accounts.models import User, Role
from employees.models import Department, Designation, Employee, EmploymentStatus, WorkMode
from attendance.models import Attendance, AttendanceStatus
from rest_framework_simplejwt.tokens import RefreshToken
import json
from datetime import date

def run_tests():
    print("=== STARTING SUPERVISOR & MAINTENANCE BACKEND VERIFICATION ===")

    # 1. Setup departments
    maint_dept, _ = Department.objects.get_or_create(name='Maintenance', defaults={'code': 'MAINT'})
    hr_dept, _ = Department.objects.get_or_create(name='Human Resources', defaults={'code': 'HR'})
    eng_dept, _ = Department.objects.get_or_create(name='Engineering', defaults={'code': 'ENG'})

    # 2. Setup Supervisor user
    sup_user, _ = User.objects.get_or_create(
        email='test_supervisor@frg.com',
        defaults={'role': Role.SUPERVISOR, 'username': 'test_supervisor'}
    )
    sup_user.role = Role.SUPERVISOR
    sup_user.set_password('Password123!')
    sup_user.save()

    sup_emp, _ = Employee.objects.get_or_create(
        user=sup_user,
        defaults={
            'employee_id': 'SUP-TEST-001',
            'full_name': 'Test Supervisor',
            'email': 'test_supervisor@frg.com',
            'department': maint_dept,
            'joining_date': date(2025, 1, 1),
            'work_mode': WorkMode.OFFICE,
            'employment_status': EmploymentStatus.ACTIVE
        }
    )
    sup_emp.department = maint_dept
    sup_emp.save()

    # 3. Setup HR user
    hr_user, _ = User.objects.get_or_create(
        email='test_hr@frg.com',
        defaults={'role': Role.HR, 'username': 'test_hr'}
    )
    hr_user.set_password('Password123!')
    hr_user.save()

    # 4. Setup Employees in different departments
    # Worker in Maintenance
    maint_worker_user, _ = User.objects.get_or_create(
        email='worker_maint@frg.com',
        defaults={'role': Role.EMPLOYEE, 'username': 'worker_maint'}
    )
    maint_worker, _ = Employee.objects.get_or_create(
        user=maint_worker_user,
        defaults={
            'employee_id': 'MNT-W-001',
            'full_name': 'Maintenance Worker 1',
            'email': 'worker_maint@frg.com',
            'department': maint_dept,
            'joining_date': date(2025, 1, 1),
            'employment_status': EmploymentStatus.ACTIVE
        }
    )
    maint_worker.department = maint_dept
    maint_worker.save()

    # Worker in Engineering (non-maintenance)
    eng_worker_user, _ = User.objects.get_or_create(
        email='worker_eng@frg.com',
        defaults={'role': Role.EMPLOYEE, 'username': 'worker_eng'}
    )
    eng_worker, _ = Employee.objects.get_or_create(
        user=eng_worker_user,
        defaults={
            'employee_id': 'ENG-W-001',
            'full_name': 'Engineering Worker 1',
            'email': 'worker_eng@frg.com',
            'department': eng_dept,
            'joining_date': date(2025, 1, 1),
            'employment_status': EmploymentStatus.ACTIVE
        }
    )
    eng_worker.department = eng_dept
    eng_worker.save()

    client = Client()
    # Login as Supervisor
    sup_token = str(RefreshToken.for_user(sup_user).access_token)
    sup_headers = {'HTTP_AUTHORIZATION': f'Bearer {sup_token}'}

    # Test 1: Supervisor list employees -> Should ONLY see Maintenance employees
    print("\n--- Test 1: Supervisor Views Employee Directory ---")
    res = client.get('/api/v1/employees/', **sup_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    emp_list = res.json().get('results', res.json())
    dept_names = set(e.get('department_name') for e in emp_list if e.get('department_name'))
    print(f"Supervisor sees {len(emp_list)} employees in departments: {dept_names}")
    assert all(d == 'Maintenance' for d in dept_names), f"Supervisor saw non-maintenance employees: {dept_names}"
    print("PASS: Supervisor only sees Maintenance employees.")

    # Test 2: Supervisor creates new worker -> Automatically assigned to Maintenance
    print("\n--- Test 2: Supervisor Creates New Maintenance Worker ---")
    new_worker_payload = {
        'employee_id': f'MNT-AUTO-{int(date.today().strftime("%Y%m%d"))}',
        'full_name': 'New Maint Worker',
        'email': 'new_maint_worker@frg.com',
        'password': 'Password123!',
        'work_mode': 'OFFICE',
        'salary': 45000
    }
    # Clean up if existed
    Employee.objects.filter(email='new_maint_worker@frg.com').delete()
    User.objects.filter(email='new_maint_worker@frg.com').delete()

    res = client.post('/api/v1/employees/', data=json.dumps(new_worker_payload), content_type='application/json', **sup_headers)
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.content}"
    created_worker = res.json()
    assert created_worker['department_name'] == 'Maintenance', f"Expected Maintenance dept, got {created_worker['department_name']}"
    print(f"PASS: Worker created successfully with Department = {created_worker['department_name']}.")

    # Test 3: Supervisor edits Maintenance worker
    print("\n--- Test 3: Supervisor Edits Maintenance Worker ---")
    worker_db = Employee.objects.get(email='new_maint_worker@frg.com')
    edit_payload = {
        'full_name': 'Updated Maint Worker',
        'phone': '+9998887776'
    }
    res = client.patch(f'/api/v1/employees/{worker_db.id}/', data=json.dumps(edit_payload), content_type='application/json', **sup_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.content}"
    worker_db.refresh_from_db()
    assert worker_db.full_name == 'Updated Maint Worker'
    print("PASS: Maintenance worker updated successfully.")

    # Test 4: Supervisor deletes Maintenance worker
    print("\n--- Test 4: Supervisor Deletes Maintenance Worker ---")
    res = client.delete(f'/api/v1/employees/{worker_db.id}/', **sup_headers)
    assert res.status_code in [200, 204], f"Expected 200/204, got {res.status_code}"
    assert not Employee.objects.filter(id=worker_db.id).exists()
    print("PASS: Maintenance worker deleted successfully.")

    # Test 5: Supervisor takes attendance for Maintenance worker
    print("\n--- Test 5: Supervisor Marks Attendance for Maintenance Worker ---")
    today_str = date.today().isoformat()
    att_payload = {
        'employee_id': maint_worker.id,
        'date': today_str,
        'status': 'PRESENT',
        'check_in': '09:00',
        'check_out': '17:00'
    }
    res = client.post('/api/v1/attendance/mark-attendance/', data=json.dumps(att_payload), content_type='application/json', **sup_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.content}"
    print("PASS: Attendance marked successfully for Maintenance worker.")

    # Test 6: Security - Supervisor tries to access / edit an Engineering employee -> 403
    print("\n--- Test 6: Security - Supervisor Access to Other Department Employee ---")
    res = client.get(f'/api/v1/employees/{eng_worker.id}/', **sup_headers)
    assert res.status_code in [403, 404], f"Expected 403 or 404, got {res.status_code}"
    res = client.patch(f'/api/v1/employees/{eng_worker.id}/', data=json.dumps({'full_name': 'Hacked'}), content_type='application/json', **sup_headers)
    assert res.status_code in [403, 404], f"Expected 403 or 404, got {res.status_code}"
    res = client.delete(f'/api/v1/employees/{eng_worker.id}/', **sup_headers)
    assert res.status_code in [403, 404], f"Expected 403 or 404, got {res.status_code}"
    print("PASS: Access DENIED (403/404) for non-maintenance employee CRUD.")

    # Test 7: Security - Supervisor tries to mark attendance for Engineering employee -> 403
    print("\n--- Test 7: Security - Supervisor Marks Attendance for Other Department ---")
    bad_att_payload = {
        'employee_id': eng_worker.id,
        'date': today_str,
        'status': 'PRESENT'
    }
    res = client.post('/api/v1/attendance/mark-attendance/', data=json.dumps(bad_att_payload), content_type='application/json', **sup_headers)
    assert res.status_code == 403, f"Expected 403 FORBIDDEN, got {res.status_code}: {res.content}"
    print(f"PASS: Access DENIED ({res.status_code}): {res.json().get('error')}")

    # Test 8: Attendance Roster for Supervisor -> Only Maintenance workers
    print("\n--- Test 8: Supervisor Attendance Roster ---")
    res = client.get(f'/api/v1/attendance/?date={today_str}', **sup_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    roster = res.json().get('results', res.json())
    roster_depts = set(r.get('department') for r in roster)
    print(f"Supervisor roster contains {len(roster)} workers across: {roster_depts}")
    assert all(d == 'Maintenance' for d in roster_depts), f"Supervisor roster contained non-maintenance depts: {roster_depts}"
    print("PASS: Attendance roster strictly scoped to Maintenance.")

    # Test 9: HR / Admin functionality untouched
    print("\n--- Test 9: HR / Admin Functionality ---")
    hr_token = str(RefreshToken.for_user(hr_user).access_token)
    hr_headers = {'HTTP_AUTHORIZATION': f'Bearer {hr_token}'}
    res = client.get('/api/v1/employees/', **hr_headers)
    assert res.status_code == 200
    all_emps = res.json().get('results', res.json())
    all_depts = set(e.get('department_name') for e in all_emps if e.get('department_name'))
    print(f"HR sees {len(all_emps)} employees across multiple depts: {all_depts}")
    assert len(all_depts) > 1, "HR should see employees from multiple departments"
    print("PASS: HR functionality untouched and sees all departments.")

    print("\n=== ALL 9 BACKEND TESTS PASSED SUCCESSFULLY! ===")

if __name__ == '__main__':
    run_tests()
