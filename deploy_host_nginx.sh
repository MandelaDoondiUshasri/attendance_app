#!/usr/bin/env bash
set -e

echo "==========================================================="
echo "Configuring Host Nginx for pgflow.online Reverse Proxy"
echo "==========================================================="

if ! command -v nginx &> /dev/null; then
    echo "Host nginx not found, skipping host proxy setup."
    exit 0
fi

# 1. Detect SSL certs for pgflow.online on the host
SSL_CERT=""
SSL_KEY=""

if [ -f "/etc/letsencrypt/live/pgflow.online/fullchain.pem" ]; then
    SSL_CERT="/etc/letsencrypt/live/pgflow.online/fullchain.pem"
    SSL_KEY="/etc/letsencrypt/live/pgflow.online/privkey.pem"
elif [ -f "/etc/ssl/certs/pgflow.online.crt" ]; then
    SSL_CERT="/etc/ssl/certs/pgflow.online.crt"
    SSL_KEY="/etc/ssl/private/pgflow.online.key"
else
    FOUND_CERT=$(grep -rn "ssl_certificate " /etc/nginx/ 2>/dev/null | grep -i "pgflow" | head -n 1 | awk '{print $2}' | tr -d ';' || true)
    FOUND_KEY=$(grep -rn "ssl_certificate_key " /etc/nginx/ 2>/dev/null | grep -i "pgflow" | head -n 1 | awk '{print $2}' | tr -d ';' || true)
    if [ -n "$FOUND_CERT" ] && [ -f "$FOUND_CERT" ]; then
        SSL_CERT="$FOUND_CERT"
        SSL_KEY="$FOUND_KEY"
    fi
fi

echo "SSL Certificate detected: $SSL_CERT"

# 2. Disable / Backup any previous nginx configs serving the old site for pgflow.online
echo "Checking for previous configs that engaged pgflow.online..."
for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*; do
    if [ -f "$f" ] && [ "$(basename "$f")" != "pgflow_attendance.conf" ]; then
        if grep -qi "pgflow.online" "$f" 2>/dev/null; then
            echo "Found existing config for pgflow.online in $f. Backing up and disabling..."
            mv "$f" "${f}.backup_old_site"
        fi
    fi
done

# 3. Create the new proxy configuration targeting the Attendance App on port 8080
TARGET_CONF="/etc/nginx/sites-available/pgflow_attendance.conf"
if [ ! -d "/etc/nginx/sites-available" ]; then
    TARGET_CONF="/etc/nginx/conf.d/pgflow_attendance.conf"
fi

echo "Generating clean reverse proxy config at $TARGET_CONF..."

cat << 'EOF' > /tmp/pgflow_attendance.conf
# =========================================================================
# Attendance App - pgflow.online Proxy
# =========================================================================

# HTTP (Port 80)
server {
    listen 80;
    listen [::]:80;
    server_name pgflow.online www.pgflow.online;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
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
    }
}
EOF

if [ -n "$SSL_CERT" ] && [ -f "$SSL_CERT" ]; then
    echo "Adding HTTPS (Port 443) block with SSL..."
    cat << EOF >> /tmp/pgflow_attendance.conf

# HTTPS (Port 443)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name pgflow.online www.pgflow.online;

    ssl_certificate $SSL_CERT;
    ssl_certificate_key $SSL_KEY;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /ws/ {
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
    }
}
EOF
fi

cp /tmp/pgflow_attendance.conf "$TARGET_CONF"

if [ -d "/etc/nginx/sites-enabled" ]; then
    ln -sf "$TARGET_CONF" /etc/nginx/sites-enabled/pgflow_attendance.conf
fi

# 4. Verify & Reload Nginx
echo "Testing Nginx syntax..."
if nginx -t; then
    echo "Nginx configuration valid. Reloading..."
    systemctl reload nginx || service nginx reload || nginx -s reload
    echo "SUCCESS: Host Nginx is now forwarding pgflow.online directly to Attendance App!"
else
    echo "ERROR: Nginx test failed. Restoring old configs..."
    rm -f "$TARGET_CONF" /etc/nginx/sites-enabled/pgflow_attendance.conf
    for f in /etc/nginx/sites-enabled/*.backup_old_site /etc/nginx/conf.d/*.backup_old_site; do
        if [ -f "$f" ]; then
            mv "$f" "${f%.backup_old_site}"
        fi
    done
    exit 1
fi
