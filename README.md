# Pan Notes

Steelpan rehearsal companion for the double guitar pans (E/C and B/F): play along with your recording, cue notes on a timeline, read your part as letters or pan tab, write practice notes, and share PDFs, pictures and videos with the band.

**Open the app:** https://jmstyle1014.github.io/pan-notes/ — in Chrome on Android, tap ⋮ → Install app.

**Try the new look (Pan Notes Next):** https://jmstyle1014.github.io/pan-notes/next/ — a separate app you can install alongside the classic one. It uses the same songs and cues on your phone. The classic version is also saved permanently as the `v1-classic` tag.

Your cues, recordings and photos are saved on your own phone, not in this repository.

## For updates
The app files live at the top level (that's what GitHub Pages serves). The editable source is in `source/`:
`source/pan-notes.html` is the app; `python3 source/build.py` rebuilds the files into `source/site/`, which are then copied to the top level.
The new look is made from the same source: `python3 source/make_next.py` writes `source/pan-notes-next.html` (styles in `source/next-look.css`), then `python3 source/build.py source/pan-notes-next.html next "Pan Notes Next"` builds the `next/` folder.
