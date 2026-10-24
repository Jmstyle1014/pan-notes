---
name: panyard-ship
description: Make a change to the Panyard steelpan app and put it live, the way this repo's owner likes it. Use for any feature, fix or look change to Panyard (pans, Studio, Play, Write, sounds, settings), from "can you add…" or "this looks wrong" to shipping it.
---

# Make a Panyard change and put it live

The owner plays steelpan and has no coding experience. Everything you say to them is plain language, short,
with screenshots of anything visual. CLAUDE.md has the build details and the list of things that are easy to break:
read it first.

## 1. Before touching anything
- `git pull` (other sessions work on this repo; an old copy once nearly overwrote newer work).
- Find the module: Panyard code lives in `source/panyard-*.js` / `.css`; never edit the built HTML.
- **Big or visual redesign?** Make a mock-up first and ask. Two ways that worked well:
  - inject a prototype into the real app with Playwright (override functions like `STAGE.layout`) and screenshot
    before/after side by side;
  - a small standalone HTML mock rendered with Playwright at phone size (412×892 upright, 892×412 sideways).
  Send the pictures, summarise in a few bullets, and ask the 1–3 questions that change what you build
  (AskUserQuestion works well). Small fixes and clear bug reports: just do them.

## 2. Build it
- Wrap globals by reassigning them (`const _f=fn;fn=function(){…}`); module objects others check use `var`.
- New module? Add it to `source/make_panyard.py` (its `rep()` asserts each target appears exactly once) and its
  CSS to the stylesheet chain there.
- Saved data: never rename keys; anything stored per song must survive backups (Studio backups are sanitised in
  `window.backupIn` in `panyard-studio.js`, so add new track fields there).
- Rebuild: `python3 source/make_panyard.py`.

## 3. Prove it
- Write a focused Playwright test `tests/t<name>.py` (copy the setup of a neighbour such as `tests/tstageside.py`:
  producer role, `panyard-guide` tips off, `ROLE.songNew0()`), add it to `ALL` in `tests/run_tests.sh`.
  Test the behaviour the owner cares about, in their words ("the tenors sound from the left after dragging them").
- Run it plus the neighbours of what you touched (`tests/run_tests.sh tpass tguide rt …`). Look at the screenshots
  in `tests/work/` yourself before showing them.
- For a bug report: reproduce it first (the test should fail on the old build), then fix.
- Sound changes: measure, don't guess. Capture the app's output by wrapping `AudioNode.prototype.connect` to tap
  the destination (see `tests/tyard.py`), check peaks stay under 1.0 and levels with numpy.
- A test that clicks the middle of a button group breaks when a button is added: click by name instead.

## 4. Ship it
```bash
python3 source/build.py source/pan-notes-panyard.html <scratchpad>/site "Panyard"
rm -rf panyard && cp -r <scratchpad>/site panyard
```
Update CLAUDE.md's "Things that are easy to break" when you add a system. Commit (with the session's attribution
trailer), push to the working branch, open a PR whose body says what changed and which tests pass, subscribe to
its activity, and schedule a ~50 minute check-in. Only rebuild the site you changed (`panyard/`).

## 5. After the merge
- Cancel the check-in, reset the branch to the merged main
  (`git fetch origin main && git checkout -B <branch> origin/main && git push -f origin <branch>`).
- ~5 minutes later check the "pages build and deployment" and "Android app" runs succeeded, then tell the owner
  it's live: close Panyard fully and reopen it (maybe twice) to get the update, and exactly where to find the new
  thing (screen → button).

## How to talk to the owner
- Lead with what they'll see or hear, then a short bullet list. No code words (say "the sound of each note",
  not "SAMPLES.tune").
- Say plainly what was tested and what wasn't (e.g. "the demo uses the built-in tone, not your recorded pans").
- When something was lost, explain the cause in one or two sentences and how to get it back.
