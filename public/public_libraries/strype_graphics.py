import strype_graphics_internal as _strype_graphics_internal
from math import sin, cos, radians

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
    def move(self, amount):
        cur = _strype_graphics_internal.getImageLocation(self.__id)
        rot = radians(_strype_graphics_internal.getImageRotation(self.__id))
        self.set_location(cur['x'] + amount * cos(rot), cur['y'] + amount * sin(rot))
    def turn(self, degrees):
        self.set_rotation(_strype_graphics_internal.getImageRotation(self.__id) + degrees)
        
