<template>
    <div class="google-drive-container">
        <a v-if="!signedIn" @click="signIn" v-t="'appMenu.signInToGoogle'" class="strype-menu-link strype-menu-item"/>
        <GoogleDriveFilePicker v-if="signedIn" @picked="loadPickedId" :dev-key="'AIzaSyDKjPl4foVEM8iCMTkgu_FpedJ604vbm6E'" :oauth-token="oauthToken"/>
        <a v-if="signedIn" v-b-modal.ask-gdrive-filename v-t="'appMenu.saveToGoogleDrive'" class="strype-menu-link strype-menu-item"/>
        <b-modal no-close-on-backdrop hide-header-close ok-only id="ask-gdrive-filename" ref="ask-gdrive-filename" :title="$t('appMessage.enterFileNameTitle')" @hidden="startSavingToGoogleDrive">
            <p>{{this.enterFileNameLabel}}</p>
            <input v-model="saveFileName" />
        </b-modal>
    </div>
</template>
<script lang="ts">
import Vue from "vue";
import {mapStores} from "pinia";
import {useStore} from "@/store/store";
import GoogleDriveFilePicker from "@/components/GoogleDriveFilePicker.vue";
import i18n from "@/i18n";
import { CustomEventTypes } from "@/helpers/editor";

export default Vue.extend({
    name: "GoogleDrive",
    
    components: {
        GoogleDriveFilePicker,
    },

    data(){
        return {
            signedIn : false,
            client: null as google.accounts.oauth2.TokenClient | null, // The Google Identity client
            oauthToken : null as string | null,
            // This is only used to get the name from the dialog to the Google request:
            saveFileName : "Strype Project " + new Date().toLocaleDateString(),
            // This actually uniquely identifies the file to save to: 
            saveFileId : undefined as string | undefined,
        };
    },

    created() {
        // There's two parts to accessing Google Drive: we need to load the Drive API (the GAPI part)
        // but we also need to load Google Identity in order to be able to sign in.

        // From https://stackoverflow.com/a/60257961/412908 and https://stackoverflow.com/a/70772647/412908
        const scripts : { [key: string]: () => void } = {
            "https://accounts.google.com/gsi/client": () => this.onGSILoad(),
            "https://apis.google.com/js/api.js" : () => this.onGAPILoad(),
        };
        // Can't believe this is how we have to load external scripts in Vue, but that's what the Internet says:
        Object.keys(scripts).forEach((url) => {
            let tag = document.createElement("script");
            tag.onload = scripts[url];
            tag.src = url;
            tag.defer = true;
            tag.async = true;
            document.head.appendChild(tag);
        });
    },

    methods: {
        // Load up general Google API:
        onGAPILoad() {
            gapi.load("client", this.gapiStart);
        },
        // After Google API loaded, initialise client:
        gapiStart() {
            gapi.client.init({
            }).then(function (response) {
                console.log("GAPI loaded");
            }, function (reason) {
                console.log("GAPI Error: " + reason.result.error.message);
            });
        },

        // Load Google Identity services API:
        onGSILoad() {
            this.client = google.accounts.oauth2.initTokenClient({
                client_id: "802295052786-h65netp8r9961pekqnhnt3oapcb9o8ji.apps.googleusercontent.com",
                scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly",
                // Note: this callback is after *sign-in* (happens on button press), NOT on simply loading the client:
                callback: (response: google.accounts.oauth2.TokenResponse) => {
                    if (response) {
                        //console.log("Token received: " + response);
                        this.signedIn = true;
                        this.oauthToken = response.access_token;
                        this.updateSignInStatus();
                    }
                },
            });
        },
        // Sign us in when the button is clicked:
        signIn() {
            this.client?.requestAccessToken();
            this.$emit(CustomEventTypes.strypeMenuActionPerformed);
        },

        // After signing in:
        updateSignInStatus() {
            // Notify parent
            this.$emit("google-drive-signed");
        },

        saveFile(content: string) {
            // Using this example: https://stackoverflow.com/a/38475303/412908
            // Arbitrary long string:
            const boundary = "2db8c22f75474a58cd13fa2d3425017015d392ce0";
            const body : string[] = [];
            body.push("Content-Type: application/json; charset=UTF-8\n\n" + JSON.stringify({
                "name": this.saveFileName,
                "mimeType": "application/strype",
            }) + "\n");
            body.push("Content-Type: text/plain; charset=UTF-8\n\n" + content + "\n");
            const fullBody = body.map((s) => "--" + boundary + "\n" + s).join("") + "--" + boundary + "--\n";
            gapi.client.request({
                path: "https://www.googleapis.com/upload/drive/v3/files" + (this.saveFileId === undefined ? "" : "/" + this.saveFileId),
                method: this.saveFileId === undefined ?  "POST" : "PATCH",
                params: {"uploadType": "multipart"},
                headers: {
                    "Content-Type" : "multipart/related; boundary=\"" + boundary + "\"",
                },
                body: fullBody,
            }).execute((resp) => {
                //console.log("Save response: " + JSON.stringify(resp)); 
                if (resp?.id) {
                    this.saveFileId = resp.id;
                }
            });
        },

        startSavingToGoogleDrive() : void {
            this.$root.$emit("setAutoSaveFunction", () => this.saveFile(this.appStore.generateStateJSONStrWithCheckpoint()));
        },
        
        loadPickedId(id : string) : void {
            gapi.client.request({
                path: "https://www.googleapis.com/drive/v3/files/" + id,
                method: "GET",
                params: {"alt": "media"},
            }).execute((resp) => {
                this.appStore.setStateFromJSONStr(
                    {
                        stateJSONStr: JSON.stringify(resp),
                    }
                );
                this.saveFileId = id;
            });
        },
    },
    computed: {
        ...mapStores(useStore),
        
        enterFileNameLabel() {
            return i18n.t("appMessage.enterFileNameLabel");
        },
    },
});
</script>

<style lang="scss">
.google-drive-container {
    flex-direction: column;
    padding: 0px !important;
    width: $strype-menu-entry-width;
}

.google-drive-container > * {
    padding: $strype-menu-entry-padding;
}
</style>