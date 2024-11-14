import strype_graphics_internal as _strype_graphics_internal
import strype_graphics_input_internal as _strype_input_internal
import math as _math
import collections as _collections
import time as _time

def in_bounds(x, y):
    """
    Checks if the given X, Y position is in the visible bounds of (-400,-300) inclusive to (400, 300) exclusive.
    
    :param x: The x position to check
    :param y: The y position to check
    :return: A boolean indicating whether it is in the visible bounds: True if it is in bounds, False if it is not.
    """
    return -400 <= x < 400 and -300 <= y < 300

class Actor:
    """
    An Actor is an item in the world with a specific image, position, rotation and scale.  Everything you want to show up
    in your graphics must be an Actor.  
    """
    # Private attributes:
    # __id: the identifier of the PersistentImage that represents this actor on screen.  Should never be None
    # __editable_image: the editable image of this actor, if the user has ever called edit_image() on us.
    # __name: the user-supplied name of the actor.  Useful to leave the type flexible, we just pass it in and out.
    # __say: the identifier of the PersistentImage with the current speech bubble for this actor.  Is None when there is no current speech.
    # Note that __say can be removed on the Javascript side without our code executing, due to a timeout.  So
    # whenever we use it, we should check it's still actually present.
    
    def __init__(self, image_or_filename, x = 0, y = 0, name = None):
        """
        Construct an Actor with a given image and position and an optional name.
        
        Note: if you pass an EditableImage, this Actor will use a reference to it for its display.  This means
        if you make any changes to that EditableImage, it will update the Actor's image.  If you pass
        the same EditableImage to multiple Actors, they will all update when you edit it.  If you do not want this
        behaviour then call `make_copy()` on the EditableImage as you pass it in.
        
        :param image_or_filename: Either a string with an image name (from Strype's built-in images), a string with a URL (e.g. "https://example.com/example.png") or an EditableImage 
        :param x: The X position at which to add the actor
        :param y: The Y position at which to add the actor
        :param name: The name to give the actor
        """
        if isinstance(image_or_filename, EditableImage):
            self.__id = _strype_graphics_internal.addImage(image_or_filename._EditableImage__image, self)
            self.__editable_image = image_or_filename
        elif isinstance(image_or_filename, str):
            self.__id = _strype_graphics_internal.addImage(_strype_graphics_internal.loadAndWaitForImage(image_or_filename), self)
            self.__editable_image = None
        else:
            raise TypeError("Actor constructor parameter must be string or EditableImage")
        self.__say = None
        self.__name = name
        _strype_graphics_internal.setImageLocation(self.__id, x, y)
        _strype_graphics_internal.setImageRotation(self.__id, 0)
        
    def set_location(self, x, y):
        """
        Sets the position of the actor to be the given x, y position.
        
        :param x: The new X position of the actor
        :param y: The new Y position of the actor
        """
        _strype_graphics_internal.setImageLocation(self.__id, x, y)
        self._update_say_position()
        
    def set_rotation(self, deg):
        """
        Sets the rotation of the actor to be the given rotation in degrees.  This changes the rotation of
        the actor's image and also affects which direction the actor will travel if you call `turn()`.
        
        :param deg: The rotation in degrees (0 points right, 90 points up, 180 points left, 270 points down).
        """
        _strype_graphics_internal.setImageRotation(self.__id, deg)
        # Note: no need to update say position if we are just rotating
        
    def set_scale(self, scale):
        """
        Sets the actor's scale (size multiplier).  The default is 1, larger values make it bigger (for example, 2 is double size),
        and smaller values make it smaller (for example, 0.5 is half size).  It must be a positive number greater than zero.
        
        :param scale: The new scale to set, replacing the old scale.
        """
        if scale <= 0:
            raise ValueError("Scale must be greater than zero")
        _strype_graphics_internal.setImageScale(self.__id, scale)
        self._update_say_position()
        
    def get_rotation(self):
        """
        Gets the current rotation of this Actor.
        
        :return: The rotation of this Actor, in degrees.
        """
        return _strype_graphics_internal.getImageRotation(self.__id)
    
    def get_scale(self):
        """
        Gets the current scale of this Actor.
        
        :return: The scale of this Actor, where 1.0 is the default scale. 
        """
        return _strype_graphics_internal.getImageScale(self.__id, scale)
    def get_name(self):
        """
        Gets the name of this actor.
        
        :return: The name of this actor, as passed to the constructor or `set_name()` call.
        """
        return self.__name
    def set_name(self, name):
        """
        Sets the name of this actor.  Actor names are typically strings, but they do not
        have to be.
        
        :param name: The new name of the actor
        """
        self.__name = name
    
    def remove(self):
        """
        Removes the actor from the world.  There is no way to re-add the actor to the world.
        """
        _strype_graphics_internal.removeImage(self.__id)
        
    def get_x(self):
        """
        Gets the X position of the actor as an integer (whole number).  If the actors current position
        is not a whole number, it is rounded down (towards zero).  If you want the exact position as a potentially
        fractional number, call `get_exact_x()` instead.
        
        :return: The current X position, rounded down to an integer (whole number). 
        """
        
         # Gets X with rounding (towards zero):
        return int(_strype_graphics_internal.getImageLocation(self.__id)['x'])
    
    def get_y(self):
        """
        Gets the Y position of the actor as an integer (whole number).  If the actors current position
        is not a whole number, it is rounded down (towards zero).  If you want the exact position as a potentially
        fractional number, call `get_exact_y()` instead.
        
        :return: The current Y position, rounded down to an integer (whole number). 
        """
        # Gets Y with rounding (towards zero):
        return int(_strype_graphics_internal.getImageLocation(self.__id)['y'])
    
    def get_exact_x(self):
        """
        Gets the exact X position of the actor, which may be a fractional number.  If you do not need this accuracy,
        you may prefer to call `get_x()` instead.
         
        :return: The exact X position
        """
        # Gets X with no rounding:
        return _strype_graphics_internal.getImageLocation(self.__id)['x']
    
    def get_exact_y(self):
        """
        Gets the exact Y position of the actor, which may be a fractional number.  If you do not need this accuracy,
        you may prefer to call `get_y()` instead.
         
        :return: The exact Y position
        """
        # Gets Y with no rounding:
        return _strype_graphics_internal.getImageLocation(self.__id)['y']
    
    def move(self, amount):
        """
        Move forwards the given amount in the current direction that the actor is heading.  If you want to change
        this direction, you can call `set_rotation()` or `turn()`.
        
        :param amount: The amount of pixels to move forwards.  Negative amounts move backwards.
        """
        cur = _strype_graphics_internal.getImageLocation(self.__id)
        rot = _math.radians(_strype_graphics_internal.getImageRotation(self.__id))
        self.set_location(cur['x'] + amount * _math.cos(rot), cur['y'] - amount * _math.sin(rot))
        
    def turn(self, degrees):
        """
        Changes the actor's current rotation by the given amount of degrees.
        
        :param degrees: The change in rotation, in degrees.  Positive amounts turn anti-clockwise, negative amounts turn clockwise.
        """
        self.set_rotation(_strype_graphics_internal.getImageRotation(self.__id) + degrees)
        
    def is_touching(self, actor):
        """
        Checks if this actor is touching the given actor.  Two actors are deemed to be touching if the
        rectangles of their images are overlapping (even if the actor is transparent at that point).
        
        Note that if either this actor or the given actor has had collisions turned off with
        `set_can_touch(false)` then this function will return False even if they touch.
        
        :param actor: The actor to check for overlap
        :return: True if this actor overlaps that actor, False if it does not 
        """
        return _strype_input_internal.checkCollision(self.__id, actor.__id)
    
    def set_can_touch(self, can_touch):
        """
        Changes whether the actor is part of the collision detection system.
        
        If you turn it off then this actor will never show up in the collision checking.
        You may want to do this if you have an actor which makes no sense to collide (such
        as a score board, or game over text), and/or to speed up the simulation for actors
        where you don't need collision detection (e.g. visual effects).
        
        :param can_touch: Whether this actor can participate in collisions.
        """
        _strype_input_internal.setCollidable(self.__id, can_touch)
    
    def get_all_touching(self):
        """
        Gets all the actors that this actor is touching.  If this actor has had `set_can_touch(false)`
        called, the returned list will always be empty.  The list will never feature any actors
        which have had `set_can_touch(false)` called on them.
        
        :return: A list of all touching actors.
        """
        return _strype_input_internal.getAllTouchingAssociated(self.__id)
    
    def edit_image(self):
        """
        Return an EditableImage which can be used to edit this actor's image.  All modifications
        to the returned image will be shown for this actor automatically.  If you call this function multiple times
        you will get the same EditableImage returned.
        
        :return: An EditableImage with the current Actor image already drawn in it 
        """
        # Note: we don't want to have an editable image by default because it is slower to render
        # the editable canvas than to render the unedited image (I think!?)
        if self.__editable_image is None:
            # The -1, -1 sizing indicates we will set the image ourselves afterwards:
            self.__editable_image = EditableImage(-1, -1)
            self.__editable_image._EditableImage__image = _strype_graphics_internal.makeImageEditable(self.__id) 
        return self.__editable_image
    
    def say(self, text, font_size = 20, max_width = 300, max_height = 200, font_family = None):
        """
        Add a speech bubble next to the actor with the given text.  The only required parameter is the
        text, all the others can be omitted.  The text will be wrapped if it reaches max_width (unless you
        set max_width to 0).  If it then overflows max_height, the font size will be reduced until the text fits
        in both max_width and max_height.  Wrapping will only occur at spaces, so if you have long text like
        "Aaaaaarrrggghhhh" and want it to wrap you may need to add a space in there. 
        
        To remove the speech bubble later, call `say("")` (that is, with a blank string).  You can also consider
        using `say_for` if you want the speech to display for a fixed time.
        
        :param text: The text to be displayed in the speech bubble.  You can use \\n to separate lines.
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
            textDimensions = textOnlyImg.draw_text(text, 0, 0, font_size, max_width, max_height, font_family)
            # Now we prepare an image of the right size plus padding:
            sayImg = EditableImage(textDimensions.width + 2 * padding, textDimensions.height + 2 * padding)
            # We draw a rounded rect for the background, then draw the text on:
            sayImg.set_fill("white")
            sayImg.set_stroke("#555555FF")
            sayImg.rounded_rectangle(0, 0, textDimensions.width + 2 * padding, textDimensions.height + 2 * padding, padding)
            sayImg.draw_part_of_image(textOnlyImg, padding, padding, 0, 0, textDimensions.width, textDimensions.height)
            self.__say = _strype_graphics_internal.addImage(sayImg._EditableImage__image, None)
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


def _round_and_clamp_0_255(number):
    return min(max(int(round(number)), 0), 255)

class Color:
    """
    A Color class with members red, green, blue, alpha, in the range 0--255.
    """
    def __init__(self, red, green, blue, alpha = 255):
        """
        Constructs a color value with the given red, green, blue and alpha values.  If they are below 0 they will be treated
        as if they were 0, and if they are above 255 they will be treated as if they were 255.  Fractional numbers will
        be converted to a whole number.
        
        :param red: The red value, from 0 (none) to 255 (most).
        :param green: The green value, from 0 (none) to 255 (most).
        :param blue: The blue value, from 0 (none) to 255 (most). 
        :param alpha: The alpha value.  Alpha represents transparency.  0 means fully transparent which is rarely what you want.  255 means non-transparent.  Values inbetween indicate the amount of transparency.
        """
        self.red = _round_and_clamp_0_255(red)
        self.green = _round_and_clamp_0_255(green)
        self.blue = _round_and_clamp_0_255(blue)
        self.alpha = _round_and_clamp_0_255(alpha)
        
    def to_html(self):
        """
        Get the HTML version of this Color, in the format #RRGGBBAA where each pair is 2 hexadecimal digits.
        
        :return: The HTML version of this Color as string.
        """
        r = _round_and_clamp_0_255(self.red)
        g = _round_and_clamp_0_255(self.green)
        b = _round_and_clamp_0_255(self.blue)
        a = _round_and_clamp_0_255(self.alpha)
        return "#{:02x}{:02x}{:02x}{:02x}".format(r, g, b, a) 

class Dimension:
    """
    A dimension value indicating a width and a height, for example the size of an image.
    """
    def __init__(self, width, height):
        """
        Constructs a dimension value with the given width and height.
        
        :param width: The width.
        :param height: The height.
        """
        self.width = width
        self.height = height

class EditableImage:
    # Attributes:
    # __image: A Javascript OffscreenCanvas, but from the Python end it is only
    #          passed back to Javascript calls.

    # Tracks the rate limiting for downloads:
    __last_download = _time.time()
        
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
        
        :param fill: A color that is either an HTML color name (e.g. "magenta"), an HTML hex string (e.g. "#ff00c0"), a :class:`Color` object, or None if you want to turn off filling
        """
        if isinstance(color, Color):
            _strype_graphics_internal.canvas_setFill(self.__image, color.to_html())
        elif isinstance(color, str) or color is None:
            _strype_graphics_internal.canvas_setFill(self.__image, color)
        else:
            raise TypeError("Fill must be either a string or a Color but was " + str(type(color)))
        
    def set_stroke(self, color):
        """
        Sets the current stroke/outline color for future shape-drawing operations (but does not draw anything).
        
        :param fill: A color that is either an HTML color name (e.g. "magenta"), an HTML hex string (e.g. "#ff00c0"), a :class:`Color` object, or None if you want to turn off the stroke
        """
        if isinstance(color, Color):
            _strype_graphics_internal.canvas_setStroke(self.__image, color.to_html())
        elif isinstance(color, str) or color is None:
            _strype_graphics_internal.canvas_setStroke(self.__image, color)
        else:
            raise TypeError("Stroke must be either a string or a Color but was " + str(type(color)))
        
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
        """
        Sets the pixel at the given x, y position to be the given color.
         
        :param x: The x position of the pixel (must be an integer) 
        :param y: The y position of the pixel (must be an integer)
        :param color: The color to set.  This must be a :class:`Color` object.
        """
        _strype_graphics_internal.canvas_setPixel(self.__image, x, y, (color.red, color.green, color.blue, color.alpha))
        
    def bulk_get_pixels(self):
        """
        Gets the values of the pixels of the image in one large array.  Index 0 in the array is the red value,
        of the pixel at the top-left (0,0) in the image.  Indexes 1, 2 and 3 are the green, blue and alpha of that pixel.
        Index 4 is the red value of the pixel at (1, 0) in the image.  So the values are sets of four (RGBA in that order)
        for each pixel, and at the end of the first row it starts at the left of the second row.
        
        :return: An array of 0-255 values organised as described above.
        """
        return _strype_graphics_internal.canvas_getAllPixels(self.__image)
    
    def bulk_set_pixels(self, rgba_array):
        """
        Sets the values of the pixels from RGBA values in one giant array.  The pixels should be arranged as described
        in `bulk_get_pixels()`.  The array should thus be of length width * height * 4.
        
        :param rgba_array: An array of 0-255 RGBA values organised as described above.
        """
        _strype_graphics_internal.canvas_setAllPixelsRGBA(self.__image, rgba_array)
        
    def clear_rect(self, x, y, width, height):
        """
        Clears the given rectangle (i.e. sets all the pixels to be fully transparent).
        
        :param x: The left X coordinate of the rectangle (inclusive).
        :param y: The top Y coordinate of the rectangle (inclusive).
        :param width: The width of the rectangle
        :param height: The height of the rectangle.
        """
        _strype_graphics_internal.canvas_clearRect(self.__image, x, y, width, height)
        
    def draw_image(self, image, x, y):
        """
        Draws the entire given image into this image, at the given top-left x, y position.  If you only want to draw
        part of the image, use `draw_part_of_image()`.
        
        :param image: The image to draw from, into this image.  Must be an EditableImage.
        :param x: The left X coordinate to draw the image at.
        :param y: The top Y coordinate to draw the image at.
        """
        dim = _strype_graphics_internal.getCanvasDimensions(image._EditableImage__image)
        _strype_graphics_internal.canvas_drawImagePart(self.__image, image._EditableImage__image, x, y, 0, 0, dim[0], dim[1])
        
    def draw_part_of_image(self, image, x, y, sx, sy, width, height):
        """
        Draws part of the given image into this image.
        
        :param image: The image to draw from, into this image.  Must be an EditableImage.
        :param x: The left X coordinate to draw the image at.
        :param y: The top Y coordinate to draw the image at.
        :param sx: The left X coordinate within the source image to draw from.
        :param sy: The top Y coordinate within the source image to draw from.
        :param width: The width of the area to draw from.
        :param height: The height of the area to draw from.
        """
        _strype_graphics_internal.canvas_drawImagePart(self.__image, image._EditableImage__image, x, y, sx, sy, width, height)
        
    def get_width(self):
        """
        Gets the width of this image.
        
        :return: The width of this image, in pixels. 
        """
        return _strype_graphics_internal.getCanvasDimensions(self.__image)[0]
    
    def get_height(self):
        """
        Gets the height of this image.
        
        :return: The height of this image, in pixels. 
        """
        return _strype_graphics_internal.getCanvasDimensions(self.__image)[1]
    
    def draw_text(self, text, x, y, font_size, max_width = 0, max_height = 0, font_family = None):
        """
        Draws text on the editable image.  You can specify an optional maximum width and maximum height.  If you specify a max_width
        greater than zero then the text will be wrapped at whitespace to try to fit it into the given width.  If the text still doesn't
        fit, or it doesn't fit in to max_height (where max_height is greater than 0), the font size will be progressively shrunk 
        (down to a minimum size of 8 pixels) to try to make it fit.  But it is possible with awkward text (e.g. one long word
        like "Aaaaaarrrghhhh!!") that it still may not fit in the given size.
        
        Note that text is colored using the fill (see `set_fill()`) not the stroke.  Text drawing is done by filling the shape of the letters,
        not outlining like a stencil. 
        
        :param text: The text to draw
        :param x: The x position of the top-left
        :param y: The y position of the top-left
        :param font_size: The size of the text to draw, in pixels
        :param max_width: The maximum width of the text (or 0 if you do not want a maximum width)
        :param max_height: The maximum height of the text (or 0 if you do not want a maximum height)
        :param font_family: If None, then the default font family is used.  To change this, pass your own FontFamily instance.
        """
        if font_family is not None and not isinstance(font_family, FontFamily):
            raise TypeError("Font family must be an instance of FontFamily")
        dim = _strype_graphics_internal.canvas_drawText(self.__image, text, x, y, font_size, max_width, max_height, font_family._FontFamily__font if font_family is not None else None)
        return Dimension(dim['width'], dim['height'])
    def rounded_rectangle(self, x, y, width, height, corner_size):
        """
        Draws a rectangle with rounded corners.  The edge of the rectangle is drawn in the current outline color
        (see `set_outline`) and filled in the current fill color (see `set_fill`).  The corners are rounded using
        quarter-circles with radius of `corner_size`.
        
        :param x: The top-left of the rounded rectangle.
        :param y: The bottom-right of the rounded rectangle.
        :param width: The width of the rounded rectangle.
        :param height: The height of the rounded rectangle.
        :param corner_size: The radius of the corners of the rounded rectangle.
        """
        _strype_graphics_internal.canvas_roundedRect(self.__image, x, y, width, height, corner_size)
    def rectangle(self, x, y, width, height):
        """
        Draws a rectangle.  The edge of the rectangle is drawn in the current stroke color
        (see `set_stroke`) and filled in the current fill color (see `set_fill`).
          
        :param x: The top-left of the rounded rectangle.
        :param y: The bottom-right of the rounded rectangle.
        :param width: The width of the rounded rectangle.
        :param height: The height of the rounded rectangle.
        """
        _strype_graphics_internal.canvas_roundedRect(self.__image, x, y, width, height, 0)
    def line(self, start_x, start_y, end_x, end_y):
        """
        Draws a line.  The line is drawn in the current stroke color.
        
        :param start_x: The starting X position.
        :param start_y: The starting Y position.
        :param end_x: The end X position.
        :param end_y: The end Y position.
        """
        _strype_graphics_internal.canvas_line(self.__image, start_x, start_y, end_x, end_y)
    def arc(self, centre_x, centre_y, width, height, angle_start, angle_amount):
        """
        Draws an arc (a part of an ellipse, an ellipse being a circle with a width than can be different than height).
        Imagine an ellipse with a given centre position and width and height.  The `angle_start` parameter
        is the angle from the centre to the start of the arc, in degrees (0 points to the right, positive values go clockwise),
        and the `angle_amount` is the amount of degrees to travel (positive goes clockwise, negative goes anti-clockwise) to
        the end point.
        
        The arc will be filled with the current fill (see `set_fill()`) and drawn in the current stroke (see `set_stroke()`).
        
        :param centre_x: The centre X position of the arc.
        :param centre_y: The centre Y position of the arc.
        :param width: The width of the ellipse that describes the arc.
        :param height: The height of the ellipse that describes the arc.
        :param angle_start: The starting angle of the arc, in degrees (0 points to the right).
        :param angle_amount: The amount of degrees to travel (positive goes clockwise).
        """
        _strype_graphics_internal.canvas_arc(self.__image, centre_x, centre_y, width, height, angle_start, angle_amount)

    def make_copy(self):
        """
        Makes a copy of this EditableImage with the same width and height,
        and the same image content.
        
        :return: The new copy of the EditableImage 
        """
        copy = EditableImage(self.get_width(), self.get_height())
        copy.draw_image(self, 0, 0)
        return copy
    
    def download(self, filename="strype-image"):
        """
        Triggers a download of this image as a PNG image file.  You can optionally
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
        if now < EditableImage.__last_download + 2:
            _time.sleep(EditableImage.__last_download + 2 - now)
        _strype_graphics_internal.canvas_downloadPNG(self.__image, filename)
        EditableImage.__last_download = _time.time()

class FontFamily:
    """
    A font family is a particular font type, e.g. Arial or Courier.
    """
    def __init__(self, font_provider, font_name):
        """
        Loads the given font name from the given font provider.  At the moment, the only font provider which is supported is
        "google", meaning `Google Fonts <https://fonts.google.com>`.  So if you find a particular font you like on Google Fonts, say Roboto, you can load it
        by calling:
        
        .. code-block:: python
            FontFamily("google", "Roboto") 
            
        If the font cannot be loaded, you will get an error.  This usually indicates either an issue with your Internet connection, or that you have entered the font name wrongly.
          
        :param font_provider: The provider of the fonts.  Currently only "google" is supported.
        :param font_name: The name of the font to load, as shown on that provider.
        """
        if not _strype_graphics_internal.canvas_loadFont(font_provider, font_name):
            raise Exception("Could not load font " + font_name)
        self.__font = font_name

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
