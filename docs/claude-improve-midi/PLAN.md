# MIDI playback support — plan

## Goal

Let Strype user programs play MIDI-style music (a sequence of notes with
timing) with a choice of instrument, e.g. something like:

```python
sound = make_midi_sound(list_of_notes_and_timing, instrument=default)
```

`make_midi_sound()` should return a Strype `Sound` object (see
`pysrc/strype/sound.py`), not just trigger live playback. This means the
underlying implementation needs to render to an in-memory audio buffer
("offline" rendering), not just schedule notes onto a live speaker output.

## Findings so far

### Pyodide/Python side: no viable pure-Python option

- `mido` / `pretty_midi` can build/parse MIDI *messages*, but their
  playback backends (`rtmidi`, `portmidi`) are native C bindings that
  don't exist in WASM/Pyodide. They cannot produce sound by themselves.
- Conclusion: MIDI synthesis must happen in JS/TS, forwarded from Python
  the same way `pysrc/strype/sound.py` forwards to
  `_strype_sound_internal` (a `strype_bridge` JS module). A new
  `strype/midi.py` should follow that same shape (e.g.
  `set_instrument()`, `make_midi_sound()`), calling into a new JS bridge
  module.

### JS/TS library options considered

| Library | Bundle/code size | Instrument data | Multi-instrument (simultaneous) | Offline render to `AudioBuffer` |
|---|---|---|---|---|
| **smplr** (github.com/danigb/smplr, successor to archived `soundfont-player`) | ~20–40 KB min+gzip core | Fetched on demand per instrument (~100 KB–2 MB each), not bundled | One instrument per player instance; mix multiple instances yourself | **Yes** — first-class, documented `renderOffline()` helper (see below) |
| **WebAudioFont** (github.com/surikov/webaudiofont) | ~20–50 KB core | Per-instrument base64 JS data files, ~100 KB–1 MB each | Same as smplr: one instrument per player, manual mixing for more | Technically possible but **broken**: unconditional `audioContext.resume()` call throws on `OfflineAudioContext` ([surikov/webaudiofont#63](https://github.com/surikov/webaudiofont/issues/63)); needs a fork/patch to fix, not supported upstream |
| **FluidSynth via WASM** (js-synthesizer / spessasynth) | ~1–1.5 MB WASM binary alone | Needs a full `.sf2` soundfont file; full GM (FluidR3_GM) ~140 MB, compact GM (TimGM6mb) ~6 MB | **Yes, natively** — proper multi-timbral synth, all 16 MIDI channels each with their own GM program | Yes — designed for offline/non-realtime rendering of MIDI events straight to a buffer |

### Recommendation: smplr

Given the `make_midi_sound() -> Sound` requirement (offline rendering, not
live playback), smplr is the best fit:

- `renderOffline(callback, options)` is a documented, first-class API —
  not a workaround. You get an `OfflineAudioContext` in the callback,
  schedule notes exactly like real-time playback, and get back
  `result.audioBuffer` (a plain `AudioBuffer`), which maps directly onto
  how `sound.py` already wraps `AudioBuffer`s into `Sound` objects.
  Options: `duration` (auto-detected if omitted, defaults to a 60s buffer
  with trailing silence trimmed), `sampleRate` (default 48000),
  `channels` (default 2). A `SampleLoader` can be shared between a
  real-time instance and an offline one to avoid re-fetching samples.
- WebAudioFont's offline path is broken (see above) and only fixable by
  forking the library — a maintenance burden Strype shouldn't take on for
  this.
- FluidSynth-WASM has the best multi-instrument story and the most
  "proper" offline-render design, but is a much bigger dependency
  (WASM binary + soundfont file, likely several MB minimum even with a
  compact soundfont like TimGM6mb) versus smplr's pay-per-instrument
  model. Given the target API only needs one instrument per
  `make_midi_sound()` call (`instrument=default`), smplr's simpler
  one-instrument-per-player model is sufficient; multi-instrument mixing
  is not currently a requirement.

### smplr sample hosting — no hard CDN dependency

By default smplr fetches instrument sample audio from a public GitHub
Pages host (`smpldsnds.github.io`, backed by
[github.com/smpldsnds](https://github.com/smpldsnds) — separately
licensed sample repos, mostly CC0/CC-BY/GPL, `.ogg`/`.m4a` format, drum
kits kept as `.wav`). Every instrument type supports overriding where
samples are loaded from, so self-hosting/mirroring is a supported,
documented path rather than a hack:

- `SplendidGrandPiano` (and similar) — `baseUrl` option; docs explicitly
  say to override it "only if you mirror the samples yourself".
- `Soundfont` — `instrumentUrl` for an alternate soundfont source.
- `Sampler` (most flexible) — either a `buffers` map of `{note: url}`,
  or a `preset` object with its own `baseUrl`.
- `Soundfont2` — `url` for a custom `.sf2` file.
- `storage` option (`CacheStorage()`, via the browser Cache API) caches
  fetched samples locally regardless of source.

For Strype (client-side, aims to work offline) this means: vendor the
chosen instrument sample set(s) alongside Strype's other static assets
and point `baseUrl`/`buffers` at that, rather than depending on
`smpldsnds.github.io` at runtime. **Still to do:** pick which instrument
sample set(s) to bundle, and check the license of each individual sample
collection permits redistribution (it's "mixed, per file" for some
soundfont-derived collections on smpldsnds).

## What the user (Neil) wants

- A Python-facing API roughly like:
  `make_midi_sound(list_of_notes_and_timing, instrument=default)`
  returning a `Sound` object (so it composes with the existing
  `Sound` API in `sound.py` — `play()`, `download()`,
  `get_samples()`/`set_samples()`, etc.)
- A choice of instrument (not just a single fixed synth voice).
- Confirmed preference: prefer self-hosting/mirroring instrument sample
  data over relying on a third-party CDN at runtime.

## Next steps (not yet started)

1. Decide which smplr instrument(s)/sample set(s) to support at launch
   (start small — e.g. piano + a couple of others — rather than all 128
   GM instruments) and confirm their sample licenses allow bundling.
2. Vendor the chosen sample set(s) into Strype's static assets and wire
   up a custom `baseUrl`/`buffers` config instead of the default CDN.
3. Add a JS/TS bridge module (parallel to the sound one) exposing
   something like `renderMidiToAudioBuffer(notes, instrument)` built on
   smplr's `renderOffline()`.
4. Add `pysrc/strype/midi.py` (parallel to `sound.py`) exposing
   `make_midi_sound()` (and instrument listing/selection), calling the
   new bridge via `strype_bridge`.
5. Decide/spec the exact shape of `list_of_notes_and_timing` (note name
   vs MIDI number, start time vs delta time, duration, velocity, etc.)
   — not yet discussed with Neil.
6. Add Cypress/Playwright coverage once the feature exists, following
   this repo's e2e conventions (see `CLAUDE.md`).

## Where this was discussed

This plan was written up from a Claude Code conversation on the
`flaky-tests` branch (2026-07-14) that investigated Python/JS MIDI
library options; the branch itself (`midi-support`) was created fresh
from `github-upstream/main` since no implementation work had started
yet.
