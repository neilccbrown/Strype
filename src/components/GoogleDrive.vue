<template>
    <div>
        <button v-if="!signedIn" type="button" @click="signIn();" class="btn btn-secondary cmd-button">
            Sign-in with Google
        </button>
        <button v-if="signedIn" type="button" @click="saveToGoogleDrive" v-t="'buttonLabel.saveToGoogleDrive'" class="btn btn-secondary cmd-button"/>
    </div>
</template>
<script lang="ts">
import Vue from "vue";

export default Vue.extend({
    name: "GoogleDrive",

    data(){
        return {
            signedIn : false as boolean,
            client: null as google.accounts.oauth2.TokenClient | null, // The Google Identity client
        }
    },

    created() {
        // There's two parts to accessing Google Drive: we need to load the Drive API (the GAPI part)
        // but we also need to load Google Identity in order to be able to sign in.

        // From https://stackoverflow.com/a/60257961/412908 and https://stackoverflow.com/a/70772647/412908
        var scripts : { [key: string]: () => void } = {
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
            gapi.load("client", this.gapiStart)
        },
        // After Google API loaded, initialise and load Sheets API:
        gapiStart() {
            gapi.client.init({}).then(function () {
                //gapi.client.load('sheets', 'v4');
            }).then(function (response) {
                console.log("GAPI loaded");
            }, function (reason) {
                console.log("Error: " + reason.result.error.message);
            });
        },

        // Load Google Identity services API:
        // Note: uses a client_id assigned to Neil's acccount that is in testing mode (max 100 users) as that's all we need.
        onGSILoad() {
            this.client = google.accounts.oauth2.initTokenClient({
                client_id: "TODO",
                scope: "https://www.googleapis.com/auth/drive.file,https://www.googleapis.com/auth/drive.readonly",
                // Note: this callback is after *sign-in* (happens on button press), NOT on simply loading the client:
                callback: (response: google.accounts.oauth2.TokenResponse) => {
                    if (response) {
                        console.log("Token received: " + response);
                        this.signedIn = true;
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
    },
});
</script>
