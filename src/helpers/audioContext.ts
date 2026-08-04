// We are not meant to create multiple audio contexts so we have one singleton context stored here.
// As noted below, it can only be created in response to a user gesture, hence why we must start
// with it being null and only create on a call to createOrGetAudioContext() below.
let audioContext : AudioContext | null = null;

// Some browsers (particularly Safari/WebKit, on both iOS and macOS) can leave an AudioContext
// in a state where it reports state "running" but has actually stopped processing audio --
// most commonly after the tab/app has been backgrounded (or the device locked) for a while.
// We track the last time we observed audioContext.currentTime advancing, so that we can spot
// a context that looks alive (state == "running") but is not actually making progress, and
// recreate it in that case.
let lastObservedCurrentTime = 0;
let lastObservedAt = 0;

// If a "running" context hasn't advanced its clock for longer than this, in wall-clock terms,
// we treat it as dead and replace it. Kept generous to avoid false positives from normal
// scheduling jitter.
const STUCK_THRESHOLD_MS = 2000;

function isStuck(ctx: AudioContext) : boolean {
    if (ctx.state !== "running") {
        return false;
    }
    const now = Date.now();
    const stuck = lastObservedAt !== 0
        && (now - lastObservedAt) > STUCK_THRESHOLD_MS
        && ctx.currentTime <= lastObservedCurrentTime;
    // Refresh our observation regardless, ready for the next check:
    lastObservedCurrentTime = ctx.currentTime;
    lastObservedAt = now;
    return stuck;
}

// Note: you must only call this function in response to a user gesture (e.g. a mouse click)
// because only such code is allowed to create the AudioContext, which we need to do if this
// is the first time this function has been called (or if we need to recover a dead context,
// see below).
export function createOrGetAudioContext() : AudioContext {
    if (audioContext == null || audioContext.state === "closed" || isStuck(audioContext)) {
        if (audioContext != null && audioContext.state !== "closed") {
            // Don't wait for this; we just want to release its resources:
            audioContext.close().catch(() => { /* Ignore errors closing a dead context */ });
        }
        audioContext = new AudioContext();
        lastObservedCurrentTime = 0;
        lastObservedAt = 0;
    }
    else if (audioContext.state === "suspended") {
        // This can happen if the browser suspended us (e.g. backgrounding); resuming does
        // not require a fresh user gesture in any of our supported browsers, so we can just
        // try it directly here.
        audioContext.resume().catch(() => { /* Ignore; caller will still get the context and can retry later */ });
    }
    return audioContext;
}

// Proactively check/recover the audio context whenever the page becomes visible again, since
// that's the most common point at which a backgrounded AudioContext will have died. This is a
// no-op if no AudioContext has been created yet.
if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && audioContext != null) {
            createOrGetAudioContext();
        }
    });
}
