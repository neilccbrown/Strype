<template>
    <div/>
</template>
<script lang="ts">
import Vue from "vue";
import {useStore} from "@/store/store";
import { mapStores } from "pinia";

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

    computed:{
        ...mapStores(useStore),
    },

    data: function() {
        return {
            showFolderOnly: false,
        };
    },
        
    // We don't import the Google scripts in this component because we rely on the parent GoogleDrive component having done it.

    methods: {
        startPicking(showFolderOnly: boolean) {
            this.showFolderOnly = showFolderOnly;
            gapi.load("picker", () => {
                this.createPicker();
            });
        },
        
        createPicker() {
            // We create views for the picker: if there is a defined Strype project location, we create a first view for that location.
            // As that view won't allow navigation (at least, not clearly) we always add another view that shows everything from the Drive.
            console.log("SHOW FOLDER ONLY? " + this.showFolderOnly);
            const docsViews: google.picker.DocsView[] = [];
            if(this.appStore.strypeProjectLocation != undefined){
                const docsView = new google.picker.DocsView();
                docsView.setMimeTypes("application/vnd.google-apps.folder" + ((this.showFolderOnly) ? "" : ",application/strype"));
                docsView.setSelectFolderEnabled(this.showFolderOnly);
                console.log("init folder " + this.appStore.strypeProjectLocation);
                docsView.setParent(this.appStore.strypeProjectLocation.toString());
                (docsView as any).setLabel((this.$i18n.t("appMessage.folderX", {folder: this.appStore.strypeProjectLocationAlias}) as string));
                docsViews.push(docsView);
            }
            const docsView = new google.picker.DocsView();
            docsView.setMimeTypes("application/vnd.google-apps.folder" + ((this.showFolderOnly) ? "" : ",application/strype"));
            docsView.setSelectFolderEnabled(this.showFolderOnly);
            docsViews.push(docsView);
            console.log("Createing Picker, start ID = " + this.appStore.strypeProjectLocation?.toString());
            const pickerBuilder = new google.picker.PickerBuilder()
                .disableFeature(google.picker.Feature.MULTISELECT_ENABLED)
                .disableFeature(google.picker.Feature.NAV_HIDDEN)
                .setLocale(useStore().appLang)
                .setOAuthToken(this.oauthToken)
                .setDeveloperKey(this.devKey)
                .setCallback(this.pickerCallback)
                .setTitle(this.$i18n.t((this.showFolderOnly) ? "appMessage.selectFolder" : "appMessage.selectStrypeFile") as string);        
            docsViews.forEach((view) => pickerBuilder.addView(view));  
            pickerBuilder.build().setVisible(true);
        },

        async pickerCallback(data : google.picker.ResponseObject) {
            if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
                // Update the location of the Strype project within the Drive
                this.appStore.strypeProjectLocation = (this.showFolderOnly) 
                    ? data[google.picker.Response.DOCUMENTS][0][google.picker.Document.ID] // the folder selected is where we are now in Drive
                    : data[google.picker.Response.DOCUMENTS][0][google.picker.Document.PARENT_ID]; // the folder selected's parent is where are now in Drive
                console.log("set the Strype location in " + this.appStore.strypeProjectLocation);
                const emitEvent = (this.showFolderOnly) ? "picked-folder" : "picked-file";
                this.$emit(emitEvent, data[google.picker.Response.DOCUMENTS][0][google.picker.Document.ID], data[google.picker.Response.DOCUMENTS][0][google.picker.Document.NAME]);
            }
        },
    },
});
</script>
