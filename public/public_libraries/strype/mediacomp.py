import collections as _collections
import graphics as _graphics
import math as _math
import sound as _sound
from public.public_libraries.strype.graphics import EditableImage


###############################################################################
# Sound functions:
###############################################################################

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


###############################################################################
# Picture functions:
###############################################################################

# Helper classes:
# Color is a class with RGBA 0--255 members red, green, blue, alpha
Pixel = _collections.namedtuple("Pixel", ("picture", "x", "y", "color"))

MainImage = None

def addArc(picture, startX, startY, width, height, start, angle, color="black"):
    """
    Adds an outline of an arc starting at (x,y) at an initial angle of "start"with the given width and height. The angle of the arc itself is "angle", which is relativeto "start." Default color is black.
    
    :param picture: The picture to draw the arc on.
    :param startX: The x-coordinate of the arc's center.
    :param startY: The y-coordinate of the arc's center.
    :param width: The width of the arc.
    :param height: The height of the arc.
    :param start: The start angle of the arc in degrees.
    :param angle: The angle of the arc relative to start in degrees.
    :param color: The color to draw the arc in (default: black).
    """
    picture.set_fill(None)
    picture.set_stroke(color)
    picture.arc(startX, startY, width, height, start, angle)

def addArcFilled(picture, startX, startY, width, height, start, angle, color="black"):
    """
    Adds a filled arc starting at (x,y) at an initial angle of "start" with thegiven width and height. The angle of the arc itself is "angle", which is relative to "start."
    
    :param picture: The picture to draw the arc on.
    :param startX: The x-coordinate of the arc's center.
    :param startY: The y-coordinate of the arc's center.
    :param width: The width of the arc.
    :param height: The height of the arc.
    :param start: The start angle of the arc in degrees.
    :param angle: The angle of the arc relative to start in degrees.
    :param color: The color to draw the arc in (default: black).
    """
    picture.set_fill(color)
    picture.set_stroke(color)
    picture.arc(startX, startY, width, height, start, angle)

def addLine(picture, startX, startY, endX, endY, color="black"):
    """
    Draws a line on the picture.
    :param picture: The picture to draw the line on.
    :param startX: The x-coordinate where the line starts.
    :param startY: The y-coordinate where the line starts.
    :param endX: The x-coordinate where the line ends.
    :param endY: The y-coordinate where the line ends.
    :param color: The color to draw the line in (default: black).
    """
    pass

def addOval(picture, startX, startY, width, height, color="black"):
    """
    Draws an outline of an oval on the picture.
    :param picture: The picture to draw the oval on.
    :param startX: The x-coordinate of the upper left corner of the bounding rectangle.
    :param startY: The y-coordinate of the upper left corner of the bounding rectangle.
    :param width: The width of the oval.
    :param height: The height of the oval.
    :param color: The color to draw the oval in (default: black).
    """
    picture.set_fill(None)
    picture.set_stroke(color)
    picture.arc(startX, startY, width, height, 0, 360)

def addOvalFilled(picture, startX, startY, width, height, color="black"):
    """
    Draws a filled oval on the picture.
    :param picture: The picture to draw the oval on.
    :param startX: The x-coordinate of the upper left corner of the bounding rectangle.
    :param startY: The y-coordinate of the upper left corner of the bounding rectangle.
    :param width: The width of the oval.
    :param height: The height of the oval.
    :param color: The color to draw the oval in (default: black).
    """
    picture.set_fill(color)
    picture.set_stroke(color)
    picture.arc(startX, startY, width, height, 0, 360)

def addRect(picture, startX, startY, width, height, color="black"):
    """
    Draws an outline of a rectangle on the picture.
    :param picture: The picture to draw the rectangle on.
    :param startX: The x-coordinate of the upper left corner of the rectangle.
    :param startY: The y-coordinate of the upper left corner of the rectangle.
    :param width: The width of the rectangle.
    :param height: The height of the rectangle.
    :param color: The color to draw the rectangle in (default: black).
    """
    pass

def addRectFilled(picture, startX, startY, width, height, color="black"):
    """
    Draws a filled rectangle on the picture.
    :param picture: The picture to draw the rectangle on.
    :param startX: The x-coordinate of the upper left corner of the rectangle.
    :param startY: The y-coordinate of the upper left corner of the rectangle.
    :param width: The width of the rectangle.
    :param height: The height of the rectangle.
    :param color: The color to draw the rectangle in (default: black).
    """
    pass

def addText(picture, xpos, ypos, text, color="black"):
    """
    Draws text on the picture.
    :param picture: The picture to add the text to.
    :param xpos: The x-coordinate where the text begins.
    :param ypos: The y-coordinate where the text begins.
    :param text: The text to display.
    :param color: The color of the text (default: black).
    """
    pass

def addTextWithStyle(picture, xpos, ypos, text, style, color="black"):
    """
    Draws styled text on the picture.
    :param picture: The picture to add the text to.
    :param xpos: The x-coordinate where the text begins.
    :param ypos: The y-coordinate where the text begins.
    :param text: The text to display.
    :param style: The font style (see makeStyle).
    :param color: The color of the text (default: black).
    """
    pass

def copyInto(smallPicture, bigPicture, startX, startY):
    """
    Copies a smaller picture into a larger one.
    :param smallPicture: The picture to be pasted.
    :param bigPicture: The picture to paste onto.
    :param startX: The x-coordinate in bigPicture to place smallPicture.
    :param startY: The y-coordinate in bigPicture to place smallPicture.
    """
    pass

def distance(color1, color2):
    """
    Returns the Cartesian distance between two colors.
    :param color1: The first color.
    :param color2: The second color.
    :return: The distance between the two colors.
    """
    if not isinstance(color1, _graphics.Color) or not isinstance(color2, _graphics.Color):
        raise TypeError
    r = pow((color1.red - color2.red), 2)
    g = pow((color1.green - color2.green), 2)
    b = pow((color1.blue - color2.blue), 2)
    return _math.sqrt(r + g + b)

def duplicatePicture(picture):
    """
    Creates a duplicate of the given picture.
    :param picture: The picture to duplicate.
    :return: A new picture object identical to the original.
    """
    dupe = EditableImage(getWidth(picture), getHeight(picture))
    dupe.draw_image(picture, 0, 0)
    return dupe

def getColor(pixel):
    """
    Gets the color of a pixel.
    :param pixel: The pixel to get the color from.
    :return: The color of the pixel.
    """
    return pixel.color

def getRed(pixel):
    """
    Gets the red value of a pixel.
    :param pixel: The pixel to extract red from.
    :return: The red component (0-255).
    """
    return pixel.color.red

def getGreen(pixel):
    """
    Gets the green value of a pixel.
    :param pixel: The pixel to extract green from.
    :return: The green component (0-255).
    """
    return pixel.color.green

def getBlue(pixel):
    """
    Gets the blue value of a pixel.
    :param pixel: The pixel to extract blue from.
    :return: The blue component (0-255).
    """
    return pixel.color.blue

def getHeight(picture):
    """
    Returns the height of the picture.
    :param picture: The picture to measure.
    :return: The height in pixels.
    """
    return picture.get_height()

def getPixels(picture):
    """
    Takes a picture as input and returns the sequence of Pixel objects in the picture.
    :param picture: The picture you want to get the pixels from.
    :return: A list of all the pixels in the picture.
    """
    return [getPixelAt(picture, x, y) for y in range(picture.get_height()) for x in range(picture.get_width())]

def getPixel(picture, x, y):
    """
    Gets a pixel from a specific position in the picture.
    
    :param picture: The picture to get the pixel from.
    :param xpos: The x-coordinate of the pixel.
    :param ypos: The y-coordinate of the pixel.
    :return: The pixel object.
    """
    return Pixel(picture, x, y, picture.get_pixel(x, y))

def getPixelAt(picture, xpos, ypos):
    """ Same as getPixelAt. """
    return getPixel(picture, xpos, ypos)

def getWidth(picture):
    """
    Returns the width of the picture.
    :param picture: The picture to measure.
    :return: The width in pixels.
    """
    return picture.get_width()


def getX(pixel):
    """
    Gets the X position of a pixel within its picture
    :param pixel: The pixel to find the X-coordinate of
    :return: The X coordinate of the pixel.
    """
    return pixel.x

def getY(pixel):
    """
    Gets the Y position of a pixel within its picture
    :param pixel: The pixel to find the Y-coordinate of
    :return: The Y coordinate of the pixel.
    """
    return pixel.y

def _scaleColor(color, scaleFactor):
    r = color.red * scaleFactor
    g = color.green * scaleFactor
    b = color.blue * scaleFactor
    return _graphics.Color(r, g, b)

def makeBrighter(color):
    """
    Returns a brighter version of the color.
    :param color: The color to brighten.
    :return: The brightened color.
    """
    if color.red == 0 and color.green == 0 and color.blue == 0:
        # Special case -- black gets lighted to very dark gray
        lighterColor = _graphics.Color(3,3,3)
    else:
        # Scale color values by 10/7
        lighterColor = _scaleColor(color, 10.0/7.0)
        if max([lighterColor.red, lighterColor.green, lighterColor.blue]) <= 2:
            # if all color values are 2 or less we need to adjust them
            c = [lighterColor.red, lighterColor.green, lighterColor.blue]
            for i in range(3):
                if c[i] > 0 and c[i] < 2:
                    c[i] += 3
                elif c[i] > 0 and c[i] == 2:
                    c[i] += 2
            lighterColor = _graphics.Color(c[0], c[1], c[2])
        return lighterColor


def makeDarker(color):
    """
    Returns a darker version of the color.
    :param color: The color to darken.
    :return: The darkened color.
    """
    return _scaleColor(color, 7.0/10.0)

def makeColor(red, green=0, blue=0):
    """
    Creates a color from RGB values.
    :param red: The red component (0-255).
    :param green: The green component (optional, 0-255).
    :param blue: The blue component (optional, 0-255).
    :return: The created color.
    """
    return _graphics.Color(red, green, blue, 255)

def makeEmptyPicture(width, height, color="white"):
    """
    Creates an empty picture with specified dimensions and color.
    :param width: The width of the picture.
    :param height: The height of the picture.
    :param color: The background color (default: white).
    :return: The empty picture.
    """
    img = _graphics.EditableImage(width, height)
    img.set_fill(color)
    img.fill()
    return img

def makePicture(path):
    """
    Takes a filename as input, reads the file, and creates a picture from it. Returns the picture.
    :param path: the name of the file you want to open as a picture
    :return: a picture object made from the file
    """
    return _graphics.load_image("mediacomp/" + path)


def makeStyle(fontName, emphasis, size):
    """
    Takes a font name, emphasis, and size in points as input. Returns a Font object with thegiven parameters.
    :param fontName: The name of the font (e.g., "sansSerif").
    :param emphasis: The emphasis (e.g., "italic").
    :param size: The font size.
    :return the style made from the inputs
    """
    pass

def pickAColor():
    """
    Opens a color chooser dialog box for the user to pick a color.

    :return: The color chosen by the user.
    :rtype: Color
    """
    pass


def pickAFile():
    """
    Opens a file chooser dialog box for the user to pick a file.

    :return: The complete path to the selected file as a string.
    :rtype: str
    """
    pass


def setColor(pixel, color):
    """
    Sets the specified color to a pixel.

    :param pixel: The pixel to set the color for.
    :type pixel: Pixel
    :param color: The color to apply to the pixel.
    :type color: Color
    """
    pixel.picture.set_pixel(pixel.x, pixel.y, color)


def repaint(picture):
    """
    Repaints the picture. Opens a new window if the picture has not been shown.

    :param picture: The picture to repaint.
    :type picture: Picture
    """
    pass


def setAllPixelsToAColor(picture, color):
    """
    Sets every pixel in the picture to the specified color.

    :param picture: The picture to modify.
    :type picture: Picture
    :param color: The color to apply to each pixel.
    :type color: Color
    """
    pass


def setRed(pixel, redValue):
    """
    Sets the red component of a pixel.

    :param pixel: The pixel to modify.
    :type pixel: Pixel
    :param redValue: The new red value (0 - 255).
    :type redValue: int
    """
    setColor(pixel, _graphics.Color(redValue, pixel.color.green, pixel.color.blue, pixel.color.alpha))

def setGreen(pixel, greenValue):
    """
    Sets the green component of a pixel.

    :param pixel: The pixel to modify.
    :type pixel: Pixel
    :param greenValue: The new green value (0 - 255).
    :type greenValue: int
    """
    setColor(pixel, _graphics.Color(pixel.color.red, greenValue, pixel.color.blue, pixel.color.alpha))


def setBlue(pixel, blueValue):
    """
    Sets the blue component of a pixel.

    :param pixel: The pixel to modify.
    :type pixel: Pixel
    :param blueValue: The new blue value (0 - 255).
    :type blueValue: int
    """
    setColor(pixel, _graphics.Color(pixel.color.red, pixel.color.green, blueValue, pixel.color.alpha))


def setColorWrapAround(flag):
    """
    Sets the color wrap-around behavior.

    :param flag: Enables wrap-around for color values if True; restricts values to 0-255 if False.
    :type flag: bool
    :return: The new ColorWrapAround setting.
    :rtype: bool
    """
    pass


def getColorWrapAround():
    """
    Gets the current color wrap-around setting.

    :return: True if color wrap-around is enabled, False otherwise.
    :rtype: bool
    """
    pass


def show(picture):
    """
    Displays the specified picture.

    :param picture: The picture to display.
    :type picture: Picture
    """
    global MainImage
    if not MainImage:
        MainImage = _graphics.Actor(_graphics.EditableImage(800, 600), 0, 0).edit_image()
    MainImage.set_fill("white")
    MainImage.fill()
    MainImage.draw_image(picture, 0, 0)


def writePictureTo(picture, path):
    """
    Writes the picture to a file in JPEG, PNG, or BMP format.

    :param picture: The picture to save.
    :type picture: Picture
    :param path: The file path to save the picture to (include .jpg, .png, or .bmp extension).
    :type path: str
    """
    pass

# Color constants:
black = _graphics.Color(0, 0, 0, 255)
white = _graphics.Color(255, 255, 255, 255)
blue = _graphics.Color(0, 0, 255, 255)
red = _graphics.Color(255, 0, 0, 255)
green = _graphics.Color(0, 255, 0, 255)
gray = _graphics.Color(128, 128, 128, 255)
darkGray = _graphics.Color(64, 64, 64, 255)
lightGray = _graphics.Color(192, 192, 192, 255)
yellow = _graphics.Color(255, 255, 0, 255)
orange = _graphics.Color(255, 200, 0, 255)
pink = _graphics.Color(255, 175, 175, 255)
magenta = _graphics.Color(255, 0, 255, 255)
cyan = _graphics.Color(0, 255, 255, 255)
