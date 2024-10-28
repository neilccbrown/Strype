import strype_graphics_internal as _strype_graphics_internal
import strype_graphics_input_internal as _strype_input_internal
import math as _math
import collections as _collections

def in_bounds(x, y):
    """
    Checks if the given X, Y position is in the visible bounds of (-400,-300) inclusive to (400, 300) exclusive 
    :param x: 
    :param y: 
    :return: A boolean indicating whether it is in the visible bounds
    """
    return -400 <= x < 400 and -300 <= y < 300

class Actor:
    # Private attributes:
    # __id: the identifier of the PersistentImage that represents this actor on screen.  Should never be None
    # __say: the identifier of the PersistentImage with the current speech bubble for this actor.  Is None when there is no current speech.
    # Note that __say can be removed on the Javascript side without our code executing, due to a timeout.  So
    # whenever we use it, we should check it's still actually present.
    
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
        self.__say = None
        _strype_graphics_internal.setImageLocation(self.__id, x, y)
        _strype_graphics_internal.setImageRotation(self.__id, 0)
    def set_location(self, x, y):
        _strype_graphics_internal.setImageLocation(self.__id, x, y)
        self._update_say_position()
    def set_rotation(self, deg):
        _strype_graphics_internal.setImageRotation(self.__id, deg)
        # Note: no need to update say position if we are just rotating
    def set_scale(self, scale):
        _strype_graphics_internal.setImageScale(self.__id, scale)
        self._update_say_position()
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
        self.set_location(cur['x'] + amount * _math.cos(rot), cur['y'] - amount * _math.sin(rot))
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
    def say(self, text, font_size = 20, max_width = 300, max_height = 200):
        """
        Add a speech bubble next to the actor with the given text.  The only required parameter is the
        text, all the others can be omitted.  The text will be wrapped if it reaches max_width (unless you
        set max_width to 0).  If it then overflows max_height, the font size will be reduced until the text fits
        in both max_width and max_height.  Wrapping will only occur at spaces, so if you have long text like
        "Aaaaaarrrggghhhh" and want it to wrap you may need to add a space in there. 
        
        To remove the speech bubble later, call `say("")` (that is, with a blank string).  You can also consider
        using `say_for` if you want the speech to display for a fixed time.
        
        :param text: The text to be displayed in the speech bubble.  You can use \n to separate lines.
        :param font_size: The font size to try to display at
        :param max_width: The maximum width to fit the speech into (excluding padding which is added to make the speech bubble)
        :param max_height: The maximum height to fit the speech into (excluding padding which is added to make the speech bubble)
        """
        
        # Remove any existing speech bubble:
        if self.__say is not None and _strype_graphics_internal.imageExists(self.__say):
            _strype_graphics_internal.removeImage(self.__say)
            self.__say = None
        # Then add a new one if text is not blank:
        if text:
            padding = 10
            # We first make an image just with the text on, which also tells us the size:
            textOnlyImg = EditableImage(max_width, max_height)
            textOnlyImg.set_fill("white")
            textOnlyImg.fill()
            textOnlyImg.set_fill("black")
            textDimensions = textOnlyImg.draw_text(text, 0, 0, font_size, max_width, max_height)
            # Now we prepare an image of the right size plus padding:
            sayImg = EditableImage(textDimensions.width + 2 * padding, textDimensions.height + 2 * padding)
            # We draw a rounded rect for the background, then draw the text on:
            sayImg.set_fill("white")
            sayImg.set_stroke("#555555FF")
            sayImg.rounded_rect(0, 0, textDimensions.width + 2 * padding, textDimensions.height + 2 * padding, padding)
            sayImg.draw_part_of_image(textOnlyImg, padding, padding, 0, 0, textDimensions.width, textDimensions.height)
            self.__say = _strype_graphics_internal.addImage(sayImg._EditableImage__image)
            self._update_say_position()
            
    def _update_say_position(self):
        # Update the speech bubble position to be relative to our new position and scale:
        if self.__say is not None and _strype_graphics_internal.imageExists(self.__say):
            say_dim = _strype_graphics_internal.getImageSize(self.__say)
            our_dim = _strype_graphics_internal.getImageSize(self.__id)
            scale = _strype_graphics_internal.getImageScale(self.__id)
            width = our_dim['width'] * scale
            height = our_dim['height'] * scale
            # Based on where speech bubbles generally appear, we try the following in order:
            placements = [
                    [1, 1],  # Above right
                    [-1, 1], # Above left
                    [0, 1],  # Above centered
                    [1, 0],  # Right
                    [-1, 0], # Left
                    [1, -1], # Below right
                    [-1, -1],# Below left
                    [-1, 0], # Below
                    [0, 0],  # Centered
                ]
            for p in placements:
                # Note, we halve the width/height of the actor because we're going from centre of actor,
                # but we do not halve the width/height of the say here because we want to see if the whole bubble fits:
                fits = in_bounds(self.get_x() + p[0]*(width/2 + say_dim['width']), self.get_y() + p[1]*(height/2 + say_dim['height']))
                # If it fits or its our last fallback:
                if fits or p == [0,0] :
                    # Here we do halve both widths/heights because we are placing the centre:
                    _strype_graphics_internal.setImageLocation(self.__say, self.get_x() + p[0]*(width/2 + say_dim['width']/2), self.get_y() + p[1]*(height/2 + say_dim['height']/2))
                    break
        else:
            self.__say = None

    def say_for(self, text, seconds, font_size = 16, max_width = 300, max_height = 200):
        """
        Like the `say` function, but automatically removes the speech bubble after the given number of seconds.  For all
        other parameters, see the `say` function for an explanation.
        
        Any other calls to `say()` or `say_for()` will override the current timed removal.
                
        :param text: The text to display in the speech bubble
        :param seconds: The number of seconds to display it for.
        :param font_size: See `say`
        :param max_width: See `say`
        :param max_height: See `say`
        """
        self.say(text, font_size, max_width, max_height)
        _strype_graphics_internal.removeImageAfter(self.__say, seconds)

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

class Dimension:
    def __init__(self, width, height):
        self.width = width
        self.height = height

class EditableImage:
    """
    An editable image of fixed width and height.
    """
    def __init__(self, width, height):
        """
        Creates an editable image with the given dimensions, with transparent content. 
        :param width: The width of the image in pixels
        :param height: The height of the image in pixels
        """
        
        # Note: for internal purposes we sometimes don't want to make an image, so we pass -1,-1 for that case:
        if width > 0 and height > 0:
            self.__image = _strype_graphics_internal.makeCanvasOfSize(width, height)
            self.clear_rect(0, 0, width, height)
            _strype_graphics_internal.canvas_setFill(self.__image, "white")
            _strype_graphics_internal.canvas_setStroke(self.__image, "black")
        else:
            self.__image = None
    def fill(self):
        """
        Fills the image with the current fill color (see `set_fill`)
        """
        dim = _strype_graphics_internal.getCanvasDimensions(self.__image)
        _strype_graphics_internal.canvas_fillRect(self.__image, 0, 0, dim[0], dim[1])
    def set_fill(self, color):
        """
        Sets the current fill color for future fill operations (but does not do any filling).
        :param fill: A color that is either an HTML color name (e.g. "magenta"), an HTML hex string (e.g. "#ff00c0") or a :class:`Color` object
        """
        if isinstance(color, Color):
            _strype_graphics_internal.canvas_setFill(self.__image, color.to_html())
        elif isinstance(color, str):
            _strype_graphics_internal.canvas_setFill(self.__image, color)
        else:
            raise TypeError("Fill must be either a string or a Color")
    def set_stroke(self, color):
        """
        Sets the current stroke/outline color for future shape-drawing operations (but does not draw anything).
        :param fill: A color that is either an HTML color name (e.g. "magenta"), an HTML hex string (e.g. "#ff00c0") or a :class:`Color` object
        """
        if isinstance(color, Color):
            _strype_graphics_internal.canvas_setStroke(self.__image, color.to_html())
        elif isinstance(color, str):
            _strype_graphics_internal.canvas_setStroke(self.__image, color)
        else:
            raise TypeError("Stroke must be either a string or a Color")
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
    def clear_rect(self, x, y, width, height):
        _strype_graphics_internal.canvas_clearRect(self.__image, x, y, width, height)
    def draw_image(self, image, x, y):
        dim = _strype_graphics_internal.getCanvasDimensions(image._EditableImage__image)
        _strype_graphics_internal.canvas_drawImagePart(self.__image, image._EditableImage__image, x, y, 0, 0, dim[0], dim[1])
    def draw_part_of_image(self, image, x, y, sx, sy, width, height):
        _strype_graphics_internal.canvas_drawImagePart(self.__image, image._EditableImage__image, x, y, sx, sy, width, height)
    def get_width(self):
        return _strype_graphics_internal.getCanvasDimensions(self.__image)[0]
    def get_height(self):
        return _strype_graphics_internal.getCanvasDimensions(self.__image)[1]
    
    def draw_text(self, text, x, y, font_size, max_width, max_height):
        dim = _strype_graphics_internal.canvas_drawText(self.__image, text, x, y, font_size, max_width, max_height)
        return Dimension(dim['width'], dim['height'])
    def rounded_rect(self, x, y, width, height, corner_size):
        """
        Draws a rectangle with rounded corners.  The edge of the rectangle is drawn in the current outline color
        (see `set_outline`) and filled in the current fill color (see `set_fill`).  The corners are rounded using
        quarter-circles with radius of `corner_size`.
        :param x: The top-left of the rounded rectangle
        :param y: The bottom-right of the rounded rectangle
        :param width: The width of the rounded rectangle
        :param height: The height of the rounded rectangle
        :param corner_size: The radius of the corners of the rounded rectangle
        """
        _strype_graphics_internal.canvas_roundedRect(self.__image, x, y, width, height, corner_size)

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
