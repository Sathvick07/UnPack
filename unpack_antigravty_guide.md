# Unpack --- Complete End-to-End Implementation Specification for Antigravity

**Product:** Unpack\
**Tagline:** Know What's Inside.\
**Purpose:** Help users understand packaged-food labels, compare label
evidence against their own allergies and dietary preferences, and track
nutrients from food they explicitly confirm eating.

This file is the source of truth for implementation. Build the actual
working application---not just mock screens. Preserve existing working
code, inspect the repository before making changes, and use the existing
project structure wherever possible.

------------------------------------------------------------------------

## 1. Required Technology

-   **Frontend:** React + TypeScript + Vite.
-   **Mobile app:** Capacitor.
-   **Camera/gallery:** `@capacitor/camera`.
-   **Backend:** Python + Django + Django REST Framework (DRF).
-   **Authentication:** Django authentication and
    `djangorestframework-simplejwt` for the React/Capacitor API.
-   **Database:** SQLite for local development if useful; PostgreSQL for
    deployment.
-   **Database access:** Django ORM and migrations.
-   **AI label reading:** An authorized image-capable vision/OCR API,
    called only by Django. Keep provider integration behind a service
    interface so it can be changed later.
-   **Admin:** Django Admin for trusted administrators.
-   **Version control:** Git + GitHub.

Use real API calls and persistent database records. Do not substitute
fake AI responses or hardcoded sample data for working features. Do not
add custom model training, wearable integrations, barcode databases, or
complex multi-agent systems to the MVP.

------------------------------------------------------------------------

## 2. Start by Inspecting the Existing Project

Before editing: 1. Inspect the repository tree, existing
frontend/backend, package files, environment configuration, and README.
2. Run `git status`, `git branch --show-current`, and `git remote -v`.
3. Identify what already works and preserve it. Do not recreate the
project or overwrite unrelated work. 4. Decide on the Django user model
before the first migration. If a custom user model is needed, set
`AUTH_USER_MODEL` before initial migrations. 5. Create or update
`.gitignore` and `.env.example`. Never put real secrets in the
repository. 6. Implement a feature, test it, inspect the diff, then
commit and push the tested milestone.

If the repository's current structure differs from this specification,
adapt to it and document only meaningful deviations.

------------------------------------------------------------------------

## 3. Complete User Journey

Implement the following journey end to end:

1.  User opens Unpack and sees the welcome/landing screen.
2.  User registers or logs in.
3.  First-time users complete a short profile setup: allergies, dietary
    restrictions/preferences, and optional nutrition targets. They may
    skip optional targets and edit them later.
4.  User lands on the dashboard.
5.  User starts a scan and captures a label photo or chooses an image
    from the gallery/device.
6.  User previews the image and can retake, replace, or cancel.
7.  Frontend uploads the image to the authenticated Django API.
8.  Backend validates the upload and asks the configured vision/OCR
    provider to extract the visible label.
9.  Backend validates the provider response, preserves evidence and
    uncertainty, and compares the findings against the user's saved
    restrictions.
10. Frontend shows the analysis result, ingredient list, nutrition
    facts, restriction findings, evidence, and any unreadable or
    uncertain sections.
11. User can return to the result, rescan, or enter a portion amount to
    preview the nutrient impact.
12. User can explicitly confirm that they consumed the selected portion.
    Analysis and preview alone must never create a consumption record.
13. After confirmation, the app saves the event and shows updated daily
    totals.
14. User can browse scan history, consumption history, daily summaries,
    and simple data-based insights.
15. User can edit their profile, restrictions, and nutrition targets,
    log out, and request account/data deletion through an implemented
    and clearly explained flow.

Every screen must have loading, empty, success, and error states where
relevant. Support small mobile screens as well as desktop web.

------------------------------------------------------------------------

## 4. Frontend Screens and Required Behaviour

### A. Welcome / Landing

-   Show the Unpack name, tagline "Know What's Inside.", a short
    plain-language explanation, and clear **Create account** and **Log
    in** actions.
-   Do not imply that AI analysis guarantees food safety or replaces
    professional advice.

### B. Registration

-   Fields: email, password, and any required display name.
-   Validate required fields and password rules.
-   Show useful validation messages, duplicate-email errors, and
    network/server errors.
-   Submit to Django; never store passwords in frontend storage or log
    them.
-   On success, create the authenticated session and direct the user to
    profile setup if their profile is incomplete; otherwise go to the
    dashboard.

### C. Login / Session

-   Email/username and password fields, show/hide password,
    submit/loading state, and clear invalid-credential errors.
-   Use JWT access and refresh tokens with a deliberate storage/refresh
    strategy appropriate to the web and Capacitor environments. Do not
    log tokens. Handle expired sessions and failed refresh by returning
    the user to login.
-   Provide logout and clear locally held session data on logout.
-   Protect private routes; unauthenticated users must not access
    profile, scans, restrictions, or intake history.

### D. Profile Setup and Settings

-   Profile fields: display name and optional preferences required by
    the UI.
-   Allergies and dietary restrictions must be explicitly managed as
    separate user-owned entries. Allow add, edit, and remove.
-   Support optional nutrition targets such as energy, protein,
    carbohydrates, total sugars, fat, sodium, or other supported
    nutrients. Clearly show the target's unit and period/basis.
-   Allow the user to update their profile, restrictions, and targets at
    any time.
-   Explain that nutrition targets are user-defined and do not
    constitute medical advice.
-   Do not require height, weight, medical conditions, or wearable data
    for label analysis.

### E. Dashboard

-   Provide clear entry points for **Scan a label**, **Today's intake**,
    **Scan history**, **Consumption history**, and **Profile/settings**.
-   Show today's confirmed intake and target progress only when recorded
    data/targets exist.
-   Show a useful empty state for a new user; never invent scan history
    or nutrition data.
-   Show API/network errors with retry options.

### F. Scan / Capture

-   Offer **Take photo** and **Choose from gallery/files**.
-   Use Capacitor Camera on supported mobile platforms; support normal
    image selection/upload in the browser.
-   Show image preview before submission, with retake/replace and cancel
    controls.
-   Guide users to capture the ingredient list and nutrition table
    clearly; allow another image if the label is split across multiple
    panels only if multi-image handling is implemented end to end.
-   Validate file type and size in the frontend for usability, but
    repeat validation on the backend for security.
-   Handle camera permission denial, cancellation, unsupported format,
    oversized image, poor/blurred image, no network, and upload failure.
-   Disable duplicate submissions while analysis is in progress.

### G. Analysis Results

Show the result in clear sections: 1. **Scan status and image/label
quality:** readable, partly readable, incomplete, or failed. 2.
**Ingredients:** extracted names and the exact source text where
available. 3. **Nutrition facts:** nutrient name, value, unit, and
whether it is per 100 g/ml, per serving, or per package. 4.
**Restriction findings:** matched restriction, finding status,
explanation, and supporting evidence. 5. **Uncertainty and missing
data:** what was not readable, not present in the captured image,
ambiguous, or not reported. 6. **Actions:** scan again, view history,
preview a portion, and confirm consumption after portion review.

Do not present a single green/red score as a substitute for specific
allergy findings. Keep "contains" statements separate from precautionary
"may contain" statements. Never state that a product is safe or
allergen-free merely because the AI did not detect an allergen.

### H. Portion Preview

-   Let the user select a quantity and unit that can be interpreted
    correctly (for example, grams, millilitres, servings, or package
    fraction where supported).
-   Display the source nutrition basis and the calculation used.
-   If the label only provides per-serving values, ask for the
    number/fraction of servings or use the serving size only when it is
    clearly extracted.
-   If units, serving size, or basis are unknown or incompatible,
    explain why a reliable calculation cannot be produced rather than
    guessing.
-   Preview is read-only and must not change the user's intake history.

### I. Confirm Consumption

-   Show the selected food/scan, portion amount, and nutrient
    contribution before confirmation.
-   Require a deliberate **Confirm consumption** action.
-   Only after successful backend confirmation should the UI show the
    saved event and updated totals.
-   Prevent accidental duplicate events from double-clicks/retries; use
    an idempotency strategy or equivalent duplicate protection.
-   Allow a user to view a saved event and correct/delete it through an
    explicit action if that feature is implemented. Recalculate totals
    from the updated event records.

### J. Today's Intake

-   Display totals calculated from confirmed consumption events for the
    selected user's local calendar date.
-   Show nutrient totals with units, target progress where targets
    exist, and a clear "no confirmed intake yet" empty state.
-   Clearly distinguish zero recorded intake from missing nutrient
    information. Missing facts must not be silently treated as zero.
-   Provide date navigation or a date picker for history.

### K. Scan History

-   List the authenticated user's previous scans with timestamp,
    analysis status, and a short summary.
-   Open a scan to view the stored analysis and evidence.
-   Provide pagination or sensible limits.
-   Allow deletion if implemented, with a confirmation step and clear
    explanation of what related data will be removed.
-   Do not expose another user's scan by changing a URL ID.

### L. Consumption History

-   List confirmed events by date, food/scan reference, portion, and
    available nutrient contribution.
-   Open an event for details.
-   Support correction/deletion only through explicit actions and keep
    daily totals consistent with the resulting event records.

### M. Insights

-   Provide simple, transparent summaries based only on recorded
    confirmed intake, for example recurring nutrient totals or progress
    against user-defined targets.
-   Show the date range and the data used.
-   Do not make medical diagnoses, predict disease, or claim causation.
    Do not generate insights from missing data as if it were zero.
-   Show an empty state until enough data exists.

### N. Account and Privacy

-   Provide profile/settings, logout, and a clear
    privacy/data-management area.
-   If account deletion is included, require re-authentication or
    another appropriate confirmation, delete or anonymize the user's
    records consistently, and explain the effect before proceeding.
-   Store only data needed for the requested features and disclose what
    label images are retained and for how long.

------------------------------------------------------------------------

## 5. AI Label Analysis and Evidence Rules

The AI provider is a label-reading assistant, not a source of guaranteed
truth.

### Extraction

-   Send the image to the provider from Django only. Never expose
    provider API keys in React, Vite, Capacitor, or mobile bundles.
-   Extract, when visible:
    -   ingredient list and exact source text;
    -   explicit allergen/"contains" statements;
    -   precautionary "may contain" statements;
    -   nutrition facts;
    -   numeric values and units;
    -   serving size and nutrition basis;
    -   visible product name/brand only when legible.
-   Preserve the original source text alongside normalized values.
-   Preserve uncertainty and whether the image appears cropped, blurry,
    incomplete, or unreadable.
-   If multiple label panels are supported, keep source image/panel
    references separate so evidence can be traced to the right image.

### Structured response

Use a defined JSON schema validated by backend serializers or equivalent
validation. A suggested shape:

``` json
{
  "product_name": {"value": null, "source_text": null, "status": "unknown"},
  "label_quality": "partly_readable",
  "ingredients": [
    {
      "name": "example ingredient",
      "source_text": "exact visible text",
      "status": "detected",
      "evidence": "exact label excerpt"
    }
  ],
  "allergen_statements": [
    {
      "kind": "contains",
      "name": "example allergen",
      "source_text": "Contains: ...",
      "status": "detected"
    }
  ],
  "nutrition_facts": [
    {
      "nutrient": "protein",
      "value": 5.0,
      "unit": "g",
      "basis_type": "per_100g",
      "basis_amount": 100,
      "basis_unit": "g",
      "source_text": "Protein 5 g per 100 g",
      "status": "detected"
    }
  ],
  "unreadable_or_missing": [],
  "provider_warnings": []
}
```

This is an illustrative schema; implement a strict, versioned schema and
adapt it to the provider's actual output. Reject malformed responses and
never quietly coerce invalid numbers or units.

### Required status semantics

Use clear statuses as appropriate: - `detected` -
`not_found_in_complete_readable_list` -
`not_detected_in_incomplete_list` - `unreadable` - `ambiguous` -
`not_provided` - `unknown`

Do not interpret `not_found_in_complete_readable_list` as a guarantee of
safety. Use it only when the relevant list is complete and readable. If
any portion is cropped or unreadable, represent that uncertainty
explicitly.

### Restriction comparison

-   Compare extracted ingredients and explicit allergen statements with
    the user's saved restrictions using transparent Python rules.
-   Normalize text carefully, including common spelling variants where
    justified, but retain original source text and explain matches.
-   Treat `contains` and `may contain` as different finding types.
-   Avoid unsupported cross-contamination or medical claims.
-   If a match is uncertain, show it as uncertain; do not force a
    definitive yes/no.
-   Do not bury an allergy-related finding in an aggregate score.
-   If provider access fails, times out, or returns invalid output,
    display an honest failure state and retry option. Never show
    fabricated analysis.

------------------------------------------------------------------------

## 6. Nutrition Calculation and Tracking Rules

-   Keep **Analyze only**, **Preview impact**, and **Confirm
    consumption** as separate actions.

-   A scan record is not a consumption event.

-   A portion preview is not a consumption event.

-   Only a successful explicit confirmation creates a consumption event.

-   For a nutrient value expressed per 100 g or per 100 ml, calculate:

    `consumed_amount = value_per_100g_or_ml × consumed_amount_g_or_ml / 100`

    Apply this only when the measured quantity and basis units match.

-   For per-serving values, calculate using the extracted serving size
    and number/fraction of servings only when known.

-   For per-package values, calculate using package fractions only when
    package size and portion are known.

-   Never treat total sugars as added sugars.

-   Keep units consistent when aggregating; implement explicit unit
    conversion only for compatible units.

-   If a nutrient is absent from the label, distinguish "not provided"
    from a numerical zero.

-   Store timestamp, portion quantity/unit, scan reference, confirmation
    status, and nutrient contributions for each event.

-   Compute daily totals from confirmed events for the user's local
    calendar day. Do not erase history at midnight or maintain a
    separately incremented total that can drift from source events.

-   Use timezone-aware timestamps and define the timezone policy
    consistently for web and mobile.

------------------------------------------------------------------------

## 7. Django Data Model

Use Django ORM, migrations, validation, foreign keys, indexes, and
deletion rules. Keep ownership explicit.

Suggested models: - `User`: Django default or custom model, chosen
before initial migration. - `UserProfile`: one-to-one with user; display
name and optional profile preferences. - `DietaryRestriction`: user,
type/category, label/name, optional notes, created/updated timestamps. -
`NutritionTarget`: user, nutrient, target value, unit, period/basis,
enabled flag. - `LabelScan`: user, image storage reference or metadata,
extracted text/structured result, analysis status, quality/completeness,
provider/schema version, timestamps. - `ExtractedIngredient`: scan,
normalized name, exact source text, status, evidence/reference. -
`AllergenStatement`: scan, kind (`contains` or `may_contain`), name,
source text, status. - `NutritionFact`: scan, nutrient, value, unit,
basis type/amount/unit, source text, status. - `CompatibilityFinding`:
scan, restriction reference where appropriate, finding type/status,
explanation, evidence, uncertainty. - `ConsumptionEvent`: user, scan
reference where available, portion amount/unit, timestamp, explicit
confirmation metadata. - `ConsumptionNutrient`: event, nutrient,
quantity, unit, source/basis metadata where needed.

Adapt the model set to avoid needless duplication, but do not lose
evidence, basis, ownership, or event history. Do not store redundant
daily totals if they can be computed from confirmed events. Store image
files only if needed, with restricted access and a defined retention
policy.

------------------------------------------------------------------------

## 8. Backend API

Use DRF serializers for input/output validation, consistent JSON error
responses, and authenticated permissions. Suggested endpoints:

  --------------------------------------------------------------------------------------
  Method                  Endpoint                               Purpose
  ----------------------- -------------------------------------- -----------------------
  `GET`                   `/api/health/`                         Health check

  `POST`                  `/api/auth/register/`                  Create account

  `POST`                  `/api/auth/token/`                     Obtain JWT tokens

  `POST`                  `/api/auth/token/refresh/`             Refresh access token

  `POST`                  `/api/auth/logout/`                    Logout/revoke refresh
                                                                 token if configured

  `GET/PATCH`             `/api/profile/`                        Read/update current
                                                                 user's profile

  `GET/POST`              `/api/restrictions/`                   List/add own
                                                                 restrictions

  `PATCH/DELETE`          `/api/restrictions/<id>/`              Update/delete an owned
                                                                 restriction

  `GET/PUT/PATCH`         `/api/nutrition-targets/`              Read/update nutrition
                                                                 targets

  `POST`                  `/api/analyze-label/`                  Validate and analyze
                                                                 uploaded label image

  `GET`                   `/api/scans/`                          List own scans

  `GET/DELETE`            `/api/scans/<id>/`                     Read/delete an owned
                                                                 scan if deletion is
                                                                 supported

  `POST`                  `/api/preview-intake/`                 Calculate portion
                                                                 impact without saving
                                                                 consumption

  `POST`                  `/api/consumption/`                    Record explicitly
                                                                 confirmed consumption

  `GET`                   `/api/consumption/?date=YYYY-MM-DD`    List own consumption
                                                                 events for a date

  `GET/PATCH/DELETE`      `/api/consumption/<id>/`               Read/correct/delete an
                                                                 owned event if
                                                                 supported

  `GET`                   `/api/intake/daily/?date=YYYY-MM-DD`   Calculate daily totals

  `GET`                   `/api/insights/`                       Return supported
                                                                 data-based insights

  `DELETE`                `/api/account/`                        Delete account/data if
                                                                 account deletion is
                                                                 implemented
  --------------------------------------------------------------------------------------

Implementation requirements: - Derive ownership from `request.user`;
never trust a client-supplied user ID. - Every private query must be
scoped to the authenticated user. - Require authentication for profile,
restriction, scan, intake, and insight endpoints. - Validate file
content, MIME type, extension, and size on the backend before calling
the AI provider. - Use multipart parsing for image uploads. - Apply
request limits and provider timeouts. - Handle invalid input, expired
credentials, permission failures, rate limits, provider failures, and
malformed AI output. - Use pagination for histories. - Return clear
status codes and errors without exposing stack traces, secrets, or
provider internals. - Use a single consistent date/time and timezone
policy.

------------------------------------------------------------------------

## 9. Frontend Architecture and API Integration

Organize the existing frontend into clear areas, adapting to its current
structure: - `pages/` for route-level screens. - `components/` for
reusable UI. - `services/` or `api/` for Django requests. - `types/` for
shared TypeScript API/result types. - `auth/` or a session provider for
session state and route guards. - `utils/` for formatting, unit display,
and non-sensitive helpers.

Requirements: - Keep API base URL in a frontend environment variable
such as `VITE_API_BASE_URL`; remember that Vite variables are public and
must not contain secrets. - Centralize API error handling, authorization
headers, token refresh, and logout-on-expired-session. - Keep
AI/provider keys exclusively on the Django server. - Model loading,
empty, success, partial-result, and failure states explicitly. - Avoid
duplicated API logic across pages. - Ensure keyboard accessibility,
readable contrast, visible form labels, responsive layouts, and useful
validation messages. - Do not show a success toast or updated totals
until the backend confirms the save.

------------------------------------------------------------------------

## 10. Capacitor Android/iOS Integration

-   Integrate Capacitor into the existing React/Vite project; do not
    create a duplicate frontend or reinitialize an existing Capacitor
    setup unnecessarily.
-   Use `webDir: "dist"` for a normal Vite production build unless the
    repository uses a different output directory.
-   Use `@capacitor/camera` to capture a photo or select an image from
    the gallery.
-   Convert the chosen image into a file/blob compatible with
    `multipart/form-data` upload.
-   Use the same Django API and account flow as the web frontend.
-   Handle camera permission denial, user cancellation, gallery
    selection, image conversion errors, poor image quality, offline
    state, failed upload, and expired authentication.
-   The Django backend runs remotely; do not attempt to run Django
    inside Capacitor.
-   A phone build must use the deployed HTTPS API URL, not `localhost`.
-   Configure Android permissions and platform settings as required by
    the installed Capacitor version.
-   Test on a real Android device or emulator. Do not claim camera
    support works until it has been tested.
-   iOS packaging generally requires macOS and Xcode; state this
    requirement rather than claiming a Windows machine can complete the
    native iOS build.

Typical commands, only if Capacitor is not already configured:

``` bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/camera
npx cap init
npx cap add android
npm run build
npx cap sync android
npx cap open android
```

Run commands in the frontend directory and adapt them to the existing
project. Do not blindly rerun initialization commands.

------------------------------------------------------------------------

## 11. Security, Privacy, and Reliability

-   Keep Django secret key, AI API keys, database credentials, and other
    secrets in backend environment variables.
-   Commit `.env.example` with placeholders, never real `.env` files.
-   Use Django password hashing; never store plaintext passwords.
-   Configure CORS for the required frontend origins only.
-   Use HTTPS in production.
-   Use appropriate JWT expiry/refresh/revocation behaviour; never log
    tokens.
-   Validate uploads and impose size limits, request limits, and
    provider timeouts.
-   Do not expose private uploaded images through public URLs.
-   Scope every user's data to `request.user`; test ID-based access
    attempts.
-   Collect only the personal data needed for the product.
-   Define how long uploaded label images and extracted text are
    retained; provide deletion behaviour consistent with the UI.
-   Restrict Django Admin to trusted administrators.
-   Do not log sensitive label/profile data unnecessarily.
-   Fail safely: no fabricated results, no silent zero values, and no
    claim that a label is safe because the scan did not find a match.

------------------------------------------------------------------------

## 12. Environment and Setup Documentation

Create a README with: - Required software and versions. - Frontend
installation/run/build commands. - Backend virtual environment,
dependency installation, migrations, superuser/admin setup if needed,
and run commands. - Required environment variables documented by name
and purpose, with placeholders only. - How to configure the authorized
vision/OCR provider. - How to run tests. - How to configure the frontend
API base URL. - How to build/sync/open the Capacitor Android app. -
Deployment configuration and HTTPS API URL setup. - Known limitations,
especially label readability, uncertain extraction, and iOS build
requirements.

Do not put actual credentials in README or source control.

------------------------------------------------------------------------

## 13. Testing and Acceptance Criteria

### Authentication and access

-   Registration, login, refresh, logout, invalid credentials, and
    expired session work.
-   Private pages/endpoints require authentication.
-   User A cannot read, edit, or delete User B's profile, restrictions,
    scans, events, or targets by changing an ID.

### Profile and restrictions

-   Users can add, edit, list, and remove their own restrictions.
-   Targets preserve value, unit, and period/basis.
-   Empty profiles and missing targets display correctly.

### Image and AI analysis

-   Valid image uploads work; invalid, oversized, corrupt, or
    unsupported files are rejected.
-   Clear label extracts source text, ingredients, nutrition values,
    units, and basis.
-   Blurry, cropped, incomplete, ambiguous, and unreadable labels
    produce uncertainty states.
-   `contains` and `may contain` remain distinct.
-   Provider timeout, rate limit, authentication error, or malformed
    output never generates fabricated results.
-   Evidence shown in the UI matches the stored source text/reference.

### Nutrition and consumption

-   Correct calculations for per-100-g/ml, per-serving, and per-package
    labels.
-   Incompatible/unknown units do not produce a guessed number.
-   Missing nutrient data is not converted into zero.
-   Analyze and preview do not create consumption events.
-   Confirmation creates one event; duplicate requests do not create
    duplicate events.
-   Daily totals reflect confirmed events and respect the selected local
    date.
-   Editing/deleting an event, if supported, correctly changes totals.
-   History persists across days.

### UI and mobile

-   Loading, empty, partial, success, and error states are present.
-   Web image selection, preview, retake/replace, and upload work.
-   Android camera, gallery selection, preview, upload, authentication,
    and API connection work.
-   Mobile uses deployed HTTPS backend rather than `localhost`.
-   Responsive layout, accessible labels, and useful form errors are
    checked.

------------------------------------------------------------------------

## 14. Git and Milestone Workflow

At the start:

``` bash
git status
git branch --show-current
git remote -v
```

After each tested milestone:

``` bash
git status --short
git diff --check
git diff
# Run relevant tests and frontend/backend build checks
git add <specific-reviewed-files>
git commit -m "feat: describe the completed milestone"
git push
```

-   Review existing changes before editing or staging.
-   Stage only reviewed files; never blindly stage secrets or unrelated
    changes.
-   Never use `git push --force` to resolve ordinary conflicts.
-   Use meaningful commits, for example:
    `feat: implement authentication`, `feat: add profile restrictions`,
    `feat: analyze food labels`, `feat: add portion preview`,
    `feat: record confirmed intake`, `test: verify user data isolation`.
-   Ensure `.gitignore` covers `.env`, virtual environments,
    `__pycache__`, `node_modules`, build outputs, logs, and local
    uploads/media without hiding required source files.
-   If remote, credentials, tests, or network are unavailable, preserve
    work and report the actual blocker. Never claim a commit, push,
    test, or deployment succeeded unless confirmed.

------------------------------------------------------------------------

## 15. Required Implementation Order

Follow this dependency order, testing each part before moving on. This
is an implementation sequence, not a timed schedule.

1.  **Repository and project setup:** inspect existing code, configure
    environment examples, dependencies, frontend/backend connection, and
    health endpoint.
2.  **Authentication:** registration, login, token handling, protected
    routes, logout, and backend permission tests.
3.  **Profile:** onboarding, profile settings, restrictions, and
    nutrition targets with database persistence.
4.  **Label capture:** web file selection plus Capacitor camera/gallery
    integration, image preview, replacement, validation, and upload.
5.  **AI extraction:** server-side provider integration, strict
    structured schema, stored scan result, evidence, uncertainty, and
    error handling.
6.  **Restriction comparison:** compare extracted evidence with saved
    restrictions and display explicit `contains` versus `may contain`
    findings.
7.  **Scan history:** list/open prior scans with strict user ownership.
8.  **Portion preview:** unit-aware calculations with no write to
    consumption history.
9.  **Confirmed consumption:** confirmation screen/action, duplicate
    protection, persistent event, and nutrient contributions.
10. **Daily intake and history:** totals derived from confirmed events,
    date navigation, targets, and missing-data handling.
11. **Insights and account controls:** transparent data-based summaries,
    logout, and deletion/privacy behaviour if included.
12. **Hardening and release:** run tests, fix failures, verify mobile
    API configuration, build frontend, test Android camera/upload,
    document limitations, and deploy only when credentials/configuration
    are available.

Do not start by building every screen with fake data. Build a small,
real, tested vertical slice, then expand it through this sequence.

------------------------------------------------------------------------

## 16. Definition of Done

Unpack is ready for an MVP release when: - A new user can register, log
in, complete profile setup, and manage restrictions/targets. - An
authenticated user can capture/select a real label image and submit it
to Django. - Django calls the configured real vision/OCR provider and
stores validated structured results with source evidence and
uncertainty. - The user can review ingredient/nutrition extraction and
restriction findings without unsupported safety guarantees. - The user
can preview a portion and see valid calculations where the label basis
supports them. - Only explicit confirmation records consumption. - Daily
totals, scan history, consumption history, and supported insights use
persisted user-owned records. - Authentication, ownership isolation,
error handling, and core calculations are tested. - The web flow works,
and the Android camera/gallery flow has been tested or its remaining
blocker is clearly reported. - README/setup instructions are accurate;
secrets are excluded from Git. - Tested milestones are committed and
pushed where the configured remote and credentials permit.

## Final instruction to Antigravity

Inspect the repository first, preserve working code, and implement this
specification end to end in the listed dependency order. Use real
persistence and real provider integration; do not fake functionality.
Validate all AI output, preserve source evidence and uncertainty,
protect user data, and separate scanning, previewing, and confirmed
consumption. Test each milestone before proceeding. Review diffs, commit
and push tested changes when possible, and report honestly what is
complete, tested, deployed, or blocked.
