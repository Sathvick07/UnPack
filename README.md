# Unpack — Know What's Inside.

Unpack helps users understand packaged-food labels, compare label evidence against their dietary restrictions and allergies, and track confirmed nutrition.

---

## Technology Stack (Milestone 1)

- **Frontend:** React + TypeScript + Vite (`frontend/`)
- **Backend:** Python + Django + Django REST Framework (`backend/`)
- **API Endpoint:** `GET /api/health/`

---

## Local Development Setup

### 1. Backend Setup (PowerShell)

```powershell
# 1. Navigate to the backend directory
cd backend

# 2. Create and activate a Python virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# 3. Install backend dependencies
pip install -r requirements.txt

# 4. Apply initial migrations
python manage.py migrate

# 5. Run automated tests
python manage.py test api

# 6. Start the development server
python manage.py runserver 8000
```

The Django REST Framework backend will be running at `http://localhost:8000/`.
Health check: `http://localhost:8000/api/health/`

---

### 2. Frontend Setup (PowerShell)

Open a second PowerShell terminal:

```powershell
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies (using npm.cmd on Windows)
npm.cmd install

# 3. Start the Vite dev server
npm.cmd run dev
```

The frontend will be running at `http://localhost:5173/`.

---

## Project Structure

```text
UnPack/
├── .gitignore               # Security exclusions for secrets, venv, node_modules
├── .env.example             # Template for local environment variables
├── README.md                # Documentation and run instructions
├── backend/                 # Django + DRF backend
│   ├── manage.py
│   ├── requirements.txt
│   ├── unpack_backend/      # Settings, URLs, WSGI, ASGI
│   └── api/                 # Core API app and health-check endpoint
└── frontend/                # React + TypeScript + Vite frontend
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/                 # React UI and API client
```

---

## Security Notes

- Do not commit `.env` files or credentials to Git.
- Credentials and private keys are excluded via `.gitignore`.
- Vite environment variables (`VITE_*`) are exposed to the browser; never place private AI keys or server secrets in frontend code.
