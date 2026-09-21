import os
import django
from datetime import date, datetime, timedelta
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import timezone
from employees.models import Employee
from attendance.models import Attendance, AttendanceStatus
from attendance.services import AttendanceEngine
from salaries.views import PayrollCalculationView
from rest_framework.test import APIRequestFactory
from accounts.models import User, Role


def test_half_day_policy():
    print("=== STARTING HALF-DAY POLICY & DEDUCTION VERIFICATION ===")

    # 1. Test past attendance records (date <= 2026-09-21)
    past_date = date(2026, 9, 21)
    emp = Employee.objects.filter(user__role=Role.EMPLOYEE, is_half_day=False).first()
    assert emp is not None, "Standard employee not found"

    print(f"\n--- Test 1: Evaluating attendance up to today ({past_date}) with < 8 hours ---")
    past_att = Attendance(
        employee=emp,
        date=past_date,
        working_hours=Decimal('7.50'),
        status=AttendanceStatus.PRESENT
    )
    status_result = AttendanceEngine.calculate_final_status(past_att)
    print(f"Past attendance (7.50 hrs on {past_date}) status: {status_result}")
    assert status_result == AttendanceStatus.PRESENT, f"Expected PRESENT for past attendance, got {status_result}"
    print("PASS: Past attendance <= 2026-09-21 does NOT become HALF_DAY.")

    # 2. Test future attendance record "from now" (date > 2026-09-21)
    future_date = date(2026, 9, 22)
    print(f"\n--- Test 2: Evaluating attendance from now ({future_date}) with < 8 hours (7h 45m = 7.75h) ---")
    future_att_short = Attendance(
        employee=emp,
        date=future_date,
        working_hours=Decimal('7.75'),
        status=AttendanceStatus.PRESENT
    )
    status_short = AttendanceEngine.calculate_final_status(future_att_short)
    print(f"Future attendance (7.75 hrs on {future_date}) status: {status_short}")
    assert status_short == AttendanceStatus.HALF_DAY, f"Expected HALF_DAY for future attendance < 8h, got {status_short}"
    print("PASS: Future attendance not maintaining 8h window is marked HALF_DAY.")

    print(f"\n--- Test 3: Evaluating attendance from now ({future_date}) with >= 8 hours (8.00h) ---")
    future_att_full = Attendance(
        employee=emp,
        date=future_date,
        working_hours=Decimal('8.00'),
        status=AttendanceStatus.PRESENT
    )
    status_full = AttendanceEngine.calculate_final_status(future_att_full)
    print(f"Future attendance (8.00 hrs on {future_date}) status: {status_full}")
    assert status_full == AttendanceStatus.PRESENT, f"Expected PRESENT for future attendance >= 8h, got {status_full}"
    print("PASS: Future attendance maintaining 8h window is marked PRESENT.")

    # 3. Test Payroll Calculation View
    print("\n--- Test 4: Payroll Calculation View - Past vs Future Half-Days ---")
    # Clean any test records for this month
    Attendance.objects.filter(employee=emp, date__in=[past_date, future_date]).delete()

    # Create/update a past half-day record (e.g. on 2026-09-15) and a future half-day record (e.g. on 2026-09-25)
    now_dt = timezone.now()
    test_past_hd, _ = Attendance.objects.update_or_create(
        employee=emp,
        date=date(2026, 9, 15),
        defaults={
            'check_in': now_dt.replace(year=2026, month=9, day=15, hour=9, minute=0, second=0),
            'check_out': now_dt.replace(year=2026, month=9, day=15, hour=15, minute=0, second=0),
            'working_hours': Decimal('6.00'),
            'status': AttendanceStatus.HALF_DAY
        }
    )
    test_future_hd, _ = Attendance.objects.update_or_create(
        employee=emp,
        date=date(2026, 9, 25),
        defaults={
            'check_in': now_dt.replace(year=2026, month=9, day=25, hour=9, minute=0, second=0),
            'check_out': now_dt.replace(year=2026, month=9, day=25, hour=15, minute=0, second=0),
            'working_hours': Decimal('6.00'),
            'status': AttendanceStatus.HALF_DAY
        }
    )

    ceo_user = User.objects.filter(role=Role.CEO).first()
    factory = APIRequestFactory()
    from rest_framework.test import force_authenticate
    request = factory.get('/api/v1/salaries/payroll/?month=9&year=2026')
    force_authenticate(request, user=ceo_user)

    view = PayrollCalculationView.as_view()
    response = view(request)
    assert response.status_code == 200, f"Payroll view returned {response.status_code}: {response.data}"

    records = response.data.get('records', [])
    emp_record = next((r for r in records if r['employee_id'] == emp.id), None)
    assert emp_record is not None, "Employee payroll record not found"

    print(f"Employee: {emp.full_name}")
    print(f"Half-days count reported: {emp_record['half_days_count']}")
    print(f"Half-day deduction: Rs. {emp_record['half_day_deduction']}")

    # Only 1 half-day (the future one on Sept 25) must be counted and deducted!
    # The past one on Sept 15 must be forgiven (0 deduction).
    assert emp_record['half_days_count'] == 1, f"Expected 1 future half-day counted, got {emp_record['half_days_count']}"

    daily_rate = Decimal(emp_record['daily_rate'])
    expected_hd_deduction = (daily_rate / Decimal('2.00')).quantize(Decimal('0.01'))
    actual_hd_deduction = Decimal(emp_record['half_day_deduction'])
    assert actual_hd_deduction == expected_hd_deduction, f"Expected Rs. {expected_hd_deduction}, got Rs. {actual_hd_deduction}"
    print(f"PASS: Past half day on Sept 15 waived! Future half day on Sept 25 deducted exactly half-day salary: Rs. {actual_hd_deduction}")

    # Clean up test records
    test_past_hd.delete()
    test_future_hd.delete()

    # 4. Test Employee Illusion
    test_employee_illusion(emp)

    print("\n=== ALL HALF-DAY POLICY & ILLUSION TESTS PASSED SUCCESSFULLY! ===")


def test_employee_illusion(emp):
    print("\n--- Test 5: Employee Illusion Verification ---")
    emp_user = emp.user

    # Create a future half-day record
    now_dt = timezone.now()
    test_hd, _ = Attendance.objects.update_or_create(
        employee=emp,
        date=date(2026, 9, 25),
        defaults={
            'check_in': now_dt.replace(year=2026, month=9, day=25, hour=9, minute=0, second=0),
            'check_out': now_dt.replace(year=2026, month=9, day=25, hour=15, minute=0, second=0),
            'working_hours': Decimal('6.00'),
            'status': AttendanceStatus.HALF_DAY
        }
    )

    from attendance.views import AttendanceViewSet
    factory = APIRequestFactory()
    from rest_framework.test import force_authenticate

    # 1. When employee views attendance list
    req_emp = factory.get('/api/v1/attendance/?date=2026-09-25')
    force_authenticate(req_emp, user=emp_user)
    view_list = AttendanceViewSet.as_view({'get': 'list'})
    res_emp = view_list(req_emp)
    assert res_emp.status_code == 200, f"List failed for employee: {res_emp.data}"
    emp_items = res_emp.data.get('results', res_emp.data)
    emp_item = next((i for i in emp_items if i['date'] == '2026-09-25'), None)
    assert emp_item is not None, "Attendance record not returned for employee"
    print(f"Status visible to Employee: {emp_item['status']}")
    assert emp_item['status'] == AttendanceStatus.PRESENT, f"Illusion failed! Employee saw {emp_item['status']} instead of PRESENT"
    print("PASS: Employee sees PRESENT instead of HALF_DAY!")

    # 2. When CEO/HR views attendance list
    ceo_user = User.objects.filter(role=Role.CEO).first()
    req_ceo = factory.get('/api/v1/attendance/?date=2026-09-25')
    force_authenticate(req_ceo, user=ceo_user)
    res_ceo = view_list(req_ceo)
    assert res_ceo.status_code == 200, f"List failed for CEO: {res_ceo.data}"
    ceo_items = res_ceo.data.get('results', res_ceo.data)
    ceo_item = next((i for i in ceo_items if i['employee'] == emp.id and i['date'] == '2026-09-25'), None)
    assert ceo_item is not None, "Attendance record not found in CEO roster"
    print(f"Status visible to CEO/Management: {ceo_item['status']}")
    assert ceo_item['status'] == AttendanceStatus.HALF_DAY, f"CEO should see real HALF_DAY status, got {ceo_item['status']}"
    print("PASS: CEO/Management sees the real HALF_DAY status!")

    # 3. When employee views monthly summary
    req_sum = factory.get('/api/v1/attendance/monthly-summary/?year=2026&month=9')
    force_authenticate(req_sum, user=emp_user)
    view_summary = AttendanceViewSet.as_view({'get': 'monthly_summary'})
    res_sum = view_summary(req_sum)
    assert res_sum.status_code == 200, f"Monthly summary failed: {res_sum.data}"
    day_item = next((d for d in res_sum.data.get('daily_breakdown', []) if d['date'] == '2026-09-25'), None)
    assert day_item is not None, "Day breakdown missing for 2026-09-25"
    print(f"Status in Employee Monthly Summary: {day_item['status']}")
    assert day_item['status'] == AttendanceStatus.PRESENT, f"Monthly summary illusion failed! Saw {day_item['status']}"
    print("PASS: Employee monthly summary breakdown displays PRESENT!")

    test_hd.delete()
    print("=== EMPLOYEE ILLUSION TESTS PASSED! ===")


if __name__ == '__main__':
    test_half_day_policy()
