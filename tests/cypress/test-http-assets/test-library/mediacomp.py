import strype.graphics as _graphics
import strype.sound as _sound

def makePicture(path):
    # type: (str) -> _graphics.Image
    """
    Takes a filename as input, reads the file, and creates a picture from it. Returns the picture.
    :param path: the name of the file you want to open as a picture
    :return: a picture object made from the file
    """
    return _graphics.load_image(path)

def makeSound(path):
    # type: (str) -> _sound.Sound
    """
    :param path: a string path of a wav file
    :returns: the sound created from the file at the given path
    Takes a filename as input, reads the file, and creates a sound from it. Returns the sound.
    """
    return None

def makeEmptySoundBySeconds(duration):
    # type: (float) -> _sound.Sound
    return None

class Pixel:
    def __init__(self, picture, x, y, index):
        # type: (str, int, int, int) -> None
        self.picture = picture
        self.x = x
        self.y = y
        self.__index = index
        self.__color = None
    def get_color(self):
        # type: () -> str
        return self.__color
    def set_color(self, color):
        # type: (str) -> None
        pass
