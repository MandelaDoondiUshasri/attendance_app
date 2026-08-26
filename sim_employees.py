import requests
import time
import threading
BASE = "http://127.0.0.1:8000"
AUTH = f"{BASE}/api/v1/auth/login/"
LOC = f"{BASE}/api/v1/loc/update/"
emps = [
    {"email": "emp1@frg.com", "pw": "Test@12345", "lat": 17.3850, "lon": 78.4867},
    {"email": "emp2@frg.com", "pw": "Test@12345", "lat": 12.9716, "lon": 77.5946},
    {"email": "emp3@frg.com", "pw": "Test@12345", "lat": 28.6139, "lon": 77.2090},
    {"email": "emp4@frg.com", "pw": "Test@12345", "lat": 19.0760, "lon": 72.8777},
    {"email": "emp5@frg.com", "pw": "Test@12345", "lat": 13.0827, "lon": 80.2707},
]
def get_tok(email, pw):
    r = requests.post(AUTH, json={"email": email, "password": pw})
    if r.status_code == 200:
        return r.json().get("access")
    return None
def run(emp):
    tok = get_tok(emp["email"], emp["pw"])
    if not tok:
        print(f"auth fail: {emp['email']}")
        return
    hdr = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    lat = emp["lat"]
    lon = emp["lon"]
    i = 0
    while True:
        lat += 0.0006
        lon += 0.0006
        r = requests.post(LOC, json={"lat": round(lat, 6), "lon": round(lon, 6)}, headers=hdr)
        i += 1
        tag = "MOVED" if r.status_code == 200 and r.json().get("moved") else "sent"
        print(f"[{emp['email']}] #{i} {tag} -> {lat:.6f},{lon:.6f}")
        time.sleep(2)
threads = []
for e in emps:
    t = threading.Thread(target=run, args=(e,), daemon=True)
    t.start()
    threads.append(t)
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("stopped")
