// Decodes/encodes PNGs via the browser's own canvas/Image APIs rather than pngjs.
//
// These Cypress specs used to decode/encode PNGs (for pixel-level screenshot comparison) with
// the "pngjs" package. That relies on Node's `zlib.Inflate` class and `util.inherits`, and
// Cypress's spec bundler (as of the Cypress 15 upgrade) no longer polyfills those for browser
// code, so importing any part of pngjs that touches them crashes with either
// "util.inherits is not a function" or "Cannot read properties of undefined (reading
// 'prototype')". Since these specs already run in a real browser, decoding/encoding through a
// canvas avoids depending on those Node polyfills at all, and this is what the file's own
// comment about avoiding browser screenshotting/colour-space transforms already aims for --
// this is a straight, transformation-free PNG codec, not a screenshot.
export interface DecodedImage {
    width: number;
    height: number;
    data: Uint8ClampedArray;
}

export function decodePngBase64(base64: string): Promise<DecodedImage> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            resolve({width: canvas.width, height: canvas.height, data: imageData.data});
        };
        img.onerror = () => reject(new Error("Failed to decode PNG"));
        img.src = "data:image/png;base64," + base64;
    });
}

export function encodePngBase64(width: number, height: number, data: Uint8ClampedArray): string {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
    return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
}
