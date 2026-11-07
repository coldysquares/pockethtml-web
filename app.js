const STORAGE_CODE = 'pockethtml.code.v1';
const STORAGE_NAME = 'pockethtml.filename.v1';
const STORAGE_SOURCE = 'pockethtml.sourceUrl.v1';

// New files start blank.
const starter = '';

const editor = document.querySelector('#editor');
const preview = document.querySelector('#preview');
const codePane = document.querySelector('#codePane');
const previewPane = document.querySelector('#previewPane');
const filenameEl = document.querySelector('#filename');
const saveStatus = document.querySelector('#saveStatus');
const fileInput = document.querySelector('#fileInput');
const importUrlButton = document.querySelector('#importUrlButton');
const modeButtons = [...document.querySelectorAll('.mode-button')];
const focusButton = document.querySelector('#focusButton');
const focusBar = document.querySelector('#focusBar');
const restoreControlsButton = document.querySelector('#restoreControlsButton');

const LOCAL_PREVIEW_SANDBOX = 'allow-scripts allow-forms allow-modals allow-popups allow-same-origin';
const IMPORTED_PREVIEW_SANDBOX = 'allow-scripts allow-forms allow-modals allow-popups';

const STORAGE_DOC = 'pockethtml.docId.v1';
const library = window.PocketLibrary || null;

let filename = localStorage.getItem(STORAGE_NAME) || 'untitled.html';
let sourceUrl = localStorage.getItem(STORAGE_SOURCE) || '';
let docId = localStorage.getItem(STORAGE_DOC) || '';
editor.value = localStorage.getItem(STORAGE_CODE) || starter;
// Drop the old built-in sample if it was never edited.
if (/<title>My page<\/title>/.test(editor.value) && /Hello from PocketHTML\./.test(editor.value) && editor.value.length < 700) editor.value = '';
filenameEl.textContent = filename;

function persistDoc() {
  if (!library) return Promise.resolve();
  if (!docId) {
    docId = library.newId();
    localStorage.setItem(STORAGE_DOC, docId);
  }
  return library.put({ id: docId, name: filename, code: editor.value, sourceUrl })
    .catch(() => { saveStatus.textContent = 'Saved (library unavailable)'; });
}

function saveLocal() {
  localStorage.setItem(STORAGE_CODE, editor.value);
  localStorage.setItem(STORAGE_NAME, filename);
  if (sourceUrl) localStorage.setItem(STORAGE_SOURCE, sourceUrl);
  else localStorage.removeItem(STORAGE_SOURCE);
  saveStatus.textContent = 'Saved locally';
  return persistDoc();
}

// Start a fresh library entry (Open, Import URL, New). Earlier files stay in the Library.
function startDoc({ name, code, source = '' }) {
  docId = library ? library.newId() : '';
  if (docId) localStorage.setItem(STORAGE_DOC, docId);
  else localStorage.removeItem(STORAGE_DOC);
  editor.value = code;
  filename = name || 'untitled.html';
  sourceUrl = source;
  filenameEl.textContent = filename;
  return saveLocal();
}

// Switch the editor to an existing library entry.
function loadDoc(doc) {
  docId = doc.id;
  localStorage.setItem(STORAGE_DOC, docId);
  editor.value = doc.code;
  filename = doc.name || 'untitled.html';
  sourceUrl = doc.sourceUrl || '';
  filenameEl.textContent = filename;
  return saveLocal();
}

// Opening the same file twice reuses its entry instead of duplicating it.
async function openAsDoc(name, code, source = '') {
  const same = library ? await library.findSame(name, code).catch(() => null) : null;
  return same ? loadDoc(same) : startDoc({ name, code, source });
}

let saveTimer;
editor.addEventListener('input', () => {
  saveStatus.textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveLocal, 180);
});

function escapeAttribute(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;');
}

function buildPreviewHtml() {
  if (!sourceUrl || /<base\b/i.test(editor.value)) return editor.value;

  const baseTag = `<base href="${escapeAttribute(sourceUrl)}">`;
  const headMatch = editor.value.match(/<head\b[^>]*>/i);

  if (headMatch) {
    return editor.value.replace(headMatch[0], `${headMatch[0]}\n  ${baseTag}`);
  }

  return `${baseTag}\n${editor.value}`;
}

let lastRendered = null;

// Only reload the preview when the code actually changed, so a tool that is
// mid-task (converting, recording) is not wiped by switching tabs. Refresh forces it.
function renderPreview(force = false) {
  const html = buildPreviewHtml();
  const sandbox = sourceUrl ? IMPORTED_PREVIEW_SANDBOX : LOCAL_PREVIEW_SANDBOX;
  if (!force && html === lastRendered && preview.getAttribute('sandbox') === sandbox) return;
  preview.setAttribute('sandbox', sandbox);
  preview.srcdoc = html;
  lastRendered = html;
}

function setMode(mode) {
  const isCode = mode === 'code';
  codePane.hidden = !isCode;
  previewPane.hidden = isCode;
  modeButtons.forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
  if (!isCode) renderPreview();
}

function enterFocusView() {
  if (!codePane.hidden) setMode('preview');
  document.body.classList.add('focus-preview');
  focusBar.hidden = false;
}

function exitFocusView() {
  document.body.classList.remove('focus-preview');
  focusBar.hidden = true;
}

function filenameFromUrl(value) {
  try {
    const url = new URL(value);
    const lastPart = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || 'index.html')
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/^-+|-+$/g, '');
    const safeName = lastPart || 'index.html';
    return /\.html?$/i.test(safeName) ? safeName : `${safeName}.html`;
  } catch {
    return 'imported.html';
  }
}

async function importFromUrl() {
  let value = prompt('Paste a public page URL:');
  if (!value) return;

  value = value.trim();
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;

  importUrlButton.disabled = true;
  saveStatus.textContent = 'Fetching…';

  try {
    const response = await fetch('/api/fetch-source', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: value })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    if (typeof data.html !== 'string') throw new Error('No HTML was returned.');

    const finalUrl = data.finalUrl || value;
    await openAsDoc(filenameFromUrl(finalUrl), data.html, finalUrl);
    setMode('code');
    editor.focus();
  } catch (error) {
    saveStatus.textContent = 'Import failed';
    alert(`Could not import that page: ${error.message}`);
  } finally {
    importUrlButton.disabled = false;
  }
}

modeButtons.forEach(button => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
});

focusButton.addEventListener('click', enterFocusView);
restoreControlsButton.addEventListener('click', exitFocusView);
importUrlButton.addEventListener('click', importFromUrl);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.body.classList.contains('focus-preview')) {
    exitFocusView();
  }
});

document.querySelector('#refreshButton').addEventListener('click', () => {
  renderPreview(true);
  setMode('preview');
});

// Clear empties the current file. Tap once to arm, again within 3 seconds to clear.
const clearButton = document.querySelector('#clearButton');
let clearArmed = null;
clearButton.addEventListener('click', () => {
  if (!clearArmed) {
    clearButton.textContent = 'Tap to confirm';
    clearArmed = setTimeout(() => { clearArmed = null; clearButton.textContent = 'Clear'; }, 3000);
    return;
  }
  clearTimeout(clearArmed);
  clearArmed = null;
  clearButton.textContent = 'Clear';
  editor.value = '';
  saveLocal();
  renderPreview(true);
  setMode('code');
  editor.focus();
});

document.querySelector('#newButton').addEventListener('click', async () => {
  if (!library && !confirm('Start a new file? Your current work will be replaced.')) return;
  await startDoc({ name: 'untitled.html', code: starter });
  setMode('code');
  editor.focus();
});

fileInput.addEventListener('change', async event => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    await openAsDoc(file.name || 'untitled.html', await file.text());
    setMode('code');
  } catch (error) {
    alert(`Could not open that file: ${error.message}`);
  } finally {
    fileInput.value = '';
  }
});

document.querySelector('#downloadButton').addEventListener('click', () => {
  const blob = new Blob([editor.value], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.html') || filename.endsWith('.htm') ? filename : `${filename}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

document.querySelectorAll('[data-insert]').forEach(button => {
  button.addEventListener('click', () => {
    const text = button.dataset.insert;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.setRangeText(text, start, end, 'end');
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.focus({ preventScroll: true });
  });
});

editor.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  event.preventDefault();
  const start = editor.selectionStart;
  editor.setRangeText('  ', start, editor.selectionEnd, 'end');
  editor.dispatchEvent(new Event('input', { bubbles: true }));
});

// ---- Library sheet ----
const librarySheet = document.querySelector('#librarySheet');
const libraryList = document.querySelector('#libraryList');

function formatSize(bytes) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatWhen(ms) {
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

async function renderLibrary() {
  libraryList.textContent = '';
  let docs = [];
  try { docs = library ? await library.list() : []; } catch { docs = []; }
  if (!docs.length) {
    const empty = document.createElement('p');
    empty.className = 'library-empty';
    empty.textContent = 'Nothing saved yet. Files you open, import or start here will show up in this list.';
    libraryList.appendChild(empty);
    return;
  }
  docs.forEach(doc => {
    const item = document.createElement('div');
    item.className = 'library-item' + (doc.id === docId ? ' current' : '');

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'library-open';
    const name = document.createElement('span');
    name.className = 'library-name';
    name.textContent = doc.title || doc.name;
    const meta = document.createElement('span');
    meta.className = 'library-meta';
    meta.textContent = `${doc.title && doc.title !== doc.name ? doc.name + ' · ' : ''}${formatSize(doc.size)} · ${formatWhen(doc.updated)}${doc.id === docId ? ' · open now' : ''}`;
    open.append(name, meta);
    open.addEventListener('click', async () => {
      await loadDoc(doc);
      closeLibrary();
      setMode('preview');
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'library-delete';
    del.textContent = 'Delete';
    del.setAttribute('aria-label', `Delete ${doc.name}`);
    del.addEventListener('click', async () => {
      if (!confirm(`Delete “${doc.title || doc.name}” from this phone’s library?`)) return;
      await library.remove(doc.id);
      if (doc.id === docId) {
        docId = '';
        localStorage.removeItem(STORAGE_DOC);
      }
      renderLibrary();
    });

    item.append(open, del);
    libraryList.appendChild(item);
  });
}

function openLibrary() {
  librarySheet.hidden = false;
  document.body.classList.add('sheet-open');
  renderLibrary();
}

function closeLibrary() {
  librarySheet.hidden = true;
  document.body.classList.remove('sheet-open');
}

document.querySelector('#libraryButton').addEventListener('click', openLibrary);
document.querySelector('#libraryClose').addEventListener('click', closeLibrary);
librarySheet.addEventListener('click', event => {
  if (event.target === librarySheet) closeLibrary();
});

// ---- Startup: ?doc=<id> opens a saved file, ?src=/tools/... loads a hosted tool's source ----
async function boot() {
  const params = new URLSearchParams(location.search);
  const wantDoc = params.get('doc');
  const wantSrc = params.get('src');
  const wantNew = params.has('new');
  try {
    if (wantNew) {
      await startDoc({ name: 'untitled.html', code: starter });
      setMode('code');
    } else if (wantDoc && library) {
      const doc = await library.get(wantDoc);
      if (doc) {
        await loadDoc(doc);
        setMode('preview');
      }
    } else if (wantSrc) {
      const url = new URL(wantSrc, location.href);
      if (url.origin !== location.origin) throw new Error('Only tools hosted here can be opened this way.');
      const response = await fetch(url.href, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Could not load ${url.pathname} (${response.status})`);
      const name = url.pathname.split('/').filter(Boolean).slice(-2).join('-').replace(/-index\.html$/, '.html') || 'tool.html';
      await openAsDoc(name, await response.text());
      setMode('code');
    } else if (library && !docId && editor.value.trim()) {
      // First run with the library: keep whatever was already being edited.
      await persistDoc();
    }
  } catch (error) {
    alert(error.message);
  }
  if (wantDoc || wantSrc || wantNew) history.replaceState(null, '', location.pathname);
  renderPreview();
}

boot();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
