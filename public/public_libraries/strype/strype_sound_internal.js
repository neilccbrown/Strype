// This file contains the internal sound/music API for Strype.
// These functions are not directly exposed to users, but are used by sound.py to
// form the actual public API.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
var $builtinmodule = function(name)  {
    var mod = {};
    mod.playOneOffSound = new Sk.builtin.func(function(soundFileName) {
        peaComponent.__vue__.playOneOffSound(soundFileName);
    });

    return mod;
};
