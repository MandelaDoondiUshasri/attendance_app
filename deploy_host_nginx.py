#!/usr/bin/env python3
import os
import sys
import re
import subprocess
import glob

print("===========================================================")
print("Host Nginx Clean Configuration for pgflow.online")
print("===========================================================")

def run(cmd):
    print(f">> {cmd}")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if res.stdout.strip():
        print(f"[OUT] {res.stdout.strip()}")
    if res.stderr.strip():
        print(f"[ERR] {res.stderr.strip()}")
    return res

# 1. Ensure SSL Certificate exists or generate fallback so HTTPS port 443 never fails
ssl_cert = None
ssl_key = None

for cert in glob.glob('/etc/letsencrypt/live/**/fullchain.pem', recursive=True) + glob.glob('/etc/ssl/certs/**/*.crt', recursive=True) + glob.glob('/etc/ssl/certs/**/*.pem', recursive=True):
    if os.path.isfile(cert) and 'snakeoil' not in cert:
        dirname = os.path.dirname(cert)
        for key_name in ['privkey.pem', 'private.key', 'pgflow.online.key', 'ssl.key']:
            kp = os.path.join(dirname, key_name)
            if os.path.isfile(kp):
                ssl_cert = cert
                ssl_key = kp
                break
        if ssl_cert:
            break

if not ssl_cert or not ssl_key or not os.path.isfile(ssl_cert) or not os.path.isfile(ssl_key):
    print("Generating fallback SSL certificate for pgflow.online...")
    os.makedirs('/etc/ssl/certs', exist_ok=True)
    os.makedirs('/etc/ssl/private', exist_ok=True)
    ssl_cert = '/etc/ssl/certs/pgflow_auto.crt'
    ssl_key = '/etc/ssl/private/pgflow_auto.key'
    run(f'openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout {ssl_key} -out {ssl_cert} -subj "/CN=pgflow.online" || true')

print(f"SSL Cert: {ssl_cert}")
print(f"SSL Key: {ssl_key}")

# 2. Clean out conflicting configs
for d in ['/etc/nginx/sites-enabled', '/etc/nginx/conf.d']:
    if os.path.isdir(d):
        for f in os.listdir(d):
            fp = os.path.join(d, f)
            if f != 'attendance_app.conf':
                print(f"Removing old config: {fp}")
                try:
                    if os.path.islink(fp) or os.path.isfile(fp):
                        os.remove(fp)
                except Exception as e:
                    print(f"Error removing {fp}: {e}")

# 3. Write clean proxy config without [::] IPv6 (prevents address family errors)
config_text = f"""# Unified Attendance App Proxy for pgflow.online & Default
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

if os.path.isdir('/etc/nginx/sites-available'):
    cfg_file = '/etc/nginx/sites-available/attendance_app.conf'
    with open(cfg_file, 'w') as f:
        f.write(config_text)
    if os.path.isdir('/etc/nginx/sites-enabled'):
        link = '/etc/nginx/sites-enabled/attendance_app.conf'
        if os.path.islink(link) or os.path.isfile(link):
            os.remove(link)
        os.symlink(cfg_file, link)
elif os.path.isdir('/etc/nginx/conf.d'):
    cfg_file = '/etc/nginx/conf.d/attendance_app.conf'
    with open(cfg_file, 'w') as f:
        f.write(config_text)

# 4. Verify syntax & Start Nginx
run("nginx -t")
run("systemctl restart nginx || service nginx restart || nginx -s reload")
print("=== Complete! ===")
