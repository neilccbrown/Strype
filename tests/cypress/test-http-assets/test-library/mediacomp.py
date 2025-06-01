import strype.graphics as _graphics
import strype.sound as _sound

def makePicture(path):
    # type: (str) -> _graphics.Image
    return _graphics.load_image(path)

def makeEmptySoundBySeconds(duration):
    # type: (float) -> _sound.Sound
    return None

