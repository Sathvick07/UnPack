# UnPack / LabelLens — Responsive Design & Mobile Usability Report

**Project:** UnPack — Food Label & Evidence Scanner (LabelLens Engine)  
**Date:** October 17, 2026  
**Repository:** [https://github.com/Sathvick07/UnPack](https://github.com/Sathvick07/UnPack)  
**Branch:** `main`  
**Tech Stack:** React 18, TypeScript, Vite, Vanilla CSS; Django REST Framework Backend  

---

## 1. Executive Summary

A complete, production-quality responsive design overhaul has been implemented for the Project UnPack / LabelLens web application. The implementation adheres strictly to the existing dark theme aesthetic (`#101814` / `#19251F`), vibrant lime and forest green accents (`#C8E68B` / `#173F35`), typography, and branding.

All existing functionalities across **Mission 1** (Authentication, User Profile, Onboarding, Intake Ledger), **Mission 2** (LabelLens OCR, Clarity Tiers, Bounding Box Visuals, Manual Data Corrections), and **Mission 3** (Evidence-Grounded Allergen Comparison, Contradiction Detection, Standardized Decision States, Ambiguous Ingredients) remain fully intact and operational without regressions.

---

## 2. Supported Breakpoints

The responsive design system uses fluid CSS Grid, Flexbox, `clamp()` fluid sizing, `minmax()`, and media queries supporting all five target viewport categories:

| Breakpoint Category | Viewport Width Range | Layout Strategy | Key Adaptations |
| :--- | :--- | :--- | :--- |
| **Small Phones** | `320px – 374px` | Single-column fluid | Compact header (tagline hidden, status dot only), stacked buttons, 220px image viewport, min 44px tap targets, wrapped contradiction bubbles. |
| **Standard Phones** | `375px – 480px` | Single-column fluid | Hamburger menu drawer, stacked hero CTAs, phone mockup scaled via `transform: scale(0.78)`, 270px image viewport, vertical contradiction bubbles with centered `VS` badge. |
| **Large Phones & Phablets** | `481px – 767px` | 1–2 columns fluid | 2-column metric cards, 2-column form grids for compact inputs, single-column dashboard layout to give full width to evidence findings. |
| **Tablets** | `768px – 1024px` | 1–2 columns adaptive | Portrait (`768px`): single-column scan dashboard with static image card to avoid obstructing results; Landscape (`1024px`): full 2-column layout (38% image, 62% findings). |
| **Laptops & Desktops** | `1025px and above` | Multi-column desktop | Preserves original desktop 40/60 split, sticky image panel, full desktop navbar, interactive modal dialogs. |

---

## 3. Files Changed

### Frontend Structure & Components
1. **[`frontend/index.html`](file:///C:/Users/sathv/OneDrive/Desktop/UnPack/frontend/index.html)**
   - Added `viewport-fit=cover` to `<meta name="viewport">` for edge-to-edge rendering on mobile notches and iOS safe areas.
2. **[`frontend/src/components/UnpackLogo.tsx`](file:///C:/Users/sathv/OneDrive/Desktop/UnPack/frontend/src/components/UnpackLogo.tsx)**
   - Added `.unpack-logo-wordmark` and `.unpack-logo-tagline` classes, enabling fluid typography and collapsing the tagline on narrow screens without DOM shifts.
3. **[`frontend/src/components/Navbar.tsx`](file:///C:/Users/sathv/OneDrive/Desktop/UnPack/frontend/src/components/Navbar.tsx)**
   - Added `.navbar-desktop-auth` wrapper to hide desktop authentication buttons below 860px (actions remain accessible inside the slide-out mobile drawer).
   - Ensured hamburger button has `aria-label`, `aria-expanded`, and a comfortable minimum tap target (44 × 44px).
4. **[`frontend/src/pages/ScanPage.tsx`](file:///C:/Users/sathv/OneDrive/Desktop/UnPack/frontend/src/pages/ScanPage.tsx)**
   - Added a hidden camera file input with `capture="environment"` alongside standard image upload.
   - Replaced fixed dropzone trigger with dual action controls: `📁 Browse Files` and `📷 Take Photo`.
   - Replaced inline styles on user greeting banner with `.scan-user-greeting-banner`.
   - Ensured dietary restriction toggle chips wrap cleanly and maintain touch-friendly padding.
5. **[`frontend/src/components/EvidenceLens.tsx`](file:///C:/Users/sathv/OneDrive/Desktop/UnPack/frontend/src/components/EvidenceLens.tsx)**
   - Wrapped the preview image and bounding-box overlay inside `.image-stage-wrapper`, locking overlay coordinates directly to the rendered image bounds as it resizes.
   - Enhanced `.supporting-evidence-box` with monospace styling, word-wrapping, and inline evidence photo locator.
   - Added `.responsive-table-container` touch scrolling with horizontal overflow indicators for the nutrition table.
6. **[`frontend/src/components/EditableFieldsModal.tsx`](file:///C:/Users/sathv/OneDrive/Desktop/UnPack/frontend/src/components/EditableFieldsModal.tsx)**
   - Replaced fixed 3-column inline grid (`150px 1fr 1fr`) with `.nutrition-edit-field-row`, enabling clean 2-column or stacked layouts on phones.
   - Enforced modal viewport bounding (`max-height: 94vh; overflow-y: auto`).
7. **[`frontend/src/pages/HomePage.tsx`](file:///C:/Users/sathv/OneDrive/Desktop/UnPack/frontend/src/pages/HomePage.tsx)**
   - Removed hardcoded inline padding on `.home-page` root, allowing fluid `clamp()` container padding.
8. **[`frontend/src/index.css`](file:///C:/Users/sathv/OneDrive/Desktop/UnPack/frontend/src/index.css)**
   - Added global mobile foundations (`html, body { overflow-x: hidden; max-width: 100vw; }`, `img { max-width: 100%; height: auto; }`, `touch-action: manipulation`).
   - Added `:focus-visible` accessible outline rings.
   - Added `@media (prefers-reduced-motion: reduce)` accessibility overrides.
   - Added safe-area inset padding (`env(safe-area-inset-top/bottom/left/right)`).
   - Replaced rigid `minmax(320px, 1fr)` in `.features-cards-grid` with `minmax(min(100%, 280px), 1fr)`.
   - Implemented the full 5-breakpoint responsive media query suite.

---

## 4. Responsive Behaviors Implemented

### A. Navigation & Mobile Drawer
- **Desktop (>= 993px):** Horizontal navigation bar with logo, tagline, center menu items, API health pill, theme toggle, and auth actions.
- **Tablet / Mobile (<= 992px):** Center navigation links collapse into a 44×44px hamburger menu button.
- **Narrow Mobile (<= 480px):** Logo tagline collapses; API health pill compacts to save header space. On small phones (<= 374px), pill displays only the live connection dot.
- **Mobile Menu Drawer:** Full-screen slide-down panel with internal scrolling (`max-height: calc(100vh - 80px)`), containing all navigation routes, appearance controls, and auth buttons.

### B. Image Previews & Visual Evidence Bounding Boxes
- **Image Stage Alignment:** The label photo and bounding-box overlay are encapsulated within `.image-stage-wrapper` (`display: inline-flex; max-width: 100%; max-height: 100%`).
- **Synchronous Scaling:** When the container scales from 480px down to 220px, the bounding box percentages (`top`, `left`, `width`, `height`) scale synchronously, preventing bounding box drift.
- **Sticky vs. Static:** On desktop, the image panel sticks to the viewport while scrolling results. On tablets and mobile (`<= 960px`), the panel switches to `position: static` so it does not cover findings.

### C. Contradiction Detection & Allergen Warnings
- **Desktop:** Side-by-side comparison bubbles (`AI Claim` vs. `Explicit Label Evidence`) with a centered `VS` badge.
- **Mobile (`<= 480px`):** Comparison bubbles stack vertically into full-width cards with the `VS` badge centered between them, preventing text compression.
- **Verbatim Text Snippets:** Supporting quotes use `word-break: break-word` and `overflow-wrap: break-word` to prevent packaging text from causing horizontal overflow.

### D. Nutrition Facts Table
- Contained inside `.responsive-table-container` with `-webkit-overflow-scrolling: touch`.
- Table has `min-width: 440px` so nutrient values, per-100g amounts, per-serving columns, and status badges remain legible without column crushing.

### E. Modals & Manual Corrections
- `.modal-card` uses `max-width: 95vw` and `max-height: 94vh`.
- `.modal-body` scrolls internally, ensuring modal actions remain accessible even when the mobile keyboard is open.
- The nutrition edit rows stack from 3 columns (`150px 1fr 1fr`) down to 2 columns and 1 column on small phones.

---

## 5. Viewports Actually Tested

Live testing was conducted against the running application (`http://localhost:5173`) using headless Chromium with Chrome DevTools Protocol (`Emulation.setDeviceMetricsOverride` and `Runtime.evaluate`):

| Viewport | Device Representation | Measured innerWidth | Measured scrollWidth | Horizontal Overflow? | Layout & Controls Verification |
| :---: | :---: | :---: | :---: | :---: | :--- |
| **320 × 568** | iPhone SE (1st gen) / Small phone | `320px` | `320px` | **No (0px excess)** | Hamburger toggle visible (44px target); tagline hidden; dropzone controls stack; restriction pills wrap; zero horizontal scroll. |
| **375 × 812** | iPhone X / XS / 11 Pro / 12 mini | `375px` | `375px` | **No (0px excess)** | Navigation drawer opens smoothly; Scan page dropzone dual buttons visible; card panels fit with 16px margins. |
| **390 × 844** | iPhone 12 / 13 / 14 / 15 | `390px` | `390px` | **No (0px excess)** | Auth forms and onboarding step cards fit cleanly with comfortable padding; inputs are 100% width. |
| **768 × 1024** | iPad Mini / Air (Portrait) | `768px` | `753px` | **No (0px excess)** | Transitions smoothly to tablet layout; sticky image switches to static; findings have full width. |
| **1024 × 768** | iPad Landscape / Small Laptop | `1024px` | `1009px` | **No (0px excess)** | Desktop navigation links visible; hero 2-column layout active; scan dashboard 2-column active. |
| **1366 × 768** | Standard Laptop / Desktop | `1366px` | `1351px` | **No (0px excess)** | Full desktop multi-column presentation; sticky image card active; centered within 1280px container. |

---

## 6. Build and Test Results

### Frontend TypeScript & Production Build
- **Command:** `npm --prefix frontend run build` (`tsc && vite build`)
- **Status:** **PASS** (Exit code `0`)
- **Build Duration:** 769 ms
- **Output:**
  - `dist/index.html` (1.84 kB)
  - `dist/assets/index-C2oH8hkX.css` (68.44 kB / gzip: 13.13 kB)
  - `dist/assets/index-ph7s-erG.js` (236.30 kB / gzip: 68.57 kB)
- **TypeScript Errors:** 0

### Backend Test Suite
- **Command:** `python backend/manage.py test api`
- **Status:** **PASS** (Exit code `0`)
- **Test Count:** **42 / 42 passed (100%)**
- **Test Duration:** 4.613 s
- **Regressions:** 0

### Live Backend Health & Connectivity
- **Endpoint:** `GET http://localhost:8000/api/health/`
- **Response:** `HTTP 200 OK`
- **Payload:** `{"status":"healthy","app":"Unpack","tagline":"Know What's Inside.","version":"1.0.0","environment":"development"}`

---

## 7. Security and Repository Safety Verification

- `.env` and `.env.development` are untracked and protected by `.gitignore`.
- No credentials, tokens, API keys, or personal images are staged.
- Working tree has zero staged files (`git status` shows clean staging area awaiting user approval).

---

## 8. Remaining Limitations

1. **Hardware Camera Access:** The `<input type="file" accept="image/*" capture="environment" />` control triggers native camera capture on mobile devices (iOS Safari and Android Chrome). On desktop browsers lacking a mobile camera handler, it falls back to the native file browser.
2. **Extreme Viewports (< 300px):** Viewport widths below 300px (e.g. smartwatches or foldables in half-screen mode) are not targeted; standard mobile support begins at 320px.
