<template>
    <a @click="startPicking" v-t="'appMenu.pickFromGoogleDrive'" class="strype-menu-link strype-menu-item"/>
</template>
<script lang="ts">
import Vue from "vue";
import {useStore} from "@/store/store";
import { CustomEventTypes } from "@/helpers/editor";

// Derived from https://medium.com/timeless/google-picker-with-vue-2a39de7f36e

export default Vue.extend({
    name: "GoogleDriveFilePicker",
    
    props: {
        devKey : String,
        oauthToken : {
            type: [String],
            required: false,
        },
    },
        
    // We don't import the Google scripts in this component because we rely on the parent GoogleDrive component having done it.

    methods: {
        startPicking() {
            gapi.load("picker", () => {
                this.createPicker();
                this.$parent.$emit(CustomEventTypes.strypeMenuActionPerformed);
            });
        },
        
        createPicker() {
            const docsView = new google.picker.DocsView();
            docsView.setMimeTypes("application/strype");
            const picker = new google.picker.PickerBuilder()
                .disableFeature(google.picker.Feature.MULTISELECT_ENABLED)
                .addView(docsView)
                .setLocale(useStore().appLang)
                .setOAuthToken(this.oauthToken)
                .setDeveloperKey(this.devKey)
                .setCallback(this.pickerCallback)
                .build();
            picker.setVisible(true);
        },

        async pickerCallback(data : google.picker.ResponseObject) {
            if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
                this.$emit("picked", data[google.picker.Response.DOCUMENTS][0][google.picker.Document.ID]);
            }
        },
    },
});
</script>
