# Timeline Edit & Delete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add edit and soft-delete actions to each timeline entry via a 3-dot context menu, reusing the existing create modal for editing.

**Architecture:** A module-level `editingEntryId` flag distinguishes create from edit mode in the existing modal. An `entriesMap` stores all loaded entry data keyed by Firestore doc ID so the edit form can be pre-filled instantly. Deletion sets `deleted: true` in Firestore and filters client-side — no entries are ever permanently removed.

**Tech Stack:** Plain JS, Firebase Firestore (`updateDoc`, `doc`), existing Quill editor, CSS for dropdown menu.

---

### Task 1: Create feature branch

**Files:** none

**Step 1: Create and switch to the feature branch**

```bash
cd RPGOrganizerApp
git checkout -b feature/timeline-edit-delete
```

**Step 2: Verify you're on the right branch**

```bash
git branch
```
Expected: `* feature/timeline-edit-delete`

---

### Task 2: Update `app.html` — modal title ID + session number display

**Files:**
- Modify: `RPGOrganizerApp/app.html:38`
- Modify: `RPGOrganizerApp/app.html:125` (near the error message `<p>`)

The modal title needs an `id` so JavaScript can change it between "Neuer Eintrag" and "Eintrag bearbeiten". We also need a read-only line to show the session number in edit mode.

**Step 1: Add `id="modalTitle"` to the modal title**

Find this line (line 38):
```html
      <h2 class="modal-title">Neuer Eintrag</h2>
```
Replace with:
```html
      <h2 class="modal-title" id="modalTitle">Neuer Eintrag</h2>
```

**Step 2: Add session number display above the error paragraph**

Find this line (line 125):
```html
        <p class="error-msg" id="formError"></p>
```
Replace with:
```html
        <p class="session-display" id="sessionNumberDisplay" hidden></p>
        <p class="error-msg" id="formError"></p>
```

**Step 3: Verify the file looks correct around those two changes**

Open `app.html` and confirm the changes look right visually.

---

### Task 3: Update Firestore imports and add module-level variables in `timeline.js`

**Files:**
- Modify: `RPGOrganizerApp/src/js/timeline.js:1-15`

**Step 1: Add `doc` and `updateDoc` to the Firestore import**

Find (line 3–6):
```js
import {
  collection, addDoc, getDocs,
  query, orderBy, where, serverTimestamp
} from 'firebase/firestore';
```
Replace with:
```js
import {
  collection, addDoc, getDocs, doc, updateDoc,
  query, orderBy, where, serverTimestamp
} from 'firebase/firestore';
```

**Step 2: Add `editingEntryId` and `entriesMap` to the module-level variables**

Find (lines 11–15):
```js
let quill;
let players = [];
let lastEntryDate = { day: null, month: null, year: null };
let nextSessionNumber = 1;
let initialized = false;
```
Replace with:
```js
let quill;
let players = [];
let lastEntryDate = { day: null, month: null, year: null };
let nextSessionNumber = 1;
let initialized = false;
let editingEntryId = null;
const entriesMap = new Map();
```

**Step 3: Run the dev server and confirm no import errors**

```bash
npm run dev
```
Open http://localhost:5173/app.html — the page should load and the timeline should render normally.

---

### Task 4: Update `loadTimeline` to populate `entriesMap`, filter soft-deleted entries, and pass `docId` to `renderEntry`

**Files:**
- Modify: `RPGOrganizerApp/src/js/timeline.js` — `loadTimeline` function (lines 108–135)

**Step 1: Replace the `loadTimeline` function**

Find the entire `loadTimeline` function:
```js
async function loadTimeline() {
  const q = query(collection(db, 'timeline'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);

  const list = document.getElementById('timelineList');
  list.innerHTML = '';

  if (snapshot.empty) {
    list.innerHTML = '<p class="timeline-empty">Noch keine Einträge vorhanden.</p>';
    nextSessionNumber = 1;
    lastEntryDate = { day: null, month: null, year: null };
    return;
  }

  // Track state from the most recent entry (first in desc order)
  const latestData = snapshot.docs[0].data();
  if (latestData.inGameEndMonth) {
    lastEntryDate = { day: latestData.inGameEndDay, month: latestData.inGameEndMonth, year: latestData.inGameEndYear };
  } else {
    lastEntryDate = { day: latestData.inGameDay, month: latestData.inGameMonth, year: latestData.inGameYear };
  }
  const maxSession = snapshot.docs.reduce((max, d) => Math.max(max, d.data().sessionNumber || 0), 0);
  nextSessionNumber = maxSession + 1;

  snapshot.forEach(doc => {
    list.appendChild(renderEntry(doc.data()));
  });
}
```

Replace with:
```js
async function loadTimeline() {
  const q = query(collection(db, 'timeline'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);

  const list = document.getElementById('timelineList');
  list.innerHTML = '';
  entriesMap.clear();

  // Filter out soft-deleted entries client-side
  const activeDocs = snapshot.docs.filter(d => d.data().deleted !== true);

  if (activeDocs.length === 0) {
    list.innerHTML = '<p class="timeline-empty">Noch keine Einträge vorhanden.</p>';
    nextSessionNumber = 1;
    lastEntryDate = { day: null, month: null, year: null };
    return;
  }

  // Track state from the most recent active entry (first in desc order)
  const latestData = activeDocs[0].data();
  if (latestData.inGameEndMonth) {
    lastEntryDate = { day: latestData.inGameEndDay, month: latestData.inGameEndMonth, year: latestData.inGameEndYear };
  } else {
    lastEntryDate = { day: latestData.inGameDay, month: latestData.inGameMonth, year: latestData.inGameYear };
  }
  const maxSession = activeDocs.reduce((max, d) => Math.max(max, d.data().sessionNumber || 0), 0);
  nextSessionNumber = maxSession + 1;

  activeDocs.forEach(d => {
    const entry = d.data();
    entriesMap.set(d.id, entry);
    list.appendChild(renderEntry(d.id, entry));
  });
}
```

**Step 2: Verify the page still loads and shows entries**

Reload http://localhost:5173/app.html. Existing entries (which have no `deleted` field) should still appear — `deleted !== true` passes for `undefined`.

---

### Task 5: Update `renderEntry` to accept `docId` and add the 3-dot context menu

**Files:**
- Modify: `RPGOrganizerApp/src/js/timeline.js` — `renderEntry` function (lines 137–161)

**Step 1: Replace the `renderEntry` function**

Find:
```js
function renderEntry(entry) {
  const card = document.createElement('div');
  card.className = 'timeline-entry';

  const inGameDate = formatInGameDateRange(
    entry.inGameDay, entry.inGameMonth, entry.inGameYear,
    entry.inGameEndDay, entry.inGameEndMonth, entry.inGameEndYear
  );
  const realDate = formatDate(entry.realDate);
  const session = entry.sessionNumber ? `Sitzung ${entry.sessionNumber}` : '';

  card.innerHTML = `
    <div class="entry-header">
      <div class="entry-meta">
        ${session ? `<span class="entry-session">${session}</span>` : ''}
        <span class="entry-dates">${inGameDate}${realDate ? ' · ' + realDate : ''}</span>
      </div>
      <span class="entry-author" style="color: ${entry.authorColor}">${entry.authorName}</span>
    </div>
    <h3 class="entry-title">${entry.title}</h3>
    <div class="entry-description ql-editor">${entry.description}</div>
  `;

  return card;
}
```

Replace with:
```js
function renderEntry(docId, entry) {
  const card = document.createElement('div');
  card.className = 'timeline-entry';

  const inGameDate = formatInGameDateRange(
    entry.inGameDay, entry.inGameMonth, entry.inGameYear,
    entry.inGameEndDay, entry.inGameEndMonth, entry.inGameEndYear
  );
  const realDate = formatDate(entry.realDate);
  const session = entry.sessionNumber ? `Sitzung ${entry.sessionNumber}` : '';

  card.innerHTML = `
    <div class="entry-header">
      <div class="entry-meta">
        ${session ? `<span class="entry-session">${session}</span>` : ''}
        <span class="entry-dates">${inGameDate}${realDate ? ' · ' + realDate : ''}</span>
      </div>
      <div class="entry-actions">
        <span class="entry-author" style="color: ${entry.authorColor}">${entry.authorName}</span>
        <button class="entry-menu-btn" aria-label="Aktionen">⋯</button>
        <div class="entry-menu" hidden>
          <button class="entry-menu-item" data-action="edit">Bearbeiten</button>
          <button class="entry-menu-item entry-menu-item--danger" data-action="delete">Löschen</button>
        </div>
      </div>
    </div>
    <h3 class="entry-title">${entry.title}</h3>
    <div class="entry-description ql-editor">${entry.description}</div>
  `;

  const menuBtn = card.querySelector('.entry-menu-btn');
  const menu = card.querySelector('.entry-menu');

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close any other open menus
    document.querySelectorAll('.entry-menu:not([hidden])').forEach(m => {
      if (m !== menu) m.hidden = true;
    });
    menu.hidden = !menu.hidden;
  });

  card.querySelector('[data-action="edit"]').addEventListener('click', () => {
    menu.hidden = true;
    openModal(docId, entriesMap.get(docId));
  });

  card.querySelector('[data-action="delete"]').addEventListener('click', () => {
    menu.hidden = true;
    deleteEntry(docId, card);
  });

  return card;
}
```

**Step 2: Add global click handler to close menus** — add this inside the `init()` function, near the other `addEventListener` calls at the top:

Find (inside `init()`):
```js
  document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
  document.getElementById('newEntryBtn').addEventListener('click', openModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('entryForm').addEventListener('submit', saveEntry);
```

Replace with:
```js
  document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
  document.getElementById('newEntryBtn').addEventListener('click', () => openModal());
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('entryForm').addEventListener('submit', saveEntry);
  document.addEventListener('click', () => {
    document.querySelectorAll('.entry-menu:not([hidden])').forEach(m => { m.hidden = true; });
  });
```

**Step 3: Verify entries still render and the ⋯ button appears**

Reload the app. Each card should now have a `⋯` button in the top right. Clicking it should show a dropdown. Clicking outside should close it.

---

### Task 6: Add CSS for the 3-dot menu

**Files:**
- Modify: `RPGOrganizerApp/src/css/timeline.css` — append at end of file

**Step 1: Append the menu styles to the end of `timeline.css`**

```css
/* ── Entry actions (3-dot menu) ──────────────────────────────── */

.entry-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;
}

.entry-menu-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.1rem;
  line-height: 1;
  padding: 0.2rem 0.4rem;
  cursor: pointer;
  border-radius: 2px;
  transition: color 0.2s, background 0.2s;
  letter-spacing: 0.05em;
}

.entry-menu-btn:hover {
  color: var(--gold);
  background: rgba(201, 168, 76, 0.08);
}

.entry-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-gold);
  border-radius: 3px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  z-index: 50;
  min-width: 130px;
  overflow: hidden;
}

.entry-menu[hidden] {
  display: none;
}

.entry-menu-item {
  display: block;
  width: 100%;
  background: none;
  border: none;
  text-align: left;
  padding: 0.6rem 0.9rem;
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.entry-menu-item:hover {
  background: rgba(201, 168, 76, 0.08);
  color: var(--gold);
}

.entry-menu-item--danger:hover {
  background: rgba(180, 50, 50, 0.12);
  color: var(--red-accent);
}

/* read-only session number in edit modal */
.session-display {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}
```

**Step 2: Verify the dropdown looks correct in the browser**

Open a card's menu. It should appear below the `⋯` button, styled in the dark gold theme. "Löschen" should turn red on hover.

---

### Task 7: Update `openModal` to handle edit mode

**Files:**
- Modify: `RPGOrganizerApp/src/js/timeline.js` — `openModal` function (lines 164–183)

**Step 1: Replace `openModal`**

Find:
```js
function openModal() {
  document.getElementById('entryModal').hidden = false;
  document.getElementById('entryForm').reset();
  document.getElementById('formError').textContent = '';
  document.getElementById('endDateRow').hidden = true;
  quill.setContents([]);

  // Pre-fill in-game date from last entry
  if (lastEntryDate.month) {
    document.getElementById('inGameMonth').value = lastEntryDate.month;
    populateDaySelect(document.getElementById('inGameDay'), lastEntryDate.month);
    document.getElementById('inGameDay').value = lastEntryDate.day ?? '';
    document.getElementById('inGameYear').value = lastEntryDate.year ?? '';
  } else {
    populateDaySelect(document.getElementById('inGameDay'), document.getElementById('inGameMonth').value);
  }

  // Pre-fill real date with today
  document.getElementById('realDate').value = new Date().toISOString().split('T')[0];
}
```

Replace with:
```js
function openModal(docId = null, entry = null) {
  editingEntryId = docId;
  const isEdit = docId !== null;

  document.getElementById('entryModal').hidden = false;
  document.getElementById('formError').textContent = '';

  document.getElementById('modalTitle').textContent = isEdit ? 'Eintrag bearbeiten' : 'Neuer Eintrag';

  const sessionDisplay = document.getElementById('sessionNumberDisplay');

  if (isEdit && entry) {
    // Pre-fill all fields from the existing entry
    document.getElementById('entryTitle').value = entry.title;

    document.getElementById('inGameMonth').value = entry.inGameMonth;
    populateDaySelect(document.getElementById('inGameDay'), entry.inGameMonth);
    document.getElementById('inGameDay').value = entry.inGameDay ?? '';
    document.getElementById('inGameYear').value = entry.inGameYear ?? '';

    const isMultiDay = !!entry.inGameEndMonth;
    document.getElementById('isMultiDay').checked = isMultiDay;
    document.getElementById('endDateRow').hidden = !isMultiDay;
    if (isMultiDay) {
      document.getElementById('inGameEndMonth').value = entry.inGameEndMonth;
      populateDaySelect(document.getElementById('inGameEndDay'), entry.inGameEndMonth);
      document.getElementById('inGameEndDay').value = entry.inGameEndDay ?? '';
      document.getElementById('inGameEndYear').value = entry.inGameEndYear ?? '';
    }

    document.getElementById('realDate').value = entry.realDate ?? '';
    document.getElementById('authorSelect').value = entry.authorId;

    sessionDisplay.textContent = entry.sessionNumber ? `Sitzung ${entry.sessionNumber}` : '';
    sessionDisplay.hidden = !entry.sessionNumber;

    quill.root.innerHTML = entry.description || '';
  } else {
    // Create mode — reset form, pre-fill sensible defaults
    document.getElementById('entryForm').reset();
    document.getElementById('endDateRow').hidden = true;
    sessionDisplay.hidden = true;
    quill.setContents([]);

    if (lastEntryDate.month) {
      document.getElementById('inGameMonth').value = lastEntryDate.month;
      populateDaySelect(document.getElementById('inGameDay'), lastEntryDate.month);
      document.getElementById('inGameDay').value = lastEntryDate.day ?? '';
      document.getElementById('inGameYear').value = lastEntryDate.year ?? '';
    } else {
      populateDaySelect(document.getElementById('inGameDay'), document.getElementById('inGameMonth').value);
    }

    document.getElementById('realDate').value = new Date().toISOString().split('T')[0];
  }
}
```

**Step 2: Verify "Neuer Eintrag" still works**

Click "+ Neuer Eintrag". The modal should open blank with title "Neuer Eintrag" exactly as before.

**Step 3: Verify edit pre-fill works**

Click `⋯` on an existing entry → "Bearbeiten". The modal should open with title "Eintrag bearbeiten" and all fields populated.

---

### Task 8: Update `saveEntry` to use `updateDoc` in edit mode and add `deleted: false` on create

**Files:**
- Modify: `RPGOrganizerApp/src/js/timeline.js` — `saveEntry` function (lines 190–224)

**Step 1: Replace `saveEntry`**

Find:
```js
async function saveEntry(e) {
  e.preventDefault();

  const authorId = document.getElementById('authorSelect').value;
  const author = players.find(p => p.id === authorId);
  if (!author) return;

  const isMultiDay = document.getElementById('isMultiDay').checked;

  const entry = {
    title: document.getElementById('entryTitle').value.trim(),
    description: quill.root.innerHTML,
    inGameDay: parseInt(document.getElementById('inGameDay').value) || null,
    inGameMonth: document.getElementById('inGameMonth').value,
    inGameYear: parseInt(document.getElementById('inGameYear').value) || null,
    inGameEndDay: isMultiDay ? (parseInt(document.getElementById('inGameEndDay').value) || null) : null,
    inGameEndMonth: isMultiDay ? document.getElementById('inGameEndMonth').value : null,
    inGameEndYear: isMultiDay ? (parseInt(document.getElementById('inGameEndYear').value) || null) : null,
    realDate: document.getElementById('realDate').value || null,
    sessionNumber: nextSessionNumber,
    authorId: author.id,
    authorName: author.characterShortName,
    authorColor: author.color,
    createdAt: serverTimestamp(),
  };

  try {
    await addDoc(collection(db, 'timeline'), entry);
    closeModal();
    await loadTimeline();
  } catch (err) {
    document.getElementById('formError').textContent = 'Fehler beim Speichern. Bitte erneut versuchen.';
    console.error(err);
  }
}
```

Replace with:
```js
async function saveEntry(e) {
  e.preventDefault();

  const authorId = document.getElementById('authorSelect').value;
  const author = players.find(p => p.id === authorId);
  if (!author) return;

  const isMultiDay = document.getElementById('isMultiDay').checked;

  const fields = {
    title: document.getElementById('entryTitle').value.trim(),
    description: quill.root.innerHTML,
    inGameDay: parseInt(document.getElementById('inGameDay').value) || null,
    inGameMonth: document.getElementById('inGameMonth').value,
    inGameYear: parseInt(document.getElementById('inGameYear').value) || null,
    inGameEndDay: isMultiDay ? (parseInt(document.getElementById('inGameEndDay').value) || null) : null,
    inGameEndMonth: isMultiDay ? document.getElementById('inGameEndMonth').value : null,
    inGameEndYear: isMultiDay ? (parseInt(document.getElementById('inGameEndYear').value) || null) : null,
    realDate: document.getElementById('realDate').value || null,
    authorId: author.id,
    authorName: author.characterShortName,
    authorColor: author.color,
    lastModifiedAt: serverTimestamp(),
  };

  try {
    if (editingEntryId) {
      await updateDoc(doc(db, 'timeline', editingEntryId), fields);
    } else {
      await addDoc(collection(db, 'timeline'), {
        ...fields,
        sessionNumber: nextSessionNumber,
        deleted: false,
        createdAt: serverTimestamp(),
      });
    }
    closeModal();
    await loadTimeline();
  } catch (err) {
    document.getElementById('formError').textContent = 'Fehler beim Speichern. Bitte erneut versuchen.';
    console.error(err);
  }
}
```

**Step 2: Update `closeModal` to reset `editingEntryId`**

Find:
```js
function closeModal() {
  document.getElementById('entryModal').hidden = true;
}
```

Replace with:
```js
function closeModal() {
  document.getElementById('entryModal').hidden = true;
  editingEntryId = null;
}
```

**Step 3: Test editing an entry end-to-end**

1. Open an existing entry via "Bearbeiten"
2. Change the title
3. Click "Speichern"
4. Verify the entry updates in the list with the new title
5. Re-open the entry and confirm the new title is pre-filled

---

### Task 9: Add `deleteEntry` function

**Files:**
- Modify: `RPGOrganizerApp/src/js/timeline.js` — add new function after `closeModal`

**Step 1: Add the function after `closeModal`**

After:
```js
function closeModal() {
  document.getElementById('entryModal').hidden = true;
  editingEntryId = null;
}
```

Add:
```js
// ── Delete entry (soft) ───────────────────────────────────────
async function deleteEntry(docId, cardEl) {
  const confirmed = confirm('Eintrag wirklich löschen? Er bleibt in der Datenbank gespeichert und kann bei Bedarf wiederhergestellt werden.');
  if (!confirmed) return;

  try {
    await updateDoc(doc(db, 'timeline', docId), { deleted: true });
    entriesMap.delete(docId);
    cardEl.remove();
  } catch (err) {
    alert('Fehler beim Löschen. Bitte erneut versuchen.');
    console.error(err);
  }
}
```

**Step 2: Test deleting an entry**

1. Click `⋯` on an entry → "Löschen"
2. A confirmation dialog appears — click "Abbrechen" and verify the entry is still there
3. Click "Löschen" again → confirm — the card should disappear from the UI
4. Open the Firebase Console → Firestore → `timeline` collection → find the document — confirm `deleted: true` is set and all other fields are intact

**Step 3: Reload the page and verify the deleted entry does not come back**

---

### Task 10: Run tests and commit

**Step 1: Run the existing test suite**

```bash
npm test
```
Expected: all 21 tests pass (no changes to `timeline-utils.js`)

**Step 2: Do a final manual check**

- Create a new entry — verify it appears correctly and has `deleted: false` in Firestore
- Edit an entry — verify all fields save correctly
- Delete an entry — verify soft delete and it doesn't reappear on reload
- Open the "Neuer Eintrag" modal — verify session number display is hidden (create mode only)

**Step 3: Stage and commit all changes**

```bash
git add app.html src/js/timeline.js src/css/timeline.css
git commit -m "feat: add edit and soft-delete to timeline entries via 3-dot menu"
```

**Step 4: Push and open a PR**

```bash
git push -u origin feature/timeline-edit-delete
```

Then open a PR on GitHub from `feature/timeline-edit-delete` → `main`.
