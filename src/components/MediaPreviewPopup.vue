<template>
    <div
        v-if="isVisible"
        class="MediaPreviewPopup"
        :style="popupStyle"
        @mouseenter="cancelHidePopup"
        @mouseleave="startHidePopup"
    >
        <img :src="imgDataURL" alt="Media preview">
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
        };
    },
    methods: {
        showPopup(event : MouseEvent, media: LoadedMedia) {
            this.cancelHidePopup();
            this.imgDataURL = media.imageDataURL;
            this.isVisible = true;
            this.popupStyle = {
                top: `${event.clientY + 5}px`,
                left: `${event.clientX + 5}px`,
            };
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
}
</style>
