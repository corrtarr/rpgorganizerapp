# The Chronicle — Project TODO

## Security
- [ ] Lock down Firestore security rules before sharing the app link with the group

## Firebase Setup
- [x] Create Firebase project (production)
- [x] Enable Authentication (Email/Password)
- [x] Create Firestore database
- [x] Register web app in Firebase and get config keys
- [ ] Enable Firebase Hosting
- [ ] Create separate Firebase project for testing/development
- [ ] Set up GitHub repository and connect to Firebase for CI/CD

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
- [ ] Build Timeline view
- [ ] Build Session Scheduling view
- [ ] Build Login / Auth flow
- [ ] Set GM vs. Player roles

## Future Features (post-MVP)
- [ ] Configurable in-game date format (currently hardcoded to The Dark Eye / Aventurian calendar)
- [ ] Configurable round-robin author order for Timeline entries (pre-fill author field, allow override)
- [ ] Multilingual UI support (German + English)

## Before Going Live
- [ ] Lock down Firestore security rules (see Security above)
- [ ] Test with all group members
- [ ] Deploy to Firebase Hosting
