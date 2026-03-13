import { auth, db } from '/src/js/firebase-config.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection, addDoc, getDocs, doc, updateDoc,
  query, orderBy, where, serverTimestamp, onSnapshot
} from 'firebase/firestore';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { formatDate, formatInGameDateRange, nextInGameDay, getMaxDayForMonth } from './timeline-utils.js';

let quill;
let players = [];
let lastEntryDate = { day: null, month: null, year: null };
let nextSessionNumber = 1;
let initialized = false;
let editingEntryId = null;
let pendingDelete = null;
let timelineUnsubscribe = null;
const entriesMap = new Map();
let pendingImageUrls = [];   // URLs uploaded in the current editing session
let pendingEntryRef  = null; // Firestore doc ref pre-generated for new entries
let pendingRange     = null; // Quill selection range saved before file picker opens
let isUploading      = false;

// ── Auth guard ───────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = '/index.html';
  } else if (!initialized) {
    initialized = true;
    init();
  }
});

// ── Day select helper ─────────────────────────────────────────
function populateDaySelect(selectEl, month) {
  const current = parseInt(selectEl.value) || null;
  const max = getMaxDayForMonth(month);
  selectEl.innerHTML = '<option value="">—</option>';
  for (let i = 1; i <= max; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    selectEl.appendChild(opt);
  }
  if (current && current <= max) selectEl.value = current;
}

// ── Init ─────────────────────────────────────────────────────
async function init() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (timelineUnsubscribe) timelineUnsubscribe();
    signOut(auth);
  });
  document.getElementById('newEntryBtn').addEventListener('click', () => openModal());
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('entryForm').addEventListener('submit', saveEntry);
  document.addEventListener('click', () => {
    document.querySelectorAll('.entry-menu:not([hidden])').forEach(m => {
      m.hidden = true;
      m.previousElementSibling.setAttribute('aria-expanded', 'false');
    });
  });

  // Populate day selects on initial load and on month change
  const inGameMonth = document.getElementById('inGameMonth');
  const inGameEndMonth = document.getElementById('inGameEndMonth');
  populateDaySelect(document.getElementById('inGameDay'), inGameMonth.value);
  populateDaySelect(document.getElementById('inGameEndDay'), inGameEndMonth.value);
  inGameMonth.addEventListener('change', () => {
    populateDaySelect(document.getElementById('inGameDay'), inGameMonth.value);
  });
  inGameEndMonth.addEventListener('change', () => {
    populateDaySelect(document.getElementById('inGameEndDay'), inGameEndMonth.value);
  });

  document.getElementById('isMultiDay').addEventListener('change', (e) => {
    const endDateRow = document.getElementById('endDateRow');
    endDateRow.hidden = !e.target.checked;
    if (e.target.checked) {
      const startDay = parseInt(document.getElementById('inGameDay').value) || null;
      const startMonth = document.getElementById('inGameMonth').value;
      const startYear = parseInt(document.getElementById('inGameYear').value) || null;
      const next = nextInGameDay(startDay, startMonth, startYear);
      const endMonth = next.month ?? inGameEndMonth.value;
      document.getElementById('inGameEndMonth').value = endMonth;
      populateDaySelect(document.getElementById('inGameEndDay'), endMonth);
      document.getElementById('inGameEndDay').value = next.day ?? '';
      document.getElementById('inGameEndYear').value = next.year ?? '';
    }
  });

  quill = new Quill('#quillEditor', {
    theme: 'snow',
    placeholder: 'Beschreibung des Ereignisses...',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'clean'],
        ['image']
      ]
    }
  });

  quill.getModule('toolbar').addHandler('image', handleImageUpload);
  document.getElementById('imageUploadInput').addEventListener('change', onImageFileSelected);

  await loadPlayers();
  subscribeToTimeline();
}

// ── Image upload stubs (filled in Task 6) ────────────────────
function handleImageUpload() {}
function onImageFileSelected() {}

// ── Load players (for author dropdown) ───────────────────────
async function loadPlayers() {
  const q = query(collection(db, 'users'), where('role', '==', 'player'));
  const snapshot = await getDocs(q);
  players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const select = document.getElementById('authorSelect');
  select.innerHTML = '';
  players.forEach(player => {
    const option = document.createElement('option');
    option.value = player.id;
    option.textContent = `${player.characterShortName} (${player.playerName})`;
    select.appendChild(option);
  });
}

// ── Subscribe to timeline (real-time) ────────────────────────
function subscribeToTimeline() {
  // Guard against accidental double-call: unsubscribe any existing listener first.
  if (timelineUnsubscribe) {
    timelineUnsubscribe();
    timelineUnsubscribe = null;
  }

  const q = query(collection(db, 'timeline'), orderBy('createdAt', 'desc'));

  timelineUnsubscribe = onSnapshot(q, (snapshot) => {
    const list = document.getElementById('timelineList');
    list.innerHTML = '';
    entriesMap.clear();

    // Filter out soft-deleted entries and the entry currently pending deletion.
    // The pending-delete entry has already been removed from the DOM optimistically;
    // if the snapshot fires during the 5s undo window we must not re-render it.
    const activeDocs = snapshot.docs.filter(d => {
      if (d.data().deleted === true) return false;
      if (pendingDelete && d.id === pendingDelete.docId) return false;
      return true;
    });

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
  }, (err) => {
    console.error('Timeline listener error:', err);
  });
}

// ── Re-render timeline from entriesMap ────────────────────────
// Used when the DOM has been wiped by a snapshot re-render during the
// undo window. entriesMap is the source of truth in that case.
function renderFromEntriesMap() {
  const list = document.getElementById('timelineList');
  list.innerHTML = '';
  if (entriesMap.size === 0) {
    list.innerHTML = '<p class="timeline-empty">Noch keine Einträge vorhanden.</p>';
    return;
  }
  entriesMap.forEach((entry, docId) => {
    list.appendChild(renderEntry(docId, entry));
  });
}

function renderEntry(docId, entry) {
  const card = document.createElement('div');
  card.className = 'timeline-entry';

  const inGameDate = formatInGameDateRange(
    entry.inGameDay, entry.inGameMonth, entry.inGameYear,
    entry.inGameEndDay, entry.inGameEndMonth, entry.inGameEndYear
  );
  const realDate = formatDate(entry.realDate);

  // Build structure with innerHTML only for trusted, static strings (dates, session label)
  // User-supplied fields (title, authorName, description) are set via textContent / DOM to avoid XSS
  card.innerHTML = `
    <div class="entry-header">
      <div class="entry-meta">
        ${entry.sessionNumber ? `<span class="entry-session">Sitzung ${entry.sessionNumber}</span>` : ''}
        <span class="entry-dates">${inGameDate}${realDate ? ' · ' + realDate : ''}</span>
      </div>
      <div class="entry-actions">
        <span class="entry-author"></span>
        <button class="entry-menu-btn" aria-label="Aktionen" aria-expanded="false">⋯</button>
        <div class="entry-menu" hidden>
          <button class="entry-menu-item" data-action="edit">Bearbeiten</button>
          <button class="entry-menu-item entry-menu-item--danger" data-action="delete">Löschen</button>
        </div>
      </div>
    </div>
    <h3 class="entry-title"></h3>
    <div class="entry-description ql-editor"></div>
  `;

  // Set user-supplied content safely
  card.querySelector('.entry-author').textContent = entry.authorName;
  card.querySelector('.entry-author').style.color = entry.authorColor;
  card.querySelector('.entry-title').textContent = entry.title;
  card.querySelector('.entry-description').innerHTML = entry.description; // Quill HTML, trusted rich text

  const menuBtn = card.querySelector('.entry-menu-btn');
  const menu = card.querySelector('.entry-menu');

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close any other open menus
    document.querySelectorAll('.entry-menu:not([hidden])').forEach(m => {
      if (m !== menu) {
        m.hidden = true;
        m.previousElementSibling.setAttribute('aria-expanded', 'false');
      }
    });
    const opening = menu.hidden;
    menu.hidden = !opening;
    menuBtn.setAttribute('aria-expanded', String(opening));
  });

  card.querySelector('[data-action="edit"]').addEventListener('click', () => {
    menu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
    openModal(docId, entriesMap.get(docId));
  });

  card.querySelector('[data-action="delete"]').addEventListener('click', () => {
    menu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
    deleteEntry(docId, card, entriesMap.get(docId));
  });

  return card;
}

// ── Modal ─────────────────────────────────────────────────────
function openModal(docId = null, entry = null) {
  editingEntryId = docId;
  const isEdit = docId !== null;
  const uploadError = document.getElementById('uploadError');

  document.getElementById('entryModal').hidden = false;
  document.getElementById('formError').textContent = '';

  document.getElementById('modalTitle').textContent = isEdit ? 'Eintrag bearbeiten' : 'Neuer Eintrag';

  const sessionDisplay = document.getElementById('sessionNumberDisplay');

  if (isEdit && entry) {
    pendingEntryRef = null;
    pendingImageUrls = [];
    pendingRange = null;
    document.querySelector('.btn-submit').disabled = false;
    uploadError.textContent = '';
    uploadError.hidden = true;

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
    pendingEntryRef = doc(collection(db, 'timeline'));
    pendingImageUrls = [];
    pendingRange = null;
    document.querySelector('.btn-submit').disabled = false;
    uploadError.textContent = '';
    uploadError.hidden = true;

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

function closeModal() {
  document.getElementById('entryModal').hidden = true;
  editingEntryId = null;
}

// ── Snackbar helpers ──────────────────────────────────────────
function showSnackbar(message, undoCallback) {
  document.getElementById('snackbarMsg').textContent = message;

  const undoBtn = document.getElementById('snackbarUndo');
  undoBtn.hidden = undoCallback === null;
  undoBtn.onclick = undoCallback;

  // Reset progress bar animation by replacing the element (forces reflow).
  // Always re-query by ID afterwards — never cache a reference to snackbarProgress.
  const oldProg = document.getElementById('snackbarProgress');
  const newProg = oldProg.cloneNode(false);
  oldProg.replaceWith(newProg);

  document.getElementById('snackbar').hidden = false;
}

function hideSnackbar() {
  document.getElementById('snackbar').hidden = true;
}

function commitPendingDelete() {
  if (!pendingDelete) return;
  clearTimeout(pendingDelete.timer);
  const { docId } = pendingDelete;
  pendingDelete = null;
  hideSnackbar();
  // Fire-and-forget. If this fails the entry will reappear via the onSnapshot listener.
  updateDoc(doc(db, 'timeline', docId), { deleted: true }).catch(err => {
    console.error('Background delete failed:', err);
  });
}

// ── Delete entry (soft) ───────────────────────────────────────
function deleteEntry(docId, cardEl, entryData) {
  // Guard: entryData may be undefined if the entriesMap was cleared by a concurrent
  // onSnapshot re-render between render and click. In that case do nothing.
  if (!entryData) return;

  // If another deletion is pending, commit it immediately before starting a new one.
  // commitPendingDelete() is fire-and-forget: the Firestore write for the first entry
  // is dispatched in the background. This is intentional — see spec §5 concurrent delete.
  commitPendingDelete();

  // Capture DOM position so undo AND error recovery can restore the card in its
  // original sorted position (not at the bottom of the list).
  const cardParent = cardEl.parentNode;
  const cardNextSibling = cardEl.nextSibling; // null if card was the last item

  // Optimistic remove from DOM and map.
  entriesMap.delete(docId);
  cardEl.remove();

  // Schedule the actual Firestore write after 5 seconds.
  const timer = setTimeout(async () => {
    pendingDelete = null;
    hideSnackbar();
    try {
      await updateDoc(doc(db, 'timeline', docId), { deleted: true });
    } catch (err) {
      console.error(err);
      // Restore on failure: put the card and map entry back.
      entriesMap.set(docId, entryData);
      if (document.contains(cardParent)) {
        cardParent.insertBefore(cardEl, cardNextSibling);
      } else {
        renderFromEntriesMap();
      }
      showSnackbar('Fehler beim Löschen. Bitte erneut versuchen.', null);
    }
  }, 5000);

  pendingDelete = { timer, docId, entryData, cardEl, cardParent, cardNextSibling };

  showSnackbar('Eintrag gelöscht', () => {
    // Undo — pendingDelete is guaranteed non-null here.
    clearTimeout(pendingDelete.timer);
    pendingDelete = null;
    entriesMap.set(docId, entryData);
    if (document.contains(cardParent)) {
      cardParent.insertBefore(cardEl, cardNextSibling);
    } else {
      // cardParent was detached by a snapshot re-render during the undo window.
      // Force a full re-render from entriesMap so the restored entry becomes visible.
      renderFromEntriesMap();
    }
    hideSnackbar();
  });
}

// ── Save entry ────────────────────────────────────────────────
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
  } catch (err) {
    document.getElementById('formError').textContent = 'Fehler beim Speichern. Bitte erneut versuchen.';
    console.error(err);
  }
}
