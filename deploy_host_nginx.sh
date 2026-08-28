#!/bin/bash

echo "==========================================================="
echo "Configuring Host Nginx for pgflow.online Reverse Proxy"
echo "==========================================================="

if ! command -v nginx &> /dev/null; then
    echo "Host nginx command not found."
    exit 0
fi

# Detect SSL Certificate & Key
SSL_CERT=""
SSL_KEY=""

for cert in /etc/letsencrypt/live/pgflow.online*/fullchain.pem /etc/letsencrypt/live/*/fullchain.pem /etc/ssl/certs/pgflow.online*.crt /etc/ssl/certs/*pgflow*.pem; do
    if [ -f "$cert" ]; then
        SSL_CERT="$cert"
        KEY_DIR=$(dirname "$cert")
        if [ -f "$KEY_DIR/privkey.pem" ]; then
            SSL_KEY="$KEY_DIR/privkey.pem"
        elif [ -f "/etc/ssl/private/pgflow.online.key" ]; then
            SSL_KEY="/etc/ssl/private/pgflow.online.key"
        fi
        break
    fi
done

if [ -z "$SSL_CERT" ]; then
    SSL_CERT=$(grep -rh "ssl_certificate " /etc/nginx/ 2>/dev/null | grep -v "#" | head -n 1 | awk '{print $2}' | tr -d ';' || echo "")
    SSL_KEY=$(grep -rh "ssl_certificate_key " /etc/nginx/ 2>/dev/null | grep -v "#" | head -n 1 | awk '{print $2}' | tr -d ';' || echo "")
fi

echo "Detected SSL Cert: $SSL_CERT"
echo "Detected SSL Key: $SSL_KEY"

# Backup all other configs in sites-enabled to prevent default_server conflict
echo "Backing up other sites-enabled configs..."
if [ -d "/etc/nginx/sites-enabled" ]; then
    for f in /etc/nginx/sites-enabled/*; do
        if [ -f "$f" ] && [ "$(basename "$f")" != "pgflow_attendance.conf" ]; then
            echo "Moving $f to backup..."
            mv "$f" "${f}.disabled_old_site"
        fi
    done
fi

if [ -d "/etc/nginx/conf.d" ]; then
    for f in /etc/nginx/conf.d/*; do
        if [ -f "$f" ] && [ "$(basename "$f")" != "pgflow_attendance.conf" ]; then
            echo "Moving $f to backup..."
            mv "$f" "${f}.disabled_old_site"
        fi
    done
fi

TARGET_CONF="/etc/nginx/conf.d/pgflow_attendance.conf"
if [ -d "/etc/nginx/sites-available" ]; then
    TARGET_CONF="/etc/nginx/sites-available/pgflow_attendance.conf"
fi

echo "Writing unified reverse proxy configuration to $TARGET_CONF..."

cat << 'EOF' > /tmp/pgflow_proxy.conf
# =========================================================================
# Attendance App - Default & pgflow.online Reverse Proxy
# =========================================================================

# HTTP (Port 80) - Catch all and proxy to Attendance App
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name pgflow.online www.pgflow.online _;

    client_max_body_size 50M;

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

# Add HTTPS (Port 443) block
if [ -n "$SSL_CERT" ] && [ -f "$SSL_CERT" ] && [ -n "$SSL_KEY" ] && [ -f "$SSL_KEY" ]; then
    echo "Adding HTTPS (Port 443 default_server) with SSL..."
    cat << EOF >> /tmp/pgflow_proxy.conf

# HTTPS (Port 443) - Catch all SSL and proxy to Attendance App
server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name pgflow.online www.pgflow.online _;

    ssl_certificate $SSL_CERT;
    ssl_certificate_key $SSL_KEY;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

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

cp /tmp/pgflow_proxy.conf "$TARGET_CONF"

if [ -d "/etc/nginx/sites-enabled" ]; then
    ln -sf "$TARGET_CONF" /etc/nginx/sites-enabled/pgflow_attendance.conf
fi

echo "Validating Nginx configuration..."
nginx -t

echo "Reloading Nginx service..."
systemctl reload nginx || service nginx reload || nginx -s reload || systemctl restart nginx || true

echo "=== Host Nginx is now actively forwarding all traffic to Attendance App on port 8080 ==="
