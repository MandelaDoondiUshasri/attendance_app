import os
import sys
import time
import django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from tracking.engine import sweep_stale
from django.conf import settings

INTERVAL = getattr(settings, 'TRACKING_STALE_TIMEOUT_SECONDS', 120)

while True:
    try:
        sweep_stale()
    except Exception as e:
        print(f"sweep err: {e}")
    time.sleep(INTERVAL)
