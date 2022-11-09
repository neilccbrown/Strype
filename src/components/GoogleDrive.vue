<template>
    <div>
        <button v-if="!signedIn" type="button" @click="signIn" v-t="'buttonLabel.signInToGoogle'" class="btn btn-secondary cmd-button"/>
        <button v-if="signedIn" type="button" @click="saveToGoogleDrive();" v-t="'buttonLabel.saveToGoogleDrive'" class="btn btn-secondary cmd-button"/>
        <GoogleDriveFilePicker v-if="signedIn" @picked="loadPickedId" :dev-key="'AIzaSyDKjPl4foVEM8iCMTkgu_FpedJ604vbm6E'" :oauth-token="oauthToken" />
    </div>
</template>
<script lang="ts">
import Vue from "vue";
import {mapStores} from "pinia";
import {useStore} from "@/store/store";
import GoogleDriveFilePicker from "@/components/GoogleDriveFilePicker.vue";

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
                console.log("Error: " + reason.result.error.message);
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
                        console.log("Token received: " + response);
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
        },

        // After signing in:
        updateSignInStatus() {
            // Do nothing?  Enable button?
        },

        saveFile(name: string, content: string) {
            // Using this example: https://stackoverflow.com/a/38475303/412908
            // Arbitrary long string:
            const boundary = "2db8c22f75474a58cd13fa2d3425017015d392ce0";
            const body : string[] = [];
            body.push("Content-Type: application/json; charset=UTF-8\n\n" + JSON.stringify({
                "name": "Example Strype File", // TODO allow user to specify name
                "mimeType": "text/plain", // TODO change mime type to something sensible
            }) + "\n");
            body.push("Content-Type: text/plain; charset=UTF-8\n\n" + content + "\n");
            const fullBody = body.map((s) => "--" + boundary + "\n" + s).join("") + "--" + boundary + "--\n";
            gapi.client.request({
                path: "https://www.googleapis.com/upload/drive/v3/files",
                method: "POST",
                params: {"uploadType": "multipart"},
                headers: {
                    "Content-Type" : "multipart/related; boundary=\"" + boundary + "\"",
                },
                body: fullBody,
            }).execute((resp) => {
                console.log("Save response: " + resp);
            });
        },

        saveToGoogleDrive() : void {
            console.log("Saving to drive");
            this.saveFile("", this.appStore.generateStateJSONStrWithCheckpoint());
        },
        
        loadPickedId(id : string) : void {
            gapi.client.request({
                path: "https://www.googleapis.com/drive/v3/files/" + id,
                method: "GET",
                params: {"alt": "media"},
            }).execute((resp) => {
                console.log("Loading content from Google Drive: " + JSON.stringify(resp));
                this.appStore.setStateFromJSONStr(
                    {
                        stateJSONStr: JSON.stringify(resp),
                    }
                );
            });
        },
    },
    computed: {
        ...mapStores(useStore),
    },
});
</script>
