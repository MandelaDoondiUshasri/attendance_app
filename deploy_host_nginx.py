#!/usr/bin/env python3
import os
import sys
import re
import subprocess
import glob

print("===========================================================")
print("Host Nginx & Port 80/443 Takeover for Attendance App")
print("===========================================================")

def run(cmd):
    print(f">> {cmd}")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if res.stdout.strip():
        print(f"[OUT] {res.stdout.strip()}")
    if res.stderr.strip():
        print(f"[ERR] {res.stderr.strip()}")
    return res

# 1. Inspect running docker containers
print("--- Checking Running Docker Containers ---")
ps_res = run("docker ps --format '{{.ID}} {{.Names}} {{.Ports}}'")

# If there is another docker container bound to 80 or 443 (e.g., slotifynest), stop it
for line in ps_res.stdout.splitlines():
    if ('80->' in line or '443->' in line or '0.0.0.0:80' in line or '0.0.0.0:443' in line) and 'attendance' not in line:
        parts = line.split()
        if len(parts) >= 2:
            c_name = parts[1]
            print(f"Stopping competing container holding 80/443: {c_name}")
            run(f"docker stop {c_name}")

# 2. Inspect which process is listening on 80 and 443
print("--- Checking Port 80 and 443 Listeners ---")
run("ss -tulpn | grep -E ':(80|443|8080) ' || netstat -tulpn | grep -E ':(80|443|8080) ' || true")

# 3. Locate SSL Certificates
ssl_cert = None
ssl_key = None

for cert in glob.glob('/etc/letsencrypt/live/**/fullchain.pem', recursive=True) + glob.glob('/etc/ssl/certs/**/*.crt', recursive=True) + glob.glob('/etc/ssl/certs/**/*.pem', recursive=True):
    if os.path.isfile(cert):
        dirname = os.path.dirname(cert)
        for key_name in ['privkey.pem', 'private.key', 'pgflow.online.key', 'ssl.key']:
            kp = os.path.join(dirname, key_name)
            if os.path.isfile(kp):
                ssl_cert = cert
                ssl_key = kp
                break
        if ssl_cert:
            break

if not ssl_cert:
    for conf in glob.glob('/etc/nginx/**/*.conf', recursive=True) + glob.glob('/etc/nginx/sites-enabled/*') + glob.glob('/etc/nginx/sites-available/*'):
        if os.path.isfile(conf):
            try:
                with open(conf, 'r', errors='ignore') as f:
                    c = f.read()
                    cm = re.search(r'ssl_certificate\s+([^;]+);', c)
                    km = re.search(r'ssl_certificate_key\s+([^;]+);', c)
                    if cm and km:
                        cp = cm.group(1).strip()
                        kp = km.group(1).strip()
                        if os.path.isfile(cp) and os.path.isfile(kp):
                            ssl_cert = cp
                            ssl_key = kp
                            break
            except Exception:
                pass

print(f"SSL Cert: {ssl_cert}")
print(f"SSL Key: {ssl_key}")

# 4. Disable all other sites in /etc/nginx/sites-enabled/ and /etc/nginx/conf.d/
for d in ['/etc/nginx/sites-enabled', '/etc/nginx/conf.d']:
    if os.path.isdir(d):
        for f in os.listdir(d):
            fp = os.path.join(d, f)
            if f != 'attendance_app.conf' and not f.endswith('.bak'):
                print(f"Disabling: {fp}")
                try:
                    os.rename(fp, fp + '.bak')
                except Exception as e:
                    print(f"Rename error: {e}")

# 5. Write unified reverse proxy to Attendance App (127.0.0.1:8080)
ssl_snippet = ""
if ssl_cert and ssl_key:
    ssl_snippet = f"""
# HTTPS (Port 443)
server {{
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name pgflow.online www.pgflow.online _;

    ssl_certificate {ssl_cert};
    ssl_certificate_key {ssl_key};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    location / {{
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }}

    location /ws/ {{
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }}
}}
"""

proxy_cfg = f"""# Unified Attendance App Proxy for pgflow.online & default
server {{
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name pgflow.online www.pgflow.online _;

    client_max_body_size 50M;

    location / {{
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    location /ws/ {{
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }}
}}
{ssl_snippet}
"""

if os.path.isdir('/etc/nginx/sites-available'):
    cfg_file = '/etc/nginx/sites-available/attendance_app.conf'
    with open(cfg_file, 'w') as f:
        f.write(proxy_cfg)
    if os.path.isdir('/etc/nginx/sites-enabled'):
        link = '/etc/nginx/sites-enabled/attendance_app.conf'
        if os.path.islink(link) or os.path.isfile(link):
            os.remove(link)
        os.symlink(cfg_file, link)
elif os.path.isdir('/etc/nginx/conf.d'):
    cfg_file = '/etc/nginx/conf.d/attendance_app.conf'
    with open(cfg_file, 'w') as f:
        f.write(proxy_cfg)

# 6. Test and restart Nginx
run("nginx -t")
run("systemctl restart nginx || service nginx restart || /etc/init.d/nginx restart")

print("=== Takeover Complete ===")
