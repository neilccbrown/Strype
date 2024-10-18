// This file contains the internal mouse+keyboard input API for the Strype graphics world.
// These functions are not directly exposed to users, but are used by graphics.py to
// form the actual public API.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
var $builtinmodule = function(name)  {
    var mod = {};
    mod.consumeLastClick = new Sk.builtin.func(function() {
        return Sk.ffi.remapToPy(peaComponent.__vue__.consumeLastClick());
    });

    mod.getPressedKeys = new Sk.builtin.func(function() {
        return Sk.ffi.remapToPy(peaComponent.__vue__.getPressedKeys());
    });

    return mod;
};
