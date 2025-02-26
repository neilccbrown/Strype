<template>
    <ModalDlg :dlgId="dlgId" :dlgTitle="dlgTitle">
        <span class="EditSoundDlg-header">{{$t("media.soundCrop")}}</span>
        <cropper
            ref="cropper"
            class="edit-sound-cropper"
            backgroundClass="edit-sound-cropper-background"
            foregroundClass="edit-sound-cropper-foreground"
            imageClass="edit-sound-cropper-image"
            :src="imgPreview"
            :resizeImage=false
            :moveImage=false
            :default-size="defaultSize"
            minWidth="1"
            minHeight="100"
            @change="change"
        ></cropper>
        <span class="EditSoundDlg-header">{{$t("media.volumeScale")}}</span>
        <div class="EditSoundDlg-scale">
            <input v-model="volumeScaleLogPercent" type="range" id="EditSoundDlg-imageScale" min="-70" max="70" />
            <span class="EditSoundDlg-scale-label">{{ Math.round(100.0 * (10 ** (volumeScaleLogPercent / 100.0))) }}%</span>
        </div>
        <span class="EditSoundDlg-header">{{$t("media.soundDetails")}}</span>
        <span class="EditSoundDlg-sizeInfo">{{$t("media.soundChangedLength")}} {{currentSoundLength}} {{$t("media.soundSeconds")}}</span>
        <span class="EditSoundDlg-sizeInfo">{{$t("media.soundAverageVolume")}} {{Math.round(volumeRMS * 10 * 100)}}%</span>
        <div class="EditSoundDlg-button-wrapper">
            <button class="EditSoundDlg-normalise-button" @click="doNormaliseVolume">{{$t("media.soundNormaliseVolume")}}</button>
        </div>
    </ModalDlg>
</template>

<script lang="ts">
import Vue from "vue";
import ModalDlg from "@/components/ModalDlg.vue";
import { Cropper } from "vue-advanced-cropper";
import "vue-advanced-cropper/dist/style.css";
import { useStore } from "@/store/store";
import { mapStores } from "pinia";
import { BvModalEvent } from "bootstrap-vue";
import {drawSoundOnCanvas, getRMS} from "@/helpers/media";

const previewImageWidth = 300;
const previewImageHeight = 100;

export default Vue.extend({
    name: "EditSoundDlg",

    components:{
        Cropper,
        ModalDlg,
    },

    props:{
        dlgId: String,
        dlgTitle: String,
        soundToEdit: AudioBuffer,
    },
    
    data: function() {
        return {
            imgPreview: "",
            currentSoundLength: "Loading...",
            // We want to allow 0.2 to 5.0 multiplier
            // The actual value on the slider goes from -70 to +70
            // If you put this through 10^(v/100), this turns into roughly 0.2 to 5
            volumeScaleLogPercent: 0,
            volumeRMS: 0,
            crop: {firstSampleIncl: 0, lastSampleExcl: 0, leftPixel: 0, widthPixels: 0},
        };
    },

    created() {
        // Register the event listener for the dialog here
        this.$root.$on("bv::modal::hide", this.onHideModalDlg);
    },

    beforeDestroy(){
        // Remove the event listener for the dialog here, just in case...
        this.$root.$off("bv::modal::hide", this.onHideModalDlg);
    },

    computed:{
        ...mapStores(useStore),

        dlgMsg(): string{
            return this.appStore.simpleModalDlgMsg;
        },
    },

    methods:{
        onHideModalDlg(event: BvModalEvent, id: string){
        },
        defaultSize({imageSize, visibleArea} : { imageSize: {width: number, height: number}, visibleArea : {width: number, height: number} }) {
            return {
                width: (visibleArea || imageSize).width,
                height: (visibleArea || imageSize).height,
            };
        },
        change(info : {image: any, coordinates: {left: number, top: number, width: number, height: number}}) {
            this.crop = {
                firstSampleIncl: Math.round(info.coordinates.left / previewImageWidth * this.soundToEdit?.length),
                lastSampleExcl: Math.round((info.coordinates.left + info.coordinates.width) / previewImageWidth * this.soundToEdit?.length),
                leftPixel: info.coordinates.left,
                widthPixels: info.coordinates.width,
            };
            // Changing the crop changes the average volume:
            let volumeFactor = 10 ** (this.volumeScaleLogPercent / 100.0);
            this.volumeRMS = getRMS(this.soundToEdit, volumeFactor, this.crop.firstSampleIncl, this.crop.lastSampleExcl);
            this.currentSoundLength = ((this.crop.lastSampleExcl - this.crop.firstSampleIncl - 1) / this.soundToEdit?.sampleRate).toFixed(3);
        },
        doNormaliseVolume() {
            let rms = getRMS(this.soundToEdit, 1.0, this.crop.firstSampleIncl, this.crop.lastSampleExcl);
            this.volumeScaleLogPercent = Math.max(-70, Math.min(70, Math.round(Math.log10(rms == 0.0 ? 1 : 0.1 / rms) * 100))); 
        },
        getUpdatedMedia() : Promise<{code: string, mediaType: string}> {
            const { canvas } = (this.$refs.cropper as Cropper).getResult();
            if (!canvas) {
                return Promise.reject("Loading");
            }
            return Promise.reject("TODO");
        },
    },
    watch: {
        volumeScaleLogPercent() {
            // Redraw sound with new volume:
            let volumeFactor = 10 ** (this.volumeScaleLogPercent / 100.0);
            this.imgPreview = drawSoundOnCanvas(this.soundToEdit, previewImageWidth, previewImageHeight, volumeFactor);
            this.volumeRMS = getRMS(this.soundToEdit, volumeFactor, this.crop.firstSampleIncl, this.crop.lastSampleExcl);
            // But retain same crop (have to do this after cropper has updated the image):
            Vue.nextTick(() => {
                (this.$refs.cropper as Cropper).setCoordinates({
                    left: this.crop.leftPixel,
                    width: this.crop.widthPixels,
                    top: 0,
                    height: previewImageHeight,
                });
            });
        },
        soundToEdit() {
            // When image changes (dialog being re-shown), redraw image:
            if (this.soundToEdit != null) {
                let volumeFactor = 10 ** (this.volumeScaleLogPercent / 100.0);
                this.imgPreview = drawSoundOnCanvas(this.soundToEdit, previewImageWidth, previewImageHeight, volumeFactor);
                this.volumeRMS = getRMS(this.soundToEdit, volumeFactor);
                // Reset volume scale:
                this.volumeScaleLogPercent = 0;
                this.crop = {firstSampleIncl: 0, lastSampleExcl: this.soundToEdit.length, leftPixel: 0, widthPixels: previewImageWidth};
                this.currentSoundLength = this.soundToEdit.duration.toFixed(3); 
            }
        },
    },
});
</script>

<style lang="scss">
.edit-sound-cropper {
    min-height: 200px;
}
.edit-sound-cropper, .edit-sound-cropper-background, .edit-sound-cropper-foreground {
    background: white;
}
.edit-sound-cropper .vue-simple-handler {
    background: blue;
}
.edit-sound-cropper .vue-simple-line {
    border-color: blue;
}
// Slightly hacky way to turn off top/bottom resize handlers and cursor:
.edit-sound-cropper .vue-handler-wrapper--north, .edit-sound-cropper .vue-handler-wrapper--south {
    visibility: hidden;
}
.edit-sound-cropper .vue-line-wrapper--north, .edit-sound-cropper .vue-line-wrapper--south {
    cursor: move;
}
.edit-sound-cropper-image {
    /* Checkerboard background to reveal transparency in image: */
    background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAACXBIWXMAAC4jAAAuIwF4pT92AAAAJ0lEQVQY02Pcv38/AypwcHBAE2FiIAIMRkWM////RxM6cODAcPEdAIlzCFHU4KMkAAAAAElFTkSuQmCC') repeat;
    /* Don't smooth; we want to show the original pixelated image: */
    image-rendering: pixelated;
}
.EditSoundDlg-header {
    display: block;
    text-align: center;
    font-size: 100%;
    padding-top: 15px;
    padding-bottom: 10px;
}
.EditSoundDlg-header:first-child {
    padding-top: 0;
    padding-bottom: 0;
}
.EditSoundDlg-scale > input {
    width: 85%;
    vertical-align: middle;
}
.EditSoundDlg-scale-label {
    font-size: 80%;
    padding-left: 10px;
    vertical-align: middle;
}
.EditSoundDlg-sizeInfo {
    font-size: 80%;
    display: block;
    text-align: center;
}
.EditSoundDlg-button-wrapper {
    text-align: center;
}
</style>
