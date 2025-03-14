import strype_sound_internal as _strype_sound_internal

class Sound:
    def __init__(self, seconds, samples_per_second = 44100):
        """
        Creates a new silent/empty sound object.  The first parameter indicates
        a length in seconds, and the optional second parameter indicates the sample rate (samples per second).
                 
        :param seconds: A numeric value to indicate the sound's length in seconds. 
        :param samples_per_second: If the first parameter is a number, this is the sampling rate in samples per second. 
        """
        if samples_per_second == -4242: # Magic number used internally to indicate source is already an audio buffer
            # Important this clause is first, because if it's a Javascript object, performing
            # Python isinstance checks will give an error.  Which is why we use a magic number rather than
            # inspecting the type of source_or_seconds ourselves:
            self.__buffer = seconds
        elif isinstance(seconds, (int, float)):
            self.__buffer = _strype_sound_internal.createAudioBuffer(seconds, samples_per_second)
        else:
            raise TypeError(f"Sound length must be a number, but was: {type(seconds)}")
    
    def get_num_samples(self):
        """
        Gets the length of the sound, in samples.
        
        :return: The length of the sound, in number of samples.
        """
        return _strype_sound_internal.getNumSamples(self.__buffer)
    
    def get_samples(self):
        """
        Gets all the samples from the sound.  This will be a list of numbers, each in the range -1 to +1.       
        
        :return: All the samples from the sound 
        """
        return _strype_sound_internal.getSamples(self.__buffer)

    def set_samples(self, sample_list, copy_to_sample_index):
        """
        Copies the given list of sample values (which should each be in the range -1 to +1, with 0 as the middle)
        to the given point in the destination sound.  It is okay if the list does not reach to the end of the sound,
        but you will get an error if the list reaches beyond the end of the sound.
        
        :param sample_list: The list of numbers (each in the range -1 to +1) to copy to the sound, one per sample.
        :param copy_to_sample_index: The index at which to start copying the sounds into
        """
        _strype_sound_internal.setSamples(self.__buffer, sample_list, copy_to_sample_index)

    def play(self):
        """
        Starts playing the sound from the start, but returns immediately without waiting for the sound to finish playing.
        """
        _strype_sound_internal.playAudioBuffer(self.__buffer)

    def play_and_wait(self):
        """
        Plays the sound.  Does not return until the sound has finished playing.
        """
        _strype_sound_internal.playAudioBufferAndWait(self.__buffer)
        
    def stop(self):
        """
        Stops the sound that was previously played with `play()`, if it is still playing.
        """
        _strype_sound_internal.stopAudioBuffer(self.__buffer)
        
    def copy_to_mono(self):
        """
        Returns a copy of this sound which is mono (i.e. one channel, rather than left/right).
        
        If you want to work with the sound via `get_samples()` and `set_samples()`, you can only do this on a mono sound.
        
        :return: A copy of this sound (leaving this sound unmodified) with the content of this one converted to mono.
        """
        return Sound(_strype_sound_internal.copyToMono(self.__buffer), -4242)

    def get_sample_rate(self):
        """
        Gets the number of samples per second in the sound.  This can be different for different sound files.
        
        :return: The number of samples per second in the sound.
        """
        return _strype_sound_internal.getSampleRate(self.__buffer)

#@@ Sound
def load_sound(source):
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
    buffer = _strype_sound_internal.loadAndWaitForAudioBuffer(source)
    return Sound(buffer, -4242)
