from django.core.management.base import BaseCommand
from django.db.models import Count
from notifications.models import Notification, DevicePushSubscription


class Command(BaseCommand):
    help = "Displays operational metrics and reliability statistics for notifications."

    def handle(self, *args, **options):
        total = Notification.objects.count()
        status_counts = dict(
            Notification.objects.values_list('status').annotate(count=Count('id'))
        )
        unread = Notification.objects.filter(is_read=False).count()
        read = Notification.objects.filter(is_read=True).count()
        active_subs = DevicePushSubscription.objects.filter(is_active=True).count()
        total_subs = DevicePushSubscription.objects.count()

        self.stdout.write(self.style.MIGRATE_HEADING("=== Notification Reliability Metrics ==="))
        self.stdout.write(f"Total Notifications: {total}")
        self.stdout.write("--- Status Breakdown ---")
        for st, count in status_counts.items():
            self.stdout.write(f"  - {st}: {count}")
        self.stdout.write("--- Inbox Engagement ---")
        self.stdout.write(f"  - Unread: {unread}")
        self.stdout.write(f"  - Read: {read}")
        self.stdout.write("--- Multi-Device Subscriptions ---")
        self.stdout.write(f"  - Active: {active_subs}")
        self.stdout.write(f"  - Total: {total_subs}")
