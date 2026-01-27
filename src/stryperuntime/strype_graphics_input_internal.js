/* eslint-disable @typescript-eslint/no-unused-vars */
// Disabled until we convert to Typescript and export everything

// This file contains the internal mouse+keyboard input API for the Strype graphics world.
// These functions are not directly exposed to users, but are used by graphics.py to
// form the actual public API.

function getAndResetClickedItem() {
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
};
function getAndResetClickDetails() {
    const d = peaComponent.__vue__.consumeLastClickDetails();
    // Should be an array of four numbers so no special mapping consideration needed:
    return Sk.ffi.remapToPy(d);
};

function getMouseDetails() {
    const d = peaComponent.__vue__.getMouseDetails();
    // Should be an array of two numbers and a boolean array so need special mapping consideration:
    return new Sk.builtin.list([Sk.ffi.remapToPy(d[0]), Sk.ffi.remapToPy(d[1]), Sk.ffi.remapToPy(d[2])]);
};

function getPressedKeys() {
    return Sk.ffi.remapToPy(peaComponent.__vue__.getPressedKeys());
};

function checkCollision(idA, idB) {
    return Sk.ffi.remapToPy(peaComponent.__vue__.getPersistentImageManager().checkCollision(idA, idB));
};

function getAllTouchingAssociated(id) {
    // The return value is awkward here because we want to give back a Python list
    // but without converting the objects within, so we don't use remapToPy:
    return new Sk.builtin.list(peaComponent.__vue__.getPersistentImageManager().getAllOverlapping(id));
};

function getAllAt(x, y) {
    // The return value is awkward here because we want to give back a Python list
    // but without converting the objects within, so we don't use remapToPy:
    return new Sk.builtin.list(peaComponent.__vue__.getPersistentImageManager().calculateAllOverlappingAtPos(x, y).map((p) => p.associatedObject).filter((o) => o != null));
};

function getAllActors(id) {
    // The return value is awkward here because we want to give back a Python list
    // but without converting the objects within, so we don't use remapToPy:
    return new Sk.builtin.list(peaComponent.__vue__.getPersistentImageManager().getAllActors());
};

function getAllNearbyAssociated(id, radius) {
    // The return value is awkward here because we want to give back a Python list
    // but without converting the objects within, so we don't use remapToPy:
    return new Sk.builtin.list(peaComponent.__vue__.getPersistentImageManager().getAllNearby(id, Sk.ffi.remapToJs(radius)));
};

function setCollidable(id, collidable) {
    peaComponent.__vue__.getPersistentImageManager().setPersistentImageCollidable(Sk.ffi.remapToJs(id), Sk.ffi.remapToJs(collidable));
};
