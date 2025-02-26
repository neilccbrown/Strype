
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
