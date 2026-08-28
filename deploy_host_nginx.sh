#!/usr/bin/env bash
set -e

echo "=== Configuring Host Nginx for pgflow.online Reverse Proxy ==="

# Check if nginx is running on host
if ! command -v nginx &> /dev/null; then
    echo "Host nginx not found, skipping host proxy setup."
    exit 0
fi

# Detect SSL certs for pgflow.online
SSL_CERT=""
SSL_KEY=""

if [ -f "/etc/letsencrypt/live/pgflow.online/fullchain.pem" ]; then
    SSL_CERT="/etc/letsencrypt/live/pgflow.online/fullchain.pem"
    SSL_KEY="/etc/letsencrypt/live/pgflow.online/privkey.pem"
elif [ -f "/etc/ssl/certs/pgflow.online.crt" ]; then
    SSL_CERT="/etc/ssl/certs/pgflow.online.crt"
    SSL_KEY="/etc/ssl/private/pgflow.online.key"
else
    # Search /etc/nginx for existing ssl_certificate referencing pgflow
    FOUND_CERT=$(grep -rn "ssl_certificate " /etc/nginx/ 2>/dev/null | grep -i "pgflow" | head -n 1 | awk '{print $2}' | tr -d ';' || true)
    FOUND_KEY=$(grep -rn "ssl_certificate_key " /etc/nginx/ 2>/dev/null | grep -i "pgflow" | head -n 1 | awk '{print $2}' | tr -d ';' || true)
    if [ -n "$FOUND_CERT" ] && [ -f "$FOUND_CERT" ]; then
        SSL_CERT="$FOUND_CERT"
        SSL_KEY="$FOUND_KEY"
    fi
fi

TARGET_CONF="/etc/nginx/conf.d/pgflow_attendance.conf"
if [ -d "/etc/nginx/sites-available" ]; then
    TARGET_CONF="/etc/nginx/sites-available/pgflow_attendance.conf"
fi

echo "Writing proxy configuration to $TARGET_CONF..."

cat << 'EOF' > /tmp/pgflow_attendance_http.conf
# HTTP server block for pgflow.online
server {
    listen 80;
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
    echo "Found SSL certificate at $SSL_CERT. Adding HTTPS (443) proxy configuration..."
    cat << EOF >> /tmp/pgflow_attendance_http.conf

# HTTPS server block for pgflow.online
server {
    listen 443 ssl http2;
    server_name pgflow.online www.pgflow.online;

    ssl_certificate $SSL_CERT;
    ssl_certificate_key $SSL_KEY;

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

cp /tmp/pgflow_attendance_http.conf "$TARGET_CONF"

if [ -d "/etc/nginx/sites-enabled" ]; then
    ln -sf "$TARGET_CONF" /etc/nginx/sites-enabled/pgflow_attendance.conf
fi

echo "Testing nginx syntax..."
if nginx -t; then
    echo "Nginx syntax is valid. Reloading nginx..."
    systemctl reload nginx || service nginx reload || nginx -s reload
    echo "Host Nginx reloaded successfully! pgflow.online is now connected to Attendance App on port 8080."
else
    echo "Nginx test failed. Reverting..."
    rm -f "$TARGET_CONF" /etc/nginx/sites-enabled/pgflow_attendance.conf
    exit 1
fi
