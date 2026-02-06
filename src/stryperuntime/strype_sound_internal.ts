/* eslint-disable @typescript-eslint/no-unused-vars */
// Disabled until we convert to Typescript and export everything

// This file contains the internal sound/music API for Strype.
// These functions are not directly exposed to users, but are used by sound.py to
// form the actual public API.

import {RemoteSound, SyncStrypePyodideHandlerFunction} from "@/stryperuntime/worker_bridge_type";
import { asyncBridge, PyodideWorkerGlobalScope, syncBridge } from "@/workers/python_execution_type";

declare const globalThis: PyodideWorkerGlobalScope;

export function startAudioBuffer(sound : RemoteSound) : void {
    asyncBridge({request: "startSound", sound});
}
export function playAudioBufferAndWait(sound: RemoteSound) : void {
    syncBridge(({request: "playSoundAndWait", sound}));
}
export function stopAudioBuffer(sound : RemoteSound) : void {
    asyncBridge({request: "stopSound", sound});
}
export function createAudioBuffer(seconds : number, samplesPerSecond : number) : RemoteSound {
    return syncBridge(({request: "createEmptyMonoSound", numSamples: Math.round(seconds * samplesPerSecond), samplesPerSecond}));
}
export function loadAndWaitForAudioBuffer(path : string) : RemoteSound {
    return syncBridge({request: "loadSound", url: path});
}
function getSamples(sound : RemoteSound) : number[] {
    if (sound.numberOfChannels > 1) {
        throw new Error("Cannot get samples from stereo sound; convert to mono first");
    }
    else {
        return syncBridge({request: "getMonoSoundSampleValues", sound});
    }
};
function setSamples(sound: RemoteSound, values : number[], targetOffset : number) {
    if (sound.numberOfChannels > 1) {
        throw new Error("Cannot set samples in stereo sound; convert to mono first");
    }
    else {
        // Simple case of mono sound:
        asyncBridge({request: "setMonoSoundSampleValues", sound, values, targetOffset});
        
        
    }
};
export function getNumSamples(sound : RemoteSound) : number {
    return sound.numSamples;
};
export function getSampleRate(sound : RemoteSound) : number {
    return sound.sampleRate;
};
function downloadWAV(sound : RemoteSound, filenameStem : string) {
    asyncBridge({request: "downloadWAV", sound, filenameStem});
};
function copy(sound : RemoteSound) {
    return syncBridge({request: "cloneSound", sound, toMono: false});
}
function copyToMono(sound: RemoteSound) {
    /*
    
    
     */
};
