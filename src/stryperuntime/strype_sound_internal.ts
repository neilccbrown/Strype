// This file contains the internal sound/music API for Strype.
// These functions are not directly exposed to users, but are used by sound.py to
// form the actual public API.

import {RemoteSound} from "@/stryperuntime/worker_bridge_type";
import { asyncBridge, syncBridge } from "@/workers/python_execution_type";

export function startAudioBuffer(sound : RemoteSound) : void {
    asyncBridge({request: "startSound", sound});
}
export function playAudioBufferAndWait(sound: RemoteSound) : void {
    syncBridge(({request: "playSoundAndWait", sound}));
}
export function stopAudioBuffer(sound : RemoteSound) : void {
    asyncBridge({request: "stopSound", sound});
}
export function createAudioBuffer(seconds : number, sampleRate : number) : RemoteSound {
    return syncBridge(({request: "createEmptyMonoSound", numSamples: Math.round(seconds * sampleRate), sampleRate}));
}
export function loadAndWaitForAudioBuffer(path : string) : RemoteSound {
    return syncBridge({request: "loadSound", url: path});
}
export function getSamples(sound : RemoteSound) : number[] {
    if (sound.numberOfChannels > 1) {
        throw new Error("Cannot get samples from stereo sound; convert to mono first");
    }
    else {
        return syncBridge({request: "getMonoSoundSampleValues", sound});
    }
}
export function setSamples(sound: RemoteSound, values : number[], targetOffset : number) : void {
    if (sound.numberOfChannels > 1) {
        throw new Error("Cannot set samples in stereo sound; convert to mono first");
    }
    else {
        // Simple case of mono sound:
        asyncBridge({request: "setMonoSoundSampleValues", sound, values, targetOffset});
    }
}
export function getNumSamples(sound : RemoteSound) : number {
    return sound.numSamples;
}
export function getSampleRate(sound : RemoteSound) : number {
    return sound.sampleRate;
}
export function downloadWAV(sound : RemoteSound, filenameStem : string) : void {
    asyncBridge({request: "downloadWAV", sound, filenameStem});
}
export function copy(sound : RemoteSound) : RemoteSound {
    return syncBridge({request: "cloneSound", sound, toMono: false});
}
export function copyToMono(sound: RemoteSound) : RemoteSound {
    return syncBridge({request: "cloneSound", sound, toMono: true});
}
