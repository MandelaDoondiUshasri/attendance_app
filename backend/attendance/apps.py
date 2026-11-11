from django.apps import AppConfig
import sys
import os

class AttendanceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'attendance'

    def ready(self):
        # We only want to start the scheduler in the main process of runserver
        # or when run via Gunicorn/Uvicorn.
        # But we need to avoid running it during migrations or collectstatic.
        # Only start scheduler during actual server execution (runserver or run_apscheduler)
        if not ('runserver' in sys.argv or 'run_apscheduler' in sys.argv):
            return

        if 'runserver' in sys.argv and os.environ.get('RUN_MAIN') != 'true':
            return

        try:
            from .scheduler import start_scheduler
            start_scheduler()
        except ImportError:
            pass
