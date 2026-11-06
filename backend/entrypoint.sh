#!/bin/sh
set -e

echo "============================================================"
echo "Starting AttendX Backend Container initialization..."
echo "============================================================"

# Wait for PostgreSQL to be ready before running migrations
python -c "
import socket, time, os, urllib.parse

db_url = os.environ.get('DATABASE_URL', '')
if db_url:
    parsed = urllib.parse.urlparse(db_url)
    host = parsed.hostname or 'db'
    port = parsed.port or 5432
else:
    host = os.environ.get('DB_HOST', 'db')
    port = int(os.environ.get('DB_PORT', 5432))

print(f'Checking PostgreSQL at {host}:{port}...')
for i in range(1, 31):
    try:
        with socket.create_connection((host, port), timeout=2):
            print(f'PostgreSQL database connected successfully on attempt {i}!')
            break
    except OSError:
        time.sleep(1)
else:
    print('Warning: Timed out waiting for database. Attempting startup...')
"

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Seeding/Verifying AttendX Super Admin & Tenant Entitlements..."
python manage.py create_attendx_superadmin || true

echo "Starting Daphne ASGI application server on 0.0.0.0:8000..."
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application

