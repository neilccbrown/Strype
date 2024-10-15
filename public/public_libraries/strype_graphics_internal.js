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
    mod.removeImage = new Sk.builtin.func(function(img) {
        peaComponent.__vue__.removePersistentImage(img);
    });

    return mod;
};
