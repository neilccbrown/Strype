import sound as _sound


# Sound functions:

# Helper functions for sound:
def _to_short(value_minus_one_to_one):
    return int(-32768 + (value_minus_one_to_one + 1) * (65535 / 2))
def _from_short(short):
    return max(-32768, min(32767, (short + 32768) / 65535.0 * 2 - 1))

# Helper classes:
class Sample:
    def __init__(self, sound, index):
        self.__sound = sound
        self.__index = index
    
# Full set from Mark:

def blockingPlay(sound):
    """
    :param sound: the sound that you want to play.
    Plays the sound provided as input, and makes sure that no other sound plays at the exact same time. (Try two play's right after each other.)
    """
    sound.play_and_wait()


def duplicateSound(sound):
    """
    :param sound: the sound you want to duplicate
    :returns: a new Sound object with the same Sample values as the original
    Takes a sound as input and returns a new Sound object with the same Sample values as the original.
    """
    new_sound = makeEmptySound(getLength(sound), getSamplingRate(sound))
    # Might be a bit slow but we can always optimise later:
    for i in range(0, getLength(sound)):
        setSampleValueAt(new_sound, i, getSampleValueAt(sound, i))


def getDuration(sound):
    """
    :param sound: the sound you want to find the length of (in seconds)
    :returns: the number of seconds the sound lasts
    Takes a sound as input and returns the number of seconds that sound lasts.
    """
    return getLength(sound) * getSamplingRate(sound)


def getLength(sound):
    """
    :param sound: the sound you want to find the length of (how many samples it has)
    :returns: the number of samples in sound
    Takes a sound as input and returns the number of samples in that sound.
    """
    return sound.get_num_samples()


def getNumSamples(sound):
    """
    :param sound: the sound you want to find the length of (how many samples it has)
    :returns: the number of samples in sound
    Takes a sound as input and returns the number of samples in that sound. (Same as getLength)
    """
    return getLength(sound)


def getSampleObjectAt(sound, index):
    """
    :param sound: the sound you want to get the sample from
    :param index: the index value of the sample you want to get
    :returns: the sample object at that index
    Takes a sound and an index (an integer value), and returns the Sample object at that index.
    """
    return Sample(sound, index)


def getSamples(sound):
    """
    :param sound: the sound you want to get the samples from
    :returns: a list of all the samples in the sound
    Takes a sound as input and returns the Samples in that sound.
    """
    return [Sample(sound, index) for index in range(0, getNumSamples(sound))]


def getSampleValue(sample):
    """
    :param sample: a sample of a sound
    :returns: the integer value of that sample
    Takes a Sample object and returns its value (between -32768 and 32767). (Formerly getSample)
    """
    return getSampleValueAt(sample._Sample__sound, sample._Sample__index)


def getSampleValueAt(sound, index):
    """
    :param sound: the sound you want to get the sample from
    :param index: the index of the sample you want to get the value of
    Takes a sound and an index (an integer value), and returns the value of the sample (between -32768 and 32767) for that object.
    """
    return _to_short(sound.get_samples()[index])


def getSamplingRate(sound):
    """
    :param sound: the sound you want to get the sampling rate from
    :returns: the integer value representing the number of samples per second
    Takes a sound as input and returns the number representing the number of samples in each second for the sound.
    """
    return sound.get_sample_rate()


def getSound(sample):
    """
    :param sample: a sample belonging to a sound
    :returns: the sound the sample belongs to
    Takes a Sample object and returns the Sound that it belongs to.
    """
    return sample._Sample__sound


def makeEmptySound(numSamples, samplingRate=22050):
    """
    :param numSamples: the number of samples in sound
    :param samplingRate: the integer value representing the number of samples per second of sound (optional)
    :returns: An Empty Sound.
    Takes one or two integers as input. Returns an empty Sound object with the given number of samples and (optionally) the given sampling rate. Default rate is 22050 bits/second. The resulting sound must not be longer than 600 seconds. Prints an error statement if numSamples or samplingRate are less than 0, or if (numSamples/samplingRate) > 600.
    """
    return _sound.Sound(numSamples / samplingRate, samplingRate)


def makeEmptySoundBySeconds(duration, samplingRate=22050):
    """
    :param duration: the time in seconds for the duration of the sound
    :param samplingRate: the integer value representing the number of samples per second of sound (optional)
    :returns: An Empty Sound.
    Takes a floating point number and optionally an integer as input. Returns an empty Sound object of the given duration and (optionally) the given sampling rate. Default rate is 22050 bits/second. If the given arguments do not multiply to an integer, the number of samples is rounded up. Prints an error statement if duration or samplingRate are less than 0, or if duration > 600.
    """
    return _sound.Sound(duration, samplingRate)


def makeSound(path):
    """
    :param path: a string path of a wav file
    :returns: the sound created from the file at the given path
    Takes a filename as input, reads the file, and creates a sound from it. Returns the sound.
    """
    return _sound.Sound("mediacomp/" + path)

# Note: Not supported in browser.  (Could do this with cloud storage?)
#def pickAFile():
#    """
#    :returns: the string path to the file chosen in the dialog box
#    Opens a file chooser to let the user pick a file and returns the complete path name as a string. Takes no input.
#    """
#    pass


def play(sound):
    """
    :param sound: the sound you want to be played.
    Plays a sound provided as input. No return value.
    """
    sound.play()

# Note: currently unsupported, at Mark's suggestion
#def playNote(note, duration, intensity=64):
#    """
#    :param note: the MIDI note number, from 0 to 127 (60 = Middle C) you want to be played
#    :param duration: the duration you want the note to be played in milliseconds
#    :param intensity: the intensity (a number between 0 and 127) you want the note to be played (optional)
#    Plays the given note. No return value. Default intensity is 64.
#    """
#    pass


def setSampleValue(sample, value):
    """
    :param sample: the sound sample you want to change the value of
    :param value: the value you want to set the sample to
    Takes a Sample object and a value (should be between -32768 and 32767), and sets the sample to that value.
    """
    setSampleValueAt(sample._Sample__sound, sample._Sample__index, value)


def setSampleValueAt(sound, index, value):
    """
    :param sound: the sound you want to change a sample in
    :param index: the index of the sample you want to set
    :param value: the value you want to set the sample to
    Takes a sound, an index, and a value (should be between -32768 and 32767), and sets the value of the sample at the given index in the given sound to the given value.
    """
    sound.set_samples([_from_short(value)], index)


def stopPlaying(sound):
    """
    :param sound: the sound that you want to stop playing
    Stops a sound that is currently playing.
    """
    sound.stop()

# Note: currently unsupported (although it wouldn't be too hard to trigger a download?)
#def writeSoundTo(sound, path):
#    """
#    :param sound: the sound you want to write out to a file
#    :param path: the path to the file you want the picture written to
#    Takes a sound and a filename (a string) and writes the sound to that file as a WAV file. (Make sure that the filename ends in '.wav' if you want the operating system to treat it right.)
#    """
#    pass

