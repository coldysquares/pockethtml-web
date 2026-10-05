const STORAGE_CODE = 'pockethtml.code.v1';
const STORAGE_NAME = 'pockethtml.filename.v1';

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
const modeButtons = [...document.querySelectorAll('.mode-button')];

let filename = localStorage.getItem(STORAGE_NAME) || 'untitled.html';
editor.value = localStorage.getItem(STORAGE_CODE) || starter;
filenameEl.textContent = filename;

function saveLocal() {
  localStorage.setItem(STORAGE_CODE, editor.value);
  localStorage.setItem(STORAGE_NAME, filename);
  saveStatus.textContent = 'Saved locally';
}

let saveTimer;
editor.addEventListener('input', () => {
  saveStatus.textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveLocal, 180);
});

function renderPreview() {
  preview.srcdoc = editor.value;
}

function setMode(mode) {
  const isCode = mode === 'code';
  codePane.hidden = !isCode;
  previewPane.hidden = isCode;
  modeButtons.forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
  if (!isCode) renderPreview();
}

modeButtons.forEach(button => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
});

document.querySelector('#refreshButton').addEventListener('click', () => {
  renderPreview();
  setMode('preview');
});

document.querySelector('#newButton').addEventListener('click', () => {
  if (!confirm('Start a new file? Your current work is already saved in this browser.')) return;
  editor.value = starter;
  filename = 'untitled.html';
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
