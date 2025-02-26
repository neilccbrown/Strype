<template>
    <ModalDlg :dlgId="dlgId" :dlgTitle="dlgTitle">
        <span class="EditImageDlg-header">Image Crop</span>
        <cropper
            ref="cropper"
            class="edit-image-cropper"
            backgroundClass="edit-image-cropper-background"
            foregroundClass="edit-image-cropper-foreground"
            imageClass="edit-image-cropper-image"
            :src="imgToEdit"
            :resizeImage=false
            :moveImage=false
            :default-size="defaultSize"
            minWidth="1"
            minHeight="1"
            @ready="imageLoaded"
            @change="change"
        ></cropper>
        <span class="EditImageDlg-header">Image Scale</span>
        <div class="EditImageDlg-scale">
            <input v-model="imageScale" type="range" id="EditImageDlg-imageScale" min="1" max="100" />
            <span class="EditImageDlg-scale-label">{{imageScale}}%</span>
        </div>
        <span class="EditImageDlg-header">Image Details</span>
        <span class="EditImageDlg-sizeInfo">Original image size: {{originalImgSize}}</span>
        <span class="EditImageDlg-sizeInfo">Changed image size: {{currentImgSize}} (approx)</span>
    </ModalDlg>
</template>

<script lang="ts">
import Vue from "vue";
import ModalDlg from "@/components/ModalDlg.vue";
import { Cropper } from "vue-advanced-cropper";
import "vue-advanced-cropper/dist/style.css";
import downscale from "downscale";
import { useStore } from "@/store/store";
import { mapStores } from "pinia";
import { BvModalEvent } from "bootstrap-vue";

export default Vue.extend({
    name: "EditImageDlg",

    components:{
        Cropper,
        ModalDlg,
    },

    props:{
        dlgId: String,
        dlgTitle: String,
        imgToEdit: String, /* Base 64 string */
    },
    
    data: function() {
        return {
            originalImgSize: "Loading...",
            currentImgSize: "Loading...",
            imageScale: 100,
            cropSize: {left: 0, top: 0, width: 1, height: 1},
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
            this.cropSize = info.coordinates; 
            this.updateCurrentSize();
        },
        imageLoaded() {
            // We have to go fetch the image from the document and ask its size:
            let img = document.getElementsByClassName("edit-image-cropper-image")?.[0] as HTMLImageElement | null;
            if (img) {
                this.originalImgSize = img.width + " × " + img.height;
                this.cropSize = {left: 0, top: 0, width: img.width, height: img.height};
                // Set scale so that image is under 1000 pixels:
                if (img.width > 1000 || img.height > 1000) {
                    this.imageScale = 100 * Math.min(1000 / img.width, 1000 / img.height);
                }
                else {
                    this.imageScale = 100;
                }
                this.updateCurrentSize();
            }
            else {
                // Shouldn't happen, but handle it gracefully in case:
                this.originalImgSize = "Unknown";
                this.currentImgSize = this.originalImgSize;
            }            
        },
        updateCurrentSize() {
            const scale = this.imageScale / 100.0;
            this.currentImgSize = Math.ceil(this.cropSize.width * scale) + " × " + Math.ceil(this.cropSize.height * scale);
        },
        getUpdatedMedia() : Promise<{code: string, mediaType: string}> {
            const { canvas } = (this.$refs.cropper as any).getResult() as {canvas : HTMLCanvasElement};
            const scale = this.imageScale / 100.0;
            let width = this.cropSize.width * scale;
            let height = this.cropSize.height * scale;
            // We set the smaller dimension to 0 to ask downscale to preserve aspect ratio:
            if (width < height) {
                width = 0;
            }
            else {
                height = 0;
            }
            // Skip resize if not needed:
            return (this.imageScale == 100 ? Promise.resolve(canvas.toDataURL()) : downscale(canvas.toDataURL(), width, 0, {imageType: "png"})).then((resized) => {
                return Promise.resolve({code: "load_image(\"" + resized + "\")", mediaType: "image/png"});
            });
        },
    },
    watch: {
        imageScale() {
            this.updateCurrentSize();
        },
        imgToEdit() {
            // When image changes (dialog being re-shown), reset scale:
            this.imageScale = 100;
        },
    },
});
</script>

<style lang="scss">
.edit-image-cropper {
    min-height: 200px;
}
.edit-image-cropper, .edit-image-cropper-background, .edit-image-cropper-foreground {
    background: white;
}
.edit-image-cropper .vue-simple-handler {
    background: blue;
}
.edit-image-cropper .vue-simple-line {
    border-color: blue;
}
.edit-image-cropper-image {
    /* Checkerboard background to reveal transparency in image: */
    background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAACXBIWXMAAC4jAAAuIwF4pT92AAAAJ0lEQVQY02Pcv38/AypwcHBAE2FiIAIMRkWM////RxM6cODAcPEdAIlzCFHU4KMkAAAAAElFTkSuQmCC') repeat;
    /* Don't smooth; we want to show the original pixelated image: */
    image-rendering: pixelated;
}
.EditImageDlg-header {
    display: block;
    text-align: center;
    font-size: 100%;
    padding-top: 15px;
    padding-bottom: 10px;
}
.EditImageDlg-header:first-child {
    padding-top: 0;
}
.EditImageDlg-scale > input {
    width: 85%;
    vertical-align: middle;
}
.EditImageDlg-scale-label {
    font-size: 80%;
    padding-left: 10px;
    vertical-align: middle;
}
.EditImageDlg-sizeInfo {
    font-size: 80%;
    display: block;
    text-align: center;
}
</style>
