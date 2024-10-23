import strype_sound_internal as _strype_sound_internal

def play_sound(filename):
    _strype_sound_internal.playOneOffSound(filename)

class Sound:
    def __init__(self, source_or_seconds, samples_per_second = 44100):
        if isinstance(source_or_seconds, (int, float)):
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
