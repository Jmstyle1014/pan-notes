# Panyard / Pan Notes: notes for Claude

A steelpan rehearsal app, live on GitHub Pages. **Panyard** (`/pan-notes/panyard/`) is the version in daily use;
Pan Notes (`/`) and Pan Notes Next (`/next/`) are older versions of the same app. The owner has no coding
experience: explain things in plain language, show screenshots of visual changes, and ask before big redesigns.

## How the app is made
Every version is one self-contained HTML file built from `source/`:

1. `source/pan-notes.html` is the base app. It also contains the pan layouts (the same code as `source/pansets.js`;
   change both together).
2. `python3 source/make_next.py` builds `source/pan-notes-next.html` (the new look, `next-look.css`).
3. `python3 source/make_panyard.py` builds `source/pan-notes-panyard.html` from the Next file. It adds the
   Panyard modules in this order: game, lab, voice (Ring/Tone per note, 24-bit takes), wave (the sound editor) and tune (Tune my pans), then hang, studio, home, tabs, stage, gb, wb, looks, role,
   parts, guide, polish, cloud, themes and back (the phone's back button) (most go just before the `/* ---------- start ---------- */` marker). It also makes small text replacements with
   `rep()`, which asserts that each target is found exactly once. Last, it builds the Chrome Day / Chrome Night
   colours (`make_themes.py`, needs `pip install tinycss2`; without it, the saved `panyard-themes.css` is used)
   and routes the canvas colours through `THEME.c()`.
4. `python3 source/build.py <built html> <folder> "<App name>"` makes the installable offline site (adds the
   service worker `sw.js`, which precaches every file, plus icons, the manifest, fonts and the `drums/` samples).

### Putting Panyard live
```bash
python3 source/make_panyard.py
python3 source/build.py source/pan-notes-panyard.html /tmp/site "Panyard"
rm -rf panyard && cp -r /tmp/site panyard && rm -rf /tmp/site
git add -A && git commit -m "..." && git push
```
GitHub Pages deploys on push. The Android app (`android-chrome/`, a Trusted Web Activity that opens the Panyard
site in Chrome) picks up website changes by itself, so it doesn't need a new APK. `.github/workflows/android.yml`
still builds a fresh APK on changes under `panyard/`.

**Only rebuild the site you changed.** The top-level site and `next/` are behind their sources on purpose:
rebuilding them would ship source changes that were never tested there.

### Before you change anything
- Run `git pull` first. More than one Claude session has worked on this repo, and an old local copy once nearly
  overwrote newer work. The repo is the source of truth.
- Edit the module files in `source/` (`panyard-*.js` / `.css`), never the built HTML.
- Code style: global functions are wrapped by reassigning them (`const _f=fn;fn=function(){...}`). Module objects
  other modules check early (LOOK, ROLE, PARTS, DAY, GUIDE, POLISH, CLOUD, THEME) use `var`, not `const`.

## Tests
`tests/run_tests.sh` (all of them) or `tests/run_tests.sh tcloud rt` (just those). These are Playwright browser
tests against `source/pan-notes-panyard.html`; they need `pip install playwright numpy pillow tinycss2` and
`playwright install chromium`. Screenshots go to `tests/work/`. Look at them after visual changes.
Main ones: `rt` (a Studio walk-through), `tcloud` (back up and restore across two phones with a pretend Google
Drive), `tlooks` (the app looks and the chrome glow), `tguide` (every guide finds its buttons), `tpass`
(every screen: errors, overflow, small buttons), `tstage` (every pan note taps to itself). Timing tests
(`tspk`, `ttapload`, `tlate`) vary from run to run; look for big jumps, not exact numbers. In `tstage`, the
upright count is low because a checklist pushes the pans below the play bar there, so that's expected.

## Things that are easy to break
- **Timing:** taps use the event timestamp minus the speaker delay; the lookahead is 0.35 s. On Android, LITE
  mode uses one shared reverb. Test with `tspk`, `ttapload` and `tlate` after touching Studio's audio.
- **Saved data:** songs live in IndexedDB (`pan-notes` / `files`) and localStorage (`pan-songs`, `pan-notes-v2`,
  `panyard-*`). Don't rename keys without migrating old data.
- **Cloud backup** (`panyard-cloud.js`): Google Drive's hidden app folder, scope `drive.appdata`. The OAuth client
  ID in `CLOUD.CID` is public and safe to keep in the code. The Google Cloud project is in testing mode, so only
  test users listed there can sign in. Settings that belong to one phone (`panyard-studio` timing etc.) are not
  backed up (`CLOUD.SKIP`).
- **Recorded pan notes:** `SAMPLES.wav` (IndexedDB `samples`) holds each note's take, 24-bit WAV for new takes (old
  16-bit ones still play). `SAMPLES.tune[id]` holds the settings on top of it (start, end, db, fade, cents, ring, tone),
  per sound profile. Every take of every note is kept in IndexedDB `sampleTakes` (`TAKES`, up to 6 per note; the
  one in use is always `SAMPLES.wav[id]`). A sound-editor save (`panyard-wave.js`) is a new take, and "Back to the
  original" picks the take it came from (`samplesOrig` is only for edits made before takes were kept). Google Drive
  backup copies all of IndexedDB, takes included; the backup file has only the takes in use. Test with `ttw`.
- **App looks** (`panyard-themes.js`, `make_themes.py`): Night and Day are the original looks (Day is a CSS
  invert); Chrome Day and Chrome Night recolour every style at build time. New canvas drawing code should use
  `THEME.c('#colour')` so it follows the look.
- **Android signing key:** `android/panyard.keystore`. Every APK must be signed with it so it installs over the last one.
