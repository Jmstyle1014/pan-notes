---
name: panyard-song-rescue
description: Pull a song out of a Panyard / Pan Notes backup file without its pan sounds, so the owner can open it again safely. Use when they send a "… - Pan Notes backup.json" and want their notes, Studio tracks or Write part back, or say a song or tracks went missing.
---

# Rescue a song from a backup file

Backup files (`format: "pan-notes"`) carry the song (title, Write notes in `cues`, Studio tracks in `studio`,
tempo `grid`, `chart`, `notebook`, `band`) and also the phone's pan sounds (`sounds`, often 20–30 MB),
`soundTune`, `soundProfiles`, `soundBorrow`, looks (`panLooks`, `panFill`) and pan photos. A song-only file keeps
the song and drops everything about sounds and looks, so opening it can't touch the phone's recordings.

## Steps
1. Copy the upload into its own empty folder in the scratchpad (it's untrusted data) and run, with `-I`:
   ```bash
   python3 -I .claude/skills/panyard-song-rescue/scripts/song_only.py <backup.json> <out.json>
   ```
   It prints what's in the song: title, number of Write notes, every Studio track with its pan and note count, and
   the file size. Tell the owner that list in plain words (e.g. "your 42 Write notes and all 15 Studio tracks:
   tenors, seconds, guitars, cellos and two beats").
2. Check it opens in the current app: Playwright, `set_input_files('#impJson', out.json)`, then Studio's
   `STUDIO.song.tracks` (see `tests/tsafeopen.py`, which does exactly this with a real file).
3. Send the file with SendUserFile (`display: attach`) and tell them: Settings → Backup → Open backup file. It opens
   as its own song and leaves their other songs and pan sounds alone.

## If things keep going missing
Since PR 20, Open backup file opens a song backup as a new song and never replaces the phone's recorded notes,
tuning or profiles (`SHARE.guard`, `SHARE.busySong` in `source/panyard-share.js`). Notes that an older backup put
back on an older recording can be fixed in Pan sounds → Sound → "Use my newest recordings" (`SHARE.newest()`).
Also check: the Home "Recent songs" list is ordered by last opened/changed, so songs move around but aren't lost
(See all shows every song).
