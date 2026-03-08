<!-- # The Chronicle — Project Context for Claude -->

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

## Design
- Dark D&D fantasy aesthetic: dark backgrounds, gold accents, medieval fonts
- Fonts: Cinzel (headings), Lora (body) — loaded from Google Fonts
- CSS variables defined in style.css under `:root`
- User feedback: currently slightly too dark — a design pass is planned

## Planned Features (in order)
1. **Timeline** — vertical scrollable list of campaign events. Each entry: Title, Description, In-game date, Real date, Session number, optional image. Details TBD (see open questions below).
2. **Session Scheduling** — calendar view, players mark availability (yes/no/maybe)
3. **Roles** — GM role vs. Player role (different permissions)

## Open Questions (to resolve before building Timeline)
- Timeline direction: newest at top or oldest at top?
- In-game date format: standard D&D calendar or custom?
- Who can add/edit entries: GM only, or all players?

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
