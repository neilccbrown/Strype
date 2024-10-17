import strype_graphics_internal as _strype_graphics_internal
import strype_input_internal as _strype_input_internal
import math as _math
import collections as _collections

class Actor:
    def __init__(self, image_filename, x, y):
        self.__id = _strype_graphics_internal.addImage(image_filename)
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
    def get_x(self):
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

def consume_last_click():
    return _strype_input_internal.consumeLastClick()

def key_pressed(keyname):
    return _collections.defaultdict(lambda: False, _strype_input_internal.getPressedKeys())[keyname]
