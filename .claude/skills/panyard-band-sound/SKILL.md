---
name: panyard-band-sound
description: Listen to a recording of the owner's steelband (phone recordings of practice or a performance) and turn what it shows into Panyard sound settings, such as the band's tuning (A = 441), how bright or warm the yard is, how long notes ring, the pitched "hum" between hits and clipping. Use when they send .m4a/.wav recordings and ask what can be done with them or want the app to sound like their pans.
---

# Capture a band's sound from a recording

What worked: measure the recording, explain the findings in plain words, then map them onto Band sound
(`source/panyard-band.js`): preset values (`a`, `stretch`, `tone`, `ring`, `stick`, `shimmer`, `room`) plus
Yard hum (ConvolverNode on the song's key notes), Yard air (warm top filters) and the `ouryard` room. The
"Our yard" preset came from exactly this (CLAUDE.md, Band sounds).

## Steps
1. Copy each upload into its own empty folder in the scratchpad and run (ffmpeg and numpy are installed):
   ```bash
   python3 -I .claude/skills/panyard-band-sound/scripts/analyze.py <recording> [<recording> …]
   ```
   It reports, per file: length, loudness, **clipping** (too close or too loud a phone), the band's **tuning**
   (A in Hz from note pitches), **tone balance** (⅓-octave levels; a steep fall above 2.5–3 kHz = a warm yard),
   **ring** (dB per second a note fades), **hum** (how far the quiet moments sit below the loud ones, and which
   note names keep sounding between hits = the song's key), and how many notes stand alone (enough to cut clean
   samples, or not).
2. Tell the owner what you found in a few bullets ("your pans are tuned a hair sharp, A = 441"; "the yard never
   goes quiet: between hits it's only 6–9 dB softer, and what keeps ringing is C, D♭, E♭, A♭, B♭").
   Be honest about limits: two pans playing at once or clipping means no clean single-note samples and no
   reliable automatic transcription; suggest how to record better (phone a few steps back, one pan at a time).
3. If they want it in the app: add or tune a Band sound preset, measure the result by capturing the app's output
   (see `tests/tyard.py`), keep chords under clipping, and render a short before/after demo m4a with Playwright
   + ffmpeg so they can hear it (say if it uses the built-in tone rather than their recorded pans).
4. Ship with the `panyard-ship` steps.
