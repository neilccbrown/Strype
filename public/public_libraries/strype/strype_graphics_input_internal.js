// This file contains the internal mouse+keyboard input API for the Strype graphics world.
// These functions are not directly exposed to users, but are used by graphics.py to
// form the actual public API.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
var $builtinmodule = function(name)  {
    var mod = {};
    mod.getAndResetClickedItem = new Sk.builtin.func(function() {
        const all = peaComponent.__vue__.consumeLastClickedItems();
        for (let i = all.length - 1; i >= 0; i--) {
            let assoc = all[i].associatedObject;
            // We don't have an associatedObject for some PersistentImage, e.g. the say speech bubbles.
            if (assoc) {
                // This already is a Python object so mustn't remap:
                return assoc;
            }
        }
        return Sk.ffi.remapToPy(null);
    });

    mod.getPressedKeys = new Sk.builtin.func(function() {
        return Sk.ffi.remapToPy(peaComponent.__vue__.getPressedKeys());
    });
    
    mod.checkCollision = new Sk.builtin.func(function(idA, idB) {
        return Sk.ffi.remapToPy(peaComponent.__vue__.getPersistentImageManager().checkCollision(idA, idB));
    });
    
    mod.getAllTouchingAssociated = new Sk.builtin.func(function(id) {
        // The return value is awkward here because we want to give back a Python list
        // but without converting the objects within, so we don't use remapToPy:
        return new Sk.builtin.list(peaComponent.__vue__.getPersistentImageManager().getAllOverlapping(id));
    });
    
    mod.setCollidable = new Sk.builtin.func(function(id, collidable) {
        peaComponent.__vue__.getPersistentImageManager().setPersistentImageCollidable(Sk.ffi.remapToJs(id), Sk.ffi.remapToJs(collidable));
    });

    return mod;
};
