// eslint-disable-next-line @typescript-eslint/no-unused-vars
var $builtinmodule = function(name)  {
    var mod = {};
    mod.playOneOffSound = new Sk.builtin.func(function(soundFileName) {
        peaComponent.__vue__.playOneOffSound(soundFileName);
    });

    return mod;
};
