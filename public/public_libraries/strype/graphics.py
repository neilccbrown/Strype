import strype_graphics_internal as _strype_graphics_internal
import strype_graphics_input_internal as _strype_input_internal
import math as _math
import collections as _collections

class Actor:
    def __init__(self, image_or_filename, x, y):
        """
        Construct an Actor with a given image and position.
        
        :param image_or_filename: Either a string with an image name (from Strype's built-in images), a string with a URL (e.g. "https://example.com/example.png") or an EditableImage 
        :param x: The X position at which to add the actor
        :param y: The Y position at which to add the actor
        """
        if isinstance(image_or_filename, EditableImage):
            self.__id = _strype_graphics_internal.addImage(image_or_filename._EditableImage__image)
        elif isinstance(image_or_filename, str):
            self.__id = _strype_graphics_internal.addImage(_strype_graphics_internal.loadAndWaitForImage(image_or_filename))
        else:
            raise TypeError("Actor constructor parameter must be string or EditableImage")
        _strype_graphics_internal.setImageLocation(self.__id, x, y)
        _strype_graphics_internal.setImageRotation(self.__id, 0)
    def set_location(self, x, y):
        _strype_graphics_internal.setImageLocation(self.__id, x, y)
    def set_rotation(self, deg):
        _strype_graphics_internal.setImageRotation(self.__id, deg)
    def set_scale(self, scale):
        _strype_graphics_internal.setImageScale(self.__id, scale)
    def remove(self):
        _strype_graphics_internal.removeImage(self.__id)
    def get_x(self):
         # Gets X with rounding (towards zero):
        return int(_strype_graphics_internal.getImageLocation(self.__id)['x'])
    def get_y(self):
        # Gets Y with rounding (towards zero):
        return int(_strype_graphics_internal.getImageLocation(self.__id)['y'])
    def get_exact_x(self):
        # Gets X with no rounding:
        return _strype_graphics_internal.getImageLocation(self.__id)['x']
    def get_exact_y(self):
        # Gets Y with no rounding:
        return _strype_graphics_internal.getImageLocation(self.__id)['y']
    def move(self, amount):
        cur = _strype_graphics_internal.getImageLocation(self.__id)
        rot = _math.radians(_strype_graphics_internal.getImageRotation(self.__id))
        self.set_location(cur['x'] + amount * _math.cos(rot), cur['y'] + amount * _math.sin(rot))
    def turn(self, degrees):
        self.set_rotation(_strype_graphics_internal.getImageRotation(self.__id) + degrees)
    def is_touching(self, actor):
        """
        Checks if this actor is touching the given actor.  Two actors are deemed to be touching if the
        rectangles of their images are overlapping (even if the actor is transparent at that point). 
        :param actor: The actor to check for overlap
        :return: True if this actor overlaps that actor, False if it does not 
        """
        return _strype_input_internal.checkCollision(self.__id, actor.__id)
    def edit_image(self):
        """
        Return an EditableImage which can be used to edit this actor's image.  All modifications
        to the returned image will be shown for this actor automatically.
        :return: An EditableImage with the current Actor image already drawn in it 
        """
        # The -1, -1 sizing indicates we will set the image ourselves afterwards:
        img = EditableImage(-1, -1)
        img._EditableImage__image = _strype_graphics_internal.makeImageEditable(self.__id) 
        return img

class Color:
    """
    A Color class with members red, green, blue, alpha, in the range 0--1.
    """
    def __init__(self, r, g, b, a):
        self.red = r
        self.green = g
        self.blue = b
        self.alpha = a
        
    def to_html(self):
        """
        Get the HTML version of this Color, in the format #RRGGBBAA where each pair is 2 hexadecimal digits.
        :return: The HTML version of this Color.
        """
        r = round(self.red * 255)
        g = round(self.green * 255)
        b = round(self.blue * 255)
        a = round(self.alpha * 255)
        return "#{:02x}{:02x}{:02x}{:02x}".format(r, g, b, a) 

class EditableImage:
    """
    An editable image of fixed width and height.
    """
    def __init__(self, width, height):
        """
        Creates an editable image with the given dimensions, filled black. 
        :param width: The width of the image in pixels
        :param height: The height of the image in pixels
        """
        if width > 0 and height > 0:
            self.__image = _strype_graphics_internal.makeCanvasOfSize(width, height)
        self.__fillColor = "black"
        self.fill()
    def fill(self):
        """
        Fills the image with the current fill color (see `set_fill`)
        """
        dim = _strype_graphics_internal.getCanvasDimensions(self.__image)
        _strype_graphics_internal.canvas_fillRect(self.__image, 0, 0, dim[0], dim[1], self.__fillColor)
    def set_fill(self, fill):
        """
        Sets the current fill color for future fill operations (but does not do any filling).
        :param fill: A color that is either an HTML color name (e.g. "magenta"), an HTML hex string (e.g. "#ff00c0") or a :class:`Color` object
        """
        if isinstance(fill, Color):
            self.__fillColor = fill.to_html()
        elif isinstance(fill, str):
            self.__fillColor = fill
        else:
            raise TypeError("Fill must be either a string or a Color")
    def get_pixel(self, x, y):
        """
        Gets a Color object with the color of the pixel at the given position.  If you want to change the color,
        you must call `set_pixel` rather than modifying the returned object.
        
        :param x: The X position within the image, in pixels
        :param y: The Y position within the image, in pixels
        :return: A Color object with the color of the given pixel
        """
        rgba = _strype_graphics_internal.canvas_getPixel(self.__image, int(x), int(y))
        return Color(rgba[0], rgba[1], rgba[2], rgba[3])
    def set_pixel(self, x, y, color):
        _strype_graphics_internal.canvas_setPixel(self.__image, x, y, (color.red, color.green, color.blue, color.alpha))
    def draw_image(self, image, x, y):
        dim = _strype_graphics_internal.getCanvasDimensions(image._EditableImage__image)
        _strype_graphics_internal.canvas_drawImagePart(self.__image, image._EditableImage__image, x, y, 0, 0, dim[0], dim[1])
    def get_width(self):
        return _strype_graphics_internal.getCanvasDimensions(self.__image)[0]
    def get_height(self):
        return _strype_graphics_internal.getCanvasDimensions(self.__image)[1]


def load_image(filename):
    """
    Loads the given image file as an EditableImage object.
    :param filename: The built-in Strype filename, or URL, of the image to load.
    :return: An EditableImage object with the same image and dimensions as the given file
    """
    img = EditableImage(-1, -1)
    img._EditableImage__image = _strype_graphics_internal.htmlImageToCanvas(_strype_graphics_internal.loadAndWaitForImage(filename))
    return img

def get_and_forget_clicked_actor():
    """
    Gets the last clicked Actor (or None if nothing was clicked since the last call to this function).  Be careful that if you call this twice
    in quick succession, the second call will almost certainly be None.  If you need to compare the result of this function
    to several other things, assign it to a variable first.
    :return: The most recently clicked Actor, or None if nothing was clicked since you last called this function.
    """
    return _strype_input_internal.getAndResetClickedItem()

def key_pressed(keyname):
    """
    Checks if the given key is currently pressed.  Note that because the user may be pressing and releasing keys all the time,
    consecutive calls to this function with the same key name may not give the same result.
    
    :param keyname: The name of the key.  This can be a single letter like "a" or a key name like "up", "down". 
    :return: Either True or False depending on whether the key is currently pressed.
    """
    return _collections.defaultdict(lambda: False, _strype_input_internal.getPressedKeys())[keyname]
