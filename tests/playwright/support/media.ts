import { PNG } from "pngjs";

/**
 * Generates a data URL for a solid black PNG.
 *
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @returns A base64 encode of the image
 */
export function createBlackPngBase64(width: number, height: number): string {
    if (width <= 0 || height <= 0) {
        throw new Error("Width and height must be positive");
    }

    const png = new PNG({ width, height });

    // Every pixel defaults to 0, so set alpha to 255.
    for (let i = 0; i < png.data.length; i += 4) {
        png.data[i + 3] = 255; // A
    }

    const buffer = PNG.sync.write(png);

    return buffer.toString("base64");
}

/**
 * Generates a data URL for a PNG with a red gradient left-to-right and a green gradient
 * top-to-bottom (blue held constant), so tests can check that pixels end up in the
 * geometrically-correct place after a transform (e.g. a rotate) by sampling many points and
 * comparing against the exact expected colour at that position -- not just that the overall
 * image dimensions are right, or that a few solid blocks moved to a plausible-looking place.
 *
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @returns A base64 encode of the image
 */
export function createGradientPngBase64(width: number, height: number): string {
    if (width <= 0 || height <= 0) {
        throw new Error("Width and height must be positive");
    }

    const png = new PNG({ width, height });

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (width * y + x) << 2;
            png.data[idx] = Math.round(255 * x / (width - 1));
            png.data[idx + 1] = Math.round(255 * y / (height - 1));
            png.data[idx + 2] = 128;
            png.data[idx + 3] = 255;
        }
    }

    const buffer = PNG.sync.write(png);

    return buffer.toString("base64");
}
