<template>
    <div>
        <GoogleDriveFilePicker :ref="googleDriveFilePickerComponentId" @picked-file="loadPickedFileId" @picked-folder="doSaveFile" :dev-key="devKey" :oauth-token="oauthToken"/>
        <SimpleMsgModalDlg :dlgId="loginErrorModalDlgId"/>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import {mapStores} from "pinia";
import {useStore} from "@/store/store";
import GoogleDriveFilePicker from "@/components/GoogleDriveFilePicker.vue";
import SimpleMsgModalDlg from "@/components/SimpleMsgModalDlg.vue";
import i18n from "@/i18n";
import { CustomEventTypes, getAppSimpleMsgDlgId, SaveRequestReason } from "@/helpers/editor";
import { strypeFileExtension } from "@/helpers/common";
import { GoogleDriveScope, GoogleDriveScopesGrant, MessageDefinitions, StrypeSyncTarget } from "@/types/types";
import { BvModalEvent } from "bootstrap-vue";

export default Vue.extend({
    name: "GoogleDrive",
    
    components: {
        GoogleDriveFilePicker,
        SimpleMsgModalDlg,
    },

    data: function(){
        return {
            client: null as google.accounts.oauth2.TokenClient | null, // The Google Identity client
            oauthToken : null as string | null,
            // Google Drive scopes used within Strype with their grant statutus
            googleDriveScopesGrants: [{scope: GoogleDriveScope.all, granted: false}, {scope: GoogleDriveScope.allFilesReadonly, granted: false}, {scope: GoogleDriveScope.appFiles, granted: false}] as GoogleDriveScopesGrant[],
            currentAction: null as "load" | "save" | null, // flag the request current action for async workflow;
            loadedFileCreatedByStrype: false,
            saveReason: SaveRequestReason.autosave, // flag the reason of the save action
            saveFileName: "", // The file name, will be set via the Menu when a name is provided for saving, or when loading a project (we need to keep it live for autosave)
        };
    },

    computed: {
        ...mapStores(useStore),

        devKey(): string {
            return "AIzaSyDKjPl4foVEM8iCMTkgu_FpedJ604vbm6E";
        },

       

        googleDriveFilePickerComponentId(): string {
            return "googleDriveFilePickerComponent";
        },

        loginErrorModalDlgId(): string {
            return "gdLoginErrorModalDlg";
        },

        signedIn(): boolean {
            return this.appStore.syncTarget == StrypeSyncTarget.gd;
        },

        saveFileId: {
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

        // Register the event listener for the dialog here
        this.$root.$on("bv::modal::hide", this.onHideLoginModalDlg);  
    },

    beforeDestroy(){
        // Remove the event listener for the dialog here, just in case...
        this.$root.$off("bv::modal::hide", this.onHideLoginModalDlg);
    },

    methods: {
        // Load up general Google API:
        onGAPILoad() {
            gapi.load("client", this.gapiStart);
        },
        
        // After Google API loaded, initialise client:
        gapiStart() {
            //const apiKey = this.devKey;
            gapi.client.init({
            }).then(function (response) {
                //gapi.client.setApiKey(apiKey);
                console.log("GAPI loaded");
            }, function (reason) {
                console.log("GAPI Error: " + reason.result.error.message);
            });
        },

        // Load Google Identity services API:
        onGSILoad() {
            this.client = google.accounts.oauth2.initTokenClient({
                client_id: "802295052786-h65netp8r9961pekqnhnt3oapcb9o8ji.apps.googleusercontent.com",
                scope: this.googleDriveScopesGrants.flatMap((scopeGrant) => scopeGrant.scope).join(" "),
                // Note: this callback is after *sign-in* (happens on button press), NOT on simply loading the client:
                callback: (response: google.accounts.oauth2.TokenResponse) => {
                    console.log("ON GSI LOAD");
                    console.log(JSON.stringify(response));
                    // We check the permission to the scopes given (and keep them flagged in data). 
                    this.googleDriveScopesGrants.forEach((scopeGrant) => (scopeGrant.granted = google.accounts.oauth2.hasGrantedAnyScope(response,scopeGrant.scope)));
                    console.log(JSON.stringify(this.googleDriveScopesGrants));
                    // If "all" is granted we can proceed without any warning
                    if(!(this.googleDriveScopesGrants.find((scopeGrant) => scopeGrant.scope == GoogleDriveScope.all)?.granted)){
                        // "all" isn't granted: if any other scope is granted, then we alert the user and stop the authentication as nothing can be done on Drive
                        // otherwise, we show a warning message that indicates the limitations caused by the lack of permissions.
                        const isAppFilesGranted = this.googleDriveScopesGrants.find((scopeGrant) => scopeGrant.scope == GoogleDriveScope.appFiles)?.granted;
                        const isAllFilesReadOnlyGranted = this.googleDriveScopesGrants.find((scopeGrant) => scopeGrant.scope == GoogleDriveScope.allFilesReadonly)?.granted;
                        if(!isAppFilesGranted && !isAllFilesReadOnlyGranted){
                            this.oauthToken = null;
                            this.appStore.simpleModalDlgMsg = this.$i18n.t("errorMessage.gdrivePermissionsNotMet") as string;
                            this.$root.$emit("bv::show::modal", this.loginErrorModalDlgId);
                            return;  
                        }
                        
                        // Other cases: let's set the message for the configuration when only the allFileReadonly permission is granted:
                        // in that configuration, users can load any files of Drive, but won't be able to sync -- that's a read only mode.
                        let errorMessageName = "errorMessage.gdrivePermissionAllFilesReadOnly";
                        if(isAppFilesGranted && isAllFilesReadOnlyGranted){
                            // In that configuration, users can load any file, but will only be able to sync files written by Strype to Drive
                            errorMessageName = "errorMessage.gdrivePermissionOnlySyncStrypeFiles";
                        }
                        else if(isAppFilesGranted){
                            // In that configuration, users can only load and sync files written by Strype to Drive 
                            errorMessageName = "errorMessage.gdrivePermissionOnlyStrypeFiles";
                        }        
                        this.appStore.simpleModalDlgMsg = this.$i18n.t(errorMessageName) as string;
                        this.$root.$emit("bv::show::modal", getAppSimpleMsgDlgId());                
                    }
                             
                    if (response && response.error == undefined) {
                        this.oauthToken = response.access_token;
                        this.updateSignInStatus(true);
                    }

                    // In any case, continue the action requested by the user (need to do it in a next tick to make sure the oauthToken is updated in all Vue components)
                    this.$nextTick(() => {
                        if(this.currentAction == "load"){
                            this.doLoadFile();
                        }
                        else if(this.currentAction == "save"){
                            this.saveFile(this.saveReason);
                        }
                    });
                },
            });
        },

        // Entry point of the signing mechanism:
        signIn() {
            this.client?.requestAccessToken();
        },

        // After signing in or signed out:
        updateSignInStatus(signed: boolean) {
            if(signed){
                // If Strype only gets the scope to read files only, we will never be able to 
            }
            else{
                // If signing fails, reset to no sync
                this.appStore.syncTarget = StrypeSyncTarget.none; 
            }   
            
            this.$root.$emit((signed) ? CustomEventTypes.addFunctionToEditorAutoSave : CustomEventTypes.removeFunctionToEditorAutoSave, (saveReason: SaveRequestReason) => this.saveFile(saveReason));
        },

        // Test the connection is still valid, and allow callbacks for success or failure of the test
        testGoogleDriveConnection(onSuccessCallback: () => void, onFailureCallBack: () => void){
            const xhr = new XMLHttpRequest();
            xhr.open("GET",
                "https://www.googleapis.com/drive/v3/about?fields=user&" +
                "access_token=" + this.oauthToken);
            xhr.onreadystatechange = function (e) {
                if(xhr.readyState == xhr.DONE) {
                    if(JSON.parse(xhr.response)["user"]){
                        onSuccessCallback();
                    }
                    else if(JSON.parse(xhr.response)["error"]){
                        onFailureCallBack();
                    }
                }
            };
            xhr.send(null);
        },

        onHideLoginModalDlg(event: BvModalEvent, dlgId: string) {
            if(dlgId == this.loginErrorModalDlgId){
                this.signIn();
            }
        },

        loadFile() {
            this.currentAction = "load";
            // This method is the entry point to load a file from Google Drive. We check or request to sign-in to Google Drive here.
            // (that is redundant with the previous "save" action if we were already syncing, but this method can be called when we were not syncing so it has to be done.)
            if(this.oauthToken == null){
                this.signIn();
                // We wait for the signing checks are done, the loading mechanism will continue later in doLoadFile()
            }
            else{
                // We test the connection to make sure it's still valid: if so, we continue with the loading, and if not we reset the token and
                // call this method again so signing will be requested
                this.testGoogleDriveConnection(() => this.doLoadFile(), () => {
                    this.oauthToken = null;
                    this.signIn();
                });
            }
        },

        doLoadFile() {
            if(this.oauthToken != null){
                // Method called to trigger the file load -- this would be called after we made sure the connection to Google Drive is (still) valid
                (this.$refs[this.googleDriveFilePickerComponentId] as InstanceType<typeof GoogleDriveFilePicker>).startPicking(false);
            }
        },

        saveFile(saveReason: SaveRequestReason) {
            // Method called to trigger the file save -- this would be called after the connection to Google Drive is (still) valid
            this.currentAction = "save";
            this.saveReason = saveReason;

            // In any case, we check that the given location (if provided) still exists. We set the alias (name of the folder) here.
            // If the folder doesn't exist, for all reasons for saving, we reset the Strype project location flags in the store (subsequent code will handle what to do)
            if(this.appStore.strypeProjectLocation){
                console.log("in save, with a location " + this.appStore.strypeProjectLocation);
                gapi.client.request({
                    path: "https://www.googleapis.com/drive/v3/files/" + this.appStore.strypeProjectLocation,
                    method: "GET",
                }).then((response) => {
                    // Folder is found, we get the name
                    this.appStore.strypeProjectLocationAlias = JSON.parse(response.body).name;
                }, (reason) => {
                    console.log(JSON.stringify(reason));
                    // Connection issue?
                    if(reason.status == 401 || reason.status == 403){
                        this.proceedFailedConnectionCheckOnSave();
                        return;
                    }
                    
                    // Folder not found
                    if(reason.status == 404){
                        this.appStore.strypeProjectLocation = undefined;
                        this.appStore.strypeProjectLocationAlias = "";
                    }
                });
            }            

            // When an explicit save is requested, it acts as a "save as" and we generate a new file in Google Drive
            if(saveReason == SaveRequestReason.saveProject){
                this.saveFileId = undefined;
                // For this case, we ask for the location (with /Strype as the default location -- which is created if non existant)
                // Note that we need to specify the parent folder of the search (root folder) otherwise we would also get subfolders; and don't get trashed folders 
                // (that will also discard shared folders, so we don't need to check the writing rights...)
                gapi.client.request({
                    path: "https://www.googleapis.com/drive/v3/files",
                    params: {"q": "mimeType='application/vnd.google-apps.folder' and name='Strype' and parents='root' and trashed=false"},
                }).then((response) => {
                    // Check if the response returns a folder. As Google Drive allows entries with same name, it is possible that several "Strype" folder exists; we will use the first one.
                    const filesArray: {id: string}[] = JSON.parse(response.body).files;
                    if(filesArray.length > 0){
                        // If the Strype root folder exists, then we make it the location reference if none is defined yet.
                        if(this.appStore.strypeProjectLocation == undefined){
                            this.appStore.strypeProjectLocation = filesArray[0].id;
                            this.appStore.strypeProjectLocationAlias = "Strype";
                        } 
                    }
                    else{
                        // If the Strype root folder doesn't exist in the user's Drive, we create one.
                        const body = JSON.stringify({
                            "name": "Strype",
                            "mimeType": "application/vnd.google-apps.folder",
                        });
                        gapi.client.request({
                            path: "https://www.googleapis.com/drive/v3/files",
                            method: "POST",
                            params: {"uploadType": "media"},
                            body: body,
                        }).then((resp) => {
                            console.log(resp);
                            // Save the save file ID as the reference location
                            console.log("created file with id " + JSON.parse(resp.body).id);
                            this.appStore.strypeProjectLocation = JSON.parse(resp.body).id; 
                            this.appStore.strypeProjectLocationAlias = "Strype";
                        },
                        (reason) => {
                            // If the Strype folder cound't be created, we alert the user (temporary message banner) but we proceed with the save file workflow1
                            console.log("failed creating folder " + JSON.stringify(reason));
                            this.appStore.currentMessage = MessageDefinitions.GDriveCantCreateStrypeFolder;
                            setTimeout(() => this.appStore.currentMessage = MessageDefinitions.NoMessage, 3000);  
                        });
                    }
                    // Show the file picker to select a folder (with default location)
                    (this.$refs[this.googleDriveFilePickerComponentId] as InstanceType<typeof GoogleDriveFilePicker>).startPicking(true);
                    // Save will be done after the file has been picked.                   
                },(reason) => {
                    // If the login to the Google failed (or the user wasn't logged in) we try again
                    if(reason.status == 401 || reason.status == 403){
                        this.proceedFailedConnectionCheckOnSave();
                    }
                });
            }
            else{
                this.doSaveFile();
            }
        },

        doSaveFile(){
            const fileContent = this.appStore.generateStateJSONStrWithCheckpoint();   
            // The file name depends on the context: normal save, we use the filed this.saveName that is in line with what the user provided in the input field
            // while when do autosave etc, we use th PROJET saved name in the store.
            const fullFileName = ((this.saveReason == SaveRequestReason.saveProject) ? this.saveFileName  : this.appStore.projectName) + "." + strypeFileExtension;        
            // Using this example: https://stackoverflow.com/a/38475303/412908
            // Arbitrary long string:
            const boundary = "2db8c22f75474a58cd13fa2d3425017015d392ce0";
            const body : string[] = [];
            console.log("ready to save file " + fullFileName + " in parent " + this.appStore.strypeProjectLocation);
            // Prepare the request body parameters. Note that we only set the parent ID for explicit save
            const bodyReqParams: {name: string, mimeType: string, parents?: [string]} = 
                {
                    name: fullFileName,
                    mimeType: "application/strype",
                };
            if(this.saveReason == SaveRequestReason.saveProject && this.appStore.strypeProjectLocation){
                console.log("setting parents to "+this.appStore.strypeProjectLocation.toString());
                bodyReqParams.parents = [this.appStore.strypeProjectLocation.toString()];
            }
            body.push("Content-Type: application/json; charset=UTF-8\n\n" + JSON.stringify(bodyReqParams) + "\n");
            body.push("Content-Type: text/plain; charset=UTF-8\n\n" + fileContent + "\n");
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
                // Success of the request
                (resp) => {
                    // Save the save file ID 
                    this.saveFileId = JSON.parse(resp.body)["id"];
                    // Set the sync target 
                    this.appStore.syncTarget = StrypeSyncTarget.gd;
                    // Set the project name when we have made an explicit saving
                    if(this.saveReason == SaveRequestReason.saveProject){
                        this.appStore.projectName = this.saveFileName;
                    }                    
                    // Notify the application that if we were saving for loading now we are done
                    if(this.saveReason == SaveRequestReason.loadProject)                     {
                        this.$root.$emit(CustomEventTypes.saveStrypeProjectDoneForLoad);
                    }                
                },
                (reason) => {
                    console.log(JSON.stringify(reason));
                    // If we have an authorised error (for example, timed-out connexion) we should disconnect and warn the users
                    // (not to sure why rawResp.status doesn't give the right stuff, but based on debugging, this works...)
                    if(reason.status == 401){
                        this.proceedFailedConnectionCheckOnSave();
                    }
                    if(reason.status == 404 && this.saveFileId != undefined){
                        // We assume something went wrong regarding saving against the specified file id.
                        // Actions to take depeding on the reason for saving:
                        // autosave --> show a message banner indicating we will save on a new file at the next sync
                        // normal + loading + unload--> show a modal and stop sync
                        if(this.saveReason == SaveRequestReason.autosave){
                            const message = MessageDefinitions.GDriveFileSaveFail;
                            this.appStore.currentMessage = message;
                        }
                        else{
                            this.appStore.simpleModalDlgMsg = this.$i18n.t("errorMessage.GDriveSaveFailed") as string;
                            this.$root.$emit("bv::show::modal", getAppSimpleMsgDlgId());
                            this.updateSignInStatus(false);
                            this.appStore.syncTarget = StrypeSyncTarget.none;
                        }
                    }
                }
            );   
        },       

        proceedFailedConnectionCheckOnSave(){
            // Do something in case of connection failure depending on the reason for saving
            // normal saving: --> try to reconnect, if failed, then we stop synchronising to Google Drive
            // auto-save: --> show banner message and stop synchronising
            // save to load + unload --> try to reconnect, if failed, stop sync + modal message
            // Even if the user may signing again, we first make sure everything shows as "not syncing" in case the signing process is not completed
            // (because if the user just drop the signing action, we have no way to get events on that...)
            this.oauthToken = null; 
            this.updateSignInStatus(false);
            if(this.saveReason != SaveRequestReason.autosave){
                if(this.saveReason == SaveRequestReason.loadProject || this.saveReason == SaveRequestReason.unloadPage){
                    const modalMsg = (this.saveReason == SaveRequestReason.loadProject) ? this.$i18n.t("errorMessage.gdriveConnectionSaveToLoadProjFailed") : this.$i18n.t("errorMessage.gdriveConnectionSaveToUnloadPageFailed") ;
                    this.appStore.simpleModalDlgMsg = modalMsg as string;
                    this.$root.$emit("bv::show::modal", this.loginErrorModalDlgId);
                    // The signIn method will be called when the modal is dismissed
                }
                else{
                    this.signIn();
                }
            }
            else{
                this.updateSignInStatus(false);
                const message = MessageDefinitions.GDriveConnectToSaveFailed;
                this.appStore.currentMessage = message;
            }
        },
        
        loadPickedFileId(id : string, fileName: string) : void {
            // First retrieve the file meta data, particularly if Strype created the file in Drive to adapt the autosave mechanism according the user's given scope permissions
            gapi.client.request({
                path: "https://www.googleapis.com/drive/v3/files/" + id,
                method: "GET",
                params: {fields: "isAppAuthorized"},
            }).execute((resp) => {
                console.log("GOT FILE data");
                console.log(JSON.stringify(resp));
                this.loadedFileCreatedByStrype = resp.isAppAuthorized;
                console.log(" now we have");
                console.log(this.loadedFileCreatedByStrype);
            });
            // Then we can retrieve the file content and load it in the editor
            gapi.client.request({
                path: "https://www.googleapis.com/drive/v3/files/" + id,
                method: "GET",
                params: {alt: "media"},
            }).execute((resp) => {
                this.appStore.setStateFromJSONStr(
                    {
                        stateJSONStr: JSON.stringify(resp),
                    }
                );
                this.saveFileId = id;
                this.appStore.syncTarget = StrypeSyncTarget.gd;
                // Users may have changed the file name directly on Drive, so we make sure at this stage we get the project with that same name
                const fileNameNoExt = fileName.substring(0, fileName.lastIndexOf("."));
                this.appStore.projectName = fileNameNoExt;
                this.saveFileName = fileNameNoExt;
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