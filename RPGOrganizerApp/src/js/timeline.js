import { auth, db } from '/src/js/firebase-config.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection, addDoc, getDocs,
  query, orderBy, where, serverTimestamp
} from 'firebase/firestore';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { formatDate, formatInGameDateRange, nextInGameDay, getMaxDayForMonth } from './timeline-utils.js';

let quill;
let players = [];
let lastEntryDate = { day: null, month: null, year: null };
let nextSessionNumber = 1;
let initialized = false;

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
  document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
  document.getElementById('newEntryBtn').addEventListener('click', openModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('entryForm').addEventListener('submit', saveEntry);

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
        ['blockquote', 'clean']
      ]
    }
  });

  await Promise.all([loadPlayers(), loadTimeline()]);
}

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

// ── Load and render timeline ──────────────────────────────────
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

// ── Modal ─────────────────────────────────────────────────────
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

function closeModal() {
  document.getElementById('entryModal').hidden = true;
}

// ── Save entry ────────────────────────────────────────────────
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
