# Apex Enterprise HR, Attendance, WFH, Salary & Biometric Platform

Production-ready enterprise management platform integrating Employee Management, Office Biometric Attendance (Face & Fingerprint), Remote WFH Attendance with Anti-Spoof Liveness & Geolocation Signals, Leave Governance, CEO Salary Adjustment with Immutable History, Executive Analytics, and System Audit Logs.

---

## 🏛️ System Architecture

```
React Frontend (SPA) ──[HTTP / REST / JWT]──► Django REST Framework Backend ──[ORM]──► PostgreSQL / SQLite Database
  ├── Role-Based Access Routing                 ├── Custom Permission RBAC (CEO, HR, Operator, Employee)
  ├── Glassmorphic Tailwind Design System       ├── Configurable Attendance Rule Engine
  ├── Recharts Executive Analytics              ├── Biometric Abstraction Layer (Face & Fingerprint)
  └── WebCam & Geolocation Integrations         └── Immutable Audit Logger & Notifications Engine
```

---

## 👥 User Roles & Permission Matrix

| Role | Access Level & Permissions | Dedicated Dashboard |
| :--- | :--- | :--- |
| **CEO** | Highest authority. Full employee management, leave approvals, WFH approvals, attendance corrections, salary adjustments (increment/decrement), executive analytics, CSV exports, audit logs, organization settings. | `/ceo/dashboard` |
| **HR / Admin** | Personnel management, department/designation configuration, attendance monitoring, leave & WFH queue reviews, attendance corrections, report generation. | `/hr/dashboard` |
| **Attendance Operator** | **Strictly Restricted**: Only allowed to record office face attendance, fingerprint attendance, view today's count, and check verification status. **Blocked** from salary, employee editing, leaves, WFH, or settings. | `/operator/dashboard` |
| **Employee** | Self-service portal: view personal profile, attendance history, apply for leave, apply for WFH, mark WFH attendance (requires approved WFH request + face + liveness + GPS), request attendance correction, view salary history. | `/employee/dashboard` |

---

## 🔑 Default Credentials (Development Seed)

| Role | Email | Password |
| :--- | :--- | :--- |
| **CEO** | `ceo@company.com` | `Password123!` |
| **HR Admin** | `hr@company.com` | `Password123!` |
| **Attendance Operator** | `operator@company.com` | `Password123!` |
| **Employee (Office)** | `emp1@company.com` | `Password123!` |
| **Employee (WFH)** | `emp2@company.com` | `Password123!` |

---

## 🛠️ Tech Stack

- **Backend**: Python 3.12, Django 5.0, Django REST Framework, SimpleJWT, SQLite / PostgreSQL, Pillow.
- **Frontend**: React 18, React Router v6, Tailwind CSS, Axios, Recharts, Lucide Icons.

---

## 🚀 Quick Setup & Local Execution

### 1. Backend Setup (Django REST Framework)
```bash
cd backend
python -m venv venv

# On Windows:
venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py seed_data
python manage.py runserver 0.0.0.0:8000
```

### 2. Frontend Setup (React SPA)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Running Automated Test Suite
```bash
cd backend
python manage.py test
```

---

## 🔒 Security & Compliance Features
1. **JWT Authentication & Token Auto-Refresh**: Secure access and refresh tokens handled via Axios request/response interceptors.
2. **Server-Side Permission Controls**: Strict custom permission classes (`IsCEO`, `IsHR`, `IsAttendanceOperator`, `CanTakeBiometrics`) enforced at DRF ViewSet/API endpoint levels.
3. **Biometric Abstraction Layer**: Pluggable provider interfaces (`BaseFaceProvider`, `BaseFingerprintProvider`) with development mock implementations (`MockFaceProvider`, `MockFingerprintProvider`) designed to seamlessly accept hardware SDK bridges (`RealFaceProvider`, `RealFingerprintProvider`).
4. **Immutable Audit Logs**: Sensitive operations (login, leave approval, WFH approval, salary changes, biometric scans) automatically recorded with actor, action, payload diffs, IP address, and timestamp.
