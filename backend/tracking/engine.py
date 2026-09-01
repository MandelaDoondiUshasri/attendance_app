import json
import math
import time
import redis
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.conf import settings as django_settings
import os

r = redis.Redis.from_url(os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0'))

# ─── Configurable thresholds (loaded from Django settings with fallbacks) ───
MIN_DISTANCE = getattr(django_settings, 'TRACKING_MIN_DISTANCE_METERS', 50)
STALE_TIMEOUT = getattr(django_settings, 'TRACKING_STALE_TIMEOUT_SECONDS', 120)
NOTIF_COOLDOWN = getattr(django_settings, 'TRACKING_NOTIFICATION_COOLDOWN_SECONDS', 300)


def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance in meters between two GPS coordinates."""
    R = 6371000
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def handle_loc(eid, name, lat, lon, img='', accuracy=None, speed=None, heading=None):
    """
    Process an incoming location update from an employee.
    Stores latest location in Redis, determines if meaningful movement occurred,
    and broadcasts to CEO/HR via WebSocket channel layer.
    Returns (moved: bool, is_new: bool).
    """
    key = f"eloc:{eid}"
    ts = time.time()
    prev = r.get(key)
    moved = False
    is_new = False

    if prev:
        old = json.loads(prev)
        dist = haversine(old['lat'], old['lon'], lat, lon)
        if dist > MIN_DISTANCE:
            moved = True
    else:
        moved = True
        is_new = True

    # Build location record
    record = {
        'lat': lat,
        'lon': lon,
        'ts': ts,
        'name': name,
        'img': img,
        'status': 'live',
    }
    if accuracy is not None:
        record['accuracy'] = accuracy
    if speed is not None:
        record['speed'] = speed
    if heading is not None:
        record['heading'] = heading

    r.set(key, json.dumps(record))
    r.sadd('eloc:active', eid)

    # Broadcast to CEO/HR WebSocket group on any update (moved or heartbeat)
    layer = get_channel_layer()
    payload = {
        'type': 'ceo.alert',
        'eid': eid,
        'name': name,
        'lat': lat,
        'lon': lon,
        'ts': ts,
        'img': img,
        'status': 'live',
    }
    if accuracy is not None:
        payload['accuracy'] = accuracy
    if speed is not None:
        payload['speed'] = speed

    if moved:
        async_to_sync(layer.group_send)('ceo_alerts', payload)
        # Send throttled notification to management
        _notify_management_throttled(eid, name, is_new)
    else:
        # Still broadcast for heartbeat/time updates (CEO map shows "Updated Xs ago")
        async_to_sync(layer.group_send)('ceo_alerts', payload)

    return moved, is_new


def _notify_management_throttled(eid, name, is_new):
    """Send a notification to CEO/HR about employee location, throttled to avoid spam."""
    cooldown_key = f"eloc:notif:{eid}"
    if r.get(cooldown_key):
        return  # Still in cooldown, skip

    try:
        from notifications.services import NotificationService
        from notifications.models import NotificationType

        if is_new:
            title = "Employee Location Active"
            message = f"{name} has started sharing their live location."
        else:
            title = "Employee Location Updated"
            message = f"{name}'s location was updated with a significant movement."

        NotificationService.notify_management(
            title=title,
            message=message,
            notification_type=NotificationType.LOCATION_UPDATE
        )
        # Set cooldown
        r.setex(cooldown_key, NOTIF_COOLDOWN, '1')
    except Exception as e:
        print(f"Location notification error: {e}")


def handle_stop(eid):
    """Explicitly mark an employee as offline (e.g. on logout or permission revoke)."""
    key = f"eloc:{eid}"
    r.delete(key)
    r.srem('eloc:active', eid)
    # Clear notification cooldown
    r.delete(f"eloc:notif:{eid}")

    layer = get_channel_layer()
    payload = {'type': 'ceo.alert', 'eid': eid, 'status': 'offline'}
    async_to_sync(layer.group_send)('ceo_alerts', payload)


def sweep_stale():
    """Remove employees whose last location update is older than STALE_TIMEOUT."""
    now = time.time()
    members = r.smembers('eloc:active')
    layer = get_channel_layer()
    for raw in members:
        eid = raw.decode() if isinstance(raw, bytes) else raw
        key = f"eloc:{eid}"
        data = r.get(key)
        if not data:
            r.srem('eloc:active', eid)
            continue
        rec = json.loads(data)
        age = now - rec.get('ts', 0)
        if age > STALE_TIMEOUT:
            r.delete(key)
            r.srem('eloc:active', eid)
            r.delete(f"eloc:notif:{eid}")
            payload = {'type': 'ceo.alert', 'eid': eid, 'status': 'offline'}
            async_to_sync(layer.group_send)('ceo_alerts', payload)


def get_all_active_locations():
    """Return list of all currently-active employee locations from Redis, excluding inactive/CEO/HR."""
    from employees.models import Employee, EmploymentStatus
    from accounts.models import Role
    
    locations = []
    now = time.time()
    members = r.smembers('eloc:active')
    
    # Batch query the database for these eids to filter out inactive/CEO/HR
    eids = [raw.decode() if isinstance(raw, bytes) else raw for raw in members]
    if not eids:
        return locations
        
    valid_emps = Employee.objects.filter(
        employee_id__in=eids, 
        employment_status=EmploymentStatus.ACTIVE
    ).select_related('user')
    
    valid_eids = set()
    for emp in valid_emps:
        if emp.user and not (emp.user.is_ceo or emp.user.is_hr):
            valid_eids.add(emp.employee_id)
            
    for eid in eids:
        key = f"eloc:{eid}"
        data = r.get(key)
        
        if eid not in valid_eids:
            # Clean up stale/invalid keys while we're at it
            if data:
                r.delete(key)
            r.srem('eloc:active', eid)
            r.delete(f"eloc:notif:{eid}")
            continue
            
        if data:
            rec = json.loads(data)
            rec['eid'] = eid
            # Determine live vs stale status
            age = now - rec.get('ts', 0)
            if age > 60:
                rec['status'] = 'stale'
            else:
                rec['status'] = 'live'
            locations.append(rec)
    return locations


def get_employee_location(eid):
    """Return a single employee's latest location or None."""
    key = f"eloc:{eid}"
    data = r.get(key)
    if data:
        rec = json.loads(data)
        rec['eid'] = eid
        return rec
    return None
