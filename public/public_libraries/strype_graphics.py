import strype_graphics_internal as _strype_graphics_internal

class Actor:
    def __init__(self, image_filename, x, y):
        self.id = _strype_graphics_internal.addImage(image_filename)
        _strype_graphics_internal.setImageLocation(self.id, x, y)
        _strype_graphics_internal.setImageRotation(self.id, 0)
    def setLocation(self, x, y):
        _strype_graphics_internal.setImageLocation(self.id, x, y)
    def setRotation(self, deg):
        _strype_graphics_internal.setImageRotation(self.id, deg)
    def setScale(self, scale):
        _strype_graphics_internal.setImageScale(self.id, scale)
    def remove(self):
        _strype_graphics_internal.removeImage(self.id)

