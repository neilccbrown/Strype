# Guitar samples for Strype music support

`acoustic_guitar_nylon-ogg.js` is a single self-contained soundfont file (all
notes bundled together as base64-encoded ogg audio, in the classic MIDI.js
soundfont format), vendored here so Strype can render guitar audio offline
without depending on a third-party CDN at runtime.

- Instrument: "acoustic_guitar_nylon" from the **FluidR3_GM** General MIDI
  soundfont (generated from `FluidR3_GM.sf2`).
- License: [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/us/).
- Repackaged as pre-rendered per-note audio by the
  [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts)
  project, and used by the [smplr](https://github.com/danigb/smplr) JS
  library's `Soundfont` instrument.
- Fetched from: `https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_guitar_nylon-ogg.js`

We deliberately used the FluidR3_GM kit rather than MusyngKite (also offered
by the same project), because MusyngKite is CC-BY-SA (share-alike) while
FluidR3_GM is plain CC-BY (attribution only).
