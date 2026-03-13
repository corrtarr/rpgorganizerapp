# The Chronicle — Project TODO

## Security
- [ ] Lock down Firestore security rules before sharing the app link with the group

## Firebase Setup
- [x] Create Firebase project (production)
- [x] Enable Authentication (Email/Password)
- [x] Create Firestore database
- [x] Register web app in Firebase and get config keys
- [x] Enable Firebase Hosting
- [ ] Create separate Firebase project for testing/development
- [x] Set up GitHub repository and connect to Firebase for CI/CD

## Project Setup
- [x] Set up Vite build tool
- [x] Set up environment-based Firebase config (.env files)
- [x] Login page working and tested
- [x] Auth flow working (login → app, protected route → redirect)
- [x] First git commit on main
- [x] Connect GitHub remote and push
- [x] Set up branch protection rules on GitHub (require PR + 1 approval)

## Design
- [ ] Design pass: adjust darkness, colors, fonts, textures based on feedback

## App Development
- [x] Build Timeline view (basic: create entries, display)
- [x] **Timeline: Einträge löschen** — soft delete via 3-dot menu; deleted: true in Firestore, filtered client-side
- [x] **Timeline: Edit entries** — 3-dot menu opens pre-filled modal; updateDoc on save; session number read-only
- [ ] **Timeline: Sortierung** — default sort is by real-life date; add a toggle/setting to switch to in-game (Aventurian) date order instead (useful when a session is played later but set earlier in the story)
- [ ] **Timeline: Real-time updates** — changes made by one user are reflected live for all other users without a page reload (Firestore `onSnapshot`)
- [x] **Timeline: Delete UX improvement** — snackbar with 5s undo window replaces confirm(); gold countdown bar; Firestore write deferred; concurrent deletes handled
- [ ] **Timeline: Concurrent edit protection** — prevent two users from accidentally overwriting each other's changes; options: (a) optimistic locking with conflict detection, or (b) live presence/lock indicator when someone is editing. Could explore Firestore-based session locking or a collaborative editing approach.
- [ ] **Timeline: Export** — export the full timeline or a selected subset of entries as a JSON file
- [ ] **Timeline: Version history** — keep a history of changes per entry so past versions can be viewed or restored
- [ ] Build Session Scheduling view
- [ ] Set GM vs. Player roles

## Future Features (post-MVP)
- [ ] Configurable in-game date format (currently hardcoded to The Dark Eye / Aventurian calendar)
- [ ] Configurable round-robin author order for Timeline entries (pre-fill author field, allow override)
- [ ] Multilingual UI support (German + English)

## Before Going Live
- [ ] Lock down Firestore security rules (see Security above)
- [ ] Test with all group members
- [x] Deploy to Firebase Hosting
