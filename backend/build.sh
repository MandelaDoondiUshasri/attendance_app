#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "==> Installing Python dependencies..."
pip install -r requirements.txt

echo "==> Collecting static assets for WhiteNoise..."
python manage.py collectstatic --no-input

echo "==> Running database migrations..."
python manage.py migrate

echo "==> Purging old sample/dummy records..."
python manage.py clear_dummy_data

echo "==> Initializing clean production organizational structure..."
python manage.py seed_data

echo "==> Build completed successfully!"


