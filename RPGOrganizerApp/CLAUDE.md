<!-- # The Chronicle — Project Context for Claude -->

## GitHub
- Repo: https://github.com/corrtarr/rpgorganizerapp (public)
- Branch protection on `main`: require PR + 1 approval before merging
- GitHub Personal Access Token expires: **April 7, 2026** — generate a new one at github.com → Settings → Developer settings → Personal access tokens

## What this project is
A private, password-protected web app for a tabletop RPG group. It helps the group
track their campaign history, schedule sessions, and manage group info.
App name: **"The Chronicle"**

## Tech Stack
- **Frontend**: Plain HTML, CSS, JavaScript — no framework
- **Build tool**: Vite 5 (dev server, env files, bundling)
- **Backend/Auth/DB**: Firebase (Firestore + Authentication + Hosting)
- **Deployment**: Firebase Hosting, served at rpgorganizerapp.web.app
- Firebase SDK loaded via npm
- Dev server: `npm run dev` → http://localhost:5173
- Build for deployment: `npm run build` → outputs to `dist/`
- Preview production build locally: `npm run preview`

## Project Structure
```
index.html           ← Login page (Vite entry point)
app.html             ← Main app (protected)
src/
  css/style.css      ← All styles (dark D&D fantasy theme)
  js/
    firebase-config.js  ← Firebase init, reads from .env, exports auth + db
dist/                ← Built output (generated, not committed)
firebase.json        ← Firebase Hosting config (serves dist/)
.firebaserc          ← Links to Firebase project "rpgorganizerapp"
.env.development     ← Dev Firebase credentials (not committed to git)
.env.production      ← Prod Firebase credentials (not committed to git)
vite.config.js       ← Vite build config
TODO.md              ← Project task tracking
CLAUDE.md            ← This file
```

## Firebase Project
- Project ID: `rpgorganizerapp`
- Auth: Email/Password only (no self-registration — GM creates accounts manually in Firebase Console)
- Firestore: enabled in test mode (rules must be locked down before go-live)

## Environment Variables
Both `.env.development` and `.env.production` must contain these 7 variables (all prefixed with `VITE_`):
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```
These files are git-ignored and must never be committed.

## Auth Flow Architecture
- Auth logic currently lives as **inline `<script type="module">` in the HTML files** (not in separate JS files yet)
- `index.html`: if already logged in → redirect to `/app.html`
- `app.html`: if NOT logged in → redirect to `/index.html`
- `app.html` is currently a **placeholder** — no real app content yet, just a welcome message

## User Profiles (Firestore)
- Firebase Authentication stores email + password only — used exclusively for login
- **Email must never be displayed anywhere in the UI** (breaks immersion)
- Each user will have a profile document in Firestore (collection: `users`, document ID = Firebase Auth UID)
- Confirmed fields:
  - `role` — `"gm"` or `"player"`
  - `playerName` — real name of the player (e.g. `"Klaus"`)
  - `characterShortName` — short in-game name (e.g. `"Thorin"`)
  - `characterFullName` — full in-game name (e.g. `"Thorin Eisenfaust"`)
  - `color` — hex color code matching their VTT color (e.g. `"#e63946"`) — used to highlight their name in the UI
- User profiles are created manually in Firebase Console (no admin UI yet — future feature)

## Design
- Dark D&D fantasy aesthetic: dark backgrounds, gold accents, medieval fonts
- Fonts: Cinzel (headings), Lora (body) — loaded from Google Fonts
- CSS variables defined in `src/css/style.css` under `:root`:
  `--bg-dark`, `--bg-card`, `--border-gold`, `--gold`, `--gold-light`, `--text-light`, `--text-muted`, `--red-accent`, `--error`
- User feedback: currently slightly too dark — a design pass is planned

### CSS `hidden` attribute + `display` pitfall
Any element that uses the HTML `hidden` attribute for show/hide toggling **must** have a `[hidden] { display: none; }` rule in CSS if its selector also sets an explicit `display` value (e.g. `display: flex`). Without it, the CSS `display` wins over the `hidden` attribute and the element is always visible. Pattern to always follow:
```css
#myElement {
  display: flex; /* used when visible */
}
#myElement[hidden] {
  display: none; /* must override when hidden */
}
```
This has already bitten us on `.modal-overlay` and `#lightbox`.

## Language
- **UI language: German** — all labels, buttons, headings, and user-facing text must be written in German
- Future TODO: add multilingual support (German + English) once the app is stable

## Planned Features (in order)
1. **Timeline** — vertical scrollable list of campaign events. Each entry: Title, Description, In-game date, Real date, Session number, Author, optional image.
2. **Session Scheduling** — calendar view, players mark availability (yes/no/maybe)
3. **Roles** — GM role vs. Player role (different permissions)

## Timeline Decisions
- **Order**: Newest entry at top
- **Permissions**: All players can read and edit all entries (no restrictions)
- **Author field**: Each entry has an author. The selectable authors are loaded dynamically from the user database, filtered to users with the **Player role** only — the GM is excluded. The group uses round-robin protocol writing (a different player each session). Future feature: configurable author order with pre-fill + override.
- **In-game date format**: The Dark Eye (Das Schwarze Auge) Aventurian calendar — **currently hardcoded, configurable format is a planned future feature**

### The Dark Eye Calendar (Aventurian)
- 12 months of 30 days each + 5 "Nameless Days" = 365 days/year
- Months (in order, each named after one of the Twelvegods):
  1. Praios, 2. Rondra, 3. Efferd, 4. Travia, 5. Boron, 6. Hesinde,
  7. Firun, 8. Tsa, 9. Phex, 10. Peraine, 11. Ingerimm, 12. Rahja
- Days per month: 1–30. Nameless Days follow Rahja (end of year).
- Year format example: "15 Peraine 1040" (day / month name / year)

## Testing

For each finished feature, a smoke test document must be created at:
```
docs/tests/smoke/YYYY-MM-DD-<feature-name>.md
```
Use `docs/tests/smoke/2026-03-14-timeline-image-support.md` as the reference template. The document covers:
- Prerequisites
- One test case per distinct user-facing behaviour
- Each test case has: Steps, Expected result, Result field (filled in manually by tester)
- A Notes section with hints for future automation (relevant DOM selectors, emulator suggestions)

The `docs/` folder is git-ignored — these documents are local only.

## Git & Deployment Workflow
- **Never commit or push directly to `main`**
- Work on feature branches (e.g. `feature/timeline`, `feature/scheduling`)
- Keep commits small and thematic — one logical change per commit
- **Never merge a branch into `main` without explicit user approval**
- **Never deploy without explicit user approval**
- Merge to `main` only when a feature is complete, tested, and approved
- **Deploy only from `main`** via Firebase Hosting (CI/CD via GitHub integration — to be set up)
- Always check TODO.md at the start of a session for current status

## Environments
- **Production**: live Firebase project `rpgorganizerapp` — real data, real users
- **Test/Dev**: separate Firebase project to be set up (see TODO) — used for all development and testing
- Never test against production data
- Never deploy untested changes to production

## User
- Not a developer — avoid jargon, explain decisions, ask before doing large changes
- Prefers to understand what's happening before moving forward
- Communication language: English (user may also write in German, respond in English)
