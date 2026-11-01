# PocketHTML Web

A tiny, phone-first HTML editor and previewer.

## v0.1
- Edit HTML in-browser
- Live preview via `iframe.srcdoc`
- Import `.html` / `.htm` / text files
- Export edited HTML
- Local autosave with `localStorage`
- Coding-symbol toolbar for mobile keyboards
- Offline installable PWA
- No backend, account, framework, or analytics

## v0.2: Library and Tools
- **Library**: every file you open, import or start is saved in this browser (IndexedDB). Tap Library to reopen or delete one. Opening the same file twice reuses its entry.
- **Tools** (`/tools/`): one list of everything made and in progress: tools hosted in this repo, other deployed apps, and drafts saved in the Library.
- Switching to Preview no longer reloads the page unless the code changed, so a tool that is mid-task keeps running. Refresh still forces a reload.
- The service worker is network first: a new deploy shows up on the next load, and pages opened before still work offline.

## Adding a tool
Each hosted tool is one self-contained HTML file at `tools/<slug>/index.html`, listed in `tools/registry.json`.

```bash
node scripts/add-tool.mjs path/to/tool.html my-tool "My Tool" "What it does"
```

That copies the file, adds the registry entry at v1.0.0 (or bumps the patch version if the slug exists; `--minor` or `--major` for bigger bumps), and sets the date. Commit and push to `main`; Vercel deploys it to `/tools/my-tool/`. Git history per tool is linked from its card.

Statuses: `live`, `building`, `idea`. Apps deployed elsewhere are registry entries with `"kind": "app"` and a `url`.

## Run locally
Any static server works:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## iPhone
Deploy over HTTPS, open in Safari, then Share → Add to Home Screen.
