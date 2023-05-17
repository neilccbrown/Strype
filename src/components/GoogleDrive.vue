<template>
    <div class="google-drive-container">
        <a v-if="!signedIn" @click="signIn" v-t="'appMenu.signInToGoogle'" class="strype-menu-link strype-menu-item"/>
        <GoogleDriveFilePicker v-if="signedIn" @picked="loadPickedId" :dev-key="'AIzaSyDKjPl4foVEM8iCMTkgu_FpedJ604vbm6E'" :oauth-token="oauthToken"/>
        <a v-if="signedIn" v-b-modal.ask-gdrive-filename v-t="'appMenu.saveToGoogleDrive'" class="strype-menu-link strype-menu-item"/>
        <ModalDlg :dlgId="saveFileModalId" :dlgTitle="$t('appMessage.enterFileNameTitle')" :noCloseOnBackDrop="true" :hideHeaderClose="true">
            <p>{{this.enterFileNameLabel}}</p>
            <input :id="saveFileNameInputId" :value="saveFileName" :placeholder="$t('defaultProjName')" type="text"/>
            <br/>
            <input id="saveToNewGDriveCheckBox" v-model="saveToNewGDrive" type="checkbox"/>
            <label for="saveToNewGDriveCheckBox" v-t="$t('appMessage.saveAsNewFile')" style="margin-left: 5px;"/>     
        </ModalDlg>
    </div>
</template>
<script lang="ts">
import Vue from "vue";
import {mapStores} from "pinia";
import {useStore} from "@/store/store";
import GoogleDriveFilePicker from "@/components/GoogleDriveFilePicker.vue";
import i18n from "@/i18n";
import { CustomEventTypes, getAppSimpleMsgDlgId } from "@/helpers/editor";
import { strypeFileExtension } from "@/helpers/common";
import { BvModalEvent } from "bootstrap-vue";
import ModalDlg from "@/components/ModalDlg.vue";
import { MessageDefinitions } from "@/types/types";

export default Vue.extend({
    name: "GoogleDrive",
    
    components: {
        GoogleDriveFilePicker,
        ModalDlg,
    },

    data: function(){
        return {
            client: null as google.accounts.oauth2.TokenClient | null, // The Google Identity client
            oauthToken : null as string | null,
            saveToNewGDrive: false,
        };
    },

    computed: {
        ...mapStores(useStore),

        saveFileModalId(): string{
            return "ask-gdrive-filename";
        },

        signedIn(): boolean{
            return this.appStore.isSignedInGoogleDrive;
        },

        saveFileNameInputId(): string {
            return "saveGDriveFileNameInput";
        },

        saveFileId:{
            // This actually uniquely identifies the file to save to:
            get(): undefined|string {
                return this.appStore.currentGoogleDriveSaveFileId;
            },
            set(value: string|undefined){
                this.appStore.currentGoogleDriveSaveFileId = value;
            },
        },
        
        enterFileNameLabel(): string {
            return i18n.t("appMessage.enterFileNameLabel") as string;
        },

        // This is only used to get the name from the dialog to the Google request. 
        // Do not have the property linked both ways as validation is needed before change is done
        saveFileName(): string{
            return this.appStore.projectName;
        },
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

    mounted(){
        // The events from Bootstrap modal are registered to the root app element.
        this.$root.$on("bv::modal::show", this.onShownModalEvent);
        this.$root.$on("bv::modal::hide", this.onSaveFileNameModalEvent);       
    },

    
    beforeDestroy(){
        // Just in case, we remove the Bootstrap modal event handler from the root app 
        this.$root.$off("bv::modal::show", this.onShownModalEvent);
        this.$root.$off("bv::modal::hide", this.onSaveFileNameModalEvent);
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
                    if (response && response.error == undefined) {
                        //console.log("Token received: " + response);
                        this.oauthToken = response.access_token;
                        this.updateSignInStatus(true);
                    }
                },
            });
        },

        // Sign us in when the button is clicked:
        signIn() {
            this.client?.requestAccessToken();
            this.$emit(CustomEventTypes.strypeMenuActionPerformed);
        },

        // After signing in or signed out:
        updateSignInStatus(signed: boolean) {
            this.appStore.isSignedInGoogleDrive = signed;
            this.$root.$emit((signed) ? CustomEventTypes.addFunctionToEditorAutoSave : CustomEventTypes.removeFunctionToEditorAutoSave, () => this.saveFile(this.appStore.generateStateJSONStrWithCheckpoint()));
        },

        onShownModalEvent(event: BvModalEvent, dlgId: string){
            // This handler should only be applied this component's modal
            if(dlgId == this.saveFileModalId){
                this.$emit(CustomEventTypes.strypeMenuActionPerformed);
                // After the above event is emitted, the Strype menu is closed and the focus is given back to the editor.
                // We want to give the focus back to the modal dialog input field. Maybe because of internal Bootstrap behaviour, can't give focus to the input right now or in next ticks
                // so we wait a bit to generate a focus/click in the input
                setTimeout(() => {
                    document.getElementById(this.saveFileNameInputId)?.focus();
                    document.getElementById(this.saveFileNameInputId)?.click();
                }, 500);           
            }
        },

        onSaveFileNameModalEvent(event: BvModalEvent, dlgId: string): void {
            // Listen to this component's modal only: if the event has been cancelled, we do nothing. Otherwise, we need to update the project name and trigger a save now.
            if(dlgId == this.saveFileModalId && (event.trigger == "ok" || event.trigger == "event")){
                const projectName = (document.getElementById(this.saveFileNameInputId) as HTMLInputElement).value.trim();
                this.appStore.projectName = (projectName.length > 0) ? projectName : i18n.t("defaultProjName") as string;
                this.saveFile(this.appStore.generateStateJSONStrWithCheckpoint());
            }
        },

        saveFile(content: string) {
            // If a new file has been request, we reset the save file id, and the flag
            if(this.saveToNewGDrive){
                this.saveFileId = undefined;
                this.saveToNewGDrive = false;
            }
            // Using this example: https://stackoverflow.com/a/38475303/412908
            // Arbitrary long string:
            const boundary = "2db8c22f75474a58cd13fa2d3425017015d392ce0";
            const body : string[] = [];
            body.push("Content-Type: application/json; charset=UTF-8\n\n" + JSON.stringify({
                "name": this.saveFileName + "." + strypeFileExtension,
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
            }).then(
                // Success of the request,
                (resp) => {
                    // Save the save file ID 
                    this.saveFileId = JSON.parse(resp.body)["id"];
                },
                // Failure of the request, 
                (reason) => {
                    this.saveFileId = undefined;
                    // If we have an authorised error (for example, timed-out connexion) we should disconnect and warn the users
                    // (not to sure why rawResp.status doesn't give the right stuff, but based on debugging, this works...)
                    if(reason.status == 401){
                        this.appStore.simpleModalDlgMsg = this.$i18n.t("appMessage.GDriveLostConnection") as string;
                        this.$root.$emit("bv::show::modal", getAppSimpleMsgDlgId());
                        this.updateSignInStatus(false);
                    }

                    if(reason.status == 404 && this.saveFileId != undefined){
                        // We assume something went wrong, if there was a current saveFileId, we reset its value to allow saving a new file and show a message
                        const message = MessageDefinitions.GDriveFileSaveFail;
                        this.appStore.currentMessage = message;
                    }
                }
            );
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