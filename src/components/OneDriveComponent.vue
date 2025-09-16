/**
 * The CloudDriveComponent implementation for OneDrive.
 * (Note that here, missing parts from CloudDriveComponent
 *  will not be detected, they will be when this component
 *  is used in CloudDriveHandler).
 * The underlying service we used for authentication is 
 * MSAL, as recommanded by Microsoft.
 * The underlying service we use is OneDrive File picker 
 * (https://learn.microsoft.com/en-us/onedrive/developer/controls/file-pickers/?view=odsp-graph-online)
 */
<template>
    <div></div>
</template>
<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import { useStore } from "@/store/store";
import { StrypeSyncTarget } from "@/types/types";
import { mapStores } from "pinia";
import Vue, { PropType } from "vue";
import { PublicClientApplication  } from "@azure/msal-browser";
import { IAuthenticateCommand, OneDrivePickConfigurationOptions } from "@/types/cloud-drive-types";
import { uniqueId } from "lodash";
import { pythonFileExtension, strypeFileExtension } from "@/helpers/common";
import { CloudDriveAPIState } from "@/types/cloud-drive-types";
import { CloudDriveFile } from "@/types/cloud-drive-types";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "OneDriveComponent",
    
    props: {
        driveName: { type: String, required: true },
        apiName: { type: String, required: true },
        onFileToLoadPicked: {type: Function as PropType<(cloudTarget: StrypeSyncTarget, fileId: string, fileName?: string) => Promise<void>>, required: true},
        onFolderToSaveFilePicked: {type: Function as PropType<(cloudTarget: StrypeSyncTarget) => void>, required: true},
        onUnsupportedByStrypeFilePicked: {type: Function as PropType<() => void>, required: true},
    },

    created() {
        // Register the listener of the File Picker's messages
        window.addEventListener("message", this.onPickerMsg);
    },


    data: function () {
        return {
            // Implements CloudDriveComponent
            isFileLocked: false,
            // Specific to OneDrive:
            oauthToken: null as string | null,
            app: null as PublicClientApplication | null,
            baseUrl: "https://onedrive.live.com/picker",
            pickerPopup: null as WindowProxy | null,
            pickerOptions: null as OneDrivePickConfigurationOptions | null,
        };
    },

    computed:{
        ...mapStores(useStore),

        // These are specific to the OneDrive component.
    },


    methods: {
        /**
         * Implements CloudDriveComponent
         **/ 
        async signIn(callback: (cloudTarget: StrypeSyncTarget) => void) {
            // We need to get an authentication token to use in the form below (more information in auth section)             
            this.oauthToken = await this.getToken({
                resource: this.baseUrl,
                command: "authenticate",
                type: "OneDrive",
            }).catch((_) => {
                return null;
            });

            if(this.oauthToken){
                callback(StrypeSyncTarget.od);                
            }
        },   

        
        resetOAuthToken() {
            this.oauthToken = null;
        },

        isOAuthTokenNotSet(){
            return this.oauthToken == null;
        },

        testCloudConnection(onSuccessCallback: () => void, onFailureCallBack: () => void){
            //TODO
            console.log("am I herreeeee?");
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

        getCloudAPIStatusWhenLoadedOrFailed(): Promise<CloudDriveAPIState> {
            // There is no API loading for OneDrive, we can return "Loaded" right away.
            return Promise.resolve(CloudDriveAPIState.LOADED);           
        },

        
        getPublicSharedProjectContent(sharedFileID: string): Promise<{isSuccess: boolean, encodedURIFileContent: string, errorMsg: string}> {            
            //TODO
            return Promise.resolve({isSuccess: false, encodedURIFileContent: "", errorMsg: "Not implemented yet."});
        },

        shareCloudDriveFile(saveFileId: string): Promise<boolean>{
            //TODO
            // When we share a Strype project, we try to set the project on OneDrive with public acccess.
            // The methods returns a Promise, with a boolean flag set at true if we succeeeded.
            return Promise.resolve(false);
        },

        getPublicShareLink(saveFileId: string): Promise<{respStatus: number, webLink: string}> {
            //TODO
            return Promise.resolve({respStatus: 500, webLink:""});
        },

        getFolderNameFromId(folderId: string): Promise<string> {
            //TODO
            return Promise.resolve("DUMMU_FOLDER_NAME");
        },

        checkIsCloudFileReadonly(id: string, onGettingReadonlyStatus: (isReadonly: boolean) => void){
            //TODO
            onGettingReadonlyStatus(false);
        },

        pickFolderForSave(){
            //TODO
            //(this.$refs[this.googleDriveFilePickerComponentId] as InstanceType<typeof GoogleDriveFilePicker>).startPicking(true);
        },

        loadPickedFileId(id: string, otherParams: {fileName?: string}, onGettingFileMetadataSucces: (fileNameFromDrive: string, fileModifiedDateTime: string)=>void
            , onGettingFileContentSuccess: (fileContent: string) => void, onGettingFileContentFailure: (errorRespStatus: number) => void){
            // TODO
            console.log("am I here...");
            // create a new window. The Picker's recommended maximum size is 1080x680, but it can scale down to
            // a minimum size of 250x230 for very small screens or very large zoom.
            this.pickerPopup = window.open("", "Picker", "width=1080,height=680");
        
            // now we need to construct our query string
            // options: These are the picker configuration, see the schema link for a full explaination of the available options
            this.pickerOptions = {
                sdk: "8.0", 
                authentication:{},
                messaging: {
                    channelId: uniqueId(),
                    origin: "https://strype.org",
                },
                entry: {oneDrive: {files: {folder: "Strype",fallbackToRoot: true}}},
                selection: {mode: "single"/*or pick? who knows! */},
                typesAndSources: {filters: [`.${pythonFileExtension}`,`.${strypeFileExtension}`]},
            };
            const queryString = new URLSearchParams({
                filePicker: JSON.stringify(this.pickerOptions),
                locale:  this.$i18n.t("localeOneDrive") as string,
            });

            // we create the absolute url by combining the base url, appending the _layouts path, and including the query string
            const url = `${this.baseUrl}/_layouts/15/FilePicker.aspx?${queryString}`;
            // create a form
            const form = this.pickerPopup?.document.createElement("form");
            if(this.pickerPopup && form){
                // set the action of the form to the url defined above
                // This will include the query string options for the picker.
                form.setAttribute("action", url);

                // must be a post request
                form.setAttribute("method", "POST");

                // Create a hidden input element to send the OAuth token to the Picker.
                // This optional when using a popup window but required when using an iframe.
                const tokenInput = this.pickerPopup.document.createElement("input");
                tokenInput.setAttribute("type", "hidden");
                tokenInput.setAttribute("name", "access_token");
                tokenInput.setAttribute("value", this.oauthToken??"dummy");
                form.appendChild(tokenInput);

                // append the form to the body
                this.pickerPopup.document.body.append(form);

                // submit the form, this will load the picker page
                form.submit();
            }               
        },
        
        doLoadFile(openSharedProjectFileId: string): Promise<void> {
            //TODO
            if(this.oauthToken != null){
                // When we load for the very first time, we may not have a Drive location to look for. In that case, we look for a Strype folder existence 
                // (however we do not create it here, we would do this on a save action). If a location is already set, we make sure it still exists. 
                // If it doesn't exist anymore, we set the default location to the Strype folder (if available) or just the Drive itself if not.
                // NOTE: we do not need to check a folder when opening a shared project
                return Promise.resolve();
            }
            else{
                // Nothing to do..
                return Promise.resolve();
            }
        },

        doSaveFile(saveFileId: string|undefined, projetLocation: string, fullFileName: string, fileContent: string, isExplictSave: boolean, onSuccess: (savedFileId: string) => void, onFailure: (errRespStatus: number) => void){                 
            //TODO
        },

        checkDriveStrypeOrOtherFolder(createIfNone: boolean, checkStrypeFolder: boolean, checkFolderDoneCallBack: (strypeFolderId: string | null) => Promise<void>, failedConnectionCallBack?: () => Promise<void>): Promise<void> {
            //TODO
            // Check if the Strype folder (when checkStrypeFolder is true) or the state's folder (otherwise) exists on the Drive. If not, we create it if createIfNone is set to true.
            // Returns the file ID or null if the file couldn't be found/created.
            // Note that we need to specify the parent folder of the search (root folder) otherwise we would also get subfolders; and don't get trashed folders 
            // (that will also discard shared folders, so we don't need to check the writing rights...)
            return Promise.resolve();
        },

        lookForAvailableProjectFileName(fileLocation: string|undefined, fileName: string, onFileAlreadyExists: (existingFileId: string) => void, onSuccessCallback: VoidFunction, onFailureCallBack: VoidFunction){
            // We check if the currently suggested file name is not already used in the location we save the file.
            this.searchCloudDriveElements("", ((fileLocation) ? fileLocation : "root"), true, {})
                .then((filesArray) => {
                    let hasAlreadyFile = false, existingFileId = "";
                    this.isFileLocked = false;                    
                    filesArray.forEach((file) => {
                        const listingThisFile = (file.name == (fileName + "." + strypeFileExtension));
                        hasAlreadyFile ||= listingThisFile;
                        if(listingThisFile){
                            existingFileId = file.id;
                        }
                    });

                    if(hasAlreadyFile){
                        onFileAlreadyExists(existingFileId);
                        return;                    
                    }
                    // Keep on with the flow of actions if everything went smooth so far
                    onSuccessCallback();
                },(_) => {
                    // We shouldn't have an issue at this stage, but if it happens, we just attempt to connect again
                    onFailureCallBack();
                });
        },

        checkIsFileLocked(existingFileId: string, onSuccess: VoidFunction, onFailure: VoidFunction) {
            //TODO: is there an equivalent in OneDrive? If not, just return as never locked...
            // // Following the addition of a locking file settings in Drive (Sept 2023) we need to check if a file is locked when we want to save.
            // This method retrieves this property for a given file by its file ID.
            // It is the responsablity of the caller of that method to provide a valid file ID and have passed authentication.
            // However, we still handle potential API access issues in this method, hence this methods expects the methods to run in case of success or failure
            this.isFileLocked = false;
            // Pass on the property value to the success case call back method.
            onSuccess();
        },

        searchCloudDriveElements(elementName: string, elementLocationId: string, searchAllSPYFiles: boolean, searchOptions: Record<string, string>): Promise<CloudDriveFile[]>{
            //TODO
            // Make a search query on OneDrive, with the provided query parameter.
            // Returns the elements found in the Drive listed by the HTTPRequest object obtained with ------------
            return Promise.resolve([]);
        },

        readFileContentForIO(fileId: string, isBinaryMode: boolean, filePath: string): Promise<string | Uint8Array | {success: boolean, errorMsg: string}> {
            //TODO
            // This method is used by FileIO to get a file string content.
            // It relies on the file Id passed as argument, and the callback method for handling succes or failure is also passed as arguments.
            // The argument "filePath" is only used for error message.
            // The nature of the answer depends on the reading mode: a string in normal text case, an array of bytes in binary mode.
            return Promise.resolve("dummy text content");
        },

        writeFileContentForIO(fileContent: string|Uint8Array, fileInfos: {filePath: string, fileName?: string, fileId?: string, folderId?: string}): Promise<string> {
            //TODO
            return Promise.resolve("a dummy file ID");
        },

        /**
         * Specific to OneDrive
         **/ 
        async getToken(command: IAuthenticateCommand): Promise<string> {
            const redirectServerHost = (process.env.NODE_ENV === "production") ? "www.strype.org" : "localhost:8081";
            const redirectServerEditorPath = "" /*IFTRUE_isPython +"editor" FITRUE_isPython*//*IFTRUE_microbit +"microbit" FITRUE_isMicrobit*/;
            const redirectUri = `http:${(process.env.NODE_ENV === "production") ? "s" : ""}//${redirectServerHost}/${redirectServerEditorPath}/`;
            this.app = new PublicClientApplication({auth: {
                clientId: "ee29b56f-8714-472f-a1c8-37e8551e3ec5", 
                authority: "https://login.microsoftonline.com/consumers",
                redirectUri: redirectUri,
            }});
            // Next line mentioned by AI and is crucial
            await this.app.initialize();

            let accessToken = "";
            //const authParams = { scopes: [`${combine(command.resource, ".default")}`] };
            const authParams = { scopes: ["Files.ReadWrite", "Files.ReadWrite.All", "Files.ReadWrite.AppFolder", "User.Read", "openid", "offline_access"] };
            try {
                // see if we have already the idtoken saved
                const resp = await this.app.acquireTokenSilent(authParams);
                accessToken = resp.accessToken;
            }
            catch (e) {
                // Per examples we fall back to popup
                // We specifically request to provide credentials for the account again in the prompt property 
                // to make MSAL doesn't use a saved account profile automatically.
                // NOTE: there is a very tricky behaviour with MSAL: it seems that Azure will try its best to keep users
                // logged in, for example with SSO. We request a login, but if the user has used MFA with email to log in
                // before, next time the popup will show a prompt to give that email address again to very that same account.
                // The only way to change user is to click on "use your password" and then the user can use another account. 
                const resp = await this.app.loginPopup({...authParams, prompt: "login"});
                this.app.setActiveAccount(resp.account);

                if (resp.idToken) {
                    const resp2 = await this.app.acquireTokenSilent(authParams);
                    accessToken = resp2.accessToken;

                }
                else {

                    // throw the error that brought us here
                    throw e;
                }
            }
            return accessToken;
        },

        async onPickerMsg(event: MessageEvent){
            // we validate the message is for us, win here is the same variable as above
            if (event.source && event.source === this.pickerPopup) {
                const message = event.data;
                // the channelId is part of the configuration options, but we could have multiple pickers so that is supported via channels
                // On initial load and if it ever refreshes in its window, the Picker will send an 'initialize' message.
                // Communication with the picker should subsequently take place using a `MessageChannel`.
                if (message.channelId === this.pickerOptions?.messaging.channelId) {
                    console.log("here :)");
                    let port = undefined as MessagePort|undefined;
                    //TODO : check that channel still applies for later messages
                    switch(message.type){
                    case "inialize":
                        // grab the port from the event
                        port = event.ports[0];

                        // add an event listener to the port (example implementation is in the next section)
                        port.addEventListener("message", this.onPickerMsg);

                        // start ("open") the port
                        port.start();

                        // tell the picker to activate
                        port.postMessage({
                            type: "activate",
                        });
                        break;
                    case "notification":
                        if (message.data.notification === "page-loaded") {
                            // here we know that the picker page is loaded and ready for user interaction
                        }

                        console.log(message.data);
                        break;

                    case "command":
                        // all commands must be acknowledged
                        port?.postMessage({
                            type: "acknowledge",
                            id: message.data.id,
                        });

                        // this is the actual command specific data from the message
                        switch (message.data.command) {
                        case "authenticate":
                            // the first command to handle is authenticate. This command will be issued any time the picker requires a token
                            // 'getToken' represents a method that can take a command and return a valid auth token for the requested resource
                            try {
                                this.oauthToken = await this.getToken(message.data.command);

                                if (!this.oauthToken) {
                                    throw new Error("Unable to obtain a token.");
                                }

                                // we report a result for the authentication via the previously established port
                                port?.postMessage({
                                    type: "result",
                                    id: message.data.id,
                                    data: {
                                        result: "token",
                                        token: this.oauthToken,
                                    },
                                });
                            }
                            catch (error: any) {
                                port?.postMessage({
                                    type: "result",
                                    id: message.data.id,
                                    data: {
                                        result: "error",
                                        error: {
                                            code: "unableToObtainToken",
                                            message: error.message,
                                        },
                                    },
                                });
                            }
                            break;
                        case "close":
                            this.pickerPopup.close();
                            break;
                        case "pick":
                            try {
                                /*await*/ this.pickFile(message.data.command);
    
                                // let the picker know that the pick command was handled (required)
                                port?.postMessage({
                                    type: "result",
                                    id: message.data.id,
                                    data: {
                                        result: "success",
                                    },
                                });
                            }
                            catch (error: any) {
                                port?.postMessage({
                                    type: "result",
                                    id: message.data.id,
                                    data: {
                                        result: "error",
                                        error: {
                                            code: "unusableItem",
                                            message: error.message,
                                        },
                                    },
                                });
                            }
                            break;                    
                        default:
                            // Always send a reply, if if that reply is that the command is not supported.
                            port?.postMessage({
                                type: "result",
                                id: message.data.id,
                                data: {
                                    result: "error",
                                    error: {
                                        code: "unsupportedCommand",
                                        message: message.data.command,
                                    },
                                },
                            });
                            break;
                        }
                        break;                    
                    default:
                        console.log("unknown message type from OneDrive Picker: "+message.type);
                        break;
                    }
                }
            }
        },    
        
        pickFile(command: any): Promise<void> {
            // what do we do now...
            console.log(JSON.stringify(command));
            // extract the file and get the webDavUrl property to download the file
            const fileURL = "";
            return fetch(fileURL).then((resp) => {
                if(resp.status == 200){
                    console.log("we got a file content:");
                    console.log(resp.body);
                    return Promise.resolve();
                }
                else{
                    console.log("problem getting file content: " + resp.status);
                    return Promise.reject();
                }
            }).catch((reason) => {
                return Promise.reject(reason);
            });
        },

        closePicker(command: any){
            //????????
        },
    },   
});
</script>

