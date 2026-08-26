import json
import math
import time
import redis
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import os
r = redis.Redis.from_url(os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0'))
def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
def handle_loc(eid, name, lat, lon, img=''):
    key = f"eloc:{eid}"
    ts = time.time()
    prev = r.get(key)
    moved = False
    if prev:
        old = json.loads(prev)
        dist = haversine(old['lat'], old['lon'], lat, lon)
        if dist > 50:
            moved = True
    else:
        moved = True
    r.set(key, json.dumps({'lat': lat, 'lon': lon, 'ts': ts, 'name': name, 'img': img}))
    r.sadd('eloc:active', eid)
    if moved:
        layer = get_channel_layer()
        payload = {'type': 'ceo.alert', 'eid': eid, 'name': name, 'lat': lat, 'lon': lon, 'ts': ts, 'img': img}
        async_to_sync(layer.group_send)('ceo_alerts', payload)
    return moved
def sweep_stale():
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
        if age > 120:
            r.delete(key)
            r.srem('eloc:active', eid)
            payload = {'type': 'ceo.alert', 'eid': eid, 'status': 'offline'}
            async_to_sync(layer.group_send)('ceo_alerts', payload)
