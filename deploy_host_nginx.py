#!/usr/bin/env python3
import os
import sys
import re
import subprocess
import glob

print("===========================================================")
print("Deep Nginx & Slotify Nest Replacement for pgflow.online")
print("===========================================================")

def run(cmd):
    print(f">> {cmd}")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if res.stdout.strip():
        print(f"[OUT] {res.stdout.strip()}")
    if res.stderr.strip():
        print(f"[ERR] {res.stderr.strip()}")
    return res

# 1. Inspect and extract SSL cert from all files in /etc/nginx/
ssl_cert = None
ssl_key = None

for conf in glob.glob('/etc/nginx/**/*.conf', recursive=True) + glob.glob('/etc/nginx/sites-*/*') + ['/etc/nginx/nginx.conf']:
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
                        print(f"Extracted SSL from {conf}: {ssl_cert}")
                        break
        except Exception:
            pass

if not ssl_cert:
    for cert in glob.glob('/etc/letsencrypt/live/**/fullchain.pem', recursive=True) + glob.glob('/etc/ssl/certs/**/*.crt', recursive=True):
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

print(f"Final SSL: {ssl_cert} / {ssl_key}")

# 2. Check if /etc/nginx/nginx.conf has inline server blocks
if os.path.isfile('/etc/nginx/nginx.conf'):
    with open('/etc/nginx/nginx.conf', 'r') as f:
        nginx_main = f.read()
    if 'server {' in nginx_main:
        print("Found inline server block in /etc/nginx/nginx.conf. Cleaning it...")
        # Create standard clean nginx.conf
        clean_nginx_conf = """user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 1024;
}

http {
    sendfile on;
    tcp_nopush on;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    gzip on;

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
"""
        with open('/etc/nginx/nginx.conf.bak', 'w') as f:
            f.write(nginx_main)
        with open('/etc/nginx/nginx.conf', 'w') as f:
            f.write(clean_nginx_conf)
        print("Wrote clean /etc/nginx/nginx.conf")

# 3. Clean out all other files in conf.d and sites-enabled
for d in ['/etc/nginx/sites-enabled', '/etc/nginx/conf.d']:
    if os.path.isdir(d):
        for f in os.listdir(d):
            fp = os.path.join(d, f)
            if f != 'attendance_app.conf':
                try:
                    if os.path.islink(fp) or os.path.isfile(fp):
                        os.remove(fp)
                        print(f"Removed: {fp}")
                except Exception as e:
                    print(f"Error removing {fp}: {e}")

# 4. Write attendance proxy
ssl_part = ""
if ssl_cert and ssl_key:
    ssl_part = f"""
server {{
    listen 443 ssl default_server;
    server_name pgflow.online www.pgflow.online _;

    ssl_certificate {ssl_cert};
    ssl_certificate_key {ssl_key};

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

cfg = f"""# Attendance Proxy
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
{ssl_part}
"""

if os.path.isdir('/etc/nginx/sites-available'):
    avail = '/etc/nginx/sites-available/attendance_app.conf'
    with open(avail, 'w') as f:
        f.write(cfg)
    link = '/etc/nginx/sites-enabled/attendance_app.conf'
    if os.path.islink(link) or os.path.isfile(link):
        os.remove(link)
    os.symlink(avail, link)
    print(f"Linked {avail} -> {link}")

if os.path.isdir('/etc/nginx/conf.d'):
    with open('/etc/nginx/conf.d/attendance_app.conf', 'w') as f:
        f.write(cfg)

# 5. Stop any other container that might be listening on 80/443
ps = run("docker ps --format '{{.ID}} {{.Names}} {{.Ports}}'")
for line in ps.stdout.splitlines():
    if ('80->' in line or '443->' in line or '0.0.0.0:80' in line or '0.0.0.0:443' in line) and 'attendance' not in line:
        parts = line.split()
        if len(parts) >= 2:
            print(f"Stopping container: {parts[1]}")
            run(f"docker stop {parts[1]}")

# 6. Test & Restart Nginx
run("nginx -t")
run("systemctl restart nginx || service nginx restart")
print("=== Deployment script complete ===")
