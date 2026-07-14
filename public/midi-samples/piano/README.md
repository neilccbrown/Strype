# Piano samples for Strype MIDI support

These `.ogg` files are the "MF" (mezzo-forte) velocity layer of the
**Splendid Grand Piano** sample set, vendored here so Strype can render
MIDI piano audio offline without depending on a third-party CDN at runtime.

- Original samples: Public domain Steinway piano samples released by AKAI
  in the early 2000s.
- Repackaged/converted (to SFZ + ogg/m4a) as "Splendid Grand Piano" by the
  [sfzinstruments](https://github.com/sfzinstruments/jlearman.jRhodes3d)
  and [smpldsnds](https://github.com/smpldsnds/sfzinstruments-splendid-grand-piano)
  projects, and used by the [smplr](https://github.com/danigb/smplr)
  JS library as its default `SplendidGrandPiano` instrument.
- License: public domain (per the smpldsnds README for this sample set).
- Fetched from: `https://smpldsnds.github.io/sfzinstruments-splendid-grand-piano/samples/`

Only the MF (velocity 85-100) layer is vendored (62 files, ~5.6MB) to keep
the bundle small; smplr pitch-shifts these samples to cover notes and
velocities that aren't sampled directly. If more dynamic range is wanted
later, the other layers (PPP, PP, MP, FF) can be fetched the same way from
the URL above.
