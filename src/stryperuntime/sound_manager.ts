import {makeSoundHandle, RemoteSound} from "@/stryperuntime/worker_bridge_type";
import audioBufferToWav from "audiobuffer-to-wav";

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
                promise = this.callbacks.loadLibraryAsset(libraryName, fileName).then(async (dataURL : string) => {
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

    getMonoSamples(index: number) : Float32Array {
        const buffer = this.loadedSounds[index];
        return buffer.getChannelData(0);
    }

    setMonoSoundSampleValues(index: number, values: number[], offset: number) : void {
        const buffer = this.loadedSounds[index];
        const floats = new Float32Array(values);
        if (offset < 0 || offset >= buffer.length) {
            throw new Error("Invalid offset when setting samples: " + offset + " (sound length is " + buffer.length + ")");
        }
        if (offset + floats.length > buffer.length) {
            throw new Error("Setting samples would go beyond end of sound, offset: " + offset + " + number of samples: " + floats.length + " > sound length: " + buffer.length);
        }
        buffer.copyToChannel(floats, 0, offset);
    }

    getAsWAV(index: number) : ArrayBuffer {
        const buffer = this.loadedSounds[index];
        return audioBufferToWav(buffer);
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
}
