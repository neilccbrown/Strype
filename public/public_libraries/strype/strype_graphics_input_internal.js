// This file contains the internal mouse+keyboard input API for the Strype graphics world.
// These functions are not directly exposed to users, but are used by graphics.py to
// form the actual public API.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
var $builtinmodule = function(name)  {
    var mod = {};
    mod.getAndResetClickedItem = new Sk.builtin.func(function() {
        const all = peaComponent.__vue__.consumeLastClickedItems();
        if (all.length !== 0) {
            let assoc = all[all.length - 1].associatedObject;
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

    return mod;
};
