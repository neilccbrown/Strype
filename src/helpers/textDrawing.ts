import { LRU } from "./lruCache";

export const sayFont="\"Klee One\", sans-serif";

interface TextMeasurement {
    lines: string[],
    fontSize: number,
    width: number,
    height: number,
}

// Since this is quite expensive, we cache it in case users repeatedly redraw the same text:
// The map is quickest with strings, so we assemble the key into a string of the format:
// $fontSize:$fontName:$maxWidth:$maxHeight:$text
// (It doesn't matter if text has colons as it is the last item)
const textMeasureCache = new LRU<string, TextMeasurement>(1000);

const lineHeightMultiplier = 1.2;

// Returns an item of the following type (but we're in Javascript so can't actually type it):
// interface {
//    lines: string[],
//    fontSize: number,
//    width: number,
//    height: number,
// }
function calculateTextToFit(ctx: OffscreenCanvasRenderingContext2D, text: string, fontSize: number, maxWidth: number, maxHeight: number, font : string) : TextMeasurement {
    const lines : string[] = [];
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
    return {lines, fontSize, width: longestWidth, height: textHeight};
}

// Draws the given text on canvas dest at top-left of x, y with given fontSize in pixels.
// If the text would be larger than maxWidth (and maxWidth is > 0) then it will be wrapped at white space in the text.
// If the text would then be larger than maxHeight (and maxHeight is > 0), its font size will be reduced until it
// fits inside maxWidth and maxHeight.  Note that it is invalid to supply maxHeight > 0 with maxWidth = 0.
// Returns a Python dict with fields "width" and "height" with the actual width and height
export function drawText(ctx : OffscreenCanvasRenderingContext2D, text : string, x : number, y : number, fontSize : number, maxWidth : number, maxHeight : number, fontName : string) : {width: number; height: number;} {
    const key = `${fontSize}:${fontName}:${maxWidth}:${maxHeight}:${text}`;
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
    return {width: details.width, height: details.height};
}
