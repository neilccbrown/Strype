// We are not meant to create multiple audio contexts so we have one singleton context stored here.
// As noted below, it can only be created in response to a user gesture, hence why we must start
// with it being null and only create on a call to createOrGetAudioContext() below.
let audioContext : AudioContext | null = null;

// Note: you must only call this function in response to a user gesture (e.g. a mouse click)
// because only such code is allowed to create the AudioContext, which we need to do if this
// is the first time this function has been called.
export function createOrGetAudioContext() : AudioContext {
    if (audioContext == null) {
        audioContext = new AudioContext();
    }
    return audioContext;
}
