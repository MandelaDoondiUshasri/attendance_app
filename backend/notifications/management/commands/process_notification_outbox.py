import time
import sys
from django.core.management.base import BaseCommand
from notifications.services import NotificationService


class Command(BaseCommand):
    help = "Processes pending notification outbox records and recovers stale or retrying jobs."

    def add_arguments(self, parser):
        parser.add_argument(
            '--daemon',
            action='store_true',
            help='Run continuously as a background daemon process.',
        )
        parser.add_argument(
            '--interval',
            type=int,
            default=15,
            help='Sleep interval in seconds between passes in daemon mode (default: 15s).',
        )

    def handle(self, *args, **options):
        daemon = options['daemon']
        interval = options['interval']

        self.stdout.write(self.style.SUCCESS("Starting Notification Outbox Processor..."))

        if not daemon:
            recovered = NotificationService.recover_stale_and_pending_jobs()
            self.stdout.write(self.style.SUCCESS(f"Outbox sweep finished. Processed/Recovered {recovered} jobs."))
            return

        self.stdout.write(self.style.NOTICE(f"Running in daemon mode. Polling every {interval} seconds. Press Ctrl+C to stop."))
        try:
            while True:
                recovered = NotificationService.recover_stale_and_pending_jobs()
                if recovered > 0:
                    self.stdout.write(self.style.SUCCESS(f"Processed/Recovered {recovered} jobs."))
                time.sleep(interval)
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("Outbox processor daemon stopped."))
            sys.exit(0)
