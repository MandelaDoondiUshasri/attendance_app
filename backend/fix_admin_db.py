import hashlib
import base64
import sqlite3
import datetime

password = 'SuperAdminPassword123!'
salt = 'randsalt'
iterations = 870000

hash_bytes = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), iterations)
hash_b64 = base64.b64encode(hash_bytes).decode('ascii')
django_hash = f'pbkdf2_sha256${iterations}${salt}${hash_b64}'

conn = sqlite3.connect('db.sqlite3')
c = conn.cursor()

c.execute("SELECT id, email FROM accounts_user WHERE email='admin@frgattendance.com'")
row = c.fetchone()
if row:
    print('Found:', row)
    c.execute("UPDATE accounts_user SET password=?, is_staff=1, is_superuser=1, is_active=1, role='CEO' WHERE email='admin@frgattendance.com'", (django_hash,))
    conn.commit()
    print('Updated existing user.')
else:
    print('Not found, inserting...')
    dt = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    c.execute("INSERT INTO accounts_user (password, is_superuser, is_staff, is_active, email, role, date_joined, first_name, last_name, phone_number, username, created_at, updated_at) VALUES (?, 1, 1, 1, 'admin@frgattendance.com', 'CEO', ?, 'Super', 'Admin', '1234567890', 'admin', ?, ?)", (django_hash, dt, dt, dt))
    conn.commit()
    print('Inserted new user.')

conn.close()
print('Done')
