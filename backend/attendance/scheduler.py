import logging
from apscheduler.schedulers.background import BackgroundScheduler
from django_apscheduler.jobstores import DjangoJobStore, register_events
from django.utils import timezone
from django.conf import settings
from .models import Attendance, FestivalHoliday
from leaves.models import LeaveRequest
from employees.models import Employee
from notifications.models import Notification, NotificationType

logger = logging.getLogger(__name__)

def check_late_clock_in():
    try:
        now = timezone.localtime()
        today = now.date()

        # Skip weekends (Saturday=5, Sunday=6)
        if today.weekday() >= 5:
            return

        # Skip official holidays
        if FestivalHoliday.objects.filter(date=today).exists():
            return

        # Fetch all active employees
        active_employees = Employee.objects.filter(is_active=True)

        for emp in active_employees:
            # Check if employee has an approved leave for today
            has_leave = LeaveRequest.objects.filter(
                employee=emp,
                start_date__lte=today,
                end_date__gte=today,
                status='APPROVED'
            ).exists()
            if has_leave:
                continue
            
            # Check if employee has clocked in today
            has_attendance = Attendance.objects.filter(employee=emp, date=today).exists()
            
            if not has_attendance:
                # Create a LATE_CLOCK_IN_ALERT notification
                user = emp.user
                if user:
                    Notification.objects.create(
                        recipient=user,
                        title="Late Clock-in Alert",
                        message="You haven't clocked in yet today. Are you absent or do you want to clock in now?",
                        notification_type=NotificationType.LATE_CLOCK_IN_ALERT
                    )
                    logger.info(f"Created Late Clock-in Alert for {emp.full_name}")

    except Exception as e:
        logger.error(f"Error in check_late_clock_in: {e}")

def start_scheduler():
    scheduler = BackgroundScheduler(timezone=settings.TIME_ZONE)
    scheduler.add_jobstore(DjangoJobStore(), "default")
    
    # Run everyday at 09:15
    scheduler.add_job(
        check_late_clock_in,
        trigger="cron",
        hour=9,
        minute=15,
        id="check_late_clock_in",
        max_instances=1,
        replace_existing=True,
    )

    # For testing right now, let's also trigger it once after 10 seconds if needed, 
    # but we'll stick to the 09:15 cron for production.
    register_events(scheduler)
    scheduler.start()
    logger.info("APScheduler started and check_late_clock_in job registered.")
