# Piano samples for Strype MIDI support

These `.m4a` files are the "MF" (mezzo-forte) velocity layer of the
**Splendid Grand Piano** sample set, vendored here so Strype can render
MIDI piano audio offline without depending on a third-party CDN at runtime.
We only vendor `.m4a` (AAC), not `.ogg`: every mainstream browser (including
Safari, which can't decode Ogg Vorbis at all) can decode AAC, so there's no
need for a second format. `sound_manager.ts` passes `formats: ["m4a"]` to
smplr's `SplendidGrandPiano` explicitly, rather than relying on its default
ogg/m4a-by-browser fallback, since that fallback assumes both are present.

- Original samples: Public domain Steinway piano samples released by AKAI
  in the early 2000s.
- Repackaged/converted (to SFZ + ogg/m4a) as "Splendid Grand Piano" by the
  [sfzinstruments](https://github.com/sfzinstruments/jlearman.jRhodes3d)
  and [smpldsnds](https://github.com/smpldsnds/sfzinstruments-splendid-grand-piano)
  projects, and used by the [smplr](https://github.com/danigb/smplr)
  JS library as its default `SplendidGrandPiano` instrument.
- License: public domain (per the smpldsnds README for this sample set).
- Fetched from: `https://smpldsnds.github.io/sfzinstruments-splendid-grand-piano/samples/`

Only the MF (velocity 85-100) layer is vendored (62 files, ~6.7MB) to keep
the bundle small; smplr pitch-shifts these samples to cover notes and
velocities that aren't sampled directly. If more dynamic range is wanted
later, the other layers (PPP, PP, MP, FF) can be fetched the same way from
the URL above (only the `.m4a` version of each file is needed).
