import {makeSoundHandle, RemoteSound} from "@/stryperuntime/worker_bridge_type";

export class SoundManager {
    private audioContext : AudioContext;
    private loadedSounds: AudioBuffer[] = [];
    
    constructor(private ctx: AudioContext) {
        this.audioContext = ctx;
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
                promise = v.loadLibraryAsset(libraryName, fileName).then(async (dataURL : string) => {
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
            return {handle: makeSoundHandle(h), numSamples: buffer.length, sampleRate: buffer.sampleRate};
        });
    }
}
