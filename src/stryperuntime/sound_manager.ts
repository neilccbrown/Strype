import {makeSoundHandle, MidiNoteEvent, RemoteSound} from "@/stryperuntime/worker_bridge_type";
import audioBufferToWav from "audiobuffer-to-wav";
import {saveAs} from "file-saver";
import {getDateTimeFormatted} from "@/helpers/common";
import {renderOffline, Scheduler, SplendidGrandPiano, Soundfont, Sampler, drumMachineToPreset} from "smplr";

// The base URL where we serve our own vendored instrument samples from (see public/midi-samples),
// rather than relying on smplr's default third-party CDN at runtime.
const MIDI_SAMPLES_BASE_URL = `${import.meta.env.BASE_URL}midi-samples`;

// Extra silence (in seconds) added after the last note ends, to let its release/decay ring out
// before the offline render is cut off.
const MIDI_RENDER_TAIL_SECONDS = 3;

// smplr's default scheduler dispatches notes using a real-time setInterval poll with a small
// (200ms) lookahead: notes further ahead than that are queued and only dispatched once real
// wall-clock time catches up. That works for live playback, but inside an OfflineAudioContext,
// currentTime doesn't advance in real time, so the poll never fires and those notes are silently
// dropped. We work around this by giving the scheduler a lookahead far longer than any piece of
// music we'll render, so every note is dispatched synchronously as soon as it's scheduled.
const MIDI_SCHEDULER_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;

// The one-shot drum sounds we vendor (see public/midi-samples/drums); each is its own alias, e.g.
// note "kick" plays the kick sample. Based on the Casio RZ-1 drum machine kit.
const DRUMS_SAMPLE_NAMES = ["clap", "clave", "cowbell", "crash", "hihat-closed", "hihat-open", "kick", "ride", "snare", "tom-1", "tom-2", "tom-3"];

type MidiInstrumentPlayer = {start: (event: {note: string | number, time: number, duration: number, velocity: number}) => void};

// Matches smplr's (unexported) DrumMachineInstrument shape, so we can build our own descriptor
// pointing at our vendored samples instead of fetching one of smplr's own hosted kits.
type DrumMachineInstrumentDescriptor = {
    baseUrl: string;
    name: string;
    samples: string[];
    groupNames: string[];
    nameToSampleName: Record<string, string | undefined>;
    sampleGroupVariations: Record<string, string[]>;
};

// The instruments we currently support in make_music()/make_advanced_music(); the key is the
// instrument name passed from Python. Every factory is given a shared Scheduler (see above).
const MIDI_INSTRUMENTS : Record<string, (ctx: OfflineAudioContext, scheduler: Scheduler) => Promise<MidiInstrumentPlayer>> = {
    piano: (ctx, scheduler) => new SplendidGrandPiano(ctx, {
        baseUrl: `${MIDI_SAMPLES_BASE_URL}/piano`,
        // Only the MF (mezzo-forte) velocity layer is vendored, so restrict loading to that;
        // smplr pitch-shifts these samples to cover the notes/velocities that aren't directly sampled.
        notesToLoad: {notes: Array.from({length: 128}, (_, i) => i), velocityRange: [85, 100]},
        // We only vendor m4a (AAC), which every mainstream browser can decode, so there's no need
        // for smplr's default ogg/m4a-by-browser fallback (and no ogg files to fall back to).
        formats: ["m4a"],
        scheduler,
    }).load,
    guitar: (ctx, scheduler) => new Soundfont(ctx, {
        // A single self-contained soundfont file (all notes bundled together as base64 audio),
        // in the classic MIDI.js format; see public/midi-samples/guitar/README.md. We only vendor
        // the mp3 version, since mp3 decodes fine in every mainstream browser.
        instrumentUrl: `${MIDI_SAMPLES_BASE_URL}/guitar/acoustic_guitar_nylon-mp3.js`,
        scheduler,
    }).load,
    drums: (ctx, scheduler) => {
        const drumsInstrument : DrumMachineInstrumentDescriptor = {
            baseUrl: `${MIDI_SAMPLES_BASE_URL}/drums`,
            name: "drums",
            samples: DRUMS_SAMPLE_NAMES,
            groupNames: DRUMS_SAMPLE_NAMES,
            nameToSampleName: Object.fromEntries(DRUMS_SAMPLE_NAMES.map((n) => [n, n])),
            sampleGroupVariations: Object.fromEntries(DRUMS_SAMPLE_NAMES.map((n) => [n, [n]])),
        };
        // Not using smplr's DrumMachine instrument directly: it hardcodes formats to ["ogg", "m4a"]
        // with no way to override, so we build the same preset via its own exported
        // drumMachineToPreset() helper and load it through the generic Sampler instead, overriding
        // the format list to just m4a (see the piano comment above for why).
        const preset = drumMachineToPreset(drumsInstrument);
        preset.samples.formats = ["m4a"];
        return new Sampler(ctx, {preset, scheduler}).load;
    },
};

// A main thread class for handling all the sounds which Python code has asked us to load or play or stop
export class SoundManager {
    private audioContext : AudioContext;
    private loadedSounds: AudioBuffer[] = [];
    private bufferToSource = new Map<AudioBuffer, AudioBufferSourceNode>(); // Used to stop playing sounds
    private callbacks : { loadLibraryAsset : (libraryShortName: string, fileName: string) => Promise<string | undefined> };
    
    constructor(ctx: AudioContext, callbacks : { loadLibraryAsset : (libraryShortName: string, fileName: string) => Promise<string | undefined> }) {
        this.audioContext = ctx;
        this.callbacks = callbacks;
    }
    
    async loadSound(url: string) : Promise<RemoteSound> {
        let promise : Promise<AudioBuffer>;
        if (url.startsWith("data:") || url.startsWith(":")) {
            const decode = (dataURL : string) =>
                this.audioContext.decodeAudioData(Uint8Array.from(atob(dataURL.split(",")[1]), (char) => char.charCodeAt(0)).buffer)
                    .then((b) => {
                        if (!b) {
                            throw Error("Cannot load audio file \"" + url.slice(0, 200) + "\"");
                        }
                        else {
                            return b;
                        }
                    });

            const match = /^:([^:]+):(.+)$/.exec(url);
            if (match) {
                // If it's some prefix between two colons, it's a library asset:
                const libraryName = match[1];
                const fileName = match[2];
                promise = this.callbacks.loadLibraryAsset(libraryName, fileName).then(async (dataURL : string | undefined) => {
                    return await decode(dataURL ?? url);
                });
            }
            else {
                promise = decode(url);
            }
        }
        else {
            promise = fetch("./sounds/" + url)
                .then((d) => d.arrayBuffer())
                .then((b) => this.audioContext.decodeAudioData(b))
                .then((b) => {
                    if (!b) {
                        throw Error("Cannot load audio file \"" + url.slice(0, 200) + "\"");
                    }
                    else {
                        return b;
                    }
                });
        }
        return await promise.then((buffer) => {
            const h = this.loadedSounds.length;
            this.loadedSounds.push(buffer);
            return {handle: makeSoundHandle(h), numSamples: buffer.length, sampleRate: buffer.sampleRate, numberOfChannels: buffer.numberOfChannels};
        });
    }

    playAudioBuffer(index: number) : Promise<void> {
        const audioBuffer = this.loadedSounds[index];
        if (audioBuffer) {
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            const sm = this;
            return new Promise(function (resolve, reject) {
                source.onended = (ev) => {
                    sm.bufferToSource.delete(audioBuffer);
                    resolve();
                };
                sm.bufferToSource.set(audioBuffer, source);
                source.start();
            });
        }
        else {
            return Promise.resolve();
        }
    }

    stopAudioBuffer(index: number) : void {
        const audioBuffer = this.loadedSounds[index];
        const source = this.bufferToSource.get(audioBuffer);
        if (source) {
            source.stop();
        }
        // It's not an error if source is null, it either means the sound hasn't been playing, or it already finished
    }

    createMonoSound(numSamples: number, sampleRate: number) : number {
        const audioBuffer = new AudioBuffer({length: numSamples, sampleRate: sampleRate, numberOfChannels: 1});
        this.loadedSounds.push(audioBuffer);
        return this.loadedSounds.length - 1;
    }
    
    createMonoSoundFromSamples(samples: Float32Array, sampleRate: number) : number {
        const audioBuffer = this.makeAudioBufferFromSamples(samples, sampleRate);

        this.loadedSounds.push(audioBuffer);
        return this.loadedSounds.length - 1;

    }

    private makeAudioBufferFromSamples(samples: Float32Array, sampleRate: number) {
        const length = samples.length;
        // Create a mono AudioBuffer
        const audioBuffer = this.audioContext.createBuffer(1, length, sampleRate);

        // Get the channel data array
        const channel = audioBuffer.getChannelData(0);

        // Copy samples (clamp just to be safe)
        for (let i = 0; i < length; i++) {
            const s = samples[i];
            channel[i] = Math.max(-1, Math.min(1, s));
        }
        return audioBuffer;
    }

    getMonoSamples(index: number) : Float32Array {
        const buffer = this.loadedSounds[index];
        return buffer.getChannelData(0);
    }

    setMonoSoundSampleValues(index: number, values: Float32Array<ArrayBuffer>) : void {
        const buffer = this.loadedSounds[index];
        // If it's the same number of samples we can just replace:
        if (values.length == buffer.length) {
            buffer.copyToChannel(values, 0, 0);
        }
        else {
            // Otherwise we must make a new AudioBuffer and replace.
            this.bufferToSource.delete(buffer);
            // This is invisible to the Python side of things as they use the index as the ID:
            this.loadedSounds[index] = this.makeAudioBufferFromSamples(values, buffer.sampleRate);
            
        }
    }

    async renderMidi(notes: MidiNoteEvent[]) : Promise<RemoteSound> {
        const lastNoteEnd = notes.reduce((max, n) => Math.max(max, n.time + n.duration), 0);
        const result = await renderOffline(async (ctx) => {
            // Shared across all instruments in this render (see MIDI_SCHEDULER_LOOKAHEAD_MS above):
            const scheduler = Scheduler(ctx, {lookaheadMs: MIDI_SCHEDULER_LOOKAHEAD_MS});
            // Notes can use different instruments, so we lazily build one player per distinct
            // instrument name used, and route each note to the right one; all players share the
            // same OfflineAudioContext, so they mix together into a single rendered buffer.
            const players = new Map<string, MidiInstrumentPlayer>();
            for (const n of notes) {
                let player = players.get(n.instrument);
                if (!player) {
                    const makeInstrument = MIDI_INSTRUMENTS[n.instrument];
                    if (!makeInstrument) {
                        throw new Error(`Unknown MIDI instrument "${n.instrument}".  Available instruments: ${Object.keys(MIDI_INSTRUMENTS).join(", ")}`);
                    }
                    player = await makeInstrument(ctx, scheduler);
                    players.set(n.instrument, player);
                }
                player.start(n);
            }
        }, {duration: lastNoteEnd + MIDI_RENDER_TAIL_SECONDS});

        const soundIndex = this.loadedSounds.length;
        this.loadedSounds.push(result.audioBuffer);
        return {
            handle: makeSoundHandle(soundIndex),
            numberOfChannels: result.audioBuffer.numberOfChannels,
            numSamples: result.audioBuffer.length,
            sampleRate: result.audioBuffer.sampleRate,
        };
    }

    getAsWAV(index: number) : ArrayBuffer {
        const buffer = this.loadedSounds[index];
        return audioBufferToWav(buffer);
    }
    
    downloadWAV(indexOrSound: number | AudioBuffer, filenameStem: string) : void {
        const wavArrayBuffer = typeof(indexOrSound) === "number" ? this.getAsWAV(indexOrSound) : audioBufferToWav(indexOrSound);
        const blob = new Blob([wavArrayBuffer], { type: "audio/wav" });
        saveAs(blob, `${filenameStem}_${getDateTimeFormatted(new Date(Date.now()))}.wav`);
    }

    cloneSound(index: number, toMono: boolean) : Promise<number> {
        const audioBuffer = this.loadedSounds[index];
        if (!toMono) {
            // Copy all channels:
            const numberOfChannels = audioBuffer.numberOfChannels;
            const copiedBuffer = this.audioContext.createBuffer(
                numberOfChannels,
                audioBuffer.length,
                audioBuffer.sampleRate
            );
            
            // Doesn't have to be done async but will stop us blocking the main thread with time-consuming copy:
            return new Promise((resolve, reject) => {
                for (let channel = 0; channel < numberOfChannels; channel++) {
                    const sourceData = audioBuffer.getChannelData(channel);
                    const targetData = copiedBuffer.getChannelData(channel);
                    targetData.set(sourceData);
                }

                this.loadedSounds.push(copiedBuffer);

                resolve(this.loadedSounds.length - 1);
            });
        }
        else {
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

            return downmixContext.startRendering().then((b) => {
                if (!b) {
                    throw Error("Cannot convert to mono for unknown reason");
                }
                else  {
                    this.loadedSounds.push(b);
                    return this.loadedSounds.length - 1;
                }
            });
        }
    }
    
    stopAllSounds() : void {
        this.bufferToSource.values().forEach((buffer) => {
            try {
                buffer.stop();
            }
            catch {
                // Ignore any errors while stopping.
            }
        });
    }
}
