// This file contains the internal graphics API for the Strype graphics world.
// These functions are not directly exposed to users, but are used by graphics.py to
// form the actual public API.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
var $builtinmodule = function(name)  {
    var mod = {};
    // There is no standard way in HTML to synchronously load images,
    // but we need to be able to do this in order to use the image's attributes
    // (particularly its width and height) after loading.  So we use Skulpt's
    // suspension mechanism to pause Skulpt execution until the promise which loads
    // the image has executed.  This effectively makes it seem like the user
    // code has loaded the image synchronously.
    // This code is adapted from Skulpt's src/lib/image.js
    mod.loadAndWaitForImage = new Sk.builtin.func(function(filename) {
        let susp = new Sk.misceval.Suspension();
        susp.resume = function () {
            if (susp.data["error"]) {
                throw new Sk.builtin.IOError(susp.data["error"].message);
            }
            return susp.ret;
        };
        susp.data = {
            type: "Sk.promise",
            promise: new Promise(function (resolve, reject) {
                var newImg = new Image();
                newImg.crossOrigin = "";
                newImg.onerror = function () {
                    reject(Error("Failed to load image: " + newImg.src));
                };
                newImg.onload = function () {
                    susp.ret = newImg;
                    resolve();
                };
                // Actually trigger the load:
                newImg.src = "./graphics_images/" + filename;
            }),
        };
        return susp;
    });
    mod.addImage = new Sk.builtin.func(function(image, assoc) {
        return peaComponent.__vue__.getPersistentImageManager().addPersistentImage(image, assoc);
    });
    mod.setImageLocation = new Sk.builtin.func(function(img, x, y) {
        peaComponent.__vue__.getPersistentImageManager().setPersistentImageLocation(img, x, y);
    });
    mod.setImageRotation = new Sk.builtin.func(function(img, r) {
        peaComponent.__vue__.getPersistentImageManager().setPersistentImageRotation(img, r);
    });
    mod.setImageScale = new Sk.builtin.func(function(img, s) {
        peaComponent.__vue__.getPersistentImageManager().setPersistentImageScale(img, s);
    });
    mod.getImageLocation = new Sk.builtin.func(function(img) {
        return Sk.ffi.remapToPy(peaComponent.__vue__.getPersistentImageManager().getPersistentImageLocation(img));
    });
    mod.getImageRotation = new Sk.builtin.func(function(img) {
        return Sk.ffi.remapToPy(peaComponent.__vue__.getPersistentImageManager().getPersistentImageRotation(img));
    });
    mod.getImageScale = new Sk.builtin.func(function(img) {
        return Sk.ffi.remapToPy(peaComponent.__vue__.getPersistentImageManager().getPersistentImageScale(img));
    });
    mod.removeImage = new Sk.builtin.func(function(img) {
        peaComponent.__vue__.getPersistentImageManager().removePersistentImage(img);
    });

    return mod;
};
