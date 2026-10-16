# Unpack — Know What's Inside.

Unpack helps users understand packaged-food labels, compare label evidence against their dietary restrictions and allergies, and track confirmed nutrition.

---

## Technology Stack (Mission 2: LabelLens)

- **Frontend:** React 18 + TypeScript + Vite (`frontend/`)
- **Backend:** Python 3.12 + Django 5.1 + Django REST Framework (`backend/`)
- **Computer Vision & Quality:** Pillow (`PIL.ImageStat`)
- **Multimodal AI / OCR:** Google Gemini Vision (`gemini-2.5-flash` / `gemini-1.5-flash`) with deterministic rule-based safety engine
- **API Endpoints:**
  - `GET /api/health/` — Backend health and service metadata
  - `POST /api/analyze-label/` — Image quality audit, OCR extraction, uncertainty analysis, dietary match
  - `POST /api/verify-fields/` — User field corrections, field verification, and re-calculation

---

## Mission 2: LabelLens Capabilities

1. **Defect & Curvature Detection:**
   - Evaluates resolution (< 350px flagged as low resolution).
   - Measures blur via pixel variance/contrast deviation.
   - Identifies harsh glare (> 240 mean luminance) and dim lighting (< 25).
   - Detects curved/cylindrical packaging via horizontal illumination profile analysis.
   - Categorizes clarity into four tiers: `CLEAR`, `MODERATE`, `UNCERTAIN`, and `UNREADABLE`.

2. **Zero-Hallucination Safety Rule:**
   - Missing nutrients are strictly recorded as `status: "not_provided"` and `value: null`. UnPack **never** assumes absent facts are 0.0g.
   - If an ingredient list is blurry, truncated, or unreadable, the system returns `UNKNOWN / VERIFY` and requests manual confirmation. It **never** claims a product is allergen-free based on unreadable text.

3. **User In-the-Loop Corrections:**
   - Interactive **Evidence Lens** enables visual inspection of bounding boxes and raw snippets.
   - **Editable Fields Modal** allows correcting OCR typos and adding missing items with instant server-side re-calculation.

4. **Honest Limitations:**
   - **Observable Evidence Only:** The engine evaluates only what is physically legible in the uploaded image. Folded wrappers or hidden panel sides cannot be inspected.
   - **Cross-Contact Advisory:** "No conflict identified" applies to legible text; it does not guarantee clinical allergen-free status if cross-contact occurred in manufacturing.
   - **Curved Package Limits:** While cylindrical shading falloff is detected, severely distorted text on extreme curves must be retaken flat-on.
   - **Non-Medical Advice:** UnPack is an evidence tool, not a clinical diagnostic device.

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

# 5. Run automated tests (14 tests covering quality, curvature, and uncertainty)
python manage.py test api

# 6. Start the development server
python manage.py runserver 8000
```

The Django REST Framework backend runs at `http://localhost:8000/`.

---

### 2. Frontend Setup (PowerShell)

Open a second PowerShell terminal:

```powershell
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies
npm.cmd install

# 3. Validate TypeScript and build bundle
npm.cmd run build

# 4. Start the Vite dev server
npm.cmd run dev
```

The frontend will be running at `http://localhost:5173/`.

---

## Project Structure

```text
UnPack/
├── .gitignore               # Security exclusions for secrets, venvs, test images, node_modules
├── .env.example             # Clean template for local environment variables
├── README.md                # Documentation, capabilities, and run instructions
├── backend/                 # Django + DRF backend
│   ├── manage.py
│   ├── requirements.txt
│   ├── unpack_backend/      # Settings, URLs, WSGI, ASGI, auto-.env loader
│   └── api/
│       ├── label_analyzer/  # Quality assessment, OCR engine, validator, matching
│       ├── views.py         # Endpoints: health, analyze-label, verify-fields
│       ├── urls.py
│       └── tests.py         # Automated test suite (14 test cases)
└── frontend/                # React + TypeScript + Vite frontend
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── api/             # Typed API client
        ├── types/           # Label, API, and navigation types
        ├── components/      # EvidenceLens, QualityBanner, ManualConfirm, Modals
        └── pages/           # ScanPage, HomePage, NutritionPage
```

---

## Security Notes

- Do not commit `.env` files or credentials to Git.
- Credentials, private keys, test photos, and database files are excluded via `.gitignore`.
- Vite environment variables (`VITE_*`) are exposed to the browser; never place private AI keys or server secrets in frontend code.
