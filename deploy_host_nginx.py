#!/usr/bin/env python3
import os
import sys
import re
import subprocess
import glob

print("===========================================================")
print("Root Host Nginx Takeover for pgflow.online -> Attendance App")
print("===========================================================")

def run(cmd):
    print(f">> {cmd}")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if res.stdout.strip():
        print(f"[OUT] {res.stdout.strip()}")
    if res.stderr.strip():
        print(f"[ERR] {res.stderr.strip()}")
    return res

# 1. Open firewall ports
run("ufw allow 80/tcp || true")
run("ufw allow 443/tcp || true")
run("ufw allow 8080/tcp || true")

# 2. Locate active SSL Certificate on host
ssl_cert = None
ssl_key = None

for cert in glob.glob('/etc/letsencrypt/live/**/fullchain.pem', recursive=True) + glob.glob('/etc/ssl/certs/**/*.crt', recursive=True) + glob.glob('/etc/ssl/certs/**/*.pem', recursive=True):
    if os.path.isfile(cert) and 'snakeoil' not in cert:
        d = os.path.dirname(cert)
        for kn in ['privkey.pem', 'private.key', 'pgflow.online.key', 'ssl.key']:
            kp = os.path.join(d, kn)
            if os.path.isfile(kp):
                ssl_cert = cert
                ssl_key = kp
                break
        if ssl_cert:
            break

# If not found yet, extract from existing nginx configs
if not ssl_cert:
    for conf in glob.glob('/etc/nginx/**/*.conf', recursive=True) + glob.glob('/etc/nginx/sites-*/*'):
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

if not ssl_cert or not ssl_key:
    print("Generating fallback SSL for pgflow.online...")
    os.makedirs('/etc/ssl/certs', exist_ok=True)
    os.makedirs('/etc/ssl/private', exist_ok=True)
    ssl_cert = '/etc/ssl/certs/pgflow_auto.crt'
    ssl_key = '/etc/ssl/private/pgflow_auto.key'
    run(f'openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout {ssl_key} -out {ssl_cert} -subj "/CN=pgflow.online" || true')

print(f"Active SSL Cert: {ssl_cert}")
print(f"Active SSL Key:  {ssl_key}")

# 3. Disable all other sites in sites-enabled and conf.d
for d in ['/etc/nginx/sites-enabled', '/etc/nginx/conf.d']:
    if os.path.isdir(d):
        for f in os.listdir(d):
            fp = os.path.join(d, f)
            if f != 'attendance_app.conf':
                try:
                    if os.path.islink(fp) or os.path.isfile(fp):
                        os.remove(fp)
                        print(f"Removed old site: {fp}")
                except Exception as e:
                    print(f"Error removing {fp}: {e}")

# 4. Write attendance proxy configuration
ssl_block = ""
if ssl_cert and ssl_key and os.path.isfile(ssl_cert) and os.path.isfile(ssl_key):
    ssl_block = f"""
server {{
    listen 443 ssl default_server;
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

proxy_cfg = f"""# Attendance Proxy for pgflow.online
server {{
    listen 80 default_server;
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
{ssl_block}
"""

if os.path.isdir('/etc/nginx/sites-available'):
    avail = '/etc/nginx/sites-available/attendance_app.conf'
    with open(avail, 'w') as f:
        f.write(proxy_cfg)
    link = '/etc/nginx/sites-enabled/attendance_app.conf'
    if os.path.islink(link) or os.path.isfile(link):
        os.remove(link)
    os.symlink(avail, link)
    print(f"Created symlink {avail} -> {link}")

if os.path.isdir('/etc/nginx/conf.d'):
    with open('/etc/nginx/conf.d/attendance_app.conf', 'w') as f:
        f.write(proxy_cfg)

# 5. Stop any other container holding 80 or 443
ps = run("docker ps --format '{{.ID}} {{.Names}} {{.Ports}}'")
for line in ps.stdout.splitlines():
    if ('80->' in line or '443->' in line) and 'attendance' not in line:
        parts = line.split()
        if len(parts) >= 2:
            print(f"Stopping competing container: {parts[1]}")
            run(f"docker stop {parts[1]}")

# 6. Verify syntax and restart host Nginx
run("nginx -t")
run("systemctl restart nginx || service nginx restart || /etc/init.d/nginx restart")

print("=== Nginx reverse proxy actively running for Attendance App! ===")
