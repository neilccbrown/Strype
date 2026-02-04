/* eslint-disable @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-unused-vars */
// Disabled until we convert to Typescript and export everything

// This file contains the internal graphics API for the Strype graphics world.
// These functions are not directly exposed to users, but are used by graphics.py to
// form the actual public API.
import {RemoteCanvas, RemoteImage, SyncStrypePyodideHandlerFunction} from "./worker_bridge_type";
import { asyncBridge, PyodideWorkerGlobalScope, syncBridge } from "@/workers/python_execution_type";

// From https://stackoverflow.com/questions/996505/lru-cache-implementation-in-javascript
class LRU {
    max : number;
    cache : Map<string, number>;
    constructor(max = 10) {
        this.max = max;
        this.cache = new Map();
    }

    get(key : string) {
        let item = this.cache.get(key);
        if (item !== undefined) {
            // refresh key
            this.cache.delete(key);
            this.cache.set(key, item);
        }
        return item;
    }

    set(key : string, val : number) {
        // refresh key
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        // evict oldest
        else if (this.cache.size === this.max) {
            this.cache.delete(this.first());
        }
        this.cache.set(key, val);
    }

    first() : string {
        return this.cache.keys().next().value;
    }
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
export function addImage(image: RemoteImage, collidable: boolean) : number {
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

export function makeImageEditable(img : number) {
    return globalThis.spriteManager.editImage(img);
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
export function canvas_drawRect(img: RemoteCanvas, x : number, y : number, width : number, height : number) {
    asyncBridge({request:"canvas_drawRect", img, x, y, width, height});
}
export function canvas_clearRect(img: RemoteCanvas, x : number, y : number, width : number, height : number) : void {
    asyncBridge({request:"canvas_clearRect", img, x, y, width, height});
}
export function canvas_setFill(img : RemoteCanvas, color : string | null) {
    // Note 8 zeroes: this is fully transparent, not black:
    asyncBridge({request:"canvas_setFill", img, fill: color == null ? "#00000000" : color});
}
export function canvas_setStroke(img : RemoteCanvas, color : string | null) {
    asyncBridge({request:"canvas_setStroke", img, stroke: color == null ? "#00000000" : color});
}
export function canvas_getPixel(img, x, y) {
    const ctx = img.getContext("2d");
    const p = ctx.getImageData(x, y, 1, 1);
    return new Sk.builtin.tuple([
        new Sk.builtin.int_(p.data[0]),
        new Sk.builtin.int_(p.data[1]),
        new Sk.builtin.int_(p.data[2]),
        new Sk.builtin.int_(p.data[3])]);
}
export function canvas_setPixel(img : RemoteCanvas, x : number, y : number, colorRGBA : number[]) : void {
    asyncBridge({request: "canvas_drawPixels", img, x, y, width: 1, height: 1, pixelRGBA: new Uint8ClampedArray(colorRGBA)});
}
export function canvas_getAllPixels(img) {
    const ctx = img.getContext("2d");
    return Sk.ffi.remapToPy(ctx.getImageData(0, 0, img.width, img.height).data);
}
export function canvas_setAllPixelsRGBA(img: RemoteCanvas, pixels : number[]) : void {
    asyncBridge({request: "canvas_drawPixels", img, x: 0, y: 0, width: img.width, height: img.height, pixelRGBA: new Uint8ClampedArray(pixels)});
}
export function canvas_drawImagePart(dest: RemoteCanvas, src : RemoteImage | RemoteCanvas, dx : number, dy : number, sx : number, sy : number, sw : number, sh : number, scale : number) : void {
    asyncBridge({request: "canvas_drawImagePart", dest, src, sx, sy, sw, sh, dx, dy, scale});
}
export function canvas_line(img: RemoteCanvas, x : number, y : number, x2 : number, y2 : number) : void {
    asyncBridge({request: "canvas_drawLine", img, x, y, x2, y2});
}
export function canvas_roundedRect(img, x, y, width, height, cornerSize) {
    const ctx = img.getContext("2d");
    ctx.beginPath();
    let radii = Sk.ffi.remapToJs(cornerSize);
    if (radii == 0) {
        ctx.rect(x, y, width, height);
    }
    else {
        ctx.roundRect(x, y, width, height, radii);
    }
    ctx.fill();
    ctx.stroke();
}
function toRadians(deg : number) : number {
    return deg * Math.PI / 180;
}
export function canvas_arc(img : RemoteCanvas, x : number, y : number, width : number, height : number, angleStartDeg : number, angleDeltaDeg : number) : void {
    asyncBridge({request: "canvas_drawArc", img, x, y, width, height, angleStartRad: toRadians(angleStartDeg), angleDeltaRad: toRadians(angleDeltaDeg)});
}
export function polygon_xy_pairs(img : RemoteCanvas, xyPairs : number[][]) : void {
    asyncBridge({request: "canvas_drawPolygon", img, xyPairs});
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
const textMeasureCache = new LRU(1000);

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

// Skulpt can't access our common.ts code so we have to copy this here:
function getDateTimeFormatted(dt) {
    // Returned "YYYY-MM-DD_HH-mm-ss" format string representation of a date
    const rawMonthOneIndexedVal = dt.getMonth() + 1;
    const rawDayVal = dt.getDate();
    const rawHoursVal = dt.getHours();
    const rawMinsVal = dt.getMinutes();
    const rawSecsVal = dt.getSeconds();
    return `${dt.getFullYear()}-${((rawMonthOneIndexedVal) < 10) ? "0" + rawMonthOneIndexedVal : rawMonthOneIndexedVal }-${(rawDayVal < 10) ? "0" + rawDayVal : rawDayVal}_${(rawHoursVal < 10) ? "0" + rawHoursVal : rawHoursVal}-${(rawMinsVal < 10) ? "0" + rawMinsVal : rawMinsVal}-${(rawSecsVal < 10) ? "0" + rawSecsVal : rawSecsVal}`;
}

export function canvas_downloadPNG(src, filenameStem) {
    /*
    filenameStem = Sk.ffi.remapToJs(filenameStem);
    // convertToBlob gives a promise, so we use Skulpt's suspensions to block until it has completed:
    let susp = new Sk.misceval.Suspension();
    function susp.resume () {
        if (susp.data["error"]) {
            throw new Sk.builtin.IOError(susp.data["error"].message);
        }
        return susp.ret;
    }
    susp.data = {
        type: "Sk.promise",
        promise: new Promise(function (resolve, reject) {
            src.convertToBlob().then((blob) => {
                if(blob){
                    saveAs(blob, `${filenameStem}_${getDateTimeFormatted(new Date(Date.now()))}.png`);
                    resolve();
                }
                else {
                    reject("Unknown error saving image");
                }
            });
        }),
    }
    return susp;
     */
}

