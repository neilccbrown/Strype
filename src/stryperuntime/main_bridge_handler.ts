// This file has the parts of the code which executes on the main thread to handle requests from the Pyodide web worker

import { AsyncStrypePyodideHandlerFunction, decodeStringToUint8, encodeUint8ToString, isRemoteImage, makeSoundHandle, SpriteHandle, SyncPromiseStrypePyodideHandlerFunction } from "@/stryperuntime/worker_bridge_type";
import { Renderer } from "@/stryperuntime/renderer";
import { SoundManager } from "@/stryperuntime/sound_manager";
import { drawText } from "@/helpers/textDrawing";
// We only import the type because the library itself is loaded from index.html: 
import type WebFont from "webfontloader";
import { saveAs } from "file-saver";
import { getDateTimeFormatted } from "@/helpers/common";

// These are callbacks passed from PythonExecutionArea.vue to do things that are tied to the DOM or wider Strype state.
// This means we don't have to make reference to the PythonExecutionArea component itself.
interface SyncRequestCallbacks {
    getPressedKeys : () => {[key: string]: boolean},
    loadLibraryAsset : (libraryShortName: string, fileName: string) => Promise<string | undefined>,
    switchToGraphicsTab: () => void,
    getMouseDetails: () => {x : number, y: number, buttonsPressed: boolean[] },
    consumeLastClickDetails: () => { x: number, y: number, button: number, clickCount: number } | null,
    consumeLastClickedItems: () => SpriteHandle[],
}

// Takes the details we need for handling then returns a function which takes a synchronous request and gives back the response in a Promise:
export const handleSyncRequests : (
    renderer : Renderer,
    soundManager : SoundManager,
    callbacks : SyncRequestCallbacks,
) => SyncPromiseStrypePyodideHandlerFunction = (renderer, soundManager, callbacks) => (req) => {
    switch (req.request) {
    case "loadImage": {
        callbacks.switchToGraphicsTab();
        return {request: req.request, response: renderer.loadImage(req.url)};
    }
    case "loadLibraryAsset": {
        return {request: req.request, response: callbacks.loadLibraryAsset(req.libraryShortName, req.fileName)};
    }
    case "makeOffscreenCanvas": {
        callbacks.switchToGraphicsTab();
        return {request: req.request, response: Promise.resolve(renderer.makeCanvas(req.width, req.height))};
    }
    case "getPressedKeys": {
        return {request: req.request, response: Promise.resolve(callbacks.getPressedKeys())};
    }
    case "getMouseDetails": {
        return {request: req.request, response: Promise.resolve(callbacks.getMouseDetails())};
    }
    case "consumeLastClickedItems": {
        return {request: req.request, response: Promise.resolve(callbacks.consumeLastClickedItems())};
    }
    case "consumeLastClickDetails": {
        return {request: req.request, response: Promise.resolve(callbacks.consumeLastClickDetails())};
    }
    case "loadSound": {
        return {request: req.request, response: soundManager.loadSound(req.url)};
    }
    case "createEmptyMonoSound": {
        const soundIndex = soundManager.createMonoSound(req.numSamples, req.sampleRate);
        return {request: req.request, response: Promise.resolve({handle: makeSoundHandle(soundIndex), numberOfChannels: 1, numSamples: req.numSamples, sampleRate: req.sampleRate })};
    }
    case "playSoundAndWait": {
        return {request: req.request, response: soundManager.playAudioBuffer(req.sound.handle.handle)?.then(()  => true)};
    }
    case "getMonoSoundSampleValues": {
        return {request: req.request, response: Promise.resolve(Array.from(soundManager.getMonoSamples(req.sound.handle.handle)))};
    }
    case "cloneSound": {
        return {request: req.request, response: soundManager.cloneSound(req.sound.handle.handle, req.toMono).then((cloneIndex) => {
            return {handle: makeSoundHandle(cloneIndex), numberOfChannels: req.toMono ? 1 : req.sound.numberOfChannels, numSamples: req.sound.numSamples, sampleRate : req.sound.sampleRate};
        })};
    }
    case "loadFont": {
        return {
            request: req.request, response: new Promise<boolean>((resolve, reject) => {
                if (req.provider.toLowerCase() != "google") {
                    reject(new Error("Provider " + req.provider + " not supported.  Currently only 'google' is supported."));
                    return;
                }
                WebFont.load({
                    google: {
                        families: [req.fontName],
                    },
                    active: function() {
                        resolve(true);
                    },
                    inactive: function() {
                        reject(new Error("Font failed to load."));
                    },
                });
            }),
        };
    }
    case "canvas_drawText": {
        return {request: req.request, response: Promise.resolve(drawText(renderer.getCanvasContext(req.img.handle), req.text, req.x, req.y, req.fontSize, req.maxWidth, req.maxHeight, req.fontName)) };
    }
    case "ensureCanvas": {
        if (isRemoteImage(req.img)) {
            // Ideally we'd remove the old Image but we don't actually have a mechanism for that at the moment:
            const img = renderer.getImage(req.img.handle);
            const c = renderer.makeCanvas(img.width, img.height);
            renderer.getCanvasContext(c.handle).drawImage(img, 0, 0);
            return {request: req.request, response: Promise.resolve(c)};
        }
        else {
            return {request: req.request, response: Promise.resolve(req.img)};
        }
    }
    case "canvas_getAllPixelsRGBA": {
        const ctx = renderer.getCanvasContext(req.img.handle);
        return {request: req.request, response: Promise.resolve(encodeUint8ToString(ctx.getImageData(0, 0, req.img.width, req.img.height).data))};
    }
    default:
        // Trick to give a compile-time error if a case is missing above:
        const _exhaustive: never = req;
        return _exhaustive;
    }
};

// Ironically, almost all the "Async" (fire-and-forget) requests are executed synchronously in one step, it's just that we don't need to know the result 
export const handleAsyncRequests : (renderer : Renderer, soundManager : SoundManager) => AsyncStrypePyodideHandlerFunction = (renderer, soundManager) => (req) => {
    switch (req.request) {
    case "canvas_setFill": {
        renderer.getCanvasContext(req.img.handle).fillStyle = req.fill;
        return undefined;
    }
    case "canvas_setStroke": {
        renderer.getCanvasContext(req.img.handle).strokeStyle = req.stroke;
        return undefined;
    }
    case "canvas_drawImagePart": {
        renderer.getCanvasContext(req.dest.handle).drawImage(req.src.handle.handleKind == "Canvas" ? renderer.getCanvas(req.src.handle) : renderer.getImage(req.src.handle), req.sx, req.sy, req.sw, req.sh, req.dx, req.dy, req.sw * req.scale, req.sh * req.scale);
        return undefined;
    }
    case "canvas_clearRect": {
        renderer.getCanvasContext(req.img.handle).clearRect(req.x, req.y, req.width, req.height);
        return undefined;
    }
    case "canvas_fillWhole": {
        renderer.getCanvasContext(req.img.handle).fillRect(0, 0, req.img.width, req.img.height);
        return undefined;
    }
    case "canvas_drawLine": {
        const ctx = renderer.getCanvasContext(req.img.handle);
        ctx.beginPath();
        ctx.moveTo(req.x, req.y);
        ctx.lineTo(req.x2, req.y2);
        ctx.stroke();
        return undefined;
    }
    case "canvas_drawArc": {
        const ctx = renderer.getCanvasContext(req.img.handle);
        ctx.beginPath();
        ctx.ellipse(req.x, req.y, req.width, req.height, 0, req.angleStartRad, req.angleStartRad + req.angleDeltaRad, false);
        ctx.fill();
        ctx.stroke();
        return undefined;
    }
    case "canvas_drawPolygon": {
        const xys = req.xyPairs;
        const ctx = renderer.getCanvasContext(req.img.handle);
        ctx.beginPath();
        // If we move to the last point, we can lineTo the rest and have the right behaviour:
        ctx.moveTo(xys[xys.length - 1][0], xys[xys.length - 1][1]);
        xys.forEach((xy) => {
            ctx.lineTo(xy[0], xy[1]);
        });
        ctx.fill();
        ctx.stroke();
        return undefined;
    }
    case "canvas_drawRoundedRect": {
        const ctx = renderer.getCanvasContext(req.img.handle);
        ctx.beginPath();
        let radii = req.cornerSize;
        if (radii == 0) {
            ctx.rect(req.x, req.y, req.width, req.height);
        }
        else {
            ctx.roundRect(req.x, req.y, req.width, req.height, radii);
        }
        ctx.fill();
        ctx.stroke();
        return;
    }
    case "canvas_drawPixels": {
        renderer.getCanvasContext(req.img.handle).putImageData(new ImageData(decodeStringToUint8(req.pixelRGBA), req.width, req.height), req.x, req.y);
        return undefined;
    }
    case "canvas_downloadPNG": {
        renderer.getCanvas(req.img.handle).convertToBlob().then((blob) => {
            if (blob) {
                saveAs(blob, `${req.filenameStem}_${getDateTimeFormatted(new Date(Date.now()))}.png`);
            }
        });
        return;
    }
    case "startSound": {
        soundManager.playAudioBuffer(req.sound.handle.handle);
        return;
    }
    case "stopSound": {
        soundManager.stopAudioBuffer(req.sound.handle.handle);
        return;
    }
    case "setMonoSoundSampleValues": {
        soundManager.setMonoSoundSampleValues(req.sound.handle.handle, req.values, req.targetOffset);
        return;
    }
    case "downloadWAV": {
        const wavArrayBuffer = soundManager.getAsWAV(req.sound.handle.handle);
        const blob = new Blob([wavArrayBuffer], { type: "audio/wav" });
        saveAs(blob, `${req.filenameStem}_${getDateTimeFormatted(new Date(Date.now()))}.png`);
        return;
    }
    default:
        // Trick to give a compile-time error if a case is missing above:
        const _exhaustive: never = req;
        return _exhaustive;
    }
};
