<template>
    <div>
        <GoogleDriveFilePicker :ref="googleDriveFilePickerComponentId" @picked-file="loadPickedFileId" @picked-folder="savePickedFolder" @nonStrypeFilePicked="onNonStrypeFilePicked" dev-key="AIzaSyDKjPl4foVEM8iCMTkgu_FpedJ604vbm6E" :oauth-token="oauthToken"/>
        <SimpleMsgModalDlg :dlgId="loginErrorModalDlgId" :hideActionListener="signIn"/>
        <SimpleMsgModalDlg :dlgId="nonStrypeFilePickedModalDlgId" :hideActionListener="loadFile" />
        <ModalDlg :dlgId="saveExistingGDProjectModalDlgId" :size="saveExistingFileDlgSize" :elementToFocusId="(isFileLocked) ? saveExistingFileCopyButtonId : saveExistingFileOverwriteButtonId">
            <span style="white-space:pre-wrap">{{$t((isFileLocked)?'appMessage.gdriveLockedFileAlreadyExists':'appMessage.gdriveFileAlreadyExists')}}</span>
            <!-- in order to allow 3 (customed) buttons, we use the slot "modal-footer" made available by Boostrap for the modal; to simply things, we handle both locked/unlocked files there -->
            <template #modal-footer-content="{ok, cancel}">
                <b-button variant="secondary" @click="onSaveGDExistingFileAction(Actions.cancel);cancel()">{{$t('buttonLabel.cancel')}}</b-button>
                <b-button :id="saveExistingFileCopyButtonId" variant="primary" @click="onSaveGDExistingFileAction(Actions.copy);ok()">{{(isFileLocked)?$t('buttonLabel.ok'):$t('buttonLabel.saveProjectCopy')}}</b-button>
                <b-button :id="saveExistingFileOverwriteButtonId" v-if="!isFileLocked" variant="primary" @click="onSaveGDExistingFileAction(Actions.overwrite);ok()">{{$t('buttonLabel.overwriteProject')}}</b-button>
            </template>
        </ModalDlg>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import {mapStores} from "pinia";
import {useStore} from "@/store/store";
import GoogleDriveFilePicker from "@/components/GoogleDriveFilePicker.vue";
import SimpleMsgModalDlg from "@/components/SimpleMsgModalDlg.vue";
import ModalDlg from "@/components/ModalDlg.vue";
import i18n from "@/i18n";
import { CustomEventTypes, getAppSimpleMsgDlgId, getSaveAsProjectModalDlg } from "@/helpers/editor";
import { strypeFileExtension } from "@/helpers/common";
import { BootstrapDlgSize, MessageDefinitions, SaveExistingGDProjectInfos, SaveRequestReason, StrypeSyncTarget } from "@/types/types";

// This enum is used for flaging the action taken when a request to save a file on Google Drive
// has been done, and a file of the same name already exists on the Drive
enum Actions{
    overwrite,
    copy,
    cancel
}

export default Vue.extend({
    name: "GoogleDrive",
    
    components: {
        GoogleDriveFilePicker,
        SimpleMsgModalDlg,
        ModalDlg,
    },

    data: function(){
        return {
            client: null as google.accounts.oauth2.TokenClient | null, // The Google Identity client
            oauthToken : null as string | null,
            currentAction: null as "load" | "save" | null, // flag the request current action for async workflow;
            saveReason: SaveRequestReason.autosave, // flag the reason of the save action
            saveFileName: "", // The file name, will be set via the Menu when a name is provided for saving, or when loading a project (we need to keep it live for autosave)
            isFileLocked: false, // Flag to notify when a file is locked (used for saving);
            Actions, // this is required to be accessible in the template
            saveExistingGDProjectInfos: {} as SaveExistingGDProjectInfos,
        };
    },

    computed: {
        ...mapStores(useStore),    
        
        googleDriveScope(): string {
            return "https://www.googleapis.com/auth/drive";
        },

        googleDriveFilePickerComponentId(): string {
            return "googleDriveFilePickerComponent";
        },

        loginErrorModalDlgId(): string {
            return "gdLoginErrorModalDlg";
        },

        nonStrypeFilePickedModalDlgId(): string {
            return "gdNonStrypeFilePickedModalDlg";
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

        saveExistingGDProjectModalDlgId(): string {
            return "saveExistingGDProjectModalDlg";
        },

        saveExistingFileDlgSize(): BootstrapDlgSize {
            return "lg";
        },

        saveExistingFileCopyButtonId(): string {
            return "saveExistingFileCopyButton";
        },
        
        saveExistingFileOverwriteButtonId(): string {
            return "saveExistingFileOverwriteButton";
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
                scope: this.googleDriveScope,
                // Note: this callback is after *sign-in* (happens on button press), NOT on simply loading the client:
                callback: (response: google.accounts.oauth2.TokenResponse) => {
                    // We check the permission is given to the scope required by Strype. If not given, show message.
                    if(!google.accounts.oauth2.hasGrantedAllScopes(response, this.googleDriveScope)) {
                        this.oauthToken = null;
                        this.appStore.simpleModalDlgMsg = this.$i18n.t("errorMessage.gdrivePermissionsNotMet") as string;
                        this.$root.$emit("bv::show::modal", this.loginErrorModalDlgId);
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
                this.$root.$emit(CustomEventTypes.addFunctionToEditorAutoSave, {name: "GD", function: (saveReason: SaveRequestReason) => this.saveFile(saveReason)});
            }  
            else{
                // If signing fails, reset to no sync
                this.appStore.syncTarget = StrypeSyncTarget.none; 
                this.$root.$emit(CustomEventTypes.removeFunctionToEditorAutoSave, "GD");
            }            
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
                // When we load for the very first time, we may not have a Drive location to look for. In that case, we look for a Strype folder existence 
                // (however we do not create it here, we would do this on a save action). If a location is already set, we make sure it still exists. 
                // If it doesn't exist anymore, we set the default location to the Strype folder (if available) or just the Drive itself if not.
                this.checkDriveStrypeFolder(false, (strypeFolderId) => {
                    if(this.appStore.strypeProjectLocation){
                        gapi.client.request({
                            path: "https://www.googleapis.com/drive/v3/files/" + this.appStore.strypeProjectLocation,
                            method: "GET",
                        }).then((response) => {
                            // Folder is found, we get the name
                            this.appStore.strypeProjectLocationAlias = JSON.parse(response.body).name;
                        }, () => {
                            // Folder not found, we set Strype as default folder if it exists
                            this.appStore.strypeProjectLocation = (strypeFolderId) ? strypeFolderId : undefined;
                            this.appStore.strypeProjectLocationAlias = (strypeFolderId) ? "Strype" : "";
                        });
                    }
                    else{
                        this.appStore.strypeProjectLocation = (strypeFolderId) ? strypeFolderId : undefined;
                        this.appStore.strypeProjectLocationAlias = (strypeFolderId) ? "Strype" : "";
                    }

                    // Method called to trigger the file load -- this would be called after we made sure the connection to Google Drive is (still) valid
                    (this.$refs[this.googleDriveFilePickerComponentId] as InstanceType<typeof GoogleDriveFilePicker>).startPicking(false);
                });
            }
        },

        saveFile(saveReason: SaveRequestReason) {
            // Method called to trigger the file save -- this would be called after the connection to Google Drive is (still) valid
            this.currentAction = "save";
            this.saveReason = saveReason;

            // In any case, we check that the given location (if provided) still exists. We set the alias (name of the folder) here.
            // If the folder doesn't exist, for all reasons for saving, we reset the Strype project location flags in the store (subsequent code will handle what to do)
            if(this.appStore.strypeProjectLocation){
                gapi.client.request({
                    path: "https://www.googleapis.com/drive/v3/files/" + this.appStore.strypeProjectLocation,
                    method: "GET",
                }).then((response) => {
                    // Folder is found, we get the name
                    this.appStore.strypeProjectLocationAlias = JSON.parse(response.body).name;
                }, (reason) => {
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

            // When an explicit save is requested, it acts as a "save as" and we generate a new file in Google Drive.
            // In any other case, we only save a file if there is a save file id set
            if(saveReason == SaveRequestReason.saveProjectAtLocation || saveReason == SaveRequestReason.saveProjectAtOtherLocation){
                // For this case, we ask for the location (with /Strype as the default location -- which is created if non existant)
                this.checkDriveStrypeFolder(true, (strypeFolderId: string | null)=> {
                    // Show the file picker to select a folder (with default location) if the location specified doesn't exist, or if the user asked for changing it
                    if(strypeFolderId != null && this.appStore.strypeProjectLocation == undefined){
                        // No location is set, we set the Strype folder
                        this.appStore.strypeProjectLocation = strypeFolderId;
                        this.appStore.strypeProjectLocationAlias = "Strype";
                    }

                    // The autosave method may not exist (the case when a user has loaded a read-only Drive project, then wants to save: sync is off, but connection probably still maintained)
                    this.$root.$emit(CustomEventTypes.addFunctionToEditorAutoSave, {name: "GD", function: (saveReason: SaveRequestReason) => this.saveFile(saveReason)});

                    if(saveReason == SaveRequestReason.saveProjectAtOtherLocation){
                        (this.$refs[this.googleDriveFilePickerComponentId] as InstanceType<typeof GoogleDriveFilePicker>).startPicking(true);
                        // Save will be done after the file has been picked.   
                    }
                    else{
                        this.lookForAvailableProjectFileName(this.doSaveFile);
                    }
                }, this.proceedFailedConnectionCheckOnSave);
            }
            else {
                if(this.saveFileId){
                    this.doSaveFile();
                }
                else{
                    // Notify the application that if we were saving for loading now we are done
                    if(this.saveReason == SaveRequestReason.loadProject)                     {
                        this.$root.$emit(CustomEventTypes.saveStrypeProjectDoneForLoad);
                    }      
                }
            }
        },

        doSaveFile(){
            const isExplictSave = (this.saveReason == SaveRequestReason.saveProjectAtLocation || this.saveReason == SaveRequestReason.saveProjectAtOtherLocation);
            if(isExplictSave){
                this.saveFileId = undefined;
            }
            const fileContent = this.appStore.generateStateJSONStrWithCheckpoint();   
            // The file name depends on the context: normal save, we use the filed this.saveName that is in line with what the user provided in the input field
            // while when do autosave etc, we use th PROJECT saved name in the store.
            const fullFileName = ((isExplictSave || this.saveReason == SaveRequestReason.overwriteExistingProject) ? this.saveFileName  : this.appStore.projectName) + "." + strypeFileExtension;        
            // Using this example: https://stackoverflow.com/a/38475303/412908
            // Arbitrary long string:
            const boundary = "2db8c22f75474a58cd13fa2d3425017015d392ce0";
            const body : string[] = [];
            // Prepare the request body parameters. Note that we only set the parent ID for explicit save
            const bodyReqParams: {name: string, mimeType: string, parents?: [string]} = 
                {
                    name: fullFileName,
                    mimeType: "application/strype",
                };
            if(isExplictSave && this.appStore.strypeProjectLocation){
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
                    this.appStore.isEditorContentModified = false;
                    // Set the project name when we have made an explicit saving
                    if(isExplictSave || this.saveReason == SaveRequestReason.overwriteExistingProject){
                        this.appStore.projectName = this.saveFileName;
                    }                    
                    // Notify the application that if we were saving for loading now we are done
                    if(this.saveReason == SaveRequestReason.loadProject)                     {
                        this.$root.$emit(CustomEventTypes.saveStrypeProjectDoneForLoad);
                    }                
                },
                (reason) => {
                    // If we have an authorised error (for example, timed-out connexion) we should disconnect and warn the users
                    // (not to sure why rawResp.status doesn't give the right stuff, but based on debugging, this works...)
                    if(reason.status == 401){
                        this.proceedFailedConnectionCheckOnSave();
                    }
                    else if((reason.status == 404 || reason.status == 403) && this.saveFileId != undefined){
                        // We assume something went wrong regarding saving against the specified file id.
                        // This can notably happen if the file has been locked in the meantime that we tried to save it.
                        // We show a modal and stop sync
                        this.appStore.simpleModalDlgMsg = this.$i18n.t("errorMessage.GDriveSaveFailed") as string;
                        this.$root.$emit("bv::show::modal", getAppSimpleMsgDlgId());
                        this.updateSignInStatus(false);
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
            gapi.client.request({
                path: "https://www.googleapis.com/drive/v3/files/" + id,
                method: "GET",
                params: {alt: "media"},
            }).execute((resp) => {
                // Some flags in the store SHOULD NOT BE lost when we load a file, so we make a backup of those here:
                const strypeLocation = this.appStore.strypeProjectLocation;
                const strypeLocationAlias = this.appStore.strypeProjectLocationAlias;
                // Load the file content in the editor
                this.appStore.setStateFromJSONStr(
                    {
                        stateJSONStr: JSON.stringify(resp),
                        callBack: (setStateSuccess: boolean) => {
                            // Only update things if we could set the new state
                            if(setStateSuccess){
                                this.saveFileId = id;
                                this.appStore.syncTarget = StrypeSyncTarget.gd;
                                // Users may have changed the file name directly on Drive, so we make sure at this stage we get the project with that same name
                                const fileNameNoExt = fileName.substring(0, fileName.lastIndexOf("."));
                                this.appStore.projectName = fileNameNoExt;
                                this.saveFileName = fileNameNoExt;
                                // Restore the fields we backed up before loading
                                this.appStore.strypeProjectLocation = strypeLocation;
                                this.appStore.strypeProjectLocationAlias = strypeLocationAlias;
                            }
                        },
                    }                    
                );

                // We check that the file has write access. If it doesn't we shouldn't propose the sync anymore.
                gapi.client.request({
                    path: "https://www.googleapis.com/drive/v3/files/" + id,
                    method: "GET",
                    params: {fields: "capabilities/canEdit"},
                }).execute((resp) => {
                    if(!resp["capabilities"]["canEdit"]){
                        this.saveFileId = undefined;
                        this.updateSignInStatus(false);
                        this.appStore.simpleModalDlgMsg = this.$i18n.t("errorMessage.gdriveReadOnly") as string;
                        this.$root.$emit("bv::show::modal", getAppSimpleMsgDlgId());
                    }
                });
            });
        },

        savePickedFolder(){
            // Doesn't matter the extact nature of the reason for saving, as long as we specify one of the 2 values for explicit saving.
            // (necessary as autosave may have been triggered in between)
            this.saveReason = SaveRequestReason.saveProjectAtLocation;
            this.lookForAvailableProjectFileName(this.doSaveFile);
        },

        onNonStrypeFilePicked(){
            // When a non-Strype file was picked to load, we notify the user on a modal dialog, and trigger the Drive picker again
            this.appStore.simpleModalDlgMsg = this.$i18n.t("errorMessage.gdriveWrongFile") as string;
            this.$root.$emit("bv::show::modal", this.nonStrypeFilePickedModalDlgId);
        },

        checkDriveStrypeFolder(createIfNone: boolean, checkFolderDoneCallBack: (strypeFolderId: string | null) => void, failedConnectionCallBack?: () => void) {
            // Check if the Strype folder exists on the Drive. If not, we create it if createIfNone is set to true.
            // Returns the file ID or null if the file couldn't be found/created.
            // Note that we need to specify the parent folder of the search (root folder) otherwise we would also get subfolders; and don't get trashed folders 
            // (that will also discard shared folders, so we don't need to check the writing rights...)
            let strypeFolderId: string | null = null;
            gapi.client.request({
                path: "https://www.googleapis.com/drive/v3/files",
                params: {"q": "mimeType='application/vnd.google-apps.folder' and name='Strype' and parents='root' and trashed=false"},
            }).then((response) => {
                // Check if the response returns a folder. As Google Drive allows entries with same name, it is possible that several "Strype" folder exists; we will use the first one.
                const filesArray: {id: string}[] = JSON.parse(response.body).files;
                if(filesArray.length > 0){
                    // If the Strype root folder exists, then we make it the location reference if none is defined yet.
                    strypeFolderId = filesArray[0].id;
                    // Continue with callback method after check is done
                    checkFolderDoneCallBack(strypeFolderId);
                }
                else if(createIfNone){
                    // If the Strype root folder doesn't exist in the user's Drive, we create one when requested
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
                        strypeFolderId = JSON.parse(resp.body).id; 
                        // Continue with callback method after check is done
                        checkFolderDoneCallBack(strypeFolderId);
                    },
                    (reason) => {
                        // If the Strype folder cound't be created, we alert the user (temporary message banner) but we proceed with the save file workflow1
                        this.appStore.currentMessage = MessageDefinitions.GDriveCantCreateStrypeFolder;
                        setTimeout(() => this.appStore.currentMessage = MessageDefinitions.NoMessage, 3000);  
                        // Continue with callback method after check is done
                        checkFolderDoneCallBack(strypeFolderId);
                    });
                }
                else{
                    // Continue with callback method after check is done
                    checkFolderDoneCallBack(strypeFolderId);
                }

            },(reason) => {
                // If the login to the Google failed (or the user wasn't logged in), handle it via the callback
                if(failedConnectionCallBack && (reason.status == 401 || reason.status == 403)){
                    failedConnectionCallBack();
                }
            });
        },

        lookForAvailableProjectFileName(onSuccessCallback: () => void){
            // We check if the currently suggested file name is not already used in the location we save the file.
            // (note: it seems that searching against regex isn't supported. cf https://developers.google.com/drive/api/guides/ref-search-terms,
            // the matching works in a very strange way, on a prefix and word basis, but yet I get results I didn't expect, so better double check on the results to make sure).
            gapi.client.request({
                path: "https://www.googleapis.com/drive/v3/files",
                params: {"q": "name contains '*.spy' and parents='" + ((this.appStore.strypeProjectLocation) ? this.appStore.strypeProjectLocation : "root") + "' and trashed=false"},
            }).then((response) => {
                let hasAlreadyFile = false, existingFileId = "";
                this.isFileLocked = false;
                const filesArray: {name: string, id: string}[] = JSON.parse(response.body).files;
                filesArray.forEach((file) => {
                    const listingThisFile = (file.name == (this.saveFileName + "." + strypeFileExtension));
                    hasAlreadyFile ||= listingThisFile;
                    if(listingThisFile){
                        existingFileId = file.id;
                    }
                });

                if(hasAlreadyFile){
                    // Check if the file is locked before we propose to overwrite
                    this.checkIsFileLocked(existingFileId, () => {
                        // We show a dialog to the user to make their choice about what to do next
                        this.$root.$emit("bv::show::modal", this.saveExistingGDProjectModalDlgId);                        
                    }, () => {
                        // We shouldn't have an issue at this stage, but if it happens, we just attempt to connect again
                        this.proceedFailedConnectionCheckOnSave();
                    });

                    // We do not continue the saving process at this stage: we wait for the user action,
                    // but we save the bits we need for continuing the process later (initiate the request to copy file to false at this stage)
                    this.saveExistingGDProjectInfos = {existingFileId: existingFileId, existingFileName: this.saveFileName, resumeProcessCallback: onSuccessCallback, isCopyFileRequested: false};                
                    return;                    
                }
                // Keep on with the flow of actions if everything went smooth so far
                onSuccessCallback();
            },(reason) => {
                // We shouldn't have an issue at this stage, but if it happens, we just attempt to connect again
                this.proceedFailedConnectionCheckOnSave();
            });
        },

        checkIsFileLocked(fileId: string, onSuccessCallback: () => void, onFailureCallBack: VoidFunction): void {
            // Following the addition of a locking file settings in Drive (Sept 2023) we need to check if a file is locked when we want to save.
            // This method retrieves this property for a given file by its file ID.
            // It is the responsablity of the caller of that method to provide a valid file ID and have passed authentication.
            // However, we still handle potential API access issues in this method, hence this methods expects the methods to run in case of success or failure
            gapi.client.request({
                path: "https://www.googleapis.com/drive/v3/files/" + fileId,
                method: "GET",
                params: {fields: "contentRestrictions"},
            }).execute((resp) => {
                if(resp["error"]){
                    // An error happened, we call the failure case method
                    onFailureCallBack();
                    return;
                }
                // Look up the property in the response
                if(resp["contentRestrictions"] && resp["contentRestrictions"][0] && resp["contentRestrictions"][0]["readOnly"]){
                    this.isFileLocked = resp["contentRestrictions"][0]["readOnly"];
                }
                // Pass on the property value to the success case call back method.
                onSuccessCallback();
            });
        },

        onSaveGDExistingFileAction(action: Actions){
            // This method processes the user action (based on what dialog button has been clicked) to decide what to do next.
            // Actions to take are really JUST about the saving workflow: we don't need to worry about dealing with the dialog itself, 
            // because that is already handles by Bootstrap.
            if(action == Actions.overwrite){
                // User chose "overwrite": we do an overwriting save with the existing file Id (on Drive)
                this.saveReason = SaveRequestReason.overwriteExistingProject;
                this.saveFileId = this.saveExistingGDProjectInfos.existingFileId;
                this.saveExistingGDProjectInfos.resumeProcessCallback();
            }
            else if(action == Actions.copy){
                // User chose "copy": we invite the user to choose a new name in the next Vue rendering
                this.saveExistingGDProjectInfos.isCopyFileRequested = true;
                this.$nextTick(() => {
                    this.$root.$emit("bv::show::modal", getSaveAsProjectModalDlg());
                }); 
            }

            // If user chose "cancel": we do nothing  
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