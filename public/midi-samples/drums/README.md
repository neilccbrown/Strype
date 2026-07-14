# Drum samples for Strype music support

These `.ogg` files are the **Casio RZ-1** drum machine kit (12 one-shot
samples: clap, clave, cowbell, crash, hihat-closed, hihat-open, kick, ride,
snare, tom-1, tom-2, tom-3), vendored here so Strype can render drum audio
offline without depending on a third-party CDN at runtime.

- License: public domain (per the
  [smpldsnds/drum-machines](https://github.com/smpldsnds/drum-machines)
  README: "A collection of public domain samples of different drum
  machines").
- Used by the [smplr](https://github.com/danigb/smplr) JS library's
  `DrumMachine` instrument; each filename (without extension) is the alias
  passed as the `note` when playing that drum, e.g. `"kick"`.
- Fetched from: `https://smpldsnds.github.io/drum-machines/Casio-RZ1/`
