// eslint-disable-next-line @typescript-eslint/no-unused-vars
var $builtinmodule = function(name)  {
    var mod = {};
    mod.consumeLastClick = new Sk.builtin.func(function() {
        return Sk.ffi.remapToPy(peaComponent.__vue__.consumeLastClick());
    });

    return mod;
};
