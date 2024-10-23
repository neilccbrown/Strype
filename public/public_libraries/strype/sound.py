import strype_sound_internal as _strype_sound_internal

def play_sound(filename):
    _strype_sound_internal.playOneOffSound(filename)

class Sound:
    def __init__(self, source_or_seconds, samples_per_second = 44100):
        if samples_per_second == -4242: # Magic number used internally to indicate source is already an audio buffer
            # Important this clause is first, because if it's a Javascript object, performing
            # Python isinstance checks will give an error
            self.__buffer = source_or_seconds
        elif isinstance(source_or_seconds, (int, float)):
            self.__buffer = _strype_sound_internal.createAudioBuffer(source_or_seconds, samples_per_second)
        elif isinstance(source_or_seconds, str):
            self.__buffer = _strype_sound_internal.loadAndWaitForAudioBuffer(source_or_seconds)
        else:
            raise TypeError("Sound source must be a number or a string")
    
    def get_num_samples(self):
        return _strype_sound_internal.getNumSamples(self.__buffer)
    
    def get_samples(self):
        return _strype_sound_internal.getSamples(self.__buffer)

    def set_samples(self, samples, copy_to_sample):
        _strype_sound_internal.setSamples(self.__buffer, samples, copy_to_sample)

    def play(self):
        _strype_sound_internal.playAudioBuffer(self.__buffer)
        
    def copy_to_mono(self):
        """
        Returns a copy of this sound which is mono (i.e. one channel, rather than left/right).
        
        If you want to work with the sound via `get_samples()` and `set_samples()`, you can only do this on a mono sound.
        
        :return: A copy of this sound (leaving this sound unmodified) with the content of this one converted to mono.
        """
        return Sound(_strype_sound_internal.copyToMono(self.__buffer), -4242)
