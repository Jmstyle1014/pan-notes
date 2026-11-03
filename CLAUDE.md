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
  **The page** (before you enter VR, `#hud`): wide (max 1000 px) with tabs (the owner: "too much to scroll through"): Pans, Look &
  room, Yard, Sound, Sticks, Songs, Help (`.tabs`, `.tab[data-tab]`, two columns of `.box` sections; `hudTab(k)`, remembered in
  localStorage `panyard-vr-tab`); the title, status and Play in my room / Enter VR stay at the top. Every control keeps its id;
  tests that click one call `hudShow('#id')` first (it opens that control's tab).
  **No black specks** (the owner's headset video showed dark grain on the bowls, mostly far pans; `dishNormals`): the bowl's light
  comes from the surface smoothed over e = 6 mm (12 mm on far `lite` stations), not the sharp 5 mm grooves; the bowl is
  `FrontSide` only (a double-sided one let flipped underside fragments win the Quest's depth test); camera near .05 (was .02:
  2.5× the depth precision); surface textures get max anisotropy; far stations a touch rougher (.48). Test with `tvrspeck`.
  **The pans in 3D:** each set's bowl is sunk `PANSET[k].depth` (tenor 19 cm ≈ 7½ in, double second 16.5, guitar 14; the
  skirt is at least that long), and `heightMap(d)` (each drum's notes blurred twice on a 512² canvas) sinks a 5 mm groove
  round every note and domes it up to 6 mm (smaller notes less); `surf(d,x,z)` is the playing surface everywhere (the
  dish, the glows, the hit test). **Grab the table:** squeeze a grip with the beam on it (or the hand near it) and move;
  it turns to face you and is kept in localStorage `panyard-vr-table` (rig-local x, y, z).
  **Drum kit** (set `'kit'`, after the pans in `KEYS`; `kitG` replaces the pans): `KITP` places snare, hi-hat, high/mid/floor
  tom, crash, ride, the iron and the engine room's bass drum (GM 35, the kick lower and longer, on its side facing you);
  a stick crossing a head plays it (`trackKit`; near the edge: rimshot 37, open hat 46, muted iron 80), a trigger
  (beam off the table) is the kick (`kickNow`). Sounds are Panyard's `../panyard/drums/` (`kit.json`); notes are
  `drum:<GM>` (`strikeDrum`), so the studio records and plays them; kit lanes are drawn by `KROWS`.
  **Songs from Google Drive** (☁ My songs, off the headset: Google's sign-in can't open in VR): `gdList()` signs in with
  Panyard's `CLOUD.CID` (drive.appdata), reads `panyard-backup.json` (`gdDec` unpacks its `$o`/`$b` packing) and lists
  `pan-songs`; `gdImport(id)` takes `studio:<id>` pan and drums tracks (rolls dropped), My part from the song's cues
  (`pan-notes-v2` for the open song, else `song:<id>`), and the recording (IndexedDB `panyard-vr` / `rec`, a `rec` track
  played from bar 1 by `recSchedule`, offset by Studio's `origin()`); beats tracks and mic takes stay in Panyard.
  Six bass and four cello notes play from the band's sounds (`moreSounds`, `PANSET.six/fcello` hum and tone); ↶ Undo
  goes back. Test with `tvrdrive` (a pretend Google and Drive).
  **Editing** (the screen's two bottom rows, `drawEdit`; Studio's tools): a note picked on its lane (`NSEL`, its hit box
  drags it in ¼ beats) moves ◀ ▶, steps ▲ ▼ to the next note on its pans (`byPitch`), Softer / Louder, 🗑; the ruler's gold
  bars (`selBars`, the loop) are copied in after themselves, moved a bar either way (swapped with the next bar) or taken
  out, on every track (`barsOp`); the selected pan track transposes ±1 / ±12 (`pitchTo` the nearest note on its pans,
  notes with no place dropped). `SONG.swing` (.5 / .58 / .66) moves off-beats when played (`swung()`, not the notes);
  `SONG.speed` (1, ¾, ½) slows the clock (`spb()`; `spb0()` is the song's own) and the recording waits for full speed.
  Test with `tvredit`.
  **Every pan:** `KEYS` tenor, dten, dsec, guitar, fcello, tcello, six, seven, kit. One or two drums stand by
  `PANSET.place`; more by `placeOf()` from the app's drawing (scaled so neighbours don't touch, each turned to you, the
  cellos' front row at `front` .04, you inside the basses' arch at .48), with flatter, shallower bowls (`tilt`, `depth`).
  Unrecorded notes (dten, tcello, seven) play the nearest recorded note of the band's `borrow` set, retuned (`borrowOf`).
  **Sticks** (`STICKS`, `makeStick(kind)`, swapped by `restick()`): bass blue balls, cello black, guitar tan, double
  second and tenor red, kit wooden; held pointing forward and a touch down (`STICK_TILT`). **Bounce:** hits use the hand's
  real tip; then `bounce()` bends the stick back from the hand until its tip rests on the steel (`sinkOf`) and a hit
  flicks it up (`kickBack`). Test with `tvrpans` (`VR.pushStick`). The whole stick stays out of the steel: `sinkOf` also checks
  points along the wooden shaft (`SHAFT_T`, not right by the hand, dips under 12 cm), so the stick bends up from the hand until
  neither tip nor wood is in a pan (test in `tvrsticks`, `VR.shaftThrough`).
  **Stick shapes** (after the owner's stick kit, `steelpan-sticks.mjs`, from the same photo): flat lathed rubber caps wider
  than the wood (`capGeo`, `cr`/`ch` in `STICKS`, tenor 11 mm … cello 15 mm), the basses' oval ribbed blue heads (`ball` 41 mm,
  a seam, `ribTex`), a rounded butt and grained beech (`woodMat`); the rubber sits on its own pivot (`s.cap`) and squashes on
  a hit (`squash()`, after `kickBack`), the hit itself unchanged. Tenor caps red or black (page switch, localStorage
  `panyard-vr-tenorcap`). Test with `tvrsticks`.
  **Stick weight** (`STICKS[k].g`, estimates: tenor 45 g … bass 110 g; `heft()` = √(g/60)): the swing's strength is
  speed/3.2 × heft (the same swing plays a bass louder, so brighter), and the bounce flicks up 1/heft as far and settles
  heft× slower, the rubber squashing heft× more (`kickBack`, `bounce`). The recordings already carry each pan's own sticks'
  tone, so weight changes the strength, not the sample. Test in `tvrsticks` (`VR.weighed`).
  **Notes to the rim** (page switch, localStorage `panyard-vr-notefill`, on): each drum's notes scale out until the outermost
  sits `FILLTO` (1.35 cm) from the rim, half the drawings' gap (tenor 2.7 cm); `outerOf()` measures the paths, `d.S` takes the
  larger scale, so hits, grooves and glows all follow. Off: `SURF` as drawn. Test in `tvrsticks` (`VR.rimGap`).
  **Just play:** 🗋 New song (an ↶ Undo away) and "Put the table away" sit on the screen's bottom row when no note is
  picked; `showTable()` hides the table, stops the music and the click (localStorage `panyard-vr-studio`); holding A / X
  a second (a tap still brings the pans) or the page's Studio table switch brings it back. The trigger only kicks on the
  drum kit.
  **Stick length:** `STICKS` lengths are what shows past the hand (tenor ~15 cm … bass 22 cm), times the page's Sticks
  switch (`STICKLEN` short .8 / medium 1 / long 1.2, localStorage `panyard-vr-sticklen`). **Move one pan:** a grip
  squeezed with the hand at a drum's rim (`drumAtRim`: near the edge, never over the notes) moves that drum
  (`panGrab/Move/Drop`), turned to face you, kept per set in localStorage `panyard-vr-drums`; ↺ Pans back (screen's
  bottom row) clears it.
  **Which pans:** + Track (desk or screen) opens a chooser on the screen (`PICK`, `drawPick`: all of `KEYS`); the new track
  takes those pans and they come out in front of you (`addTrack(set)`). A desk strip's pan name (▾, `setof:i`) changes an
  empty track's pans; a track with notes keeps its own.
  **The menu** (a thumbstick press; the Quest keeps ☰ for itself): `menu`, a canvas panel put in front of you
  (`menuOpen`, `drawMenu`, beam + trigger like the table; `panelLive` keeps the table out of reach while it's open): pans
  and look ◀ ▶, Drum body hum and Bass & treble (`OPT.hum`/`OPT.tone`, on unless switched off, localStorage
  `panyard-vr-hum`/`-tone`, also on the page's Sound switches; `strike()` adds the hum peaks and the pan's shelves only when
  on), sticks, the table, Bring the pans to me, Leave VR. Looks moved here from the thumbstick press.
  Test with `tvr` (`VR.swing`, `VR.hitDrum`, `VR.kick`, `VR.press`/`VR.drag` on the desk or screen).
  **Lift the pans** (both grips, a hand on a rim each, `liftGrab/Move/Drop`): the drums sit in a `lift` group inside `rig`;
  the hands' frame (`handFrame`: the middle between them, the line between them, the wrists' up) moves, turns and tilts it,
  so you can tilt the pans up to you instead of looking down. Kept per set in localStorage `panyard-vr-lift` (x, y, z and a
  quaternion, rig frame); ↺ Pans back (screen or menu) clears it with the single-pan moves (`panGrab` works in `lift`'s frame).
  **My songs** (menu → 💾 My songs, `drawSongs`; the page's Saved in VR list): `SONGS` in localStorage `panyard-vr-songs`
  (`[{id, title, at, song}]`, newest first); `SONG.sid` is the saved song it came from, so 💾 Save updates it and ＋ Save as
  new adds one (`freeTitle`: Song 1, Song 2…). Open (`openMine`, an ↶ Undo away), 🗑 (press twice), and off the headset
  rename, ⬇ a file (`format:'panyard-vr-song'`) and Open a song file (a new song). Test with `tvrlift`.
  **The pan yard** (the default; menu/page "Where you play": Pan yard / One pan, localStorage `panyard-vr-yard`): every pan
  set in the song (plus where you are, and pans you went to, `SHOWN`) is a **station** (`STN`: `{key, g, lift, drums, bus,
  label}`, `buildStation`/`dropStation`/`syncStations`) under the galvanize (`shed`), set out as on a Panorama stage (the
  owner's choice; `BAND`: [x, z, facing], the front is −z by the flag: frontline row at z −2.2, guitar/four cello behind, three
  cello behind them, six/seven bass on the left/right wings facing in, the kit at the back; `BORDER` is B/Y's order), each
  `g` turned the way its section faces, you standing 0.5 m behind its pans (`spotOf`). `BAND` reads the chosen layout in
  `LAYOUTS` (`pano`, or `rows`: Concert rows, everyone facing the front, basses and drums in the back row; `setLayout`,
  localStorage `panyard-vr-layout`; menu Panorama / Rows / One pan); each layout keeps its own moved sections (`posKey`). One pan is a
  single station whose `g` is the old `rig`. `drums` holds every station's drums (hits, bounce, rim grabs, lift all work per
  drum; `d.st`, `d.set`, `d.i`); `setKey` is the station you're at (`arrive()`: its sticks, its track selected, the table and
  sign moved to it by `hereStation`). Moving: `PL` (x, z, yaw) is applied as an offset reference space (`applyPlayer`,
  `baseRef` from `enter()`); thumbstick forward aims an arc (`aimFrom`, `landing` snaps to a station's spot), let go to
  teleport; left/right snap turns 45°; walking near a station (`walkCheck`) arrives too; B/Y and the menu's ◀ ▶ go to the
  next station. ● Rec records the track for the pans you're at, and only their notes (`recHit`). **Surround:** each station
  has an HRTF `PannerNode` bus (`busOf`/`placeBus`), tracks route there (`chan`, `routeAll`), the listener follows your head
  (`listen`); Even mix (`EVEN`, localStorage `panyard-vr-even`, off unless chosen) is rolloff 0.3, off is 1. 🗋 New song asks which pans
  (`PICK='song'`, `PSEL`, Put them out → `pansOut`); `songChanged()` re-syncs after undo, delete, open, Drive import.
  **The yard feels still and close** (the owner: pans "always seem to move", jumps felt far): in the headset `goTo(k)` keeps your
  facing (only you move; you turn your body to pans facing another way); `goTo(k,true)` faces you to the pans for the first
  placing, A / X, a new layout, spacing or Yard back. **Spacing** (`SPACES`, `SPACE`, localStorage `panyard-vr-space`, page
  `#spaceSeg`, menu "Yard:" in the Even mix row): Close (default) is `BAND` × .68 then `relaxYard()` nudges any two sections that
  would touch apart (`pairOver`, `GAP`; ones you moved yourself, `YPOS`, stay), Roomy the first layout. **Even mix is off by
  default** now (far sections quieter, direction clearer), and each station's panner sits at its drums' middle (`placeBus`).
  Test with `tvryardfeel`.
  **Players** (a section's size, per song: `SONG.players[set]`, `playersOf`/`maxPlayers`/`setPlayers`, the owner: "three tenors…"):
  `buildStation` adds n−1 copies of the set's drums side by side (`makeDrums(k,st,lite,copy,off)`, `d.copy`, own index → own
  saved place, `st.n`; `syncStations` rebuilds a station whose size changed, `rebuildStation(k)`), still **one track**; `strike()`
  with a track plays every copy (`CP_DT` ms later, `CP_C` cents off, ×.82; voices keyed `id#copy`; copies skip lights/hits), so
  the section sounds fuller. Any copy is playable (same ids). Set on the mixer strip (Players − / +, `plm`/`plp`) or the sign
  over a section you point at (`psign`, `signFrame`/`signTick`/`drawSign`, `psm`/`psp`). Max 6, 12 drums a section (six/seven 2,
  four cello 3), not the kit. Test with `tvrplayers` (`VR.players`).
  **Pull a section closer:** a beam on another station (its invisible cylinder `st.hit`, the beam turns gold) + trigger drags it
  along the floor (`stationHit`, `stGrab/stMove/stDrop` on the 0.9 m plane, `placeStation` moves it and its sound); kept per set in localStorage `panyard-vr-yardpos`; menu ↺ Yard back (`yardBack`) puts all back in their `BAND` places. Dragging keeps a section's facing.
  **The barrier** (`clashOf`/`footOf`, `GAP` 8 cm): footprints are each station's drums, the kit's pieces and its player's
  spot; a pull (`stMove`), one-pan move (`panMove`) or lift (`liftMove`) that would make the worst overlap bigger is undone
  that frame (a buzz, `bump`). **The lock** (`LOCK`, localStorage `panyard-vr-lock`, on): the grips and the beam leave the
  pans be (a `toast` says how to unlock); menu 🔒/🔓 and the page's switch. A gold ring (`hereRing`) marks your spot.
  **Welcome guide** (`guide` panel, `GUIDE.grown`/`.kids` pages, `guideOpen`/`drawGuide`): opens the first time in the
  headset (localStorage `panyard-vr-welcomed`), Next / Back / Skip, menu ❓ Guide. `toast()` floats short messages.
  **The studio hovers** (the owner's choice over the table): the table group's wood is hidden; `hoverHome()` puts the screen
  just behind the pans you're at (behind their farthest drum), at about eye height (table y .13 in the station frame), facing
  you, at every station (`hereStation` moves it; the sign rides on top). A grip on it nudges it (localStorage
  `panyard-vr-hover`, kept as an offset for every pan). The mixer (`desk`) folds down under the screen with the bottom row's
  🎚 Mixer (`setMixer`, localStorage `panyard-vr-mixer`, off); `panelLive` skips hidden panels. **Wrist buttons** (`wrist`
  panel on the left grip, `drawWrist`/`wristFrame`): ▶/■, ● Rec, 🎓 Learn, ⟲ Loop and the status line, shown when the left
  palm turns up to your face (the grip's +x toward the head, a moment's grace), pressed with the right beam.
  **Play along** (🎓 Learn on the screen, `learn()`/`learnStop()`, `LEARN`): the part for the pans you're at (or the selected
  track) goes silent (`audible()` leaves out `LEARN.id`) while the rest plays; its notes glow solid teal on the pans `LEAD`
  (2) beats ahead (`learnFrame`, `upcoming()`, per-note `n.cue` mesh sharing the glow's shape; kit pieces via `p.cue`), from a
  cursor (`LEARN.cur`) so slow frames skip none. A live hit within `GOOD` (0.18 s) of its moment counts (`learnHit`, matched
  straight from the part, green flash); notes let go are missed; each pass toasts its score (`LEARN.P` by `passOf`). ▶, ● or
  🎓 ends it. Test with `tvrlearn` (`VR.learnAt` gives a hit's exact moment: the test browser's frames are too slow to time).
  **Studio sound packs** (`packs/<name>/`, served at /pan-notes/packs/, made by `source/make_sound_pack.py` from a library
  with one WAV per note per loudness, `<note>v<k>.wav`): a few loudness layers per note (mono 16-bit FLAC, trimmed, the
  loudest layer at about −1 dB, the others at their own level) and `pack.json` (`files[id]` soft→hard, `tune[id].cents` to A
  440 from each note's measured pitch, `credit`, `licence`). VR (`PACKS`, `PACK`, `pbuf`, `strikeLayer`: the layer for the
  hit's strength, ×0.78) plays a pack per set when chosen (`packOn`, localStorage `panyard-vr-snd-<set>`, page `#packBox` with
  the credit, menu "Sound: studio/band" beside Go to pans). **dunleavy-dsec**: the Dunleavy Double Seconds (bitKlavier,
  Princeton, Josh Quillen; Neumann mics; CC BY 4.0, credit required), 30 notes × 4 layers (v1/3/5/7), on by default.
  **sasse-tenor**: the SASS-E dataset (Zenodo 7803316, Colin Malloy, UVic; **CC BY-NC: non-commercial, remove before
  charging**), recorded for pitch-detection research (hits all over the note, ~1 s rings, three pans unlabelled: the
  largest pitch group per note, four hits soft→hard), off by default. Test with `tvrpack`.
  **Kids mode** (`KIDS`, localStorage `panyard-vr-kids`): the yard with `KIDSETS`, no table, a simple menu. Test with `tvryard`
  (the older VR tests pin One pan with `panyard-vr-yard` = 0).
- **VR classroom** (Level 1: Know your pan, `CLASS`/`LESSONS`/`lessonsFor(set)` in `panyard-vr.html`, before `const VR=`): a chalkboard
  (`door`, rig-local 3.4, 3.2, back right, yard only, not kids) or the menu's 🎓 Class starts it (`classStart`): you go to your
  pan (`CLS_SETS` tenor, dsec; localStorage `panyard-vr-cls-set`), the studio steps aside (`table.visible=false`; `panelLive`
  skips desk/scr/wrist while `CLASS.on`) and `board` stands where the screen hovers (`placeBoard`). Lessons are steps: `say`
  (board + `speak()` speechSynthesis, `panyard-vr-cls-voice`; a `demo` played on a solo demo track `DTR`), `play` (`items`
  {ids, any, label}; `glow` guided or check; two ids = together within 0.45 s; wrong hits flash red with `hintFor()` (what
  you played, how far, which ring/pan from `cInfo`: the pan's own labels, ring and drum, note centres from the SVG paths);
  check steps glow the answer after 2 wrong tries), `beat` (a 4-click count-in, `click()`, hits within 0.17 s, glow a
  beat ahead). Live hits reach `classHit` beside `learnHit`. Patient: nothing moves on without the note. Stars from slips
  (`CLASS.mis`: ≤1 ★★★, ≤4 ★★), kept per pan in localStorage `panyard-vr-cls`; ★★ opens the next lesson; lesson 9 is the
  Level 1 test. Chords are two notes (`voicing()`: the chord's third always in, close in pitch, close on the pan; dsec one
  on each pan). Glow uses the Play-along cue meshes (`cueOf`) with its own fields (`cA/cOk/cBad`, `classFrame`). Test with
  `tvrclass` (`VR.cls`).
- **VR classroom Level 2** (chords, keys and reading music; `lessons2For(set)`, `CLASS.lvl` / localStorage `panyard-vr-cls-lvl`,
  progress keys `set:2:i`; Level 1 keeps `set:i`; `LESSONS` is built after all the tables, at the end of the engine, or a
  Level 2 start throws): `drawStaff` (treble clef, ledger lines, the pan's own spelling via `spell`, `KEYSIG`, note
  lengths and rests); play steps with `read` hide the name; chord items `{chord: chordOf('Dm'), guide, smooth}` take any
  two chord notes together that keep the third (`guide`: 3rd + 7th); the same two notes as the last chord don't count
  as a change; `smooth` compares the move (`travel`, cm via `CM_PER`) with the closest choice; ear items `{hear}`
  are answered on the pan (`alt` messages for the wrong third); beat steps take `rh` notation ("q q h | e e q Q"), `chart`
  (bars, `rep:{from,to,end1,end2}`, `chartOrder`, `strum`), `roll` beats (≥ 4.5 hits/s, both notes, evenness) and a
  `band` (`playBand`: calypso or soca, six bass root/fifth + kick, snare, hi-hat on `BTR`/`KTR`). `chordVoice` picks the
  pair (dsec: one note on each pan strongly preferred; G7's guide tones are both on the C♯ pan). Note centres in
  `cInfo` come from SVG `getBBox` (the middle ring's arcs broke a plain average). 🎵 Practise my songs: `guessChords`
  (major/minor triads scored per bar, bass notes double), a bar tap cycles guesses (localStorage
  `panyard-vr-cls-chords-<song id>`), comp along while the song's other tracks play. Mary Ann's chart is I/V7; no melody
  yet. Test with `tvrclass2`.
- **VR classroom Level 3** (playing in the band, and composing; `lessons3For(set)`, keys `set:3:i`, **every pan**: `ALL_CLS`,
  `clsSets()`): each pan has a role (`ROLE3`: tenor/dten lead, dsec harm, guitar/cellos strum, six/seven bass). Two original
  calypso tunes written for the class, `TUNE_A` "Yard Lime" (C, 8 bars) and `TUNE_B` "Moonlight Mas" (A minor), as `melody()`
  strings ("E5/e C5/q. r/q |"), fitted to any pan by octaves (`fitShift`/`fitNote`, `setRange`; guitar ids are names, so `cm()`
  reads NOTE hz and `cid()` maps back). `arrangeTo(set,tune,role)` writes any section's part (harmony a third/sixth below in the
  key, strum two-note voicings, bass root and fifth); the yard plays the other sections from their stations (`SECT`,
  `sectionsReady`, `bandAround`/`pieceBand`, `KITP_CAL`). Steps: `mel` (a timed staff, bass clef on `LOWPANS`, dotted notes,
  paged 2 bars at a time), `rh` with dots ('q.'), `beats` with `dyn` p/f (swing strength: f ≥ .62, p < .5) and a `cresc` roll,
  `write` steps (🎼: the band plays, what you play is recorded, quantized to eighths, `finishWrite` judges it) into `PIECE`
  (localStorage `panyard-vr-cls3-piece`: melody, answer (bars 5–8), harm, strum, bass, minor (bars 9–12), jam, key), a choose
  item for the key (G moves everything up a fifth). `pieceTune()` builds the piece, `piecePart` takes your bars and the
  arranger's for the rest; 🎼 My piece (`CLASS.page='piece'`): ▶ Hear (`pieceHear`, `stopClass` silences the cls- channels),
  💾 Save (`savePiece` → SONGS "My calypso", 4 sections + drums), 🗑 Start over. The Level 3 test performs it and saves it.
  Test with `tvrclass3` (`VR.cls.go(L,S)`, `clock`, `piece`, `arrange`).
  **Note names** (🔤 Names on the board's lesson pages, `CLASS.names`, localStorage `panyard-vr-cls-names`, on): `drawStaff(…,{names})`
  writes each note's letter (the pan's spelling) under the staff, the current one large in gold; mel steps show ▶ Next: <note>.
  **Demonstrations at your pace** (the owner found them rushed): `speak(text, then)` calls back when the voice ends (or soon
  with it off), so `enterStep` plays the demo (`playDemo`) and ear questions only after it; `demo()` plays a note every 0.9 s
  (chords 1.4 s) times 1/`CLASS.spd`, rhythm and melody demos follow `CLASS.spd` too; the board's "Now playing" box shows each
  note's name as it plays (`demoShow`/`demoNow`, `♪` only in ear questions); 🔁 Replay replays just the demo; Demo speed 1× / ¾ /
  ½ sits on every say and play step. Test with `tvrdemo`.
- **VR stands and sway** (`HANG`, `hangStand`, `standFollow(dt)`, `swayHit` in `panyard-vr.html`): tenor, dten, dsec, guitar and
  cellos hang: a pole and tripod, three chrome arms (`seg()` places unit cylinders between points) up round the skirt to hooks
  ~10 cm above holes near the rim (`HOOK_A`: back and the two front sides), a black strap to each. The stand is rebuilt only when
  the pan's rest pose moves (`d.rest`), so it stays still while the pan swings. A hit (`track` → `swayHit`) kicks a damped pendulum
  (`SWAY` w 7, ζ .18; more near the edge, for a harder hit and a lighter pan via `HANG`), applied as `d.g.rotation.x = tilt0 + sx`,
  `.z = sz` (≤ 2°), so hits follow the pan. Basses keep the old floor pole and don't sway. Menu / page switch Pans sway
  (`OPT.sway`, localStorage `panyard-vr-sway`, on). Test with `tvrstand` (`VR.swayStep` steps it by simulated time).
- **VR four cello sound** (`FCMODE`, `fcelloSrc`, `FC_GOOD` in `panyard-vr.html`; page "Four cello sound", menu "Sound:" beside Go to pans
  at the four cello; localStorage `panyard-vr-fcello`): the band's four cello recordings (band sounds version `FC_VER` 0f448d2055)
  were measured: fcello:48–51, 53, 54, 58, 60, 61 are mostly the octave below (the drum ringing into the mic), 34, 35, 55, 56 the
  octave above, so it sounded like a bass. **Cleaned** (default) plays the nearest `FC_GOOD` recording retuned, two high-passes at
  0.8× the note, a gentler body hum and no low-shelf lift; **From guitar** the nearest double guitar recording retuned (C♯3–G♯4,
  further stretches beyond); **As recorded** the old way. Re-measure if new band sounds come (a new version falls back to all of
  them). Test with `tvrfcello` (it renders middle C and measures the octave below).
- **VR stick feel** (the owner found the sticks too light; `WEIGHTS`, `hitBuzz`, `lagFrame`, `SOFT`/`softAt` in `panyard-vr.html`):
  Stick weight Light / **Real** (default) / Heavy (page "Stick weight", menu "Weight:" on the Sticks row, localStorage
  `panyard-vr-weight`): a full hit needs `full`× the old 3.2 m/s swing; the tip trails the hand on fast moves (`lagFrame`, a spring
  on the pivot from the grip's speed in its own frame, ≤ .07–.11 rad, drawn only: `track()` still uses the real tip); each hit
  buzzes (`hitBuzz`: a thump 14+14·heft ms then two fading taps, the rubber bouncing; stronger for harder hits). Band recordings'
  soft hits use Panyard's `BAND.SOFT` (octave, third and sparkle dB below a firm hit), not the old lowpass; packs keep their layers.
  Test with `tvrfeel` (`VR.weight.swingLag`, `VR.buzzes`).
- **VR rooms** (page → Room, menu → Room ▸): a 360° picture as the room (`ROOM`, `setRoom`, `applyRoom` in `panyard-vr.html`):
  built-in ones from `rooms/rooms.json` (`[{k, name, file}]`, files beside it, served at /pan-notes/rooms/), your own added on
  the page (`roomAdd`: cut to at most 4096 wide, JPEG, IndexedDB panyard-vr / rec `room:<id>`, names in localStorage
  `panyard-vr-rooms`; a warning when not 2:1). The choice (`panyard-vr-room`) is drawn on a **grounded dome** (`groundedSky`, as three.js's GroundedSkybox: the lower half
  pressed into a floor at y 0, `roomEye(k)` m below the picture's camera, 1.6 by default, page Floor lower / higher per room,
  localStorage `panyard-vr-roomeye-<k>`); as `scene.background` it sat at infinity and felt like floating. The sky,
  floor, flag and the yard's roof hide while it shows, never in passthrough. Test with `tvrroom`.
  **Built-in rooms are real 360° photos** from Poly Haven (CC0, free for anything; `credit` in rooms.json shows on the page): Beach
  with palms (Spiaggia di Mondello), Seaside at night (Blue Lagoon Night), Beach at sunrise (Umhlanga Sunrise), Zanzibar fort stage
  (Amphitheatre Zanzibar Fort), cut from 8K to 6144 × 3072 (about the Quest 3S's sharpness round a full circle); chosen with open
  ground near the camera, since anything close smears on the grounded floor. `roomTex` shrinks a picture past the GPU's
  `maxTextureSize` and skips mipmaps. The owner's first two (1774 px wide, AI-made, so soft and stretched) stay at the end.
  **Classroom polish:** practice speed 1× / ¾ / ½ on beat and comp steps (`CLASS.spd`, localStorage `panyard-vr-cls-spd`,
  `spdBtns`); the where-to-look map (`drawMap`: the pan's own drawing from above, gold = what may glow, red = your last
  wrong note `CLASS.badId`) on play steps. Tested in `tvrclass2`.
- **VR 💡 Ideas** (menu → 💡 Ideas, `pad`/`IDEAS`/`IA`, `ideasOpen`/`drawPad`/`ideaAct` in `panyard-vr.html`, ids `ia…`): a pad in front
  of you for ideas while you play, kept in localStorage `panyard-vr-ideas` (`{list:[{id,title,at,bpm,notes,text,ink}],cur,tab}`).
  🎼 Score: with ✏ Writing on, every live pan hit (`ideaHit`, called beside `classHit` in `strike`/`strikeLayer`) goes on a blank
  staff at the chosen length (Whole/Half/Quarter/Eighth, Dotted, Rest, ⌫ Undo); a hit within 90 ms of the last is a chord (same
  `b`); notes are `{id,m,b,d}` drawn by `drawStaff` (timed, 2 rows × 4 bars a page, bass clef when the notes are low); ▶ plays it
  on the pans (`ideaPlay`, a solo track `idea-play`). ⌨ Type: a keyboard on the pad (`KB`, auto capitals). ✏ Draw: beam + trigger
  draws (`inkDrag`, a hit with `nosnap`/`done`, so it never touches the song's undo; `uiDown`/`uiUp` honour both). The page's
  Songs tab lists ideas (`ideasUI`, `#ideaBox`): rename, type the notes with a real keyboard, delete. Test with `tvrideas`
  (`VR.ideas`).
- **Studio sound packs in Panyard and Panyard Band** (`panyard-packs.js`, `PACKS`, after steel): the same `packs/` as VR
  (`PACKS.LIST`: dsec Dunleavy on by default, tenor SASS-E off; **remove `tenor` before charging**, CC BY-NC). With a pack on and
  recorded sounds (`S.panVoice==='mine'`), Play's taps (`strikeMine` wrapper → `playSample(…, pk)`) and Studio's `panVoice`
  (`PACKS.pick(id,v)` → `playBuf`) play the layer for the hit's strength (×0.78, as VR), the pack's cents + the song's A, Band
  sound on top; the phone's own recordings stay. A pack loads when its set is the song's pan (or Studio asks for a note).
  Settings: a switch per pack with credit and licence (localStorage `panyard-packs`, not backed up). The service worker keeps
  pack files in its own `sound-packs` cache (survives app updates). Test with `tpacks` (Panyard and Band).
- **Songs out of VR** (page → Saved in VR → Share, `shareRow`/`shareDo` in `panyard-vr.html`): 🎵 MP3 / WAV (`renderSong`:
  an OfflineAudioContext borrows the note players: `RENDER` makes `chan()` give per-track channels and `busOf()` the plain
  stereo `masterChain()`, no lights, no resume; mute/solo, swing, a Panyard recording included; MP3 by Panyard's
  `../panyard/lame.min.js`); 📱 Send to Panyard (`sendPanyard`: `panyard-vr-inbox.json` in the hidden app folder, upserted by
  song id, recording tracks left out); 📁 Save to my Drive (`toMyDrive`: its own token with scope **drive.file**, a visible
  "Panyard VR" folder, the song file + an MP3, the same names replaced). Panyard's side is `panyard-vrin.js` (`VRIN`, after
  cloud; Panyard only, set up at DOMContentLoaded so Band's later `BANDAPP` keeps it out): with Google signed in it peeks at
  the inbox, a 🥽 chip on Home for unopened songs (localStorage `panyard-vrin` {id: at}), a Songs from VR button on the
  Backup card; Open = `ROLE.songNew0()`, title and pan, then `backupIn({studio})` (pan tracks, kit → drums 'real').
  Test with `tvrshare` (a pretend Google and Drive, both apps).
- **Soft hits, Even out, Clean the rumble** (measured from the Dunleavy double seconds against the band's tenor): recordings
  are one firm hit per note, so `BAND.chain` shapes softer hits with `BAND.SOFT` (octave / third / sparkle dB below a hard hit at
  v .15 .43 .71 1, from the pack's 4 layers, the softest capped): `softNodes()` (peaks at 2× and 3×, a shelf from 3.6×), on
  recordings only (`real`: not `T.layered` pack notes, not Tuned steel, which keep the old lowpass or none), when How you
  play's dynamics are on. Ring and body are left as recorded (they come from the skirt). `panyard-even.js` (`EVENOUT`, after
  packs): ⚖ Even out my <pan> (Pan sounds, recorded sounds) measures each note's octave and sparkle (`measure`, first 0.3 s)
  against its neighbours within 4 semitones (2 dB allowance, 60% of the way, Tone ±6, `T.oct` ±8 dB, a peak at 2× in
  `BAND.chain`), ↶ Undo from localStorage `panyard-even`; Panyard Band evens the band's tenor once per band-sounds version
  (`panyard-even-band`). 🧹 Clean the rumble (Settings, `panyard-clean`): three 170 Hz high-passes (**Q −3.01: a high-pass's Q
  is in dB in Web Audio, 0.707 gives a bump**) on tenor recordings (and dten, which borrows them); the skirt's ~265 Hz hum
  stays. Test with `tsoft`.
- **Android signing key:** `android/panyard.keystore`. Every APK must be signed with it so it installs over the last one.
