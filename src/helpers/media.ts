import toWav from "audiobuffer-to-wav";
import { MediaDataAndDim } from "@/types/types";
import { readFileAsyncAsData, readImageSizeFromDataURI } from "./common";


// Adapted from https://stackoverflow.com/questions/66776487/how-to-convert-mp3-to-the-sound-wave-image-using-javascript
// Returns base64 version of PNG of image
export function drawSoundOnCanvas(audioBuffer : AudioBuffer, targetWidth: number, targetHeight: number, volumeFactor = 1.0, rescaleToMax = 1.0) : string {
    const float32Arrays : Float32Array[] = [];
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        float32Arrays.push(audioBuffer.getChannelData(ch));
    }
    const array = [];

    let i = 0;
    const length = audioBuffer.length;
    const chunkSize = Math.floor(length / targetWidth);
    while (i < length) {
        let max = 0;
        // We take the max out of all values in the chunk, across all channels:
        for (const arr of float32Arrays) {
            max = Math.max(arr.slice(i, i + chunkSize).reduce(function (total, value) {
                return Math.max(total, Math.abs(value));
            }));
        }
        array.push(max);
        i += chunkSize;
    }

    const img = document.createElement("canvas");
    img.width = targetWidth;
    img.height = targetHeight;
    const ctx = img.getContext("2d") as OffscreenCanvasRenderingContext2D | null;
    if (ctx == null) {
        // Shouldn't happen:
        return "";
    }
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    for (let index = 0; index < array.length; index++) {
        ctx.strokeStyle = "green";
        ctx.beginPath();
        // Most sounds don't reach max volume so we allow rescaling to give a more indicative preview:
        ctx.moveTo(index, targetHeight/2 - Math.min(rescaleToMax, volumeFactor * Math.abs(array[index]))/rescaleToMax * targetHeight/2);
        ctx.lineTo(index, targetHeight/2 + Math.min(rescaleToMax, volumeFactor * Math.abs(array[index]))/rescaleToMax * targetHeight/2);
        ctx.stroke();
    }
    return img.toDataURL("image/png");
}

export function getRMS(audioBuffer: AudioBuffer, volumeFactor: number, firstSampleIncl?: number, lastSampleExcl?: number) : number {
    const numChannels = audioBuffer.numberOfChannels;
    let rms = 0;
    let sampleCount = 0;

    // Calculate RMS level
    for (let channel = 0; channel < numChannels; channel++) {
        const samples = audioBuffer.getChannelData(channel);
        for (let i = firstSampleIncl ?? 0; i < (lastSampleExcl ?? samples.length); i++) {
            rms += samples[i] * samples[i] * volumeFactor * volumeFactor; // Sum squared values
            sampleCount++;
        }
    }

    rms = Math.sqrt(rms / sampleCount); // Compute RMS
    return rms;
}

export async function audioBufferToDataURL(audioBuffer : AudioBuffer) : Promise<string> {
    const wavArrayBuffer = toWav(audioBuffer);
    return new Promise((resolve) => {
        const blob = new Blob([wavArrayBuffer], { type: "audio/wav" });
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });
}

export function bufferToBase64(buffer: ArrayBuffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const blob = new Blob([buffer], { type: "application/octet-stream" });
        const reader = new FileReader();

        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            // Strip off the 'data:application/octet-stream;base64,' part
            const base64 = dataUrl.split(",")[1];
            resolve(base64);
        };

        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function svgToPngDataUri(svgText: string): Promise<string> {
    return new Promise((resolve, reject) => {
        // 1. Create a Blob for the SVG
        const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        // 2. Load into an <img>
        const img = new Image();
        img.onload = () => {
            const w = img.width || 300;
            const h = img.height || 300;

            // 3. Draw to canvas
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                return reject("Canvas context missing");
            }

            ctx.drawImage(img, 0, 0, w, h);

            // 4. Convert canvas to PNG data URI
            const pngUri = canvas.toDataURL("image/png");

            // 5. Cleanup
            URL.revokeObjectURL(url);
            resolve(pngUri);
        };
        img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(e);
        };
        img.src = url;
    });
}

export function preparePasteMediaData(event: ClipboardEvent, callBackOnDataDimAndCode: (code: string, dataAndDim: MediaDataAndDim) => void): void {
    const withData = (dataAndDim : MediaDataAndDim) => {
        // The code is the code to load the literal from its base64 string representation:
        const code = (dataAndDim.itemType.startsWith("image") ? "load_image" : "load_sound") + "(\"" + dataAndDim.dataURI + "\")";
        callBackOnDataDimAndCode(code, dataAndDim);
    };

    if(event.clipboardData?.items){
        // SVGs are generally put on the clipboard as HTML content by browsers when you copy them
        // So we need to look for HTML that starts <svg
        
        // Apparently for handling HTML we should try to query it direct as it's not always
        // present in the list of clipboard items:
        let html = event.clipboardData?.getData("text/html");
        // Otherwise look in the items:
        if (!html) {
            for (const item of event.clipboardData?.items) {
                if (item.type == "text/html") {
                    item.getAsString((s) => {
                        html = s;
                    });
                    break;
                }
            }
        }
        if (html && (html.startsWith("<svg") || html.startsWith("<img"))) {
            // It can be an img with an SVG source (we do this on our front page for the KCL logo)
            // so in that case we find the SVG link and fetch it:
            // (This may be blocked by CORS, but nothing we can do about that).
            const match = html.match(/<img[^>]+src=["']([^"']+\.svg)['"]/i);
            if (match) {
                const svgUrl = match[1];
                fetch(svgUrl).then((r) => r.text()).then(svgToPngDataUri).then(readImageSizeFromDataURI).then((v) => withData({...v, itemType: "image/png"}));
                return;
            }
            else if (html.startsWith("<svg")) {
                // Convert to PNG then use our existing infrastructure:
                svgToPngDataUri(html).then(readImageSizeFromDataURI).then((v) => withData({...v, itemType: "image/png"}));
                return;
            }
            
        }
        
        for (const item of event.clipboardData.items) {
            const file = item.getAsFile();
            // Note: it is incredibly important that we store item.type in a variable here.  Due to browser clipboard
            // permissions, if we access item.type inside the .then() below, it will appear blank.  So we must
            // fetch it now and store it:
            const itemType = item.type;
            const isImage = itemType.startsWith("image");
            const isAudio = itemType.startsWith("audio");
            if (file && (isImage || isAudio)) {
                readFileAsyncAsData(file).then(isImage ? readImageSizeFromDataURI : (s) => Promise.resolve({dataURI: s, width: -1, height: -1})).then((v) => withData({...v, itemType}));
                return;
            }
        }
    }
}