/* eslint-disable @typescript-eslint/no-unused-vars */
// Disabled until we convert to Typescript and export everything

// This file contains the internal sound/music API for Strype.
// These functions are not directly exposed to users, but are used by sound.py to
// form the actual public API.

import {RemoteSound, StrypePyodideHandlerFunctionSync} from "@/stryperuntime/worker_bridge_type";
import {PyodideWorkerGlobalScope} from "@/workers/python_execution_type";

declare const globalThis: PyodideWorkerGlobalScope;

const bridge : StrypePyodideHandlerFunctionSync = (req) => {
    return globalThis.StrypePyodideWorkerBridge(req);
};

export function startAudioBuffer(sound : RemoteSound) : undefined {
    return bridge({request: "startSound", sound});
};
function playAudioBufferAndWait(audioBuffer) {
    /*
    let susp = new Sk.misceval.Suspension();
    function susp.resume () {
        if (susp.data["error"]) {
            throw new Sk.builtin.IOError(susp.data["error"].message);
        }
    };
    susp.data = {
        type: "Sk.promise",
        promise: peaComponent.__vue__.playAudioBuffer(audioBuffer),
    };
    return susp;
    
     */
};
function stopAudioBuffer(audioBuffer) {
    peaComponent.__vue__.stopAudioBuffer(audioBuffer);
};
function createAudioBuffer(seconds : number, samplesPerSecond : number) {
    return new AudioBuffer({length: Math.round(seconds * samplesPerSecond), sampleRate: samplesPerSecond});
};
export function loadAndWaitForAudioBuffer(path : string) : RemoteSound {
    return bridge({request: "loadSound", url: path});
}
function getSamples(buffer) {
    if (buffer.numberOfChannels > 1) {
        throw new Error("Cannot get samples from stereo sound; convert to mono first");
    }
    else {
        // Simple case of mono sound: just return the data
        return Sk.ffi.remapToPy(buffer.getChannelData(0));
    }
};
function setSamples(buffer, floatArray, offset) {
    if (buffer.numberOfChannels > 1) {
        throw new Error("Cannot set samples in stereo sound; convert to mono first");
    }
    else {
        // Simple case of mono sound: 
        const floats = new Float32Array(Sk.ffi.remapToJs(floatArray));
        if (offset < 0 || offset >= buffer.length) {
            throw new Error("Invalid offset when setting samples: " + offset + " (sound length is " + buffer.length + ")");
        }
        if (offset + floats.length > buffer.length) {
            throw new Error("Setting samples would go beyond end of sound, offset: " + offset + " + number of samples: " + floats.length + " > sound length: " + buffer.length);
        }
        buffer.copyToChannel(floats, 0, offset);
    }
};
export function getNumSamples(sound : RemoteSound) : number {
    return sound.numSamples;
};
export function getSampleRate(sound : RemoteSound) : number {
    return sound.sampleRate;
};
function downloadWAV(src, filenameStem) {
    filenameStem = Sk.ffi.remapToJs(filenameStem);
    peaComponent.__vue__.downloadWAV(src, filenameStem);
};
function copy(audioBuffer) {
    const audioContext = peaComponent.__vue__.getAudioContext();
    const numberOfChannels = audioBuffer.numberOfChannels;
    const copiedBuffer = audioContext.createBuffer(
        numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
    );

    for (let channel = 0; channel < numberOfChannels; channel++) {
        const sourceData = audioBuffer.getChannelData(channel);
        const targetData = copiedBuffer.getChannelData(channel);
        targetData.set(sourceData);
    }

    return copiedBuffer;
};
function copyToMono(audioBuffer) {
    /*
    // From https://gist.github.com/chrisguttandin/e49764f9c29376780f2eb1f7d22b54e4
    const downmixContext = new OfflineAudioContext(
        1,
        audioBuffer.length,
        audioBuffer.sampleRate
    );
    const bufferSource = new AudioBufferSourceNode(downmixContext, {
        buffer: audioBuffer,
    });
    bufferSource.start(0);
    bufferSource.connect(downmixContext.destination);

    let susp = new Sk.misceval.Suspension();
    function susp.resume () {
        if (susp.data["error"]) {
            throw new Sk.builtin.IOError(susp.data["error"].message);
        }
        return susp.ret;
    };
    susp.data = {
        type: "Sk.promise",
        promise: downmixContext.startRendering().then((b) => {
            if (!b) {
                susp.data["error"] = Error("Cannot convert to mono for unknown reason");
            }
            else  {
                susp.ret = b;
            }
        }),
    };
    return susp;
    
     */
};
