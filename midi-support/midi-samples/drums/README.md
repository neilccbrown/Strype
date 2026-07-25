# Drum samples for Strype music support

These `.m4a` files are the **Casio RZ-1** drum machine kit (12 one-shot
samples: clap, clave, cowbell, crash, hihat-closed, hihat-open, kick, ride,
snare, tom-1, tom-2, tom-3), vendored here so Strype can render drum audio
offline without depending on a third-party CDN at runtime. We only vendor
`.m4a` (AAC), not `.ogg`: every mainstream browser (including Safari, which
can't decode Ogg Vorbis at all) can decode AAC, so there's no need for a
second format.

Note: smplr's own `DrumMachine` instrument hardcodes its format list to
`["ogg", "m4a"]` with no way to override it, so `sound_manager.ts` doesn't
use `DrumMachine` directly — it builds the same preset via smplr's exported
`drumMachineToPreset()` helper, overrides `samples.formats` to `["m4a"]`,
and loads it through the generic `Sampler` instrument instead.

- License: public domain (per the
  [smpldsnds/drum-machines](https://github.com/smpldsnds/drum-machines)
  README: "A collection of public domain samples of different drum
  machines").
- Each filename (without extension) is the alias passed as the `note` when
  playing that drum, e.g. `"kick"`.
- Fetched from: `https://smpldsnds.github.io/drum-machines/Casio-RZ1/`
