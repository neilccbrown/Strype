<template>
    <div
        v-if="isVisible"
        class="MediaPreviewPopup"
        :style="popupStyle"
        @mouseenter="cancelHidePopup"
        @mouseleave="startHidePopup"
    >
        <span class="MediaPreviewPopup-header">{{mediaInfo}}</span>
        <div class="MediaPreviewPopup-img-container">
            <img ref="previewImgElement" :src="imgDataURL" alt="Media preview" @load="imgLoaded">
        </div>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import {LoadedMedia} from "@/types/types";

export default Vue.extend({
    name: "MediaPreviewPopup",
    data() {
        return {
            isVisible: false,
            popupStyle: { top: "0px", left: "0px" },
            hideTimeout: undefined as number | undefined,
            imgDataURL: "",
            mediaInfo: "",
            mediaType: "",
        };
    },
    methods: {
        showPopup(event : MouseEvent, media: LoadedMedia) {
            this.cancelHidePopup();
            this.isVisible = true;
            this.popupStyle = {
                top: `${event.clientY + 5}px`,
                left: `${event.clientX + 5}px`,
            };

            this.mediaType = media.mediaType;
            if (media.audioBuffer) {
                this.mediaInfo = "Sound";
                this.imgDataURL = media.imageDataURL;
            }
            else {
                if (this.imgDataURL != media.imageDataURL) {
                    this.imgDataURL = media.imageDataURL;
                    this.mediaInfo = "Image";
                }
            }
        },
        imgLoaded(event: Event) {
            const previewImgElement = event.target as HTMLImageElement;
            if (this.mediaType.startsWith("image/")) {
                this.mediaInfo = `Image (${this.mediaType.replace("image/", "")}), ${previewImgElement?.width} × ${previewImgElement?.height} pixels`;
            }
        },
        startHidePopup() {
            this.hideTimeout = window.setTimeout(() => {
                this.isVisible = false;
            }, 300);
        },
        cancelHidePopup() {
            window.clearTimeout(this.hideTimeout);
        },
    },
});
</script>

<style>
.MediaPreviewPopup {
    position: absolute;
    background: white;
    color: black;
    padding: 5px;
    border: 1px solid #444;
    border-radius: 5px;
    transition: opacity 0.2s;
    filter: drop-shadow(2px 2px #444444cc);
}
.MediaPreviewPopup img {
    max-width: 200px;
    max-height: 200px;
    object-fit: contain;
}
.MediaPreviewPopup-img-container {
    /* Checkerboard background to reveal transparency in image: */
    background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAACXBIWXMAAC4jAAAuIwF4pT92AAAAJ0lEQVQY02Pcv38/AypwcHBAE2FiIAIMRkWM////RxM6cODAcPEdAIlzCFHU4KMkAAAAAElFTkSuQmCC') repeat;
    position: relative;
    /* Important to make div size match img size: */
    display: inline-block;
}
.MediaPreviewPopup-header {
    display: block;
    text-align: center;
}
</style>
