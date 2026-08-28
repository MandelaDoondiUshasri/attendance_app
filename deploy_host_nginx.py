#!/usr/bin/env python3
import os
import re
import subprocess
import glob

print("===========================================================")
print("Python Host Nginx Reconfiguration for pgflow.online")
print("===========================================================")

# 1. Search for SSL certificate and key paths in /etc/nginx and /etc/letsencrypt
ssl_cert = None
ssl_key = None

# Check standard letsencrypt paths
for cert in glob.glob('/etc/letsencrypt/live/*/fullchain.pem') + glob.glob('/etc/ssl/certs/*.crt') + glob.glob('/etc/ssl/certs/*.pem'):
    if os.path.isfile(cert):
        dirname = os.path.dirname(cert)
        privkey = os.path.join(dirname, 'privkey.pem')
        if os.path.isfile(privkey):
            ssl_cert = cert
            ssl_key = privkey
            break

# If not found, inspect existing nginx configs
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
                            print(f"Found active SSL in {conf}: {ssl_cert}")
                            break
            except Exception as e:
                pass

print(f"Using SSL Cert: {ssl_cert}")
print(f"Using SSL Key: {ssl_key}")

# 2. Disable ALL existing sites in /etc/nginx/sites-enabled/ and /etc/nginx/conf.d/
for folder in ['/etc/nginx/sites-enabled', '/etc/nginx/conf.d']:
    if os.path.isdir(folder):
        for item in os.listdir(folder):
            full_path = os.path.join(folder, item)
            if os.path.isfile(full_path) or os.path.islink(full_path):
                if item != 'attendance_app.conf':
                    backup_path = full_path + '.old_backup'
                    print(f"Backing up and disabling: {full_path} -> {backup_path}")
                    try:
                        os.rename(full_path, backup_path)
                    except Exception as e:
                        print(f"Error renaming {full_path}: {e}")

# 3. Create a unified reverse proxy configuration
ssl_block = ""
if ssl_cert and ssl_key:
    ssl_block = f"""
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

config_content = f"""# =========================================================================
# Attendance App - Unified Reverse Proxy for pgflow.online & Default
# =========================================================================

# HTTP (Port 80)
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

target_path = "/etc/nginx/conf.d/attendance_app.conf"
if os.path.isdir('/etc/nginx/sites-available'):
    avail_path = '/etc/nginx/sites-available/attendance_app.conf'
    with open(avail_path, 'w') as f:
        f.write(config_content)
    if os.path.isdir('/etc/nginx/sites-enabled'):
        target_link = '/etc/nginx/sites-enabled/attendance_app.conf'
        if os.path.islink(target_link) or os.path.isfile(target_link):
            os.remove(target_link)
        os.symlink(avail_path, target_link)
        print(f"Linked {avail_path} -> {target_link}")
else:
    with open(target_path, 'w') as f:
        f.write(config_content)
    print(f"Wrote configuration to {target_path}")

# 4. Test and reload Nginx
print("Testing nginx configuration syntax...")
res = subprocess.run(['nginx', '-t'], capture_output=True, text=True)
print(res.stdout)
print(res.stderr)

if res.returncode == 0:
    print("Nginx syntax test passed! Restarting nginx service...")
    subprocess.run(['systemctl', 'restart', 'nginx'])
    print("SUCCESS: Nginx is now proxying pgflow.online to Attendance App on port 8080!")
else:
    print("Nginx test failed! Reverting backups...")
    for folder in ['/etc/nginx/sites-enabled', '/etc/nginx/conf.d']:
        if os.path.isdir(folder):
            for item in os.listdir(folder):
                if item.endswith('.old_backup'):
                    orig = os.path.join(folder, item[:-11])
                    os.rename(os.path.join(folder, item), orig)
