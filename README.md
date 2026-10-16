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

## Mission 2: LabelLens Capabilities & Quality Assessment

1. **Defect, Blur & Curvature Detection:**
   - **Blur Detection via Laplacian Variance:** Evaluates high-frequency 2nd-order spatial edge energy ($\nabla^2 I$). Defocused/blurry labels produce low Laplacian variance (< 70 for severe blur, 70–180 for moderate blur).
   - **Contrast vs. Sharpness Separation:** Global pixel intensity standard deviation is strictly decoupled from sharpness; colorful labels with dark print on light backgrounds maintain dynamic range without bypassing blur checks.
   - **Resolution Checks:** Images with dimensions < 350px are flagged for low resolution; extreme aspect ratios (> 3.8:1) are flagged for potential cropping.
   - **Lighting Quality:** Identifies harsh glare (> 240 mean luminance) and underexposure (< 25 mean luminance).
   - **Curved / Cylindrical Surfaces:** Detects parabolic cylindrical illumination drop-off across horizontal slices (e.g. cans, jars, bottles) to warn of wrapped or distorted edge text.
   - **Clarity Scoring:** Standardized score out of 100 with four tiers: `CLEAR` (95), `MODERATE` (75, e.g. curved packaging), `UNCERTAIN` (55, e.g. moderate blur), and `UNREADABLE` (30, e.g. severe blur or low contrast).

2. **Zero-Hallucination & Uncertainty Safety Guarantees:**
   - **Never Fabricate Nutrition:** Missing or unreadable nutrients are strictly recorded as `value: null` with `status: "not_provided"`. UnPack **never** assumes missing facts are 0.0g. Zero is only recorded when explicitly stated on the packaging.
   - **Never Assume Safety on Compromised Labels:** If an ingredient list or allergen panel is blurry, curved, truncated, or unreadable, the system returns `UNKNOWN / VERIFY` with `severity: "ATTENTION"` and requests manual confirmation. It **never** claims a product is allergen-free based on unreadable text.
   - **Negative Confirmation Language:** When no conflict is detected in readable text, the finding explicitly states `"No conflict identified in readable information on this label. Notice: This does not guarantee the product is completely allergen-free."`
   - **Consolidated Multi-Source Evidence:** Allergens declared across both explicit allergen statements (e.g. `"CONTAINS MILK, WHEAT AND SOY."`) and ingredient lists (e.g. `"MAIDA (REFINED WHEAT FLOUR)"`) are merged into a single canonical finding with composite evidence and clear actionable advice.

3. **User In-the-Loop Corrections:**
   - **Evidence Lens:** Visual inspection pane highlighting extracted text snippets, bounding boxes, and uncertainty flags.
   - **Editable Fields Modal:** Allows correcting OCR typos, adding missing items, and updating values with immediate server-side re-evaluation via `POST /api/verify-fields/`.
   - **Persistent Allergen Filters:** Dietary restrictions remain selected across scans and can be toggled live on the results screen.

4. **System Limitations:**
   - **Observable Evidence Only:** The engine evaluates only what is physically captured in the uploaded frame. Hidden panel sides, folded wrapper seams, or obscured corners cannot be analyzed.
   - **Cross-Contact & Facility Advisories:** "No conflict identified" applies solely to visible text; it cannot detect unstated cross-contact that occurred during agricultural harvesting or shared manufacturing lines.
   - **Extreme Curvature Distortion:** While cylindrical curvature is detected and flagged, severe optical distortion along outer edges requires taking flat-on orthogonal photos of each panel.
   - **Camera Resolution & Lighting:** Minimum legible print requires at least 350px short-edge resolution under even, diffuse ambient lighting.
   - **Non-Medical Disclaimer:** UnPack is an evidence verification assistant, not a clinical diagnostic device. Users with severe allergies must always inspect physical packaging.

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

# 5. Run automated tests (25 tests covering quality, curvature, blur, allergen matching, and uncertainty)
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
