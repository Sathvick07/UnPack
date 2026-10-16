# Unpack — Implementation Instructions for Antigravity

**Tagline:** Know What's Inside.

## 1. Instructions

Treat this file as the implementation requirements for Unpack.

Before changing anything:
- Inspect the existing repository, files, dependencies, Git status, current branch, and remotes.
- Preserve working code and inspect existing changes. Do not replace or regenerate the project blindly.
- Keep the application runnable and implement one tested feature at a time.
- Use the stack and requirements below. If a detail conflicts with existing working code, explain the conflict and choose the smallest safe change.
- Never claim a feature, test, deployment, or Git push succeeded unless it actually did.

## 2. Required Tech Stack

- **Frontend:** React + TypeScript + Vite.
- **Mobile:** Capacitor for Android/iOS packaging.
- **Camera/gallery:** `@capacitor/camera`.
- **Backend:** Python + Django + Django REST Framework (DRF).
- **Database:** SQLite for local development if useful; PostgreSQL for deployment.
- **Database layer:** Django ORM and migrations.
- **Authentication:** Django authentication + DRF; use `djangorestframework-simplejwt` for JWT API authentication if using the planned React/Capacitor API flow.
- **Admin:** Django Admin for trusted administrators only.
- **AI:** An authorized image-capable vision/OCR API called only from Django. Use structured output or validate the provider response into a defined schema.
- **Version control:** Git + GitHub.

Do not add custom model training, barcode databases, live wearable integrations, or complex multi-agent systems to the MVP.

## 3. Product Requirements

Users must be able to:
1. Register, log in, and manage their own profile.
2. Set allergies, dietary restrictions/preferences, and optional user-defined nutrition targets.
3. Capture a food-label photo with the Capacitor camera or select an image from the gallery; on the web, support image upload too.
4. Preview, replace, or retake the image before analysis.
5. Analyze ingredient and/or nutrition labels using the real vision/OCR API through Django.
6. View extracted ingredients, nutrition values, units, serving basis, original source text, and findings.
7. See how findings relate to their profile, with supporting evidence and uncertainty clearly explained.
8. Preview the nutrient contribution of a chosen portion.
9. Explicitly confirm consumption before it is added to their consumption history.
10. View daily nutrient totals, history, and simple transparent pattern insights.

### Core flow

`Profile/restrictions → Capture/select label → Preview image → Upload to Django → Vision/OCR extraction → Structured data validation → Evidence and uncertainty checks → Compare with user restrictions → Show findings → Preview portion → Confirm consumption → Save event → Calculate daily totals and insights`

## 4. Label Analysis Rules

- Preserve exact visible source text alongside normalized ingredient/nutrient values.
- Preserve nutrition units and basis: per 100 g, per 100 ml, per serving, or per package.
- Use explicit Python rules for clear matches and calculations; use the LLM for extraction/interpretation where appropriate, not as the sole authority for deterministic calculations or permissions.
- Every finding must include supporting source text/reference or explain why evidence is unavailable.
- Distinguish `detected`, `not_found_in_complete_readable_list`, `not_detected_in_incomplete_list`, `unreadable`, `ambiguous`, `not_provided`, and `unknown` as applicable.
- Never treat missing, unreadable, cropped, ambiguous, or unreported information as absent or zero.
- Keep explicit `contains` statements separate from precautionary `may contain` statements.
- Do not infer added sugars from total sugars.
- Do not claim a product is safe or allergen-free because an ingredient was not detected.
- Do not hide an allergy conflict behind an overall score.
- If the AI provider fails or returns invalid data, show an error/retry state. Never fabricate results.

## 5. Nutrition Tracking Rules

- Keep these actions separate: **Analyze only**, **Preview impact**, and **Confirm consumption**.
- Scanning or previewing must not add a consumption event. Only explicit confirmation creates one.
- Calculate a nutrient amount from a per-100-g/ml value only when units and basis match:

  `consumed_amount = value_per_100g_or_ml × amount_consumed / 100`

- Correctly handle per-serving and per-package values rather than assuming every label is per 100 g/ml.
- Store timestamp, portion amount/unit, scan reference, and nutrient contributions for each confirmed event.
- Calculate daily totals from confirmed events for the user's local calendar day. Preserve history; do not delete records at midnight or maintain a counter that can drift from event records.
- Pattern insights must be based on recorded data and use neutral language. Do not diagnose, predict disease, or make unsupported medical claims.
- Height, weight, medical conditions, and wearable readings are not required for label analysis. Collect optional personal data only when a feature needs it.

## 6. Django Models and Database

Decide on the user model **before the first migration**. If using a custom user model, configure `AUTH_USER_MODEL` before initial migrations.

Create only the models needed for the implemented features, using Django ORM and migrations. Suggested models:
- `User` — Django default or custom user model.
- `UserProfile` — one-to-one user profile.
- `DietaryRestriction` — user-owned allergies/preferences/restrictions.
- `NutritionTarget` — user-configured nutrient target, value, unit, and period/basis.
- `LabelScan` — owner, image reference/metadata, extracted text, status, uncertainty/completeness, timestamp.
- `ExtractedIngredient` — scan, normalized name, exact source text, detection status, optional image coordinates.
- `NutritionFact` — scan, nutrient, value, unit, basis, source text, status.
- `CompatibilityFinding` — scan, finding type/status, explanation, evidence, uncertainty.
- `ConsumptionEvent` — owner, optional scan reference, portion, timestamp, explicit confirmation.
- `ConsumptionNutrient` — event, nutrient, quantity, and unit.

Use suitable relationships, validation, indexes, and deletion rules. Scope all private records to the authenticated user. Do not store redundant daily totals when they can be calculated from confirmed events.

## 7. API Contract

Use DRF serializers for validation and keep the API contract consistent for web and mobile clients. Implement these endpoints as needed:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health/` | Health check |
| `POST` | `/api/auth/register/` | Register user |
| `POST` | `/api/auth/token/` | Obtain JWT tokens |
| `POST` | `/api/auth/token/refresh/` | Refresh access token |
| `GET/PATCH` | `/api/profile/` | Read/update current user's profile |
| `GET/POST` | `/api/restrictions/` | List/add restrictions |
| `PATCH/DELETE` | `/api/restrictions/<id>/` | Update/delete owned restriction |
| `GET/PUT/PATCH` | `/api/nutrition-targets/` | Read/update nutrition targets |
| `POST` | `/api/analyze-label/` | Upload and analyze image (`multipart/form-data`) |
| `GET` | `/api/scans/` | List current user's scans |
| `GET` | `/api/scans/<id>/` | Retrieve an owned scan and evidence |
| `POST` | `/api/preview-intake/` | Calculate portion impact without saving consumption |
| `POST` | `/api/consumption/` | Record explicitly confirmed consumption |
| `GET` | `/api/consumption/?date=YYYY-MM-DD` | List user's events for a date |
| `GET` | `/api/intake/daily/?date=YYYY-MM-DD` | Calculate daily totals |
| `GET` | `/api/insights/` | Return pattern insights |

Requirements:
- Derive ownership from `request.user`; never trust a client-supplied user ID.
- Require authentication for private endpoints and restrict every query to the current user. Prevent access to another user's records by changing an ID.
- Validate actual image content, type, and size before calling the AI provider.
- Use `MultiPartParser`/`FormParser` for image uploads.
- Handle provider timeouts, malformed responses, invalid input, and permission errors clearly.
- Use timezone-aware timestamps and a consistent local-day policy.

## 8. Capacitor Camera and Mobile Requirements

- Add Capacitor to the existing React/Vite project; do not create a duplicate frontend or duplicate Capacitor config.
- For a standard Vite build, use `webDir: "dist"` unless the existing build output differs.
- Use `@capacitor/camera` to capture a new photo or select one from the gallery.
- Preview/retake/replace the image, convert it to a `File`/`Blob`, and upload it to the same authenticated Django endpoint as the web client using `multipart/form-data`.
- Handle denied camera permissions, cancelled capture, invalid image, poor image quality, network errors, and expired tokens.
- Keep Django running as a remote backend; do not try to run Django inside Capacitor.
- Use the deployed HTTPS API URL on mobile. Do not use `localhost` in a phone build to reach the development computer.
- `VITE_` environment variables are public in the frontend bundle. Store no secrets or AI keys there.
- Android builds require Android Studio/SDK. iOS builds generally require macOS and Xcode.

Typical commands, adapted to the existing project:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/camera
npx cap init
npx cap add android
npm run build
npx cap sync android
npx cap open android
```

Run these in the frontend directory and avoid reinitializing Capacitor if it is already configured.

## 9. Security and Configuration

- Keep AI API keys, Django secret key, database credentials, and other secrets in backend environment variables.
- Never commit `.env`, tokens, passwords, real user labels, or sensitive health data. Commit `.env.example` with placeholder values only.
- Use HTTPS in production and configure CORS for only the required origins.
- Use Django password hashing; never store raw passwords.
- Configure JWT/token handling carefully and never log credentials or tokens.
- Validate uploads and impose file-size/request limits.
- Minimize storage of label images and sensitive profile information.
- Use Django Admin for trusted administrators only.

## 10. Testing Requirements

Test at least:
- Registration/login and authenticated API access.
- User A cannot view or modify User B's profile, restrictions, scans, or consumption records.
- Clear label with an explicitly listed allergen produces an evidence-backed conflict.
- Cropped, blurry, incomplete, or missing label data produces appropriate unknown/unreadable states.
- `may contain` remains distinct from `contains`.
- Nutrition values preserve units and serving basis; calculations are correct.
- Scan/preview do not change the ledger; confirmed consumption creates one event and updates totals.
- Invalid/oversized image and AI timeout/malformed response are handled without fabricated results.
- Camera permission denial, gallery selection, preview/retake, and upload work on Android.
- Mobile app uses the deployed HTTPS API, not `localhost`.

## 11. Git Commit and Push — Required After Every Tested Milestone

First inspect the repository:

```bash
git status
git branch --show-current
git remote -v
```

After each completed milestone:

```bash
git status --short
git diff --check
git diff
# Run relevant tests/build checks
git add <specific-reviewed-files>
git commit -m "feat: describe the completed milestone"
git push
```

- Inspect existing changes before editing or staging files.
- Stage specific reviewed files; do not blindly stage secrets or unrelated changes.
- Never use `git push --force` to resolve ordinary conflicts.
- If the remote, credentials, or network is unavailable, preserve work and report the blocker honestly. Do not claim a push succeeded unless Git confirms it.
- Use meaningful commit messages such as `chore: add Django backend`, `feat: add authentication`, `feat: capture label images`, `feat: add evidence-backed analysis`, `feat: record confirmed consumption`, and `test: cover user permissions`.
- Add suitable `.gitignore` entries for `.env`, virtual environments, `__pycache__`, `node_modules`, build outputs, logs, and local uploads/media. Review rules to avoid ignoring required source files.

## 12. Completion Criteria

The MVP is complete when:
- A user can authenticate and manage restrictions.
- A user can upload a label on the web or capture/select one in the Capacitor app.
- Django calls a real authorized vision/OCR API and returns validated structured data.
- Results show source evidence and clearly mark missing, unreadable, ambiguous, or incomplete information.
- Findings are compared with the authenticated user's restrictions without unsupported safety claims.
- Portion preview works, and only confirmed consumption updates the ledger.
- Daily totals and basic history/insights work.
- User data isolation and error cases are tested.
- Android camera/upload flow has been tested on a device or any limitation is stated accurately.
- Setup instructions and required environment variables are documented.
- Tested changes are committed and pushed to the configured GitHub remote.

## Final instruction

Inspect the current repository and Git configuration first. Preserve existing working code. Build and test the smallest end-to-end slice: capture/select a label image → upload it to Django → call the real vision/OCR API → structure the result → retain evidence → compare one restriction → display uncertainty where needed. Then add authentication/profile persistence, scan history, portion preview, confirmed consumption, and daily totals. Test the web flow before the Capacitor Android flow. Commit and push each tested milestone, protect secrets, and report results honestly.
