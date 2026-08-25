# FRG Enterprise HR, Attendance, WFH, Salary & Biometric Platform

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
| **CEO** | `md.3capstech@gmail.com` | `@3Caps!2345$` |
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

---

## 🌐 Production Deployment & CI/CD Architecture

This system is configured for enterprise-grade continuous deployment across **Render** (Backend API & PostgreSQL) and **Vercel** (Frontend React SPA) powered by **GitHub Actions**.

```
Developer makes code changes
            │
            ▼
      git push origin main
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                 GitHub Actions CI/CD Pipeline                │
│                                                             │
│  [Job 1: Backend CI]          [Job 2: Frontend CI]          │
│  • Python 3.10 setup          • Node.js 18 setup            │
│  • Django check & migrations  • npm ci dependencies         │
│  • Automated unit tests       • Vite production build       │
│                                                             │
│                [Job 3: Production Deployment]                │
│  • Triggers Render Deploy Hook via Webhook                   │
│  • Triggers Vercel Deploy Hook via Webhook                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│     Render.com (Backend)      │   │      Vercel (Frontend)        │
│                               │   │                               │
│ • Gunicorn WSGI Server        │   │ • React 18 SPA                │
│ • WhiteNoise Static Asset CDN │   │ • Global Edge Network         │
│ • Managed PostgreSQL DB       │   │ • SPA Rewrites (vercel.json)  │
│ • HTTPS & Health Probes       │   │ • Environment: VITE_API_URL   │
└───────────────▲───────────────┘   └───────────────┬───────────────┘
                │                                   │
                └──────── HTTPS API & CORS ─────────┘
```

---

### 🚀 1. Backend Deployment on Render

#### Option A: 1-Click Render Blueprint (Recommended)
1. Push this repository to your GitHub account.
2. Log into [Render.com](https://dashboard.render.com/) and navigate to **Blueprints**.
3. Click **New Blueprint Instance** and connect your repository.
4. Render will read [`render.yaml`](render.yaml) and automatically configure:
   - **PostgreSQL Database**: `attendance-db`
   - **Python Web Service**: `attendance-backend`
   - **Build Command**: `./build.sh` (runs pip install, collectstatic, migrate)
   - **Start Command**: `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 3`
   - **Health Check Path**: `/health/`

#### Option B: Manual Web Service Setup on Render
1. Create a **New PostgreSQL Database** on Render:
   - Name: `attendance-db`
   - Copy the **Internal Database URL** (or External if connecting externally).
2. Create a **New Web Service**:
   - Environment: `Python`
   - Root Directory: `backend`
   - Build Command: `./build.sh`
   - Start Command: `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 3`
   - Health Check Path: `/health/`
3. Configure the following **Environment Variables** in Render:

| Variable | Value / Description | Example |
| :--- | :--- | :--- |
| `DEBUG` | `False` | `False` |
| `SECRET_KEY` | Strong random secret key | *(Render Generate Key)* |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `ALLOWED_HOSTS` | Render domain + custom domains | `.onrender.com,localhost,127.0.0.1` |
| `CSRF_TRUSTED_ORIGINS` | Allowed frontend domains | `https://your-frontend.vercel.app,https://*.onrender.com` |
| `CORS_ALLOW_ALL_ORIGINS` | Allow all or specify domains | `False` (or `True` for testing) |
| `CORS_ALLOWED_ORIGINS` | Frontend URL | `https://your-frontend.vercel.app` |
| `SECURE_SSL_REDIRECT` | Enforce HTTPS | `True` |

4. Seed initial database data on Render (via Render Shell tab):
```bash
python manage.py seed_data
```

---

### ⚡ 2. Frontend Deployment on Vercel

1. Log into [Vercel](https://vercel.com/) and click **Add New Project**.
2. Import your GitHub repository.
3. Configure Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend` (or leave as root if using the root `vercel.json`)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add the **Environment Variable**:
   - `VITE_API_URL`: Set to your live Render backend URL (e.g. `https://attendance-backend.onrender.com`)
5. Click **Deploy**. Vercel will build the frontend bundle and serve it across its global edge network.

---

### 🔄 3. Continuous Integration & Deployment (GitHub Actions)

A pre-configured CI/CD workflow is located in [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml).

#### Automated Workflow Execution:
- **On Pull Requests to `main`**: Runs backend tests (`python manage.py test`), migration checks, and frontend build verification.
- **On Push / Merge to `main`**: Validates the codebase and triggers automated webhooks to deploy changes to Render and Vercel instantly.

#### Setting up Automatic Deployment Webhooks:
1. In your **GitHub Repository**, navigate to **Settings > Secrets and variables > Actions**.
2. Add the following repository secrets:
   - `RENDER_DEPLOY_HOOK_URL`: Your Render Web Service Deploy Hook (found under *Render Dashboard > Settings > Deploy Hook*).
   - `VERCEL_DEPLOY_HOOK_URL`: Your Vercel Deploy Hook (found under *Vercel Dashboard > Settings > Git > Deploy Hooks*).

*Note: If Render and Vercel Git-integrations are enabled with auto-deploy on `main`, deployments will also trigger automatically upon git push.*

---

### 📋 4. Environment Variables Reference

| Variable | Scope | Description | Production Example |
| :--- | :--- | :--- | :--- |
| `SECRET_KEY` | Backend | Django cryptographic signing key | `f7a98e2... (secret)` |
| `DEBUG` | Backend | Debug error pages | `False` |
| `DATABASE_URL` | Backend | PostgreSQL database connection string | `postgresql://user:pass@host/db` |
| `ALLOWED_HOSTS` | Backend | Allowed host headers | `.onrender.com,api.yourdomain.com` |
| `CSRF_TRUSTED_ORIGINS` | Backend | Origins trusted for CSRF protection | `https://your-frontend.vercel.app` |
| `CORS_ALLOWED_ORIGINS` | Backend | Allowed origins for cross-origin API calls | `https://your-frontend.vercel.app` |
| `SECURE_SSL_REDIRECT` | Backend | Forces HTTPS redirection | `True` |
| `VITE_API_URL` | Frontend | Backend API endpoint URL | `https://attendance-backend.onrender.com` |

---

### 🛠️ 5. Production Verification Checklist

After deploying your backend and frontend:
1. ✅ **Health Check**: Access `https://<your-backend>.onrender.com/health/` and confirm JSON response `{"status": "healthy", "database": "connected"}`.
2. ✅ **Admin Portal**: Access `https://<your-backend>.onrender.com/admin/` and log in with superuser credentials.
3. ✅ **Frontend Loading**: Access `https://<your-frontend>.vercel.app` and confirm the login screen loads with glassmorphism UI.
4. ✅ **Authentication**: Log in with demo accounts (e.g. `md.3capstech@gmail.com` / `@3Caps!2345$`). Verify JWT tokens are received and stored.
5. ✅ **API Operations**: Test attendance marking, leave approval, and CEO salary modification.
6. ✅ **Report Downloads**: Test CSV report export buttons in CEO Dashboard and Reports page.
7. ✅ **SPA Page Refreshes**: Navigate directly to `/ceo/dashboard` or `/employees` and refresh the page to confirm `vercel.json` rewrites are working without 404s.
8. ✅ **CORS & SSL**: Open DevTools Network tab and verify zero CORS errors and all requests use HTTPS.

