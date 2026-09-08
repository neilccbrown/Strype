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
