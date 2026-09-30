import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client
from accounts.models import User, Role
from employees.models import Department, Designation, Employee, EmploymentStatus, WorkMode
from attendance.models import Attendance, AttendanceStatus, DailyAttendanceSubmission, MaintenanceGeofence, AttendanceBreak
from rest_framework_simplejwt.tokens import RefreshToken
import json
from datetime import date, timedelta
from decimal import Decimal

def run_tests():
    print("=================================================================")
    print("STARTING COMPLETE MAINTENANCE DEPARTMENT & SUPERVISOR VERIFICATION")
    print("=================================================================")

    today_str = date.today().isoformat()
    client = Client()

    # 1. Setup Maintenance Department
    maint_dept, _ = Department.objects.get_or_create(
        name='Maintenance',
        defaults={'code': 'MAINTENANCE', 'description': 'Maintenance Department'}
    )
    if maint_dept.code != 'MAINTENANCE':
        maint_dept.code = 'MAINTENANCE'
        maint_dept.save()

    # Setup non-maintenance department
    eng_dept, _ = Department.objects.get_or_create(name='Engineering', defaults={'code': 'ENG'})

    # 2. Setup Maintenance Supervisor
    sup_user, _ = User.objects.get_or_create(
        email='supervisor.maintenance@frg.com',
        defaults={'role': Role.SUPERVISOR, 'username': 'maint_supervisor_test', 'first_name': 'Maint', 'last_name': 'Supervisor'}
    )
    sup_user.role = Role.SUPERVISOR
    sup_user.set_password('Password123!')
    sup_user.save()

    sup_desg, _ = Designation.objects.get_or_create(title='Supervisor', department=maint_dept)
    sup_emp, _ = Employee.objects.get_or_create(
        user=sup_user,
        defaults={
            'employee_id': 'SUP-MAINT-TEST',
            'full_name': 'Maintenance Supervisor',
            'email': 'supervisor.maintenance@frg.com',
            'department': maint_dept,
            'designation': sup_desg,
            'joining_date': date(2025, 1, 1),
            'work_mode': WorkMode.OFFICE,
            'employment_status': EmploymentStatus.ACTIVE
        }
    )
    sup_emp.department = maint_dept
    sup_emp.save()

    # Setup Maintenance Worker
    tech_desg, _ = Designation.objects.get_or_create(title='Technician', department=maint_dept)
    worker_user, _ = User.objects.get_or_create(
        email='ravi.maint@frg.com',
        defaults={'role': Role.EMPLOYEE, 'username': 'ravi_maint', 'first_name': 'Ravi', 'last_name': 'Kumar'}
    )
    worker_user.set_password('Password123!')
    worker_user.save()

    worker_emp, _ = Employee.objects.get_or_create(
        employee_id='M001',
        defaults={
            'user': worker_user,
            'full_name': 'Ravi Kumar',
            'email': 'ravi.maint@frg.com',
            'phone': '9876543210',
            'department': maint_dept,
            'designation': tech_desg,
            'shift': 'Morning',
            'joining_date': date(2025, 1, 1),
            'work_mode': WorkMode.OFFICE,
            'employment_status': EmploymentStatus.ACTIVE,
            'created_by': sup_user,
            'manager': sup_emp,
            'is_maintenance_worker': True,
        }
    )
    worker_emp.department = maint_dept
    worker_emp.created_by = sup_user
    worker_emp.manager = sup_emp
    worker_emp.is_maintenance_worker = True
    worker_emp.save()

    # Setup Non-Maintenance Worker (Engineering)
    eng_user, _ = User.objects.get_or_create(
        email='eng.worker@frg.com',
        defaults={'role': Role.EMPLOYEE, 'username': 'eng_worker'}
    )
    eng_emp, _ = Employee.objects.get_or_create(
        employee_id='ENG001',
        defaults={
            'user': eng_user,
            'full_name': 'Alice Engineer',
            'email': 'eng.worker@frg.com',
            'department': eng_dept,
            'joining_date': date(2025, 1, 1),
            'work_mode': WorkMode.OFFICE,
            'employment_status': EmploymentStatus.ACTIVE
        }
    )

    # Clean today's attendance for supervisor and workers for clean test run
    Attendance.objects.filter(employee__in=[sup_emp, worker_emp, eng_emp], date=date.today()).delete()
    DailyAttendanceSubmission.objects.filter(department=maint_dept, date=date.today()).delete()

    sup_token = str(RefreshToken.for_user(sup_user).access_token)
    sup_headers = {'HTTP_AUTHORIZATION': f'Bearer {sup_token}'}

    print("\n--- TEST 1: Rule 1 - Supervisor CANNOT take attendance BEFORE clocking in ---")
    att_payload = {
        'records': [{
            'worker_id': worker_emp.id,
            'status': 'PRESENT',
            'date': today_str
        }]
    }
    res = client.post('/api/v1/maintenance/attendance/', data=json.dumps(att_payload), content_type='application/json', **sup_headers)
    assert res.status_code == 403, f"Expected 403 Forbidden before supervisor clock-in, got {res.status_code}: {res.content}"
    print(f"PASS: Correctly rejected with 403: {res.json().get('error')}")

    print("\n--- TEST 2: Supervisor Clocks In Successfully (with GPS verification) ---")
    clock_in_payload = {'work_mode': 'OFFICE', 'latitude': 17.385044, 'longitude': 78.486671}
    clock_in_res = client.post('/api/v1/attendance/clock-in/', data=json.dumps(clock_in_payload), content_type='application/json', **sup_headers)
    assert clock_in_res.status_code in [200, 201], f"Expected 200/201 clock in, got {clock_in_res.status_code}: {clock_in_res.content}"
    sup_att = Attendance.objects.filter(employee=sup_emp, date=date.today()).first()
    assert sup_att is not None and sup_att.check_in is not None
    assert sup_att.location_verified is True
    print(f"PASS: Supervisor clocked in at {sup_att.check_in} with location_verified=True")

    print("\n--- TEST 3: Duplicate Clock-In Prevented ---")
    dup_res = client.post('/api/v1/attendance/clock-in/', **sup_headers)
    assert dup_res.status_code == 400, f"Expected 400 for duplicate clock in, got {dup_res.status_code}"
    print(f"PASS: Duplicate clock in blocked with: {dup_res.json().get('error')}")

    print("\n--- TEST 4: Maintenance Dashboard Metrics ---")
    dash_res = client.get('/api/v1/maintenance/dashboard/', **sup_headers)
    assert dash_res.status_code == 200, f"Expected 200 from dashboard, got {dash_res.status_code}"
    dash_data = dash_res.json()
    assert dash_data['supervisor_attendance']['is_clocked_in'] == True
    assert dash_data['supervisor_attendance']['status'] == 'CLOCKED_IN'
    assert dash_data['workforce']['total_workers'] >= 1
    print(f"PASS: Dashboard returned: Supervisor Status = {dash_data['supervisor_attendance']['status']}, Total Workers = {dash_data['workforce']['total_workers']}")

    print("\n--- TEST 5: Supervisor Takes Attendance (AFTER clocking in) ---")
    res = client.post('/api/v1/maintenance/attendance/', data=json.dumps(att_payload), content_type='application/json', **sup_headers)
    assert res.status_code == 200, f"Expected 200 for attendance mark, got {res.status_code}: {res.content}"
    worker_att = Attendance.objects.filter(employee=worker_emp, date=date.today()).first()
    assert worker_att is not None
    assert worker_att.status == AttendanceStatus.PRESENT
    assert worker_att.taken_by == sup_user, f"Expected taken_by = {sup_user.email}, got {worker_att.taken_by}"
    print(f"PASS: Worker attendance recorded: status = {worker_att.status}, taken_by = {worker_att.taken_by.email}")

    print("\n--- TEST 6: Supervisor Marks Other Statuses (Late, Absent, Half Day, Leave) ---")
    statuses = ['LATE', 'ABSENT', 'HALF_DAY', 'LEAVE', 'PRESENT']
    for st in statuses:
        p = {'records': [{'worker_id': worker_emp.id, 'status': st, 'date': today_str}]}
        r = client.post('/api/v1/maintenance/attendance/', data=json.dumps(p), content_type='application/json', **sup_headers)
        assert r.status_code == 200
        worker_att.refresh_from_db()
        assert worker_att.status == st
    print(f"PASS: Successfully updated through all statuses: {statuses}")

    print("\n--- TEST 7: Security - Supervisor CANNOT mark attendance for other department worker ---")
    bad_p = {'records': [{'worker_id': eng_emp.id, 'status': 'PRESENT', 'date': today_str}]}
    res = client.post('/api/v1/maintenance/attendance/', data=json.dumps(bad_p), content_type='application/json', **sup_headers)
    assert res.status_code in [403, 404], f"Expected 403 or 404 for non-maintenance worker attendance, got {res.status_code}"
    print(f"PASS: Non-maintenance attendance rejected with {res.status_code}: {res.json().get('error')}")

    print("\n--- TEST 8: Worker Management - Add Maintenance Worker ---")
    new_worker_payload = {
        'employee_id': 'M999',
        'full_name': 'Test Welder',
        'email': 'welder.maint@frg.com',
        'phone': '9876543299',
        'password': 'Password123!',
        'designation': tech_desg.id,
        'shift': 'Night'
    }
    Employee.objects.filter(email='welder.maint@frg.com').delete()
    User.objects.filter(email='welder.maint@frg.com').delete()

    add_res = client.post('/api/v1/maintenance/workers/', data=json.dumps(new_worker_payload), content_type='application/json', **sup_headers)
    assert add_res.status_code == 201, f"Expected 201 creating worker, got {add_res.status_code}: {add_res.content}"
    welder_obj = Employee.objects.get(employee_id='M999')
    assert welder_obj.department == maint_dept
    assert welder_obj.shift == 'Night'
    print(f"PASS: Worker M999 created with Department = {welder_obj.department.name} and Shift = {welder_obj.shift}")

    print("\n--- TEST 9: Worker Management - Edit Maintenance Worker ---")
    edit_payload = {'phone': '9111222333', 'shift': 'Evening'}
    patch_res = client.patch(f'/api/v1/maintenance/workers/{welder_obj.id}/', data=json.dumps(edit_payload), content_type='application/json', **sup_headers)
    assert patch_res.status_code == 200, f"Expected 200 editing worker, got {patch_res.status_code}"
    welder_obj.refresh_from_db()
    assert welder_obj.phone == '9111222333'
    assert welder_obj.shift == 'Evening'
    print("PASS: Maintenance worker updated successfully.")

    print("\n--- TEST 10: Security - Supervisor cannot access Engineering worker via maintenance endpoint ---")
    idor_res = client.get(f'/api/v1/maintenance/workers/{eng_emp.id}/', **sup_headers)
    assert idor_res.status_code in [403, 404], f"Expected 403 or 404, got {idor_res.status_code}"
    print("PASS: Access DENIED for other department worker.")

    print("\n--- TEST 11: Supervisor Submits Daily Attendance ---")
    sub_payload = {'date': today_str, 'notes': 'Daily maintenance shift attendance complete.'}
    sub_res = client.post('/api/v1/maintenance/attendance/submit/', data=json.dumps(sub_payload), content_type='application/json', **sup_headers)
    assert sub_res.status_code == 200, f"Expected 200 submitting attendance, got {sub_res.status_code}: {sub_res.content}"
    submission = DailyAttendanceSubmission.objects.filter(department=maint_dept, date=date.today()).first()
    assert submission is not None
    assert submission.submitted_by == sup_user
    worker_att.refresh_from_db()
    assert worker_att.is_submitted == True
    print(f"PASS: Daily attendance submitted and recorded: id = {submission.id}, submitted_by = {submission.submitted_by.email}")

    print("\n--- TEST 12: Locked After Submission ---")
    lock_test_payload = {'records': [{'worker_id': worker_emp.id, 'status': 'ABSENT', 'date': today_str}]}
    lock_res = client.post('/api/v1/maintenance/attendance/', data=json.dumps(lock_test_payload), content_type='application/json', **sup_headers)
    assert lock_res.status_code == 403, f"Expected 403 modifying submitted attendance, got {lock_res.status_code}"
    print(f"PASS: Modifying submitted attendance correctly locked: {lock_res.json().get('error')}")

    print("\n--- TEST 13: Attendance History & Reports ---")
    hist_res = client.get('/api/v1/maintenance/attendance/history/?range=today', **sup_headers)
    assert hist_res.status_code == 200
    assert len(hist_res.json()['results']) > 0
    print(f"PASS: History returned {len(hist_res.json()['results'])} records.")

    rep_res = client.get(f'/api/v1/maintenance/reports/?year={date.today().year}&month={date.today().month}', **sup_headers)
    assert rep_res.status_code == 200
    assert len(rep_res.json()['results']) > 0
    print(f"PASS: Monthly reports returned {len(rep_res.json()['results'])} workers.")

    print("\n--- TEST 14: Security RBAC - Supervisor CANNOT access Salary Management ---")
    sal_res = client.get('/api/v1/salaries/', **sup_headers)
    assert sal_res.status_code == 403, f"Expected 403 FORBIDDEN on salaries for Supervisor, got {sal_res.status_code}"
    print("PASS: Access DENIED (403) to Salary module for Supervisor.")

    print("\n--- TEST 15: Security RBAC - Supervisor CANNOT access Audit Logs ---")
    audit_res = client.get('/api/v1/audit/logs/', **sup_headers)
    assert audit_res.status_code == 403, f"Expected 403 FORBIDDEN on audit logs for Supervisor, got {audit_res.status_code}"
    print("PASS: Access DENIED (403) to Audit Logs for Supervisor.")

    print("\n--- TEST 16: Regression - CEO, HR, and Employee Authentication & Dashboards ---")
    # CEO
    ceo_user, _ = User.objects.get_or_create(email='ceo_test@frg.com', defaults={'role': Role.CEO, 'username': 'ceo_test'})
    ceo_user.role = Role.CEO
    ceo_user.set_password('Password123!')
    ceo_user.save()
    ceo_token = str(RefreshToken.for_user(ceo_user).access_token)
    ceo_headers = {'HTTP_AUTHORIZATION': f'Bearer {ceo_token}'}
    ceo_dash_res = client.get('/api/v1/reports/analytics/', **ceo_headers)
    assert ceo_dash_res.status_code == 200, f"CEO dashboard failed: {ceo_dash_res.status_code}"

    # HR
    hr_user, _ = User.objects.get_or_create(email='hr_test@frg.com', defaults={'role': Role.HR, 'username': 'hr_test'})
    hr_user.role = Role.HR
    hr_user.set_password('Password123!')
    hr_user.save()
    hr_token = str(RefreshToken.for_user(hr_user).access_token)
    hr_headers = {'HTTP_AUTHORIZATION': f'Bearer {hr_token}'}
    hr_dash_res = client.get('/api/v1/attendance/today-summary/', **hr_headers)
    assert hr_dash_res.status_code == 200, f"HR today-summary failed: {hr_dash_res.status_code}"

    # Employee
    worker_token = str(RefreshToken.for_user(worker_user).access_token)
    worker_headers = {'HTTP_AUTHORIZATION': f'Bearer {worker_token}'}
    worker_shift_res = client.get('/api/v1/attendance/shift-status/', **worker_headers)
    assert worker_shift_res.status_code == 200, f"Employee shift status failed: {worker_shift_res.status_code}"

    # Worker CANNOT access maintenance dashboard
    worker_dash_res = client.get('/api/v1/maintenance/dashboard/', **worker_headers)
    assert worker_dash_res.status_code == 403, f"Worker must be denied access to maintenance dashboard: {worker_dash_res.status_code}"
    print("PASS: CEO, HR, and Employee workflows untouched. Normal worker correctly denied supervisor access.")

    print("\n--- TEST 17: Lunch Break - Supervisor pauses department for lunch (scope: 'ALL') ---")
    pause_res = client.post(
        '/api/v1/maintenance/breaks/pause/',
        data=json.dumps({'scope': 'ALL', 'break_type': 'LUNCH', 'notes': 'Midday Meal'}),
        content_type='application/json',
        **sup_headers
    )
    assert pause_res.status_code == 200, f"Pause ALL failed: {pause_res.status_code} - {pause_res.json()}"
    assert pause_res.json().get('success') is True, "Pause did not return success=True"
    print(f"PASS: Lunch break started for department: {pause_res.json().get('message')}")

    print("\n--- TEST 18: Lunch Break - Status check returns active break ---")
    status_res = client.get('/api/v1/maintenance/breaks/status/', **sup_headers)
    assert status_res.status_code == 200, f"Break status check failed: {status_res.status_code}"
    break_data = status_res.json()
    assert break_data.get('department_on_break') is True, "Department must be marked on break"
    assert break_data.get('supervisor_break', {}).get('is_on_break') is True, "Supervisor must be on break"
    print(f"PASS: Break status verified. Active breaks count = {break_data.get('active_breaks_count')}")

    print("\n--- TEST 19: Lunch Break - Supervisor resumes work (scope: 'ALL', with GPS) ---")
    resume_res = client.post(
        '/api/v1/maintenance/breaks/resume/',
        data=json.dumps({'scope': 'ALL', 'latitude': 17.385044, 'longitude': 78.486671}),
        content_type='application/json',
        **sup_headers
    )
    assert resume_res.status_code == 200, f"Resume ALL failed: {resume_res.status_code} - {resume_res.json()}"
    status_res2 = client.get('/api/v1/maintenance/breaks/status/', **sup_headers)
    assert status_res2.json().get('department_on_break') is False, "Department break must be ended"
    print(f"PASS: Department resumed work: {resume_res.json().get('message')}")

    print("\n--- TEST 20: Lunch Break - Individual worker pause and resume (with GPS) ---")
    pause_ind_res = client.post(
        '/api/v1/maintenance/breaks/pause/',
        data=json.dumps({'scope': 'WORKER', 'worker_id': worker_emp.id}),
        content_type='application/json',
        **sup_headers
    )
    assert pause_ind_res.status_code == 200, f"Individual pause failed: {pause_ind_res.status_code}"
    resume_ind_res = client.post(
        '/api/v1/maintenance/breaks/resume/',
        data=json.dumps({'scope': 'WORKER', 'worker_id': worker_emp.id, 'latitude': 17.385044, 'longitude': 78.486671}),
        content_type='application/json',
        **sup_headers
    )
    assert resume_ind_res.status_code == 200, f"Individual resume failed: {resume_ind_res.status_code}"
    print("PASS: Individual worker pause and resume verified successfully.")

    print("\n--- TEST 21: CEO dynamically configures Maintenance Geofence & Radius ---")
    geofence_payload = {
        'site_name': 'Central Maintenance Base',
        'latitude': 17.385044,
        'longitude': 78.486671,
        'radius_meters': 100,
        'is_active': True
    }
    geo_res = client.post('/api/v1/maintenance/geofence/', data=json.dumps(geofence_payload), content_type='application/json', **ceo_headers)
    assert geo_res.status_code == 200, f"CEO geofence configuration failed: {geo_res.status_code} - {geo_res.json()}"
    geo_data = geo_res.json()
    assert geo_data.get('success') is True
    assert geo_data.get('radius_meters') == 100
    print(f"PASS: CEO dynamically set worksite geofence at ({geo_data['latitude']}, {geo_data['longitude']}) radius: {geo_data['radius_meters']}m")

    print("\n--- TEST 22: Security RBAC - Supervisor / Worker CANNOT configure geofence ---")
    bad_geo = client.post('/api/v1/maintenance/geofence/', data=json.dumps(geofence_payload), content_type='application/json', **sup_headers)
    assert bad_geo.status_code == 403, f"Expected 403 for supervisor geofence update, got {bad_geo.status_code}"
    print(f"PASS: Non-CEO blocked from configuring geofence: {bad_geo.json().get('error')}")

    print("\n--- TEST 23: Maintenance Geofence Enforcement on Clock-In ---")
    # Clean any stale M002 or test email
    Employee.objects.filter(employee_id='M002').delete()
    Employee.objects.filter(email='worker2.maint@frg.com').delete()
    User.objects.filter(email='worker2.maint@frg.com').delete()

    # Setup fresh worker for clock in test
    worker2_user = User.objects.create(
        email='worker2.maint@frg.com',
        role=Role.EMPLOYEE,
        username='worker2_maint'
    )
    worker2_user.set_password('Password123!')
    worker2_user.save()
    worker2_emp, _ = Employee.objects.get_or_create(
        user=worker2_user,
        defaults={
            'employee_id': 'M002',
            'full_name': 'Suresh Technician',
            'email': 'worker2.maint@frg.com',
            'department': maint_dept,
            'designation': tech_desg,
            'joining_date': date(2025, 1, 1),
            'work_mode': WorkMode.OFFICE,
            'employment_status': EmploymentStatus.ACTIVE,
            'created_by': sup_user,
            'manager': sup_emp,
            'is_maintenance_worker': True,
        }
    )
    worker2_emp.department = maint_dept
    worker2_emp.designation = tech_desg
    worker2_emp.created_by = sup_user
    worker2_emp.manager = sup_emp
    worker2_emp.is_maintenance_worker = True
    worker2_emp.save()
    Attendance.objects.filter(employee=worker2_emp, date=date.today()).delete()
    worker2_token = str(RefreshToken.for_user(worker2_user).access_token)
    worker2_headers = {'HTTP_AUTHORIZATION': f'Bearer {worker2_token}'}

    # Attempt 1: Clock in OUTSIDE radius (~7km away: 17.450000, 78.486671)
    outside_clock_res = client.post(
        '/api/v1/attendance/clock-in/',
        data=json.dumps({'work_mode': 'OFFICE', 'latitude': 17.450000, 'longitude': 78.486671}),
        content_type='application/json',
        **worker2_headers
    )
    assert outside_clock_res.status_code == 403, f"Expected 403 for clock-in outside radius, got {outside_clock_res.status_code}: {outside_clock_res.content}"
    assert outside_clock_res.json().get('geofence_blocked') is True
    print(f"PASS: Clock-in blocked outside radius: {outside_clock_res.json().get('error')}")

    # Attempt 2: Clock in INSIDE radius (17.385050, 78.486671 - ~1m from center)
    inside_clock_res = client.post(
        '/api/v1/attendance/clock-in/',
        data=json.dumps({'work_mode': 'OFFICE', 'latitude': 17.385050, 'longitude': 78.486671}),
        content_type='application/json',
        **worker2_headers
    )
    assert inside_clock_res.status_code in [200, 201], f"Expected 200/201 inside radius, got {inside_clock_res.status_code}: {inside_clock_res.content}"
    w2_att = Attendance.objects.filter(employee=worker2_emp, date=date.today()).first()
    assert w2_att is not None and w2_att.location_verified is True
    print(f"PASS: Clock-in accepted within worksite perimeter. location_verified = {w2_att.location_verified}")

    print("\n--- TEST 24: Lunch Break Resume - Blocked outside radius, Allowed inside radius ---")
    # Pause worker2 for lunch
    client.post(
        '/api/v1/maintenance/breaks/pause/',
        data=json.dumps({'scope': 'WORKER', 'worker_id': worker2_emp.id, 'break_type': 'LUNCH'}),
        content_type='application/json',
        **sup_headers
    )
    brk = AttendanceBreak.objects.filter(employee=worker2_emp, is_active=True).first()
    assert brk is not None, "Worker2 must be on break"

    # Resume Attempt 1: Outside radius (~5km away)
    blocked_resume = client.post(
        '/api/v1/maintenance/breaks/resume/',
        data=json.dumps({'scope': 'WORKER', 'worker_id': worker2_emp.id, 'latitude': 17.430000, 'longitude': 78.486671}),
        content_type='application/json',
        **sup_headers
    )
    assert blocked_resume.status_code == 403, f"Expected 403 resuming outside radius, got {blocked_resume.status_code}"
    assert blocked_resume.json().get('geofence_blocked') is True
    print(f"PASS: Resume blocked outside worksite perimeter: {blocked_resume.json().get('error')}")

    # Resume Attempt 2: Inside radius (~10m from center)
    ok_resume = client.post(
        '/api/v1/maintenance/breaks/resume/',
        data=json.dumps({'scope': 'WORKER', 'worker_id': worker2_emp.id, 'latitude': 17.385100, 'longitude': 78.486671}),
        content_type='application/json',
        **sup_headers
    )
    assert ok_resume.status_code == 200, f"Expected 200 resuming inside radius, got {ok_resume.status_code}"
    brk.refresh_from_db()
    assert brk.is_active is False
    assert brk.resume_latitude is not None and brk.resume_distance_meters is not None
    print(f"PASS: Lunch break resumed inside perimeter! Recorded distance = {brk.resume_distance_meters}m from center")

    print("\n--- TEST 25: Non-Maintenance Employees Unaffected by Maintenance Geofence ---")
    Attendance.objects.filter(employee=eng_emp, date=date.today()).delete()
    eng_token = str(RefreshToken.for_user(eng_user).access_token)
    eng_headers = {'HTTP_AUTHORIZATION': f'Bearer {eng_token}'}
    # Engineering worker clock in without GPS (or anywhere)
    eng_clock = client.post('/api/v1/attendance/clock-in/', **eng_headers)
    assert eng_clock.status_code in [200, 201], f"Engineering worker clock in should succeed: {eng_clock.status_code}"
    print("PASS: Engineering employee clock-in succeeded completely unaffected by Maintenance geofence.")

    # Cleanup
    Employee.objects.filter(employee_id__in=['M999', 'M002']).delete()
    User.objects.filter(email__in=['welder.maint@frg.com', 'worker2.maint@frg.com']).delete()

    print("\n=================================================================")
    print("ALL 25 MAINTENANCE INTEGRATION, RBAC & GEOFENCE TESTS PASSED!")
    print("=================================================================")

if __name__ == '__main__':
    run_tests()

