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

**Only rebuild the site you changed.** The top-level site and `next/` are behind their sources on purpose (Panyard Band, `band/`, follows Panyard: see below):
rebuilding them would ship source changes that were never tested there.

### Before you change anything
- Run `git pull` first. More than one Claude session has worked on this repo, and an old local copy once nearly
  overwrote newer work. The repo is the source of truth.
- Edit the module files in `source/` (`panyard-*.js` / `.css`), never the built HTML.
- Code style: global functions are wrapped by reassigning them (`const _f=fn;fn=function(){...}`). Module objects
  other modules check early (LOOK, ROLE, PARTS, DAY, GUIDE, POLISH, CLOUD, THEME) use `var`, not `const`.

## Skills (`.claude/skills/`)
`panyard-ship` (make a change and put it live, how to talk to the owner), `panyard-song-rescue` (song-only file from
a backup, `scripts/song_only.py`) and `panyard-band-sound` (measure a band recording, `scripts/analyze.py`).

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
  `channel()`. Sections light up as their notes play; drag to move, tap for players, M/S, volume, ⧉ Copy. Each player is
  drawn with their real set (`RIG`: tenor 1, doubles 2, four cello 4, six/seven bass 6/7). The stage is a fixed screen
  in its own units (`STW()`, shaped like the floor, `STA`); `CAM` is the zoom (pinch, wheel, + / − / ⤢, double tap fits,
  a mini map once zoomed). Hold a player's pans, then drag, to move just that player: `tr.st.pp[i]=[dx,dy]` (shares of the
  stage); ⇆ In line clears it. Layouts (`LAYOUTS`, `song.stage.layout`: 'stage' Panorama risers and lights, 'yard' a
  circle under the galvanize, 'road' on the truck): `stScene()` draws the scene in SVG (wider than the stage, so no edge
  shows); `LAY_Y`/`stY()`/`stDepth()` set each layout's rows and how much smaller the back looks; `layHome()` places a
  section; `layApply()` moves everyone (one undo step). Pans are chrome on stands (`stDrum`). Test with `tstageside` and `tstagepans`.
- **Sounds files** (`panyard-share.js`, `SHARE`): Pan sounds → Sound → Save my sounds file writes `format:'panyard-sounds'`
  JSON (recorded notes trimmed to their kept part, their tuning, the profile's room; no songs). Opening one (that card,
  or Open backup file) adds each note as a new take plus a new sound profile, so the phone's own stay. Test with `tshare`.
- **Open backup file is safe** (`panyard-share.js`, `SHARE.guard/busySong`): a song backup opens as its own song
  (unless the open song is a blank new one), and never replaces the phone's recorded notes, their tuning, sound
  profiles or borrowing; only notes the phone never recorded take the backup's sound. It used to pour the backup into
  the open song and put older sounds back. `SHARE.stale()`/`newest()` (Pan sounds → Sound) put notes left on an
  older recording back on their newest take. Test with `tsafeopen`.
- **Pan sets** (`SETS` in `source/pansets.js` and `source/pan-notes.html`, kept the same; rebuild Next with
  `make_next.py` before `make_panyard.py`): guitar, tenor, dsec, dten (Double Tenor, A3–C♯6 as in the G-Pan patent, flat side of the circle of
  fifths on the left pan, sharp side on the right), fcello (its note ids are an octave low; `SOUND_UP.fcello=12` makes it sound
  B♭2–C♯5 as a real four cello, skirt 18 in), tcello (Three Cello, B2–G4, three pans of a diminished chord each: C E♭ F♯ A,
  C♯ E G B♭, B D F G♯; low notes round the rim, the octave above inside; one pan on top and two below in Play), six, seven (Seven Bass, G♯1–E3, seven drums of three).
  A new set also needs its key in `ARRANGE.SETS`, `LOOK.KEYS`, `ROLE.SECTIONS`, `STAGE.SK` (and six/seven layouts),
  Studio's `PAN_RANK`/`SHORT`/`LAYER_OF`/`STG_*`, and `tune.js` PARTS for basses. Test with `tnewpans`.
- **Note covers** (How you play, `FEEL.s.covers`, applied in `BAND.chain` via `BAND.covered(id)`): a soft pad on the
  outer and middle rings of tenor, dten and dsec, after the G-Pan patent's claim 14; a slower, darker start on
  recorded notes only. Test with `tcovers`.
- **Drum body** (Band sound slider `body` 0–10, on in Our yard): each pan's barrel hums at 343/(4(L+0.3d)) from its skirt
  length (`BAND.BODY`: tenor 265 Hz … basses 83 Hz, G-Pan patent eq. 1); `BAND.chain` lifts that and 3× it per note.
  Test with `tbody`.
- **Real note sizes** (Pan layout switch, localStorage `panyard-notesizes`, `REAL` in `panyard-arrange.js`): each note
  shape shrinks about 96.4% per semitone above the lowest on its ring or drum (93% area, the patent's rule), min 68%,
  via a wrapping `<g transform>` (the press animation's CSS transform on `.zone` would fight one on the path).
  Not the Double Guitar. Test with `treal`.
- **Studio count lines** (`renderTimeline`/`rulerHTML` in `panyard-studio.js`): bar, beat, ½ and ¼ beat lines down
  every lane (`.st-inner.gb/.g2/.g4`, `--bt`) and ruler numbers 1 → 1.2 → 1.2.2 as you zoom. The playhead, bar
  counter, beat flash and pan lights use `heardNow()` (the beat minus the speaker delay `spkLag()`); scheduling and
  recording still use `beatNow()`. Test with `tgrid`.
- **Write is part of Studio** (for a Producer): the Write tab and the pencil call `STUDIO.writePart()` (My part on the
  pans; the tab is lit while it's showing). A band member (no Studio) still gets the old Write screen (`cues` view),
  which stays reachable from Studio's ⋯ ("The old Write screen"). The Write and tempo guides follow Studio for a
  Producer and the old screen for a band member (`GUIDE.pw()`, `GUIDE.write()`). Upright, Studio's four view buttons
  fold into one with a drawer (`#gbView.open`), so play and record have room.
  - My part's notes are `S.cues`. Studio's undo steps (`snapNow`) hold `{s:song,c:S.cues,ps:panSet}`, so ↶ Undo covers
    your part and its pan. Recording My part follows Merge/Replace: Merge never writes a note twice (same note within
    90 ms), Replace hides the old cues from where you start and puts back the ones after where you stop (`WR.hid`).
  - My part's Pan picker (`partSet`) switches the song's pan and carries notes across by pitch. ＋ Add to… copies My
    part's bars onto a song track for the song's pan (`songTwin`, `asPan`).
  - Coming up + ✚ Step (`nextTick`, `stepAdd`): the next notes above the pans; Step puts notes in at the playhead.
  - ⏩ Playback speed (`SPD`, `setSpeed`, `cspb()`): ¾ or ½. `spb()` stays the song's seconds per beat (cue times use
    it); `cspb()` is the clock's (scheduling, the playhead, taps). Recordings play a WSOLA-stretched copy
    (`stretched()`, same pitch); mic takes need full speed.
  - The Tempo sheet holds Write's timing panel (`#gridBox`, moved in and back out like WB's sheet).
  Test with `tpart` (My part) and `tmerge` (the rest).
- **Suggested tone per pan** (Studio track settings → Tone, `TONE`/`SHELF`/`fxOf` in `panyard-studio.js`): pan and My part
  tracks get their pan's Treble/Bass/Compressor (basses more bass and less treble, tenors the opposite) unless
  `tr.fx.own` is set (moving one of those sliders sets it; the ✨ Suggested switch clears it, or turns it off = flat).
  Older tracks with no `own` count as their own when Treble, Bass or Compressor isn't 0. Each pan's Bass/Treble shelves
  sit at its own range (`SHELF`). Test with `ttone`.
- **Vincy Mas look** (App look `vm`, St. Vincent and the Grenadines): built on the Trinidad & Tobago look (`TT` in
  `panyard-trini.js`, html classes `th-cnight th-tt th-vm`), with its own backgrounds `TT.VM` (gems, gren, flag; your own
  pictures are shared with T&T), kept apart in localStorage `panyard-bg` (`vm` beside `tt`). `vmPaint()` recolours the
  pans' gradients (`vmSkirt/vmRim/vmBed/vmHit`) and the play bar glow (`--vmg`) to match the background. ☀ / 🌙 go back to
  the flag you came from (`panyard-ttday`: '1' T&T, 'vm'). Test with `tvincy` (and `ttt`).
- **On the phone speaker** (Settings switch, `PHONE` in `panyard-phone.js`, localStorage `panyard-phone`, not backed up):
  for bass pans (six, seven, fcello, tcello) a waveshaper adds the notes' overtones (150–1100 Hz) and two 80 Hz high-passes
  trim the sub a phone can't play. Play: put between `FX.hp` and `FX.shelf` while the song's pan is a bass (`sync()`, via
  `applyFx`/`applyPanSet`); Studio: in `channel()` between `hp` and the tone shelves of bass tracks (`c.ph`). Test with
  `tphone` (its recorder taps every connection to the speakers, so Studio is heard too).
- **Tuned steel** (Pan sounds voice `S.panVoice='steel'`, `STEEL` in `panyard-steel.js`): notes made from the tuner's recipe,
  modes 1 : 2 : 3 (low notes) or 1 : 2 : 4, a few untuned high modes, the octave blooming in, a rubber-tip mallet filter
  (harder = brighter), neighbours ringing along and the barrel hum at `BAND.BODY`; through `BAND.chain`/`BAND.tune`, so
  Band sound still shapes it. Its sliders Barrel hum (6) and Octave bloom (5) sit at the top of Pan sounds → Sound
  (localStorage `panyard-steel`). Play: `strikeMine` wrapper (after How you play's hit strength); Studio: `panVoice()`;
  My part's sound file: `panyard-part.js`. `make_panyard.py` lets a saved song keep 'steel'. Test with `tsteel`.
  **Tune it like your pans** (button under its sliders): `STEEL.learn()` measures every pan's recorded notes with
  Goertzel filters at the note, 2× and 3×/4× (`measure()`: ring t60 from the fundamental's fall, octave and third peaks
  next to the note's, and when the octave peaks), takes each pan's middle values into `st.fit[set]`, and `play()` uses
  them (the mallet filter taken off so the result matches). The pitch always comes from the tuning maths, so noise or a
  recording a bit off doesn't get in. Standard pan (`unlearn`) clears it. Test with `tsteelfit` (pretend noisy recordings).
  **Ready notes:** each note is made once (`make()`, an OfflineAudioContext at 32 kHz, `raw` = A 440 and no band sound) and
  played like a recording: Studio's `panVoice()` hands it to `playBuf` (Stop, loops, same-note damping, Band sound, the
  song's A), Play's taps use `tapBuf`. Live tones are only the stand-in while a note is being made (all `lineUp`'d).
  Studio's `play()` and `renderSong()` get the song's notes ready first (`steelIds()`). Making ~10 live tones per note
  once crackled on phones and left notes ringing after Stop. Test with `tsteeltrack`.
  **The steel sound** (`tone()` in `play()`): besides the tuned note, octave and third (each a close doublet, 84/16, for the
  shimmer), the ladder 3×–12× the note (from the steel bending, so no stick filter; `.24·0.8^(k-3)`, bright burst at the
  hit), six untuned plate tones and the 22.5 in oil drum's shell (seven Q 45 resonators struck by a noise burst, ready
  notes only). Nothing above 8 kHz and softer from 4.5 kHz (very high bursts sounded like ticks). Steel edge slider
  (`st.edge`, 6) scales the ladder, plate and shell; Tune it like your pans measures the ladder 1×–8× (`F.h`).
- **Panyard Band** (`/pan-notes/band/`, for band members): `python3 source/make_band.py` builds
  `source/pan-notes-band.html` from the Panyard file (rebuild Panyard first), then `build.py … "Panyard Band"` into `band/`.
  `panyard-bandapp.js` (`BANDAPP`): always Band member (ROLE never offers Producer), no Studio / Pan sounds (`TW`) / Band sound
  / tuning / pan picker, `S.refA` and `S.panVoice` fixed by getters (441, 'mine'), and a sounds file can't change the sounds.
  The band's pan sounds are `source/band-sounds/` (FLAC + `manifest.json`, made by `make_band_sounds.py` from the owner's
  "Save my sounds file"); on first open (and when the manifest's `version` changes) they go in through `SHARE.open`.
  The BANDSHIM script keeps its storage apart from Panyard's on the same site (localStorage keys `pb:…`, IndexedDB
  `band-…`), and its Drive backup is `panyard-band-backup.json`. Its icon (a pan with a gold note ringing out) is `source/icons/band-*.png`, made by `band-icon.py` from `band-icon.svg`. Test with `tbandapp`. Rebuild `band/` after Panyard
  changes that band members should get. New band sounds: run make_band_sounds.py on a new sounds file, then rebuild.
- **Mix** (`panyard-mix.js`, `MIX`, Play's 🎚 on the play bar, Panyard and Panyard Band): per song in localStorage
  `panyard-mix` (`songs[songId]={rec,pan}`): Recording sets `audio.volume` (0–100%), Your pans scales `pBus` from its own
  level (`pBus._base`, 0–200%; the limiter and soft clip keep chords under 1.0), and its switch is `S.tapSound`
  (always/paused). Panyard Band also has **Drum body hum** and **Suggested tone** for every song (`panyard-bandapp.js`,
  localStorage `panyard-bandtone`, wrapping `BAND.chain`: `BAND.BODY` at Drum body 6, and `STUDIO.TONE`/`SHELF`), with
  Settings switches, ▶ Hear the difference and a one-time introduction. Test with `tbandmix`.
- **Panyard VR** (`/pan-notes/vr/`, Quest 3S browser, WebXR): `python3 source/make_vr.py` builds `vr/` from
  `source/panyard-vr.html` (`SETS`: the tenor from `pansets.js` and the Double Guitar's `PANS`/`PITCH` from `pan-notes.html`, read with node;
  each drum keeps its own drawing frame `cx, cy, r`; `PANSET` has each set's skirt, hum, tone and where its drums stand) and three.js 0.160 in `source/vr-lib/`
  (the CDNs are blocked here, so it's kept in the repo). The sounds are Panyard Band's (`../band/band-sounds/`, A 441, Drum
  body hum and Suggested tone baked into `strike()`). A hit is the stick tip (`makeStick`, on each controller grip)
  crossing down through the bowl (`h(r)`, pan-local) over a note (`noteAt`: canvas `isPointInPath` on the note's SVG path,
  a hair onto the groove counts); swing speed sets the strength (about 3 m/s full), a haptic pulse answers, and the stick
  must lift 12 mm before it hits again. A / X brings the pan in front of you, the thumbstick moves it up or down; "Play in
  my room" is passthrough (immersive-ar). B / Y switches pans, a thumbstick press the look (`LOOKS`: Chrome and the three
  Vincy Mas backgrounds' skirt, rim and hit colours, a sky, a floor and the SVG flag); both are kept in localStorage
  `panyard-vr-set` / `-look`. Sets: tenor, Double Guitar, Double Second (`fromSet` in make_vr.py gives each note to the
  nearest drum). **The studio table** on your left (`table`, placed by `placeTable()`): a mixing desk (`desk`, a strip per
  track: M, S, left/right, fader 0–125%, ↻ Rec, ✕, + Track) and a track screen (`scr`: ▶/■, ● Rec, Click, tempo, Snap ½ / ¼,
  ↶ Undo, ⟲ Loop, Bars − / +, a ruler you drag across to loop bars, a lane per track), both canvas panels (`uiPanel`, hit
  boxes in `p.hits`). Each controller's beam + trigger (`beamFrame`, `uiDown/Move/Up`), or the mouse off the headset, presses
  them; the sticks still play. `SONG` (localStorage `panyard-vr-song`): bpm, length `L` in beats, loop bars, selected track,
  click, up to 8 tracks `{name, set, vol, pan, mute, solo, col, notes:[{id, v, b}]}`; each plays through its own gain and
  panner (`chan`, `mixAll`). One clock `TR` (beat 0 = start, count-in −4…−1; `tick()` schedules clicks and every audible
  track 0.12 s ahead, looping the song or the loop); ● Rec records the selected track (or a new one, on its pans) while
  the others play, ● again stops, and the first take sets `L` (whole bars). `UNDO` holds earlier songs. Old per-set takes
  (`panyard-vr-take-<set>`) become the first tracks.
  Test with `tvr` (`VR.swing`, `VR.press`/`VR.drag` on the desk or screen).
- **Android signing key:** `android/panyard.keystore`. Every APK must be signed with it so it installs over the last one.
