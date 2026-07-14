from strype_bridge import strype_sound_internal as _strype_sound_internal
import time as _time

_NOTE_LETTER_SEMITONE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}

def _note_name_to_midi(name):
    # type: (str) -> int
    name = name.strip()
    if len(name) < 1 or name[0].upper() not in _NOTE_LETTER_SEMITONE:
        raise ValueError("Invalid note name (expected e.g. \"C\", \"C4\", \"F#3\", \"Bb2\"): " + repr(name))
    semitone = _NOTE_LETTER_SEMITONE[name[0].upper()]
    rest = name[1:]
    if rest.startswith("#"):
        semitone += 1
        rest = rest[1:]
    elif rest.startswith("b"):
        semitone -= 1
        rest = rest[1:]
    if rest == "":
        # No octave given (e.g. "C", "F#"): default to the octave containing Middle C.
        octave = 4
    else:
        try:
            octave = int(rest)
        except ValueError:
            raise ValueError("Invalid note name (expected e.g. \"C\", \"C4\", \"F#3\", \"Bb2\"): " + repr(name))
    # Middle C (C4) is MIDI note 60, following the usual scientific pitch notation convention:
    return (octave + 1) * 12 + semitone

def _note_to_midi(note):
    if isinstance(note, str):
        return _note_name_to_midi(note)
    elif isinstance(note, (int, float)):
        return int(note)
    else:
        raise TypeError("Note should be a string (e.g. \"C4\") or a MIDI note number (0-127), but was: " + str(type(note)))

class Sound:
    # Tracks the rate limiting for downloads:
    __last_download = _time.time()
    # type: float
    # There is a __buffer member which is of type RemoteSound
    
    def __init__(self, samples, samples_per_second = 44100):
        # type: (float, float) -> None
        """
        Creates a new sound object.  The first parameter is a list of samples from -1 to +1,
        and the optional second parameter indicates the sample rate (samples per second).
                 
        :param samples: A list of sound samples with values ranging from -1 to +1.  This list should not be empty; if it is, a single sample of value 0 will be used.
        :param samples_per_second: The sampling rate in samples per second. 
        """
        if samples_per_second == -4242: # Magic number used internally to indicate source is already a RemoteSOund
            # Important this clause is first, because if it's a Javascript object, performing
            # Python isinstance checks will give an error.  Which is why we use a magic number rather than
            # inspecting the type of seconds ourselves:
            self.__buffer = samples
        elif isinstance(samples, list):
            self.__buffer = _strype_sound_internal.createAudioBufferFromSamples(samples, samples_per_second)
        elif isinstance(samples, (int, float)):
            # For backwards compatibility: passing a number gives a silent buffer of that many seconds:
            self.__buffer = _strype_sound_internal.createAudioBuffer(samples, samples_per_second)
        else:
            raise TypeError(f"Samples should be a list, but was: {type(samples)}")
    
    def get_num_samples(self):
        # type: () -> float
        """
        Gets the length of the sound, in samples.
        
        :return: The length of the sound, in number of samples.
        """
        return _strype_sound_internal.getNumSamples(self.__buffer)

    def get_duration(self):
        # type: () -> float
        """
        Gets the duration of the sound, in seconds.  This is calculated by dividing the number of samples by the sample rate.
        
        :return: The duration of the sound, in seconds.
        """
        return self.get_num_samples() / self.get_sample_rate()
    
    def get_samples(self):
        # type: () -> list[float]
        """
        Gets all the samples from the sound.  This will be a list of numbers, each in the range -1 to +1.       
        
        :return: All the samples from the sound 
        """
        # Because it's a [proxy] object, must convert to Python before returning it:
        return _strype_sound_internal.getSamples(self.__buffer).to_py()

    def set_samples(self, sample_list):
        # type: (list[float]) -> None
        """
        Replaces the contents of this sound with the given list of sample values (which should each be in the range -1 to +1, with 0 as the middle).
        This may change the length of the sound if the number of samples is different to the original
        number of samples.
        
        :param sample_list: The list of numbers (each in the range -1 to +1) to use for the sound, one per sample.
        """
        _strype_sound_internal.setSamples(self.__buffer, sample_list)

    def play(self):
        # type: () -> None
        """
        Starts playing the sound from the start, but returns immediately without waiting for the sound to finish playing.
        """
        _strype_sound_internal.startAudioBuffer(self.__buffer)

    def play_and_wait(self):
        # type: () -> None
        """
        Plays the sound.  Does not return until the sound has finished playing.
        """
        _strype_sound_internal.playAudioBufferAndWait(self.__buffer)
        
    def stop(self):
        # type: () -> None
        """
        Stops the sound that was previously played with `play()`, if it is still playing.
        """
        _strype_sound_internal.stopAudioBuffer(self.__buffer)
        
    def copy_to_mono(self):
        # type: () -> Sound
        """
        Returns a copy of this sound which is mono (i.e. one channel, rather than left/right).
        
        If you want to work with the sound via `get_samples()` and `set_samples()`, you can only do this on a mono sound.
        
        :return: A copy of this sound (leaving this sound unmodified) with the content of this one converted to mono.
        """
        return Sound(_strype_sound_internal.copyToMono(self.__buffer), -4242)

    def clone(self):
        # type: () -> Sound
        """
        Returns a copy of this sound.
        
        :return: A copy of this sound (leaving this sound unmodified).
        """
        return Sound(_strype_sound_internal.copy(self.__buffer), -4242)

    def get_sample_rate(self):
        # type: () -> float
        """
        Gets the number of samples per second in the sound.  This can be different for different sound files.
        
        :return: The number of samples per second in the sound.
        """
        return _strype_sound_internal.getSampleRate(self.__buffer)

    def download(self, filename="strype-sound"):
        # type: (str) -> None
        """
        Triggers a download of this sound as a WAV sound file.  You can optionally
        pass a file name (you do not need to include the file extension, Strype
        will add that automatically).  To help you distinguish downloads
        from repeated runs, Strype will automatically add a timestamp to the file.
        
        To avoid problems with accidentally calling this method too often, Strype
        will limit the rate of downloads to at most one every 2 seconds.
        
        :param filename: The main part of the filename to use for the downloaded file.
        """
        # We add a kind of rate limiter for downloads.  This is not necessary from a technical perspective,
        # but imagine the user accidentally puts their download inside a tight loop; they may trigger the
        # download of 100 files before they realised what has happened.  I'm not sure if browsers will
        # protect against this.  So we protect against this by limiting downloads to only happening every
        # 2 seconds.  It's easier to do this on the Python side than on the Javascript side (where we'd have
        # to mess with promises and Skulpt suspensions.  This is already wrapped up into the Python time
        # module anyway:        
        now = _time.time()
        # If it's less than 2 seconds since last download, wait:
        if now < Sound.__last_download + 2:
            _time.sleep(Sound.__last_download + 2 - now)
        _strype_sound_internal.downloadWAV(self.__buffer, filename)
        Sound.__last_download = _time.time()

def load_sound(source):
    # type: (str) -> Sound
    """
    Loads the given sound file as a Sound object.

    Note that most browsers will resample loaded sounded files to a fixed rate (44100 or 48000).
    So the sample rate of a loaded sound file will probably not match the original file you are loading from.
    You can call get_sample_rate() on the loaded sound to get the actual sample rate.       
    
    Note: you can pass a filename for the sound, which is a sound name from Strype's sound library,
        or a URL to an image.  Using a URL requires the server to allow remote loading from Javascript via a feature
        called CORS.   Many servers do not allow this, so you may get an error even if the URL is valid and
        you can load the sound in a browser yourself.

    :param source: The filename or URL to a sound file 
    :return: The loaded sound
    """
    # If they mistakenly try to load a sound (e.g. a literal) just let it through:
    if isinstance(source, Sound):
        return source
    import re
    if source.startswith("http:") or source.startswith("https:") or source.startswith("data:")  or source.startswith(":") or (":" not in source and re.match(r'^[^./]+\.[^/]+/.+', source)):
        buffer = _strype_sound_internal.loadAndWaitForAudioBuffer(source)
    else:
        # We load it from our virtual file system, either the current dir or /strype/graphics/
        # To pass it on, it's probably faster to turn it into a data URL than e.g. read bytes
        # and pass a long list of numbers which Pyodide has to convert item by array item to Javascript: 
        import base64
        import mimetypes

        # If both fail, it will give an informative error (no such file):
        try:
            with open(source, "rb") as f:
                encoded = base64.b64encode(f.read()).decode("ascii")
        except:
            with open("/sounds/" + source, "rb") as f:
                encoded = base64.b64encode(f.read()).decode("ascii")
        mime_type, _ = mimetypes.guess_type(source)
        buffer = _strype_sound_internal.loadAndWaitForAudioBuffer(f"data:{mime_type};base64,{encoded}")

    return Sound(buffer, -4242)

_DRUM_INSTRUMENT_NAME = "drums"

def get_instrument_names():
    # type: () -> list[str]
    """
    Gets the list of instrument names that can be passed to make_music() or make_advanced_music().

    :return: A list of available instrument names.
    """
    return ["piano", "guitar", _DRUM_INSTRUMENT_NAME]

def _note_to_bridge_value(note, instrument):
    if instrument == _DRUM_INSTRUMENT_NAME:
        # Drum "notes" are the name of the drum sound to hit (e.g. "kick", "snare"), not a pitch,
        # so we pass them through unchanged rather than treating them as a note name/number.
        return note
    return _note_to_midi(note)

def make_music(notes, instrument="piano"):
    # type: (list, str) -> Sound
    """
    Renders a simple tune into a Sound, using the given instrument.  The notes are played one
    after another, each one starting as soon as the previous one finishes.

    Each item in notes should be a (note, duration) pair:

    - note: a note name such as "C", "F#" or "Bb" (no octave number needed; a default
      octave is used), or a note number (an integer from 0 to 127, where Middle C is 60).
      Use "" or None for a rest: nothing is played, but the next note will still start
      only after this duration has passed.
    - duration: how long the note (or rest) should last, in seconds.

    For example, to play Middle C for half a second, then wait half a second in silence,
    then play the D above Middle C for half a second::

        make_music([("C", 0.5), ("", 0.5), ("D", 0.5)])

    If you need more control (notes that overlap, start at a specific time, use a different
    instrument per note, or vary the velocity), use make_advanced_music() instead; note that
    make_advanced_music() does not support rests in this way.

    :param notes: A list of notes to play; see above for the format of each item.
    :param instrument: The name of the instrument to play the notes with.  See get_instrument_names() for the available options.
    :return: A Sound with the given notes rendered using the given instrument.
    """
    advanced_notes = []
    start_time = 0
    for note, duration in notes:
        if note != "" and note is not None:
            advanced_notes.append((note, start_time, duration))
        start_time = start_time + duration
    return make_advanced_music(advanced_notes, instrument)

def make_advanced_music(notes, main_instrument="piano"):
    # type: (list, str) -> Sound
    """
    Renders a list of notes into a Sound, with full control over timing, instrument and velocity
    for each individual note.  If you just want a simple tune played on one instrument, one note
    after another, use make_music() instead.

    Each item in notes should be a tuple or list of the form (note, start_time, duration),
    (note, start_time, duration, instrument) or (note, start_time, duration, instrument, velocity):

    - note: a note name such as "C4", "F#3" or "Bb2", or a note number (an integer from 0 to 127,
      where Middle C is 60).  For the "drums" instrument, this should instead be the name of the
      drum sound to hit, e.g. "kick" or "snare" (see get_instrument_names() for how to find these).
    - start_time: the time (in seconds, measured from the start of the sound) at which the note should begin.
      Notes can overlap (e.g. to play a chord, or to have different instruments playing at once).
    - duration: how long the note should last, in seconds.
    - instrument: optional; which instrument plays this note.  Defaults to main_instrument if not given.
    - velocity: optional; how hard the note is struck, from 0 to 127 (default 100).  This mainly affects the volume of the note.

    For example, to play Middle C on the piano at the same time as a low guitar note::

        make_advanced_music([("C4", 0, 1, "piano"), ("E2", 0, 1, "guitar")])

    :param notes: A list of notes to play; see above for the format of each item.
    :param main_instrument: The instrument to use for any note that doesn't specify its own instrument.  See get_instrument_names() for the available options.
    :return: A Sound with the given notes rendered using the given instrument(s).
    """
    if main_instrument not in get_instrument_names():
        raise ValueError("Unknown instrument " + repr(main_instrument) + ".  Available instruments: " + str(get_instrument_names()))

    # We pass five parallel lists of plain values across the bridge (rather than e.g. a list of
    # dictionaries), because Pyodide's Python-to-JS marshalling of nested containers is unreliable:
    note_values = []
    times = []
    durations = []
    velocities = []
    instruments = []
    for item in notes:
        if len(item) == 3:
            note, start_time, duration = item
            instrument = main_instrument
            velocity = 100
        elif len(item) == 4:
            note, start_time, duration, instrument = item
            velocity = 100
        elif len(item) == 5:
            note, start_time, duration, instrument, velocity = item
        else:
            raise ValueError("Each note should be a (note, start_time, duration), (note, start_time, duration, instrument) or (note, start_time, duration, instrument, velocity) tuple/list, but was: " + str(item))
        if instrument not in get_instrument_names():
            raise ValueError("Unknown instrument " + repr(instrument) + ".  Available instruments: " + str(get_instrument_names()))
        note_values.append(_note_to_bridge_value(note, instrument))
        times.append(float(start_time))
        durations.append(float(duration))
        velocities.append(int(velocity))
        instruments.append(instrument)

    buffer = _strype_sound_internal.renderMidiToAudioBuffer(note_values, times, durations, velocities, instruments)
    return Sound(buffer, -4242)
