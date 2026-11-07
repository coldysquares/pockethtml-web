# Pocket apps plan

Working plan for making Nick's apps one place he can open from his phone, with phone and computer work kept in sync. Claude keeps this file current across sessions; read it before picking the work back up.

## Goal
- One home page (this repo's root) that opens every tool and every saved HTML, with icons.
- Phone apps work offline and store locally.
- Computer-only apps are listed too, and anything that can bridge to the phone does.
- Later: phone data syncs up when the computer is back online.

## Done
- 2026-11-07: Service worker falls back to cache after 3 s and precaches every hosted tool (PR #6).
- 2026-11-07: Root is now the Pocket home grid; the editor moved to `/edit/`; `/tools/` redirects home; old `/?doc=` and `/?src=` links forward to the editor. Clear button (tap twice). New files start blank. Registry lists 25 live apps with icons and groups.
- 2026-11-07: WAV to MP3 picker no longer uses `audio/*`, which iPhone can treat as a photo and video picker.

- 2026-11-07: PocketMP3 audio picker lists audio types instead of `audio/*`; its service worker was cache first with a fixed name, so deploys never reached the phone. Now network first with a 3 s timeout (pocket-mp3 PR).
- 2026-11-07: Registry `"offline": true` marks apps checked to open offline (PocketHTML, PocketPDF, PocketMP3). Home shows them with a green dot.

- 2026-11-07: Night Cruiser (merged from Nick's six versions) and Tape Deck added as hosted tools. Both share one offline audio library (IndexedDB `pocket-audio`), so music added in one plays in the other with no signal. Home has an Upload HTML tile that saves .html files to the Library.

- 2026-11-07: Rule from Nick: one best version of every product, never duplicates. Home collapses Library copies into one tile per project and folds drafts of hosted tools into the tool. Night Cruiser 2.0 rebuilt: new synth engine (supersaw, keys, FM bells, acid bass, layered drums, sidechain, tape wobble), song sections, motif-based melodies, drive-first layout.

- 2026-11-07: Pitchback now opens offline (pitchback-app PR, live). Astrograph offline code is merged in aster-graf but that Vercel project does not deploy from GitHub, so it is not live yet. Tabbycat's live site is a loader that pulls a pinned commit from jsDelivr, not the repo; making it offline needs a decision (see below).

## Offline survey (2026-11-07, from the live pages)
- Have a service worker: PocketPDF, PocketMP3, Aether Alchemist, Systems & Chaos Lab, Rhinoceros. Only PocketPDF and PocketMP3 are marked offline so far; the other three need a check.
- No service worker (need signal): Pitchback, Tabbycat, Local Songbook, Slopscore Lab, TED LAB, Wollohy Playground, Wollohy archive, Clip Studio, Local Tools, Wiki Constellation, Astrograph, GUVs, Saperli Popette, STATERoom, NickOS, Packet Now, Task Keeper.
- Picker scan: only PocketMP3, Slopscore Lab and WAV to MP3 used `audio/*`. Pitchback and Clip Studio set no `accept` in their first-load code; if their upload is the broken one, check the source.

## Next
1. Slopscore Lab audio picker (`audio/*`), once Nick decides whether it stays.
2. Add the same network-first service worker to the phone apps Nick uses most (start with Astrograph, Tabbycat, Pitchback).
2. Nick decides keep, merge or retire for each app (list below).
3. Mark each app phone, computer or both; add computer-only apps (local tools on the Mac) to the registry with `"where": "computer"`.
4. Real descriptions for the apps whose registry description is only their page title.
5. Sync design (see below).

## Decisions needed from Nick
| App | Question |
| --- | --- |
| Slopscore Lab | Nick unsure of its use beyond a toy. Keep, fold into Wollohy Playground or TED LAB, or retire? |
| Local Songbook vs Tabbycat | Both are songbooks. Merge into one? |
| Wiki Constellation | Three deployments: guvs.vercel.app/wiki-constellation, wiki-constellation.vercel.app, wiki-constellation-run.vercel.app. Which is the real one? |
| Wollohy, wollohy-twcp | Two deployments of the music archive. Keep one? |
| Saperli Popette, saperli-popette-byok | Two deployments. Keep one? |
| Portfolio sites | live-portfolio, nick-berghane-portfolio, nick-berghane-hiring, chronosaudit: sites, not tools, so not on the home grid. Confirm. |
| Writing sites | zweff-live, editorial-seed-preview (The Index), divergent-cognition, worried-about-me-lately, coconuthing-hut: add a SITES group? |
| Dead deployments | pocket-mp3-c89l, sketch-2-png, awd, tabbycat (404), constellation (402): delete from Vercel? |
| agent-scouts | Behind Vercel login. Keep private? |

| Tabbycat | Live site loads a pinned commit from jsDelivr. Option A: deploy the repo itself with offline support on the same domain (songs stay). Option B: move it into Pocket (offline, shared storage) but songs saved in the old site would need an export and import. |
| Astrograph | Is aster-graf (genealogy) the app Nick means by Astrograph? Its Vercel project needs a redeploy Claude cannot trigger without Vercel team access. |

## Sync design (draft, not built)
- Every Pocket app on the same origin shares one IndexedDB, so moving tools into this repo (`tools/<slug>/`) is the cheapest way to share a library between them.
- Apps on other origins cannot read this storage. Options: move them under this domain, or sync through a small store (GitHub repo, or a Vercel Blob or KV store) keyed to Nick.
- Phone writes locally first and queues changes; when online, pushes the queue. The computer pulls on start.
