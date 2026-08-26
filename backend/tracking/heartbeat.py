import os
import sys
import time
import django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from tracking.engine import sweep_stale
while True:
    try:
        sweep_stale()
    except Exception as e:
        print(f"sweep err: {e}")
    time.sleep(120)
