import os
import django
from datetime import date, datetime, time, timedelta
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from employees.models import Employee, Department, Designation, EmploymentStatus
from attendance.models import Attendance, AttendanceStatus, AttendanceWorkMode, AttendanceMethod, FestivalHoliday, FestivalType
from leaves.models import LeaveRequest, LeaveType, LeaveStatus, LeaveBalance
from tracking.models import EmployeeScreenTime
from core.models import OrganizationSettings, Holiday
from accounts.models import User

def seed_monthly_report_data():
    settings = OrganizationSettings.get_settings()
    settings.optional_leave_annual_entitlement = 1.0
    settings.casual_leave_annual_entitlement = 12.0
    settings.standard_daily_work_hours = Decimal('8.00')
    settings.save()

    # Ensure leave types
    opt_lt, _ = LeaveType.objects.get_or_create(
        code='OPT_FESTIVAL',
        defaults={'name': 'Optional Festival Leave', 'days_allowed': 1}
    )
    cl_lt, _ = LeaveType.objects.get_or_create(
        code='CL',
        defaults={'name': 'Casual Leave', 'days_allowed': 12}
    )
    sl_lt, _ = LeaveType.objects.get_or_create(
        code='SL',
        defaults={'name': 'Sick Leave', 'days_allowed': 12}
    )

    admin_user = User.objects.filter(is_superuser=True).first() or User.objects.first()

    employees = list(Employee.objects.filter(employment_status=EmploymentStatus.ACTIVE))
    if not employees:
        print("No active employees found.")
        return

    # Let's seed for September 2026 (Month 9, Year 2026)
    year = 2026
    month = 9
    import calendar
    _, num_days = calendar.monthrange(year, month)

    # Let's configure Employee 1 (John Smith or first employee) with ₹30,000 salary
    emp1 = employees[0]
    emp1.salary = Decimal('30000.00')
    emp1.joining_date = date(2025, 1, 1)
    emp1.save()

    # Clear old attendances, screen times, and leaves for Sep 2026 for emp1
    Attendance.objects.filter(employee=emp1, date__year=year, date__month=month).delete()
    EmployeeScreenTime.objects.filter(employee=emp1, date__year=year, date__month=month).delete()
    LeaveRequest.objects.filter(employee=emp1, start_date__year=year, start_date__month=month).delete()

    # Create 1 Optional Leave for Sep 8, 2026 (Tuesday - Working day)
    l_opt = LeaveRequest.objects.create(
        employee=emp1,
        leave_type=opt_lt,
        start_date=date(2026, 9, 8),
        end_date=date(2026, 9, 8),
        number_of_days=1.0,
        is_half_day=False,
        reason="Festival celebration",
        status=LeaveStatus.APPROVED,
        reviewed_by=admin_user
    )

    # In Sep 2026:
    # Working days = 25.
    # We want: 22 Present, 1 Optional Leave, 2 Unpaid Absence.
    # Unpaid absences: Sep 21 and Sep 22.
    working_days_count = 0
    present_created = 0

    for d_num in range(1, num_days + 1):
        d = date(year, month, d_num)
        weekday = d.weekday()
        is_sun = (weekday == 6)
        is_2nd_sat = (weekday == 5 and 8 <= d_num <= 14)

        if is_sun or is_2nd_sat:
            continue

        working_days_count += 1

        if d == date(2026, 9, 8):
            # Optional Leave day: Attendance status = LEAVE
            Attendance.objects.create(
                employee=emp1,
                date=d,
                check_in=datetime.combine(d, time(9, 0)),
                check_out=datetime.combine(d, time(18, 0)),
                working_hours=Decimal('0.00'),
                status=AttendanceStatus.LEAVE,
                work_mode=AttendanceWorkMode.OFFICE,
                attendance_method=AttendanceMethod.MANUAL_CORRECTION
            )
        elif d in [date(2026, 9, 21), date(2026, 9, 22)]:
            # Unpaid Absence days: no attendance record or status=ABSENT
            Attendance.objects.create(
                employee=emp1,
                date=d,
                check_in=datetime.combine(d, time(9, 0)),
                working_hours=Decimal('0.00'),
                status=AttendanceStatus.ABSENT,
                work_mode=AttendanceWorkMode.OFFICE,
                attendance_method=AttendanceMethod.MANUAL_CORRECTION
            )
        else:
            # Present day (22 present days)
            present_created += 1
            # Vary hours: 7h, 8h, 8.5h, 9h
            if present_created % 4 == 0:
                w_hrs = Decimal('7.00')
                s_secs = int(6.5 * 3600)
            elif present_created % 4 == 1:
                w_hrs = Decimal('8.50')
                s_secs = int(8.0 * 3600)
            elif present_created % 4 == 2:
                w_hrs = Decimal('9.00')
                s_secs = int(8.25 * 3600)
            else:
                w_hrs = Decimal('8.00')
                s_secs = int(7.75 * 3600)

            c_in = datetime.combine(d, time(9, 0))
            c_out = c_in + timedelta(hours=float(w_hrs))

            att = Attendance.objects.create(
                employee=emp1,
                date=d,
                check_in=c_in,
                check_out=c_out,
                working_hours=w_hrs,
                status=AttendanceStatus.PRESENT,
                work_mode=AttendanceWorkMode.OFFICE,
                attendance_method=AttendanceMethod.WEB_PORTAL
            )

            EmployeeScreenTime.objects.create(
                employee=emp1,
                date=d,
                active_seconds=s_secs
            )

    print(f"Seeded Employee 1 ({emp1.full_name}): WorkingDays={working_days_count}, Present={present_created}, OptionalLeave=1, Unpaid=2")

    # If Employee 2 exists, configure Example 1 (No absence, 1 Optional Leave, 24 Present)
    if len(employees) > 1:
        emp2 = employees[1]
        emp2.salary = Decimal('30000.00')
        emp2.joining_date = date(2025, 1, 1)
        emp2.save()

        Attendance.objects.filter(employee=emp2, date__year=year, date__month=month).delete()
        EmployeeScreenTime.objects.filter(employee=emp2, date__year=year, date__month=month).delete()
        LeaveRequest.objects.filter(employee=emp2, start_date__year=year, start_date__month=month).delete()

        # 1 Optional Leave on Sep 15
        LeaveRequest.objects.create(
            employee=emp2,
            leave_type=opt_lt,
            start_date=date(2026, 9, 15),
            end_date=date(2026, 9, 15),
            number_of_days=1.0,
            is_half_day=False,
            reason="Festival holiday",
            status=LeaveStatus.APPROVED,
            reviewed_by=admin_user
        )

        for d_num in range(1, num_days + 1):
            d = date(year, month, d_num)
            weekday = d.weekday()
            is_sun = (weekday == 6)
            is_2nd_sat = (weekday == 5 and 8 <= d_num <= 14)
            if is_sun or is_2nd_sat:
                continue

            if d == date(2026, 9, 15):
                Attendance.objects.create(
                    employee=emp2,
                    date=d,
                    check_in=datetime.combine(d, time(9, 0)),
                    working_hours=Decimal('0.00'),
                    status=AttendanceStatus.LEAVE,
                    work_mode=AttendanceWorkMode.OFFICE
                )
            else:
                c_in = datetime.combine(d, time(9, 0))
                c_out = c_in + timedelta(hours=8)
                Attendance.objects.create(
                    employee=emp2,
                    date=d,
                    check_in=c_in,
                    check_out=c_out,
                    working_hours=Decimal('8.00'),
                    status=AttendanceStatus.PRESENT,
                    work_mode=AttendanceWorkMode.OFFICE
                )
                EmployeeScreenTime.objects.create(
                    employee=emp2,
                    date=d,
                    active_seconds=int(8 * 3600)
                )

        print(f"Seeded Employee 2 ({emp2.full_name}): WorkingDays=25, Present=24, OptionalLeave=1, Unpaid=0")

    # If Employee 3 exists, configure with Casual Leave (2 days) and Half-Day present
    if len(employees) > 2:
        emp3 = employees[2]
        emp3.salary = Decimal('45000.00')
        emp3.joining_date = date(2025, 1, 1)
        emp3.save()

        Attendance.objects.filter(employee=emp3, date__year=year, date__month=month).delete()
        EmployeeScreenTime.objects.filter(employee=emp3, date__year=year, date__month=month).delete()
        LeaveRequest.objects.filter(employee=emp3, start_date__year=year, start_date__month=month).delete()

        # 2 days Casual Leave (Sep 3 to Sep 4)
        LeaveRequest.objects.create(
            employee=emp3,
            leave_type=cl_lt,
            start_date=date(2026, 9, 3),
            end_date=date(2026, 9, 4),
            number_of_days=2.0,
            is_half_day=False,
            reason="Personal work",
            status=LeaveStatus.APPROVED,
            reviewed_by=admin_user
        )

        for d_num in range(1, num_days + 1):
            d = date(year, month, d_num)
            weekday = d.weekday()
            is_sun = (weekday == 6)
            is_2nd_sat = (weekday == 5 and 8 <= d_num <= 14)
            if is_sun or is_2nd_sat:
                continue

            if d in [date(2026, 9, 3), date(2026, 9, 4)]:
                Attendance.objects.create(
                    employee=emp3,
                    date=d,
                    check_in=datetime.combine(d, time(9, 0)),
                    working_hours=Decimal('0.00'),
                    status=AttendanceStatus.LEAVE,
                    work_mode=AttendanceWorkMode.OFFICE
                )
            else:
                c_in = datetime.combine(d, time(9, 0))
                c_out = c_in + timedelta(hours=8.5)
                Attendance.objects.create(
                    employee=emp3,
                    date=d,
                    check_in=c_in,
                    check_out=c_out,
                    working_hours=Decimal('8.50'),
                    status=AttendanceStatus.PRESENT,
                    work_mode=AttendanceWorkMode.OFFICE
                )
                EmployeeScreenTime.objects.create(
                    employee=emp3,
                    date=d,
                    active_seconds=int(8.2 * 3600)
                )

        print(f"Seeded Employee 3 ({emp3.full_name}): WorkingDays=25, Present=23, CasualLeave=2, Unpaid=0")

    print("Finished seeding monthly report data successfully!")

if __name__ == '__main__':
    seed_monthly_report_data()
