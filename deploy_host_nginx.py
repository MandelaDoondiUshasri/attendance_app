#!/usr/bin/env python3
import os
import sys
import re
import subprocess
import glob
import shutil

print("===========================================================")
print("Host Nginx Reconfiguration Script for pgflow.online")
print("===========================================================")

# Helper for running shell commands
def run_cmd(cmd):
    print(f"Running: {cmd}")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if res.stdout:
        print(f"[STDOUT] {res.stdout.strip()}")
    if res.stderr:
        print(f"[STDERR] {res.stderr.strip()}")
    return res

# 1. Search for SSL certificate and key paths across the system
ssl_cert = None
ssl_key = None

# Check standard cert locations
potential_certs = (
    glob.glob('/etc/letsencrypt/live/**/fullchain.pem', recursive=True) +
    glob.glob('/etc/ssl/certs/**/*.crt', recursive=True) +
    glob.glob('/etc/ssl/certs/**/*.pem', recursive=True) +
    glob.glob('/etc/nginx/ssl/**/*', recursive=True)
)

for cert in potential_certs:
    if os.path.isfile(cert):
        dirname = os.path.dirname(cert)
        for key_name in ['privkey.pem', 'private.key', 'pgflow.online.key', 'ssl.key']:
            key_path = os.path.join(dirname, key_name)
            if os.path.isfile(key_path):
                ssl_cert = cert
                ssl_key = key_path
                print(f"Found certificate & key: {ssl_cert} / {ssl_key}")
                break
        if ssl_cert:
            break

# If not found yet, inspect existing nginx configs
if not ssl_cert:
    for conf in glob.glob('/etc/nginx/**/*.conf', recursive=True) + glob.glob('/etc/nginx/sites-enabled/*') + glob.glob('/etc/nginx/sites-available/*'):
        if os.path.isfile(conf):
            try:
                with open(conf, 'r', errors='ignore') as f:
                    content = f.read()
                    cert_match = re.search(r'ssl_certificate\s+([^;]+);', content)
                    key_match = re.search(r'ssl_certificate_key\s+([^;]+);', content)
                    if cert_match and key_match:
                        c_path = cert_match.group(1).strip()
                        k_path = key_match.group(1).strip()
                        if os.path.isfile(c_path) and os.path.isfile(k_path):
                            ssl_cert = c_path
                            ssl_key = k_path
                            print(f"Found active SSL in config {conf}: {ssl_cert}")
                            break
            except Exception:
                pass

print(f"Final Selected SSL Cert: {ssl_cert}")
print(f"Final Selected SSL Key: {ssl_key}")

# 2. Disable all conflicting sites in /etc/nginx/sites-enabled/ and /etc/nginx/conf.d/
for folder in ['/etc/nginx/sites-enabled', '/etc/nginx/conf.d']:
    if os.path.isdir(folder):
        for item in os.listdir(folder):
            full_path = os.path.join(folder, item)
            if item != 'attendance_app.conf' and not item.endswith('.disabled_bak'):
                backup_path = full_path + '.disabled_bak'
                print(f"Disabling old config: {full_path} -> {backup_path}")
                try:
                    os.rename(full_path, backup_path)
                except Exception as e:
                    print(f"Failed to rename {full_path}: {e}")

# 3. Create unified reverse proxy config
ssl_block = ""
if ssl_cert and ssl_key:
    ssl_block = f"""
# HTTPS (Port 443) - Reverse Proxy to Attendance App
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

config_content = f"""# =========================================================================
# Attendance App - Host Nginx Unified Reverse Proxy
# =========================================================================

# HTTP (Port 80) - Reverse Proxy to Attendance App
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
{ssl_block}
"""

if os.path.isdir('/etc/nginx/sites-available'):
    avail_path = '/etc/nginx/sites-available/attendance_app.conf'
    with open(avail_path, 'w') as f:
        f.write(config_content)
    if os.path.isdir('/etc/nginx/sites-enabled'):
        target_link = '/etc/nginx/sites-enabled/attendance_app.conf'
        if os.path.islink(target_link) or os.path.isfile(target_link):
            os.remove(target_link)
        os.symlink(avail_path, target_link)
        print(f"Created symlink: {avail_path} -> {target_link}")

if os.path.isdir('/etc/nginx/conf.d'):
    conf_path = '/etc/nginx/conf.d/attendance_app.conf'
    with open(conf_path, 'w') as f:
        f.write(config_content)
    print(f"Wrote config: {conf_path}")

# 4. Test Nginx and reload
run_cmd("nginx -t")
run_cmd("systemctl reload nginx || systemctl restart nginx || service nginx restart")

print("=== Done configuring host Nginx proxy ===")
