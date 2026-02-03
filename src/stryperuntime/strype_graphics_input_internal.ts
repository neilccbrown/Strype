/* eslint-disable @typescript-eslint/no-unused-vars */
// Disabled until we convert to Typescript and export everything

// This file contains the internal mouse+keyboard input API for the Strype graphics world.
// These functions are not directly exposed to users, but are used by graphics.py to
// form the actual public API.
import {PyodideWorkerGlobalScope} from "@/workers/python_execution_type";
import type {StrypePyodideHandlerFunctionSync} from "@/stryperuntime/worker_bridge_type";

declare const globalThis: PyodideWorkerGlobalScope;

const bridge : StrypePyodideHandlerFunctionSync = (req) => {
    return globalThis.StrypePyodideWorkerBridge(req);
};

function getAndResetClickedItem() {
    const all = peaComponent.__vue__.consumeLastClickedItems();
    for (let i = all.length - 1; i >= 0; i--) {
        let assoc = all[i].associatedObject;
        // We don't have an associatedObject for some Sprite, e.g. the say speech bubbles.
        if (assoc) {
            // This already is a Python object so mustn't remap:
            return assoc;
        }
    }
    return Sk.ffi.remapToPy(null);
}
function getAndResetClickDetails() {
    const d = peaComponent.__vue__.consumeLastClickDetails();
    // Should be an array of four numbers so no special mapping consideration needed:
    return Sk.ffi.remapToPy(d);
}

function getMouseDetails() {
    const d = peaComponent.__vue__.getMouseDetails();
    // Should be an array of two numbers and a boolean array so need special mapping consideration:
    return new Sk.builtin.list([Sk.ffi.remapToPy(d[0]), Sk.ffi.remapToPy(d[1]), Sk.ffi.remapToPy(d[2])]);
}

export function getPressedKeys() : {[key: string]: boolean} {
    return bridge({request: "getPressedKeys"});
}

export function checkCollision(idA : number, idB : number) : boolean {
    return globalThis.spriteManager.checkCollision(idA, idB);
}

export function getAllTouchingAssociated(id : number) : number[] {
    return globalThis.spriteManager.getAllOverlapping(id);
}

export function getAllAt(x : number, y : number) : number[] {
    return globalThis.spriteManager.calculateAllOverlappingAtPos(x, y).map((p) => p.id);
}

export function getAllActors() : number[] {
    return globalThis.spriteManager.getAllActors();
}

export function getAllNearbyAssociated(id : number, radius : number) : number[] {
    return globalThis.spriteManager.getAllNearby(id, radius);
}

export function setCollidable(id : number, collidable : boolean) : void {
    globalThis.spriteManager.setSpriteCollidable(id, collidable);
}
