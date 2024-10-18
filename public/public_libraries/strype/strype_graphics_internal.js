// This file contains the internal graphics API for the Strype graphics world.
// These functions are not directly exposed to users, but are used by graphics.py to
// form the actual public API.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
var $builtinmodule = function(name)  {
    var mod = {};
    mod.addImage = new Sk.builtin.func(function(imgFileName, x, y) {
        var img = peaComponent.__vue__.addPersistentImage(imgFileName);
        peaComponent.__vue__.setPersistentImageLocation(img, x, y);
        return img;
    });
    mod.setImageLocation = new Sk.builtin.func(function(img, x, y) {
        peaComponent.__vue__.setPersistentImageLocation(img, x, y);
    });
    mod.setImageRotation = new Sk.builtin.func(function(img, r) {
        peaComponent.__vue__.setPersistentImageRotation(img, r);
    });
    mod.setImageScale = new Sk.builtin.func(function(img, s) {
        peaComponent.__vue__.setPersistentImageScale(img, s);
    });
    mod.getImageLocation = new Sk.builtin.func(function(img) {
        return Sk.ffi.remapToPy(peaComponent.__vue__.getPersistentImageLocation(img));
    });
    mod.getImageRotation = new Sk.builtin.func(function(img) {
        return Sk.ffi.remapToPy(peaComponent.__vue__.getPersistentImageRotation(img));
    });
    mod.getImageScale = new Sk.builtin.func(function(img) {
        return Sk.ffi.remapToPy(peaComponent.__vue__.getPersistentImageScale(img));
    });
    mod.removeImage = new Sk.builtin.func(function(img) {
        peaComponent.__vue__.removePersistentImage(img);
    });

    return mod;
};
