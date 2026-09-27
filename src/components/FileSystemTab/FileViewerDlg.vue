<template>
    <ModalDlg :dlgId="dlgId" :dlgTitle="fileName" size="lg">
        <div class="file-viewer-dlg-body">
            <div v-if="kind === 'loading'" class="file-viewer-dlg-message">{{ $t("fileSystemTab.loading") }}</div>
            <img v-else-if="kind === 'image'" :src="objectUrl" class="file-viewer-dlg-image" :alt="fileName" />
            <div v-else-if="kind === 'sound'" class="file-viewer-dlg-sound">
                <div class="file-viewer-dlg-sound-info">{{ soundDurationLabel }}</div>
                <div class="file-viewer-dlg-sound-image-container">
                    <img :src="waveformDataUrl" alt="Waveform" />
                    <div ref="playbackLine" class="file-viewer-dlg-sound-red-line" style="opacity:0%; left:0%;"></div>
                </div>
                <button class="btn btn-secondary" @click="togglePlay">
                    {{ playing ? $t("media.soundStop") : $t("media.soundPlay") }}
                </button>
            </div>
            <pre v-else-if="kind === 'text'" class="file-viewer-dlg-text">{{ text }}</pre>
            <div v-else class="file-viewer-dlg-message">
                {{ tooLarge ? $t("fileSystemTab.viewTooLarge") : $t("fileSystemTab.viewUnsupported") }}
            </div>
        </div>
        <template #modal-footer-content="{cancel}">
            <button v-if="kind === 'unsupported'" class="btn btn-secondary" @click="$emit('download')">
                {{ $t("fileSystemTab.download") }}
            </button>
            <button class="btn btn-primary" @click="onClose(); cancel()">
                {{ $t("buttonLabel.close") }}
            </button>
        </template>
    </ModalDlg>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import ModalDlg from "@/components/ModalDlg.vue";
import { closeAudioContext, createOrGetAudioContext } from "@/helpers/audioContext";

export default defineComponent({
    name: "FileViewerDlg",

    components: {
        ModalDlg,
    },

    props: {
        dlgId: { type: String, required: true },
        fileName: { type: String, required: true },
        kind: { type: String as PropType<"loading" | "image" | "sound" | "text" | "unsupported">, required: true },
        // Only set when kind is "image" -- an object URL built from the file's bytes (see
        // FileSystemPane.vue's onView()).
        objectUrl: { type: String, default: undefined },
        // Only set when kind is "sound": the decoded audio (for playback -- see togglePlay()) and
        // its waveform, drawn the same way as the editor's own sound preview/edit dialogs (see
        // drawSoundOnCanvas, media.ts, and MediaPreviewPopup.vue/EditSoundDlg.vue's identical use
        // of it) rather than a plain native <audio> control.
        audioBuffer: { type: Object as PropType<AudioBuffer>, default: undefined },
        waveformDataUrl: { type: String, default: undefined },
        // Only set when kind is "text".
        text: { type: String, default: undefined },
        // Only meaningful when kind is "unsupported": distinguishes "too large to even try
        // previewing" from "fetched fine, but not a type we know how to render".
        tooLarge: { type: Boolean, default: false },
    },

    emits: ["closed", "download"],

    data() {
        return {
            // Set to a stop function while a preview is actually playing -- mirrors
            // MediaPreviewPopup.vue's identically-named field/pattern.
            stopPreview: null as (() => void) | null,
        };
    },

    computed: {
        playing(): boolean {
            return this.stopPreview != null;
        },

        soundDurationLabel(): string {
            const duration = this.audioBuffer?.duration ?? 0;
            return `${duration.toFixed(2)} ${this.$t("media.soundSeconds")}`;
        },
    },

    methods: {
        togglePlay(): void {
            if (this.stopPreview != null) {
                this.stopPreview();
                return;
            }
            const audioBuffer = this.audioBuffer;
            if (!audioBuffer) {
                return;
            }
            // A genuine user gesture (this click), so it's fine to create/resume the shared
            // AudioContext here -- see createOrGetAudioContext()'s own comment:
            const ctx = createOrGetAudioContext();
            const src = ctx.createBufferSource();
            src.buffer = audioBuffer;
            src.connect(ctx.destination);
            const startTime = ctx.currentTime;
            src.start();

            // There's no regular playback-progress callback, so time it ourselves -- matching
            // MediaPreviewPopup.vue's doPreview() exactly, including not bothering under 300ms:
            let updater: number | null = null;
            if (audioBuffer.duration >= 0.3) {
                updater = window.setInterval(() => {
                    const percentage = (ctx.currentTime - startTime) / audioBuffer.duration * 100;
                    if (percentage >= 100) {
                        this.stopPreview?.();
                    }
                    else {
                        const playbackLine = this.$refs.playbackLine as HTMLDivElement;
                        if (playbackLine) {
                            playbackLine.style.left = percentage + "%";
                            playbackLine.style.opacity = "100%";
                        }
                    }
                }, 100);
            }
            this.stopPreview = () => {
                src.stop();
                if (updater != null) {
                    window.clearInterval(updater);
                }
                const playbackLine = this.$refs.playbackLine as HTMLDivElement;
                if (playbackLine) {
                    playbackLine.style.opacity = "0%";
                }
                this.stopPreview = null;
            };
            src.onended = () => this.stopPreview?.();
        },

        onClose(): void {
            this.stopPreview?.();
            // No more sound can play until this dialog is (re-)shown and Play clicked again --
            // matches MediaPreviewPopup.vue's startHidePopup():
            closeAudioContext();
            this.$emit("closed");
        },
    },
});
</script>

<style lang="scss">
.file-viewer-dlg-body {
    max-height: 60vh;
    overflow: auto;
}

.file-viewer-dlg-image {
    max-width: 100%;
    display: block;
    margin: 0 auto;
}

.file-viewer-dlg-sound {
    text-align: center;
}

.file-viewer-dlg-sound-info {
    margin-bottom: 0.5em;
}

.file-viewer-dlg-sound-image-container {
    position: relative;
    display: inline-block;
    margin-bottom: 1em;

    img {
        max-width: 100%;
        display: block;
    }
}

.file-viewer-dlg-sound-red-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background-color: red;
    pointer-events: none;
    transition: opacity 0.1s;
}

.file-viewer-dlg-text {
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
}

.file-viewer-dlg-message {
    text-align: center;
    padding: 2em 0;
    opacity: 0.8;
}
</style>
