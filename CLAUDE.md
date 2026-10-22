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
   Panyard modules in this order: game, lab, voice (Ring/Tone per note, 24-bit takes), wave (the sound editor) and tune (the Pan sounds screen: record, tune, sound; once called Tune my pans), feel (How you play: dynamics, roll
   delay `HOLD_MS`, keep-awake hum) and band (Band sounds per song), then hang, studio, home, tabs, stage, gb, wb, looks, role,
   parts, guide, polish, cloud, themes, back (the phone's back button), notesui, arrange (Arrange pans) and share (sounds files) (most go just before the `/* ---------- start ---------- */` marker). It also makes small text replacements with
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
- **Loudness:** the tap sound has headroom (`pBus` 0.6), a soft limiter and `softClip()` last (also on Studio's
  master), so loud chords never clip. Recordings are decoded when the app opens (`warmSamples`) and a recorded note
  never falls back to the built-in tone (test with `tfirst`).
- **Timing:** taps use the event timestamp minus the speaker delay; the lookahead is 0.35 s. On Android, LITE
  mode uses one shared reverb. Test with `tspk`, `ttapload` and `tlate` after touching Studio's audio.
- **Saved data:** songs live in IndexedDB (`pan-notes` / `files`) and localStorage (`pan-songs`, `pan-notes-v2`,
  `panyard-*`). Don't rename keys without migrating old data.
- **Cloud backup** (`panyard-cloud.js`): Google Drive's hidden app folder, scope `drive.appdata`. The OAuth client
  ID in `CLOUD.CID` is public and safe to keep in the code. The Google Cloud project is in testing mode, so only
  test users listed there can sign in. Settings that belong to one phone (`panyard-studio` timing etc.) are not
  backed up (`CLOUD.SKIP`).
- **Band sounds** (`panyard-band.js`, `BAND`): per song in localStorage `panyard-band` (`songs[songId]`, plus `own`
  presets). Pitch centre sets the song's `S.refA` (unless it has a recording); Sweet ↔ Sharp, Tone, Ring, Stick and
  Shimmer work per note in `playSample` (voice) and Studio's `playBuf` via `BAND.tune/cents/chain/shimmerOn`; Room, Lo-fi
  and Punch only on the tap sound's chain (`applyFx` wrapper re-routes `pBus`). Off while tuning (Record & tune tab).
  How you play (`panyard-feel.js`, `FEEL`, localStorage `panyard-feel`, not backed up): a hit's strength comes from
  where on the note it lands; Studio records it (`n.r` marks roll strikes, so a soft hit isn't mistaken for one).
  Test with `tband`. The Our yard preset was measured from the band's practice recordings (A 441, warm top, long ring):
  Yard hum is a ConvolverNode of quiet fading tones on the song's key notes (`BAND.keyOf()`, from the song's cues, or
  the recordings' own key for a song with few notes), Yard air three filters, room `ouryard` (added to `SPACES`). Test with `tyard`.
- **My notes** (`panyard-notes.js` engine `NOTES`, `panyard-notesui.js` screens, `panyard-notes.css`): the notebook in Play
  (under the pans), Write (beside Coming up), Chart → Notes and full screen. Pages are `S.notePages` (global); which song
  owns a page is in localStorage `panyard-notebook` (pages with no owner are from before and show in every song).
  Handwriting stays in `pan-ink-<page>` (the old format, plus `m:1` for marker); text, section tags and background are
  in `pan-note-<page>`. A song's first page is a blank `new:<song>` page that only becomes real when written on: never
  create pages or call `save()` while the app starts (that once overwrote the saved song). Test with `tnotes`.
- **Recorded pan notes:** `SAMPLES.wav` (IndexedDB `samples`) holds each note's take, 24-bit WAV for new takes (old
  16-bit ones still play). `SAMPLES.tune[id]` holds the settings on top of it (start, end, db, fade, cents, ring, tone),
  per sound profile. Every take of every note is kept in IndexedDB `sampleTakes` (`TAKES`, up to 6 per note; the
  one in use is always `SAMPLES.wav[id]`). A sound-editor save (`panyard-wave.js`) is a new take, and "Back to the
  original" picks the take it came from (`samplesOrig` is only for edits made before takes were kept). Google Drive
  backup copies all of IndexedDB, takes included; the backup file has only the takes in use. Test with `ttw`.
- **App looks** (`panyard-themes.js`, `make_themes.py`): Night and Day are the original looks (Day is a CSS
  invert); Chrome Day and Chrome Night recolour every style at build time. New canvas drawing code should use
  `THEME.c('#colour')` so it follows the look.
- **Pan layout** (`panyard-stage.js` `STAGE`, `panyard-arrange.js` `ARRANGE`): `layout0`/`portrait0` place the drums;
  `layout`/`portrait` add your own arrangement from localStorage `panyard-layout` (per set: `skirt`, and per way up
  `land`/`up`: `all` size and `p[drum]=[dx,dy,size]`, offsets as parts of the box). Skirt length per set is `STAGE.SK`
  (tenor shortest, six bass a full drum); far drums draw first so near ones cover their skirts. Arrange pans opens from
  Settings → Pan layout. Test with `tarrange` (and `tstage` for taps).
- **Stage side** (Studio → 🎭 Stage, in `panyard-studio.js`): every pan, drum, beat and mic track is a section on a
  Panorama-style stage. Its place is `tr.st={x,y,n}` (x left→right, y back→front, n players); `song.stage.hear` is the
  seat ('judges', 'middle', 'off'). `stageMix(tr)` turns the place into left/right, loudness and extra room in
  `channel()`. Sections light up as their notes play; drag to move, tap for players, M/S, volume, ⧉ Copy. Test with `tstageside`.
- **Sounds files** (`panyard-share.js`, `SHARE`): Pan sounds → Sound → Save my sounds file writes `format:'panyard-sounds'`
  JSON (recorded notes trimmed to their kept part, their tuning, the profile's room; no songs). Opening one (that card,
  or Open backup file) adds each note as a new take plus a new sound profile, so the phone's own stay. Test with `tshare`.
- **Open backup file is safe** (`panyard-share.js`, `SHARE.guard/busySong`): a song backup opens as its own song
  (unless the open song is a blank new one), and never replaces the phone's recorded notes, their tuning, sound
  profiles or borrowing; only notes the phone never recorded take the backup's sound. It used to pour the backup into
  the open song and put older sounds back. `SHARE.stale()`/`newest()` (Pan sounds → Sound) put notes left on an
  older recording back on their newest take. Test with `tsafeopen`.
- **Android signing key:** `android/panyard.keystore`. Every APK must be signed with it so it installs over the last one.
