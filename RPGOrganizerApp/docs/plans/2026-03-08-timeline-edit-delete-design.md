# Design: Timeline Edit & Delete (with Soft Delete)

**Date:** 2026-03-08
**Branch:** `feature/timeline-edit-delete`
**Covers TODO items:**
- Timeline: Einträge löschen
- Timeline: Edit entries

---

## Summary

Add edit and delete actions to each timeline entry via a 3-dot context menu. Editing reuses the existing create modal, pre-filled with the entry's data. Deletion is a soft delete — the entry is flagged `deleted: true` in Firestore and filtered out client-side, but never permanently removed.

---

## 1. Card Changes — 3-dot Context Menu

Each rendered timeline card gets a `⋯` button in the top-right corner of the card header. Clicking it opens a small dropdown with two actions:

- **Bearbeiten** — opens the modal in edit mode
- **Löschen** — prompts for confirmation, then soft-deletes

Clicking anywhere outside the open menu closes it. Only one menu may be open at a time.

### Data access

`renderEntry` currently receives only the entry data object. It will be updated to also receive the Firestore document ID. A module-level `Map<docId, entryData>` (`entriesMap`) is populated when the timeline loads, so clicking "Bearbeiten" can look up the full entry data immediately without a second database call.

---

## 2. Modal — Edit Mode vs. Create Mode

A module-level variable `editingEntryId` (initially `null`) tracks the current mode:

| State | Value | Behaviour |
|---|---|---|
| Create | `null` | Form is blank, title "Neuer Eintrag", button "Erstellen" |
| Edit | Firestore doc ID | Form is pre-filled, title "Eintrag bearbeiten", button "Speichern" |

When the modal closes (cancel or successful save), `editingEntryId` is reset to `null`.

### Pre-filling in edit mode

All fields are populated from the entry stored in `entriesMap`:
- Title, real date, session number (read-only text, not an input)
- In-game start date (day/month/year selects)
- Multi-day toggle + end date fields (shown/hidden as appropriate)
- Author dropdown set to the entry's `authorId`
- Quill editor content set via `quill.root.innerHTML`

Session number is **not editable** — displayed as static text only.

---

## 3. Data Flow

### Save — edit mode

On form submit, if `editingEntryId` is set:
1. Build the same entry object as today, but omit `createdAt` and `sessionNumber`
2. Add `lastModifiedAt: serverTimestamp()`
3. Call `updateDoc(doc(db, 'timeline', editingEntryId), updatedFields)`
4. On success: close modal, reload timeline

If `editingEntryId` is `null`, the existing `addDoc` path runs unchanged.

### Delete — soft delete

On "Löschen" click:
1. Show a native `confirm()` dialog: `"Eintrag wirklich löschen? Er bleibt in der Datenbank gespeichert und kann bei Bedarf wiederhergestellt werden."`
2. On confirm: `updateDoc(doc(db, 'timeline', docId), { deleted: true })`
3. On success: remove the card from the DOM (no full reload needed)

### Filtering deleted entries

Deleted entries are filtered **client-side** after loading from Firestore:
- Any document where `data.deleted === true` is skipped during rendering
- Documents without a `deleted` field (all existing entries) pass through unaffected — no migration needed
- All new entries going forward will have `deleted: false` stored explicitly, setting up a clean foundation for a future restore feature

The Firestore query itself stays simple (`orderBy('createdAt', 'desc')`) — no composite index required.

---

## 4. What Is Not Changing

- The create flow is unchanged — `openModal()` with no arguments works exactly as before
- Session number auto-increment logic is unchanged
- The Quill rich-text editor is reused as-is
- No new HTML files or modals are added
- Tests for `timeline-utils.js` are unaffected

---

## Out of Scope (future features)

- Restore UI for soft-deleted entries (can be done manually via Firebase Console for now)
- Concurrent edit protection / locking
- Real-time live updates via `onSnapshot`
- Version history
