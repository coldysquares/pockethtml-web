const STORAGE_CODE = 'pockethtml.code.v1';
const STORAGE_NAME = 'pockethtml.filename.v1';
const STORAGE_SOURCE = 'pockethtml.sourceUrl.v1';

const starter = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My page</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 680px;
      margin: 60px auto;
      padding: 0 20px;
    }
  </style>
</head>
<body>
  <h1>Hello from PocketHTML.</h1>
  <p>Edit this, then tap Preview.</p>
</body>
</html>`;

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

let filename = localStorage.getItem(STORAGE_NAME) || 'untitled.html';
let sourceUrl = localStorage.getItem(STORAGE_SOURCE) || '';
editor.value = localStorage.getItem(STORAGE_CODE) || starter;
filenameEl.textContent = filename;

function saveLocal() {
  localStorage.setItem(STORAGE_CODE, editor.value);
  localStorage.setItem(STORAGE_NAME, filename);
  if (sourceUrl) localStorage.setItem(STORAGE_SOURCE, sourceUrl);
  else localStorage.removeItem(STORAGE_SOURCE);
  saveStatus.textContent = 'Saved locally';
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

function renderPreview() {
  preview.srcdoc = buildPreviewHtml();
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

    editor.value = data.html;
    sourceUrl = data.finalUrl || value;
    filename = filenameFromUrl(sourceUrl);
    filenameEl.textContent = filename;
    saveLocal();
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
  renderPreview();
  setMode('preview');
});

document.querySelector('#newButton').addEventListener('click', () => {
  if (!confirm('Start a new file? Your current work is already saved in this browser.')) return;
  editor.value = starter;
  filename = 'untitled.html';
  sourceUrl = '';
  filenameEl.textContent = filename;
  saveLocal();
  setMode('code');
  editor.focus();
});

fileInput.addEventListener('change', async event => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    editor.value = await file.text();
    filename = file.name || 'untitled.html';
    sourceUrl = '';
    filenameEl.textContent = filename;
    saveLocal();
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

renderPreview();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
