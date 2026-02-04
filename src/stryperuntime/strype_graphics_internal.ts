/* eslint-disable @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-unused-vars */
// Disabled until we convert to Typescript and export everything

// This file contains the internal graphics API for the Strype graphics world.
// These functions are not directly exposed to users, but are used by graphics.py to
// form the actual public API.
import { decodeRGBA, encodeRGBA, isRemoteImage, makeCanvasHandle, RemoteCanvas, RemoteImage, SyncStrypePyodideHandlerFunction } from "./worker_bridge_type";
import { asyncBridge, PyodideWorkerGlobalScope, syncBridge } from "@/workers/python_execution_type";
import { PyProxy } from "pyodide/ffi";
import { DebouncedFunc, throttle } from "lodash";

// From https://stackoverflow.com/questions/996505/lru-cache-implementation-in-javascript
class LRU<K extends string | number, V> {
    max : number;
    cache : Map<K, V>;
    onEvict : (key: K, value: V) => void;
    constructor(max = 10, onEvict : (key: K, value: V) => void = () => {}) {
        this.max = max;
        this.cache = new Map();
        this.onEvict = onEvict;
    }

    get(key : K) : V | undefined {
        let item = this.cache.get(key);
        if (item !== undefined) {
            // refresh key
            this.cache.delete(key);
            this.cache.set(key, item);
        }
        return item;
    }

    // If this set evicts an item, it is passed to onEvict
    set(key : K, val : V) : void {
        // refresh key
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        // evict oldest
        else if (this.cache.size === this.max) {
            const evictKey = this.firstKey();
            const evictVal = this.cache.get(evictKey);
            this.cache.delete(evictKey);
            if (evictVal !== undefined) {
                this.onEvict(evictKey, evictVal);
            }
        }
        this.cache.set(key, val);
    }
    
    // Evicts the given item, and passes it to onEvict if it existed
    evict(key: K) {
        const evictVal = this.cache.get(key);
        if (evictVal !== undefined) {
            this.onEvict(key, evictVal);
        }
        this.cache.delete(key);
    }

    firstKey() : K {
        return this.cache.keys().next().value;
    }
}

// Saves the pixels for the last three images
// Note that although the type is DebouncedFunc, we use throttle not debounce (see cachePixelsOf below)
// We don't need a dirty flag because each markDirty call queues up update(), and we don't need a separate dirty flag.
type CachedPixels = { width: number; height: number; pixelsRGBA: Uint8ClampedArray, update: DebouncedFunc<() => void> };
const pixelsCache = new LRU<number, CachedPixels>(3, (key, value) => value.update.flush());

function aboutToDrawOnImage(img : RemoteCanvas) : void {
    // Evict automatically flushes the pixels if we have a dirty cache, then removes from cache:
    pixelsCache.evict(img.handle.handle);
}

function cachePixelsOf(img: RemoteCanvas) : CachedPixels {
    const existing = pixelsCache.get(img.handle.handle);
    if (existing !== undefined) {
        return existing;
    }
    // Note we want throttle not debounce for update
    // (see https://css-tricks.com/debouncing-throttling-explained-examples/ )
    // With debounce, if the user loops round forever updating pixels more frequently than the threshold,
    // we will never send the updated pixels and they'll never show on screen.  Whereas with throttle, they
    // will be shown on screen but we limit how often we send updates.
    const pixelsRGBA = decodeRGBA(syncBridge({request: "canvas_getAllPixelsRGBA", img}));
    const data = {
        width: img.width,
        height: img.height,
        pixelsRGBA,
        // These set calls are quite expensive so we do them max 10 times a second:
        update: throttle(() => {
            asyncBridge({request: "canvas_drawPixels", img, x: 0, y: 0, width: img.width, height: img.height, pixelRGBA: encodeRGBA(pixelsRGBA)});
        }, 1000/10),
    };
    pixelsCache.set(img.handle.handle, data);
    return data;
}

function markDirty(canvas: RemoteCanvas, img: CachedPixels) {
    // All we need to do here is queue up an invocation of the update() function:
    img.update();
}

declare const globalThis: PyodideWorkerGlobalScope;

// There is no standard way in HTML to synchronously load images,
// but we need to be able to do this in order to use the image's attributes
// (particularly its width and height) after loading.  So we use Skulpt's
// suspension mechanism to pause Skulpt execution until the promise which loads
// the image has executed.  This effectively makes it seem like the user
// code has loaded the image synchronously.
// This code is adapted from Skulpt's src/lib/image.js
export function loadAndWaitForImage(filename: string) : RemoteImage {
    // Try to detect if it's a relative path or absolute URL.  We are fairly lenient
    // and permissive, so our rule is: if it starts with http: or https: or // we 
    // treat it as absolute, or something.ext/something then we assume it's a URL.
    // Otherwise we count it as a relative path:
    let match;
    if (/^https?:/.test(filename) || /^\/\//.test(filename)) {
        // Absolute:
        return syncBridge({request: "loadImage", url: filename});
    }
    else if (!/:/.test(filename) && /^[^./]+\.[^/]+\/.+/.test(filename)) {
        // Absolute partial:
        return syncBridge({request: "loadImage", url: "https://" + filename});
    }
    else if (/^data:/.test(filename) && !/^data:image\/svg+xml/.test(filename)) {
        // Base64 data image:
        return syncBridge({request: "loadImage", url: filename});
    }
    else if ((match = /^:([^:]+):(.+)$/.exec(filename))) {
        // If it's some other prefix between two colons, it's a library asset:
        const libraryShortName = match[1];
        const fileName = match[2];
        const viaLibrary = syncBridge({request: "loadLibraryAsset", libraryShortName, fileName}) ?? filename;
        return syncBridge({request: "loadImage", url: viaLibrary});
    }
    else {
        // Relative path:
        return syncBridge({request: "loadImage", url: "./graphics_images/" + filename});
    }
}
export function setBackground(img : RemoteImage) {
    globalThis.spriteManager.setBackground(img);
} 
export function addSprite(image: RemoteImage, collidable: boolean) : number {
    return globalThis.spriteManager.addSprite(image, collidable);
}
export function updateImage(id: number, image: RemoteImage) : void {
    globalThis.spriteManager.setSpriteImage(id, image);
}
export function imageExists(image : number) : boolean {
    return globalThis.spriteManager.hasSprite(image);
}
export function getImageSize (img : number)  : {width: number, height: number} | undefined {
    return globalThis.spriteManager.getSpriteSize(img);
}
export function setImageLocation(img : number, x : number, y : number) : void {
    globalThis.spriteManager.setSpriteLocation(img, x, y);
}
export function setImageRotation(img : number, r : number) : void {
    globalThis.spriteManager.setSpriteRotation(img, r);
}
export function setImageScale(img : number, s : number) : void {
    globalThis.spriteManager.setSpriteScale(img, s);
}
export function getImageLocation(img : number): { x: number; y: number } | undefined {
    return globalThis.spriteManager.getSpriteLocation(img);
}
export function getImageRotation(img : number): number | undefined {
    return globalThis.spriteManager.getSpriteRotation(img);
}
export function getImageScale(img : number) : number | undefined {
    return globalThis.spriteManager.getSpriteScale(img);
}
export function removeImage(img: number) : void {
    globalThis.spriteManager.removeSprite(img);
}
// Removes an image after a timeout.  Can be cancelled with cancelRemoveImageAfter (passing same img)
export function removeImageAfter(img : number, secs : number) : void {
    globalThis.spriteManager.removeSpriteAfter(img, secs);
}

export function makeImageEditableForSprite(spriteId : number) : RemoteCanvas | null {
    return globalThis.spriteManager.editImage(spriteId, (r : RemoteImage | RemoteCanvas) : RemoteCanvas => {
        const canvas = syncBridge({request: "ensureCanvas", img: r});
        // This will also send the change through to the main thread via the usual state-mirroring channel:
        globalThis.spriteManager.setSpriteImage(spriteId, canvas);
        return canvas;
    });
}


export function makeCanvasOfSize(width : number, height : number) : RemoteCanvas {
    return syncBridge({request: "makeOffscreenCanvas", width, height});
}
export function htmlImageToCanvas(imageElement : RemoteImage) : RemoteCanvas {
    const c = makeCanvasOfSize(imageElement.width, imageElement.height);
    canvas_drawImagePart(c, imageElement, 0, 0, 0, 0, imageElement.width, imageElement.height, 1.0);
    return c;
}
export function getCanvasDimensions(img : RemoteCanvas) : number[] {
    return [img.width, img.height];
}
export function canvas_fillWhole(img: RemoteCanvas) {
    aboutToDrawOnImage(img);
    asyncBridge({request:"canvas_fillWhole", img});
}
export function canvas_clearRect(img: RemoteCanvas, x : number, y : number, width : number, height : number) : void {
    aboutToDrawOnImage(img);
    asyncBridge({request:"canvas_clearRect", img, x, y, width, height});
}
export function canvas_setFill(img : RemoteCanvas, color : string | null) {
    // Note 8 zeroes: this is fully transparent, not black:
    asyncBridge({request:"canvas_setFill", img, fill: color == null ? "#00000000" : color});
}
export function canvas_setStroke(img : RemoteCanvas, color : string | null) {
    asyncBridge({request:"canvas_setStroke", img, stroke: color == null ? "#00000000" : color});
}
export function canvas_getPixel(img : RemoteCanvas, x : number, y : number) {
    // We cache as it's rare that a call to this is isolated; usually it's in a loop:
    const cache = cachePixelsOf(img);
    const baseIndex = (y * img.width + x) * 4; // RGBA are 4 values per pixel 
    // We can't slice, as we want number[] not a Uint8ClampedArray:
    return [cache.pixelsRGBA[baseIndex], cache.pixelsRGBA[baseIndex + 1], cache.pixelsRGBA[baseIndex + 2], cache.pixelsRGBA[baseIndex + 3]];
}
export function canvas_setPixel(img : RemoteCanvas, x : number, y : number, r : number, g: number, b: number, a: number) : void {
    // We cache as it's rare that a call to this is isolated; usually it's in a loop:
    const cache = cachePixelsOf(img);
    const baseIndex = (y * img.width + x) * 4; // RGBA are 4 values per pixel
    cache.pixelsRGBA[baseIndex] = r;
    cache.pixelsRGBA[baseIndex+1] = g;
    cache.pixelsRGBA[baseIndex+2] = b;
    cache.pixelsRGBA[baseIndex+3] = a;
    markDirty(img, cache);
}
export function canvas_getAllPixels(img : RemoteCanvas) : Uint8ClampedArray {
    return cachePixelsOf(img).pixelsRGBA;
}
export function canvas_setAllPixelsRGBA(img: RemoteCanvas, pixels : number[]) : void {
    const cache = cachePixelsOf(img);
    cache.pixelsRGBA.set(pixels);
    markDirty(img, cache);
}
export function canvas_drawImagePart(dest: RemoteCanvas, src : RemoteImage | RemoteCanvas, dx : number, dy : number, sx : number, sy : number, sw : number, sh : number, scale : number) : void {
    aboutToDrawOnImage(dest);
    asyncBridge({request: "canvas_drawImagePart", dest, src, sx, sy, sw, sh, dx, dy, scale});
}
export function canvas_line(img: RemoteCanvas, x : number, y : number, x2 : number, y2 : number) : void {
    aboutToDrawOnImage(img);
    asyncBridge({request: "canvas_drawLine", img, x, y, x2, y2});
}
export function canvas_roundedRect(img : RemoteCanvas, x : number, y : number, width : number, height : number, cornerSize : number) {
    aboutToDrawOnImage(img);
    asyncBridge({request: "canvas_drawRoundedRect", img, x, y, width, height, cornerSize});
}
function toRadians(deg : number) : number {
    return deg * Math.PI / 180;
}
export function canvas_arc(img : RemoteCanvas, x : number, y : number, width : number, height : number, angleStartDeg : number, angleDeltaDeg : number) : void {
    aboutToDrawOnImage(img);
    asyncBridge({request: "canvas_drawArc", img, x, y, width, height, angleStartRad: toRadians(angleStartDeg), angleDeltaRad: toRadians(angleDeltaDeg)});
}
export function polygon_xy_pairs(img : RemoteCanvas, xyPairs : PyProxy) : void {
    aboutToDrawOnImage(img);
    // Usually we don't need to call toJs manually, but with this nested array it comes as a PyProxy so we need to convert:
    const xyPairsPlain = xyPairs.toJs() as number[][];
    asyncBridge({request: "canvas_drawPolygon", img, xyPairs: xyPairsPlain});
}

export function canvas_loadFont(provider, fontName) {
    /*
    provider = Sk.ffi.remapToJs(provider);
    if (provider.toLowerCase() != "google") {
        throw new Error("Provider " + provider + " not supported.  Currently only 'google' is supported.");
    }
    const susp = new Sk.misceval.Suspension();
    function susp.resume () {
        return susp.ret;
    }
    susp.data = {
        type: "Sk.promise",
        promise: new Promise(function (resolve, reject) {
            WebFont.load({
                google: {
                    families: [Sk.ffi.remapToJs(fontName)],
                },
                active: function() {
                    susp.ret = Sk.ffi.remapToPy(true);
                    resolve();
                },
                inactive: function() {
                    susp.ret = Sk.ffi.remapToPy(false);
                    reject(Error("Font failed to load."));
                },
            });
        }),
    }
    return susp;
     */
}

const sayFont="\"Klee One\", sans-serif";
// Load font:
const myFont = new FontFace(
    "Klee One",
    "url(fonts/klee-one-v12-latin-regular.woff2)"
);

myFont.load().then((font) => {
    document.fonts.add(font);
});
// Since this is quite expensive, we cache it in case users repeatedly redraw the same text:
// The map can only really use string keys, so we assemble the key into a string of the format:
// $fontSize:$maxWidth:$maxHeight:$text
const textMeasureCache = new LRU<string, number>(1000);

const lineHeightMultiplier = 1.2;

// Returns an item of the following type (but we're in Javascript so can't actually type it):
// interface {
//    lines: string[],
//    fontSize: number,
//    width: number,
//    height: number,
// }
function calculateTextToFit(ctx, text, fontSize, maxWidth, maxHeight, font) {
    let lines = [];
    const paragraphs = text.split("\n");  // Split the text by '\n' to respect forced line breaks.
    let textHeight = 0;
    let longestWidth = 0;

    // Minimum font size of 8 pixels:
    for (;fontSize >= 8; fontSize -= 1) {
        ctx.font = `${fontSize}px ${font}`;
        
        paragraphs.forEach((paragraph) => {
            let currentLine = "";
            // The brackets make it retain the whitespace parts in the array as a "word".  This way,
            // if the user asks for us to write "But....       I don't know." then we'll actually render
            // the long space.
            const words = paragraph.split(/(\s+)/);

            if (maxWidth > 0) {
                for (let i = 0; i < words.length; i++) {
                    const currentLinePlusNextWord = currentLine + words[i];
                    const metrics = ctx.measureText(currentLinePlusNextWord);
                    const testWidth = metrics.width;

                    // If it's too long, start a new line:
                    if (testWidth > maxWidth && currentLine.length > 0) {
                        lines.push(currentLine);
                        // If it's a single space at the start of a line, discard it:
                        currentLine = words[i] === " " ? "" : words[i];
                    }
                    else {
                        // currentLinePlusNextWord includes the previous part, so just overwrite currentLine with it:
                        currentLine = currentLinePlusNextWord;
                    }
                    longestWidth = Math.max(longestWidth, testWidth);
                }
                lines.push(currentLine.trim()); // Push the last line of the paragraph
            }
            else {
                lines.push(paragraph); // No wrapping if maxWidth is <= 0
                longestWidth = Math.max(longestWidth, ctx.measureText(paragraph).width);
            }
        });

        let lineHeight = fontSize * lineHeightMultiplier;
        textHeight = lines.length * lineHeight;
        
        if (maxHeight <= 0 || textHeight <= maxHeight) {
            break;
        }
        // Otherwise we go round again, reducing the font size...
    }
    return {lines: lines, fontSize: fontSize, width: longestWidth, height: textHeight}
}

// Draws the given text on canvas dest at top-left of x, y with given fontSize in pixels.
// If the text would be larger than maxWidth (and maxWidth is > 0) then it will be wrapped at white space in the text.
// If the text would then be larger than maxHeight (and maxHeight is > 0), its font size will be reduced until it
// fits inside maxWidth and maxHeight.  Note that it is invalid to supply maxHeight > 0 with maxWidth = 0.
// Returns a Python dict with fields "width" and "height" with the actual width and height
export function canvas_drawText(dest, text, x, y, fontSize, maxWidth = 0, maxHeight = 0, fontName = null) {
    aboutToDrawOnImage(img);
    // Must remap the string to Javascript:
    text = Sk.ffi.remapToJs(text);
    fontName = Sk.ffi.remapToJs(fontName);
    if (fontName != null) {
        fontName = fontName + ", sans-serif";
    }
    else {
        fontName = sayFont;
    }
    fontSize = Sk.ffi.remapToJs(fontSize);
    maxWidth = Sk.ffi.remapToJs(maxWidth);
    maxHeight = Sk.ffi.remapToJs(maxHeight);
    const ctx = dest.getContext("2d");
    const key = `${fontSize}:${maxWidth}:${maxHeight}:${text}:${fontName}`;
    let details = textMeasureCache.get(key);
    if (!details) {
        details = calculateTextToFit(ctx, text, fontSize, maxWidth, maxHeight, fontName);
        textMeasureCache.set(key, details);
    }
    ctx.font = `${details.fontSize}px ${fontName}`;
    
    // Render each line of text on the canvas at (x, y)
    for (let i = 0; i < details.lines.length; i++) {
        // Since we are passing the baseline, we always add an extra 1 * fontSize to get from the top-left
        // down to the baseline, then add i * lineHeightMultiplier from there:
        let actualY = y + details.fontSize * (1 + i * lineHeightMultiplier);
        ctx.strokeText(details.lines[i], x, actualY);
        ctx.fillText(details.lines[i], x, actualY); 
    }
    return Sk.ffi.remapToPy({width: details.width, height: details.height});
}

export function canvas_downloadPNG(src : RemoteCanvas, filenameStem : string) {
    // Force flush any pending pixel writes without evicting:
    const cached = pixelsCache.get(src.handle.handle);
    if (cached) {
        cached.update.flush();
    }
    asyncBridge({request: "canvas_downloadPNG", img: src, filenameStem});
}

