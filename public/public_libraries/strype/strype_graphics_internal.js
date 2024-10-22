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
    mod.makeImageEditable = new Sk.builtin.func(function(img) {
        return peaComponent.__vue__.getPersistentImageManager().editImage(img);
    });
    
    
    mod.makeCanvasOfSize = new Sk.builtin.func(function(width, height) {
        const c = new OffscreenCanvas(width, height);
        c.fillStyle = "black";
        c.getContext("2d").fillRect(0, 0, width, height);
        // Note: we do not remapToPy because it makes no sense, we are just passing the reference around:
        return c;
    });
    mod.htmlImageToCanvas = new Sk.builtin.func(function(imageElement) {
        const c = new OffscreenCanvas(imageElement.width, imageElement.height);
        c.getContext("2d").drawImage(imageElement, 0, 0);
        return c;
    });
    mod.getCanvasDimensions = new Sk.builtin.func(function(img) {
        return new Sk.builtin.tuple([img.width, img.height]);
    });
    mod.canvas_fillRect = new Sk.builtin.func(function(img, x, y, width, height, color) {
        const cxt = img.getContext("2d");
        cxt.fillStyle = color;
        return cxt.fillRect(x, y, width, height);
    });
    mod.canvas_getPixel = new Sk.builtin.func(function(img, x, y) {
        const cxt = img.getContext("2d");
        const p = cxt.getImageData(x, y, 1, 1);
        return new Sk.builtin.tuple([
            new Sk.builtin.float_(p.data[0] / 255),
            new Sk.builtin.float_(p.data[1] / 255),
            new Sk.builtin.float_(p.data[2] / 255),
            new Sk.builtin.float_(p.data[3] / 255)]
        );
    });
    mod.canvas_setPixel = new Sk.builtin.func(function(img, x, y, colorTuple) {
        const cxt = img.getContext("2d");
        const p = Sk.ffi.remapToJs(colorTuple);
        cxt.putImageData(new ImageData(new Uint8ClampedArray([p[0] * 255, p[1] * 255, p[2] * 255, p[3] * 255]), 1, 1), x, y);
    });
    mod.canvas_drawImagePart = new Sk.builtin.func(function(dest, src, dx, dy, sx, sy, sw, sh) {
        const cxt = dest.getContext("2d");
        cxt.drawImage(src, sx, sy, sw, sh, dx, dy, sw, sh);
    });
    
    
    return mod;
};
