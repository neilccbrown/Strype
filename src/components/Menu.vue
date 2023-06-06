<template>
    <!-- keep the tabindex attribute, it is necessary to handle focus properly -->
    <div @keydown="handleKeyEvent" @keyup="handleKeyEvent" tabindex="-1">
        <GoogleDrive :ref="googleDriveComponentId" />
        <Slide 
            :isOpen="showMenu"
            :burgerIcon="false"
            @openMenu="handleMenuOpen"
            @closeMenu="toggleMenuOnOff(null)"
            width="200"
        >
            <!-- download python/hex section -->
            /* IFTRUE_isMicrobit 
            <a v-if="showMenu" class="strype-menu-link strype-menu-item" @click="downloadHex();showMenu=false;" v-t="'appMenu.downloadHex'" />
            FITRUE_isMicrobit */
            <a v-if="showMenu" class="strype-menu-link strype-menu-item" @click="downloadPython();showMenu=false;" v-t="'appMenu.downloadPython'" />
            <div class="menu-separator-div"></div>
            <!-- load/save section -->
            <a v-if="showMenu" class="strype-menu-link strype-menu-item" v-b-modal.load-strype-project-modal-dlg v-t="'appMenu.loadProject'" :title="$t('appMenu.loadProjectTooltip')"/>
            <ModalDlg :dlgId="loadProjectModalDlgId">
                <div v-if="changesNotSavedOnLoad">
                    <span  v-t="'appMessage.editorConfirmChangeCode'" class="load-project-lost-span"/>
                    <br/>
                </div>
                <label v-t="'appMessage.loadToTarget'" :for="loadProjectProjectSelectId" class="load-save-label"/>
                <select :name="loadProjectProjectSelectId" :ref="loadProjectProjectSelectId">
                    <option :value="syncFSValue" v-t="'appMessage.targetFS'" :selected="getSyncTargetStatus(syncFSValue)"/>
                    <option :value="syncGDValue" :selected="getSyncTargetStatus(syncGDValue)">Google Drive</option>
                </select>
            </ModalDlg>
            <a :id="saveProjectLinkId" v-if="showMenu" class="strype-menu-link strype-menu-item" v-b-modal.save-strype-project-modal-dlg v-t="'appMenu.saveProject'" :title="$t('appMenu.saveProjectTooltip')"/>
            <ModalDlg :dlgId="saveProjectModalDlgId">
                <label v-t="'appMessage.fileName'" class="load-save-label"/>
                <input :id="saveFileNameInputId" :placeholder="$t('defaultProjName')" type="text"/>  
                <div v-show="showGDSaveLocation">
                    <label v-t="'appMessage.gdriveLocation'" class="load-save-label"/>
                    <span class="load-save-label">{{currentDriveLocation}}</span>
                    <b-button v-t="'buttonLabel.saveDiffLocation'" variant="outline-primary" @click="onSaveDiffLocationClick" size="sm" />
                    </div>
                <br/>    
                <label v-t="'appMessage.saveToTarget'" :for="saveProjectProjectSelectId" class="load-save-label" />
                <select :name="saveProjectProjectSelectId" :ref="saveProjectProjectSelectId" @change="onSaveTargetSelectChange">
                    <option :value="syncFSValue" v-t="'appMessage.targetFS'" :selected="getSyncTargetStatus(syncFSValue)" />
                    <option :value="syncGDValue" :selected="getSyncTargetStatus(syncGDValue)">Google Drive</option>
                </select>
            </ModalDlg>
            <div class="menu-separator-div"></div>
            <!-- reset section -->
            <a v-if="showMenu" class="strype-menu-link strype-menu-item" @click="resetProject();showMenu=false;" v-t="'appMenu.resetProject'" :title="$t('appMenu.resetProjectTooltip')"/>
            <div class="menu-separator-div"></div>
            <!-- prefs (localisation) section -->
            <span v-t="'appMenu.prefs'"/>
            <div class="appMenu-prefs-div">
                <div>
                    <label for="appLangSelect" v-t="'appMenu.lang'"/>&nbsp;
                    <select name="lang" id="appLangSelect" v-model="appLang" @change="showMenu=false;" class="strype-menu-item" @click="setCurrentTabIndexFromEltId('appLangSelect')">
                        <option value="en">English</option>
                        <option value="fr">Français</option>
                        <option value="el">Ελληνικά</option>
                    </select>
                </div> 
            </div>   
        </Slide>
        <div>
            <button 
                :id="menuUIID" 
                href="#" 
                tabindex="0" 
                class="show-menu-btn"
                @click="toggleMenuOnOff"
            >
            &#x2630;
            </button>    
        </div>
        <div>
            <input 
                type="file" 
                :accept="acceptedInputFileFormat"
                ref="importFileInput" 
                @change="selectedFile" 
                class="editor-file-input"
            /> 
        </div>
        <div class="undoredo-div">
            <div class="menu-icon-div">
                <input 
                    type="image" 
                    :src="undoImagePath"
                    :disabled="isUndoDisabled"
                    @click="performUndoRedo(true)"
                    class="undoredo-img"
                    :title="this.$i18n.t('contextMenu.undo')"
                />
            </div>
            <div class="menu-icon-div">   
                <input 
                    type="image" 
                    :src="redoImagePath"
                    :disabled="isRedoDisabled"
                    @click="performUndoRedo(false)"
                    class="undoredo-img"
                    :title="this.$i18n.t('contextMenu.redo')"
                />
            </div>
        </div> 
        <a id="feedbackLink" href="/feedback" target="_blank"><i class="far fa-comment" :title="$t('action.feedbackLink')"></i></a>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import { useStore } from "@/store/store";
import {saveContentToFile, readFileContent, fileNameRegex, strypeFileExtension} from "@/helpers/common";
import { AppEvent, FormattedMessage, FormattedMessageArgKeyValuePlaceholders, MessageDefinitions, MIMEDesc, SaveRequestReason, StrypeSyncTarget } from "@/types/types";
import { CustomEventTypes, fileImportSupportedFormats, getAppSimpleMsgDlgId, getEditorMenuUIID, getFrameUIID } from "@/helpers/editor";
import { Slide } from "vue-burger-menu";
import { mapStores } from "pinia";
import GoogleDrive from "@/components/GoogleDrive.vue";
import { downloadHex, downloadPython } from "@/helpers/download";
import { canBrowserOpenFilePicker, canBrowserSaveFilePicker, openFile, saveFile } from "@/helpers/filePicker";
import ModalDlg from "@/components/ModalDlg.vue";
import { BvModalEvent } from "bootstrap-vue";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "Menu",

    components: {
        Slide,
        GoogleDrive,
        ModalDlg,
    },

    data: function() {
        return {
            showMenu: false,
            // This flag is used to know if we've added the tabindex value for the closing "button", and get the number of indexes
            retrievedTabindexesCount: -1,
            // The tabindex of the currently focused element of the menu
            currentTabindexValue: 0,
            // The current selection for the sync target (local to this component, not in the store)            
            localSyncTarget: StrypeSyncTarget.fs,
            showGDSaveLocation: false,
            // Flag to know if a request to change with a different folder location for Googe Drive has been requested
            saveAtOtherLocation: false, 
        };
    },

    mounted() {
        // We register the keyboad event handling for the menu here
        window.addEventListener(
            "keydown",
            (event: KeyboardEvent) => {
                //handle the Ctrl/Meta + S command for saving the project
                if(event.key.toLowerCase() === "s" && (event.metaKey || event.ctrlKey)){
                    document.getElementById(this.saveProjectLinkId)?.click();
                    event.stopImmediatePropagation();
                    event.preventDefault();
                    this.toggleMenuOnOff(null);
                }
            }
        );

        // The events from Bootstrap modal are registered to the root app element.
        this.$root.$on("bv::modal::show", this.onStrypeMenuShownModalDlg);
        this.$root.$on("bv::modal::hide", this.onStrypeMenuHideModalDlg);      
        
        // Event listener for saving project action completion
        this.$root.$on(CustomEventTypes.saveStrypeProjectDoneForLoad, this.loadProject);
    },

    beforeDestroy(){
        // Just in case, we remove the Bootstrap modal event handler from the root app 
        this.$root.$off("bv::modal::show", this.onStrypeMenuShownModalDlg);
        this.$root.$off("bv::modal::hide", this.onStrypeMenuHideModalDlg);

        // And for the saving project action completion too
        this.$root.$off(CustomEventTypes.saveStrypeProjectDoneForLoad, this.loadProject);
    },

    computed: {
        ...mapStores(useStore),
        
        menuUIID(): string {
            return getEditorMenuUIID();
        },

        googleDriveComponentId(): string {
            return "googleDriveComponent";
        },

        loadProjectProjectSelectId(): string {
            return "loadProjectProjectSelect";
        },

        saveProjectProjectSelectId(): string {
            return "saveProjectProjectSelect";
        },

        syncFSValue(): StrypeSyncTarget {
            return StrypeSyncTarget.fs;
        },

        syncGDValue(): StrypeSyncTarget {
            return StrypeSyncTarget.gd;
        },

        loadProjectModalDlgId(): string {
            return "load-strype-project-modal-dlg";
        },

        saveProjectLinkId(): string {
            return "saveStrypeProjLink";
        },

        saveProjectModalDlgId(): string {
            return "save-strype-project-modal-dlg";
        },

        currentDriveLocation(): string {
            const currentLocation = this.appStore.strypeProjectLocationAlias??"";
            return (currentLocation.length > 0) ? (this.$i18n.t("appMessage.folderX", {folder: currentLocation}) as string) : "Strype";
        },

        saveFileNameInputId(): string {
            return "saveStrypeFileNameInput";
        },

        changesNotSavedOnLoad(): boolean {
            // For Google Drive, we will attempt saving anyway when loading so we don't need to care.
            return this.appStore.syncTarget != StrypeSyncTarget.gd && (this.appStore.isProjectUnsaved ?? true);
        },

        isSyncingToGoogleDrive(): boolean {
            return this.appStore.syncTarget == StrypeSyncTarget.gd;
        },

        isUndoDisabled(): boolean {
            return this.appStore.isUndoRedoEmpty("undo");
        },

        isRedoDisabled(): boolean {
            return this.appStore.isUndoRedoEmpty("redo");
        },

        undoImagePath(): string {
            return (this.isUndoDisabled) ? require("@/assets/images/disabledUndo.svg") : require("@/assets/images/undo.svg");
        },

        redoImagePath(): string {
            return (this.isRedoDisabled) ? require("@/assets/images/disabledRedo.svg") : require("@/assets/images/redo.svg");
        },

        acceptedInputFileFormat(): string {
            //The format needs to be as ".<ext1>, .<ext2>,..., .<extn>"
            return fileImportSupportedFormats.map((extension) => "." + extension).join(", ");
        },

        appLang: {
            get(): string {
                return this.appStore.appLang;
            },
            set(lang: string) {
                this.appStore.setAppLang(lang);
            }, 
        },

        strypeProjMIMEDescArray(): MIMEDesc[]{
            return [
                {
                    description: this.$i18n.t("strypeFileDesc") as string,
                    accept: { "application/strype": fileImportSupportedFormats.flatMap((extension) => "."+extension) },
                },
            ];
        },
    },

    methods: {
        downloadHex() {
            downloadHex();
        },

        downloadPython() {
            downloadPython(); 
        },

        getSyncTargetStatus(target: StrypeSyncTarget): boolean {
            return target == this.appStore.syncTarget;
        },

        getTargetSelectVal(isActionSave: boolean): number {
            // Get the target selected in a target select HTML element; 
            // of the "save" action popup if isActionSave is true, of the "load" action popup otherwise
            const refId = (isActionSave) ? this.saveProjectProjectSelectId : this.loadProjectProjectSelectId;
            return parseInt((this.$refs[refId] as HTMLSelectElement).value);
        },

        onSaveTargetSelectChange(){
            this.showGDSaveLocation = (this.getTargetSelectVal(true) == this.syncGDValue);
        },

        onStrypeMenuShownModalDlg(event: BvModalEvent, dlgId: string) {
            // This method handles the workflow of the "save file" menu entry related dialog
            this.showMenu = false;
            if(dlgId == this.saveProjectModalDlgId){
                this.saveAtOtherLocation = false;
                // After the above event is emitted, the Strype menu is closed and the focus is given back to the editor.
                // We want to give the focus back to the modal dialog input field and set its value.
                // Maybe because of internal Bootstrap behaviour, can't give focus to the input right now or in next ticks
                // so we wait a bit to generate a focus/click in the input.
                // We also check which target is selected to update target-depend UI in the modal.
                setTimeout(() => {
                    this.onSaveTargetSelectChange();
                    (document.getElementById(this.saveFileNameInputId) as HTMLInputElement).value = this.appStore.projectName;
                    document.getElementById(this.saveFileNameInputId)?.focus();
                    document.getElementById(this.saveFileNameInputId)?.click();
                }, 500);           
            }
        },

        onStrypeMenuHideModalDlg(event: BvModalEvent, dlgId: string) {
            // This method handles the workflow after acting on any modal dialog of the Strype menu entries.
            // For all cases, if there is no confirmation, nothing special happens.
            if(event.trigger == "ok" || event.trigger == "event"){
                // Case of "load file"
                if(dlgId == this.loadProjectModalDlgId){
                    // We force saving the current project anyway just in case
                    this.localSyncTarget = this.getTargetSelectVal(false);
                    this.$root.$emit(CustomEventTypes.requestEditorAutoSaveNow, SaveRequestReason.loadProject);
                    // The remaining parts of the loading process will be only done once saving is complete (cd loadProjec())                    
                }
                // Case of "save file"
                else if(dlgId == this.saveProjectModalDlgId){
                    // User has been given a chance to give the file a specifc name,
                    // we check that the name doesn't contain illegal characters (we are a bit restricive here) for file saving
                    // DO NOT UPDATE THE CURRENT SYNC FLAG IN THE STATE - we only do that IF loading succeed (because it can be still cancelled or impossible to achieve)
                    let saveFileName = (document.getElementById(this.saveFileNameInputId) as HTMLInputElement).value.trim();
                    if(saveFileName.length == 0){
                        saveFileName = this.$i18n.t("defaultProjName") as string;
                    }
                    
                    const selectValue = this.getTargetSelectVal(true);
                    if(selectValue != StrypeSyncTarget.gd ){
                        if(!canBrowserSaveFilePicker && saveFileName.trim().match(fileNameRegex) == null){
                            // Show an error message and do nothing special
                            this.appStore.simpleModalDlgMsg = this.$i18n.t("errorMessage.fileNameError") as string;
                            this.$root.$emit("bv::show::modal", getAppSimpleMsgDlgId());
                            return;
                        }
                        // Save the JSON file of the state, we try to use the file picker if the browser allows it, otherwise, download to the default download repertory of the browser.
                        if(canBrowserSaveFilePicker){
                            saveFile(saveFileName, this.strypeProjMIMEDescArray, this.appStore.strypeProjectLocation, (fileHandle: FileSystemFileHandle) => {
                                this.appStore.strypeProjectLocation = fileHandle;
                                this.appStore.projectName = fileHandle.name.substring(0, fileHandle.name.lastIndexOf("."));
                                this.appStore.syncTarget = StrypeSyncTarget.fs;
                            });
                        }
                        else{
                            saveContentToFile(this.appStore.generateStateJSONStrWithCheckpoint(), saveFileName + "." + strypeFileExtension);
                        }
                    }
                    else {          
                        // If we were already syncing to Google Drive, we save the current file now
                        if(this.isSyncingToGoogleDrive){
                            this.$root.$emit(CustomEventTypes.requestEditorAutoSaveNow, SaveRequestReason.autosave);
                        }
                        const saveReason = (this.saveAtOtherLocation) ? SaveRequestReason.saveProjectAtOtherLocation : SaveRequestReason.saveProjectAtLocation; 
                        (this.$refs[this.googleDriveComponentId] as InstanceType<typeof GoogleDrive>).saveFileName = saveFileName;
                        (this.$refs[this.googleDriveComponentId] as InstanceType<typeof GoogleDrive>).saveFile(saveReason);
                    }
                }
            }
        },

        onSaveDiffLocationClick(){
            // When the button to save at a different location is called, we trigger the hiding of the modal dialog and and set the right flag about saving
            this.saveAtOtherLocation = true;
            this.$root.$emit("bv::hide::modal", this.saveProjectModalDlgId);
        },

        loadProject(){
            // Called once sanity save has been performed
            // If the user chose to sync on Google Drive, we should open the Drive loader. Otherwise, we open default file system.
            // DO NOT UPDATE THE CURRENT SYNC FLAG IN THE STATE - we only do that IF loading succeed (because it can be still cancelled or impossible to achieve)
            const selectValue = this.localSyncTarget;
            if(selectValue == StrypeSyncTarget.gd){
                (this.$refs[this.googleDriveComponentId] as InstanceType<typeof GoogleDrive>).loadFile();
            }
            else{               
                // And let the user choose a file
                if(canBrowserOpenFilePicker){
                    openFile(this.strypeProjMIMEDescArray, this.appStore.strypeProjectLocation, (fileHandles: FileSystemFileHandle[]) => {
                        // We select 1 file so we can get the first element of the returned array
                        this.appStore.strypeProjectLocation = fileHandles[0];
                        this.appStore.projectName = fileHandles[0].name.substring(0, fileHandles[0].name.lastIndexOf("."));
                        this.appStore.syncTarget = StrypeSyncTarget.fs;
                    });                        
                }
                else{
                    (this.$refs.importFileInput as HTMLInputElement).click();
                }
            }
        },
        
        selectedFile() {
            const files = (this.$refs.importFileInput as HTMLInputElement).files;
            if(files){
                //before reading the file, we check the extension is supported for the import
                if(files[0].name.indexOf(".") > -1 && fileImportSupportedFormats.findIndex((extension) => extension === files[0].name.substring(files[0].name.lastIndexOf(".") + 1)) > -1) {
                    const emitPayload: AppEvent = {requestAttention: true};
                    emitPayload.message = this.$i18n.t("appMessage.editorFileUpload").toString();
                    this.$emit("app-showprogress", emitPayload);
                    readFileContent(files[0])
                        .then(
                            (content) => {
                                this.appStore.setStateFromJSONStr( 
                                    {
                                        stateJSONStr: content,
                                        callBack: () => {},
                                    }
                                );
                                emitPayload.requestAttention=false;
                                this.$emit("app-showprogress", emitPayload);
                                // Update the sync target and remove Drive infos
                                this.appStore.syncTarget = StrypeSyncTarget.fs;
                                this.appStore.currentGoogleDriveSaveFileId = undefined;
                            }, 
                            (reason) => this.appStore.setStateFromJSONStr( 
                                {
                                    stateJSONStr: "",
                                    callBack: () => {},
                                    errorReason: reason,
                                }
                            )
                        );  
                }
                else {
                    //alert the user this file format isn't supported (in case the file browser filter doesn't work on the browser)
                    const message = MessageDefinitions.UploadEditorFileNotSupported;
                    const msgObj: FormattedMessage = (message.message as FormattedMessage);
                    msgObj.args[FormattedMessageArgKeyValuePlaceholders.list.key] = msgObj.args.list.replace(FormattedMessageArgKeyValuePlaceholders.list.placeholderName, this.acceptedInputFileFormat);

                    this.appStore.currentMessage = message;
                }
                
                //reset the input file element value to empty (so further changes can be notified)
                (this.$refs.importFileInput as HTMLInputElement).value = "";
            }
        },

        resetProject(): void {
            //resetting the project means removing the WebStorage saved project and reloading the page
            //we emit an event to the App so that handlers are done properly
            this.$emit("app-reset-project");
        },

        handleMenuOpen(){
            // As we are handling the tab indexing and navigation manually, we need also to add the tabindex attribute for the menu elements
            // (the close button and all bits in the menu). The button is treated separately, and all other elements are found based on the CSS class.
            (document.getElementsByClassName("bm-cross-button")[0] as HTMLSpanElement).tabIndex = 0;
            this.retrievedTabindexesCount = 1;
            document.querySelectorAll(".bm-menu .strype-menu-item").forEach((element, index) => {
                element.setAttribute("tabindex", (index + 1).toString());
                this.retrievedTabindexesCount++;
            });
        },

        toggleMenuOnOff(e: Event | null): void {
            const isMenuOpening = (e !== null);
            if(isMenuOpening) {
                //cf online issues about vue-burger-menu https://github.com/mbj36/vue-burger-menu/issues/33
                e.preventDefault();
                e.stopPropagation();
                this.currentTabindexValue = 0;                
            }
            else {
                // Bring the focus back to the editor
                document.getElementById(getFrameUIID(this.appStore.currentFrame.id))?.focus();
                this.appStore.ignoreKeyEvent = false;                
            }
            this.appStore.isAppMenuOpened = isMenuOpening;
            this.showMenu = isMenuOpening;
        },

        handleKeyEvent(event: KeyboardEvent){
            this.appStore.ignoreKeyEvent = true;

            if(event.type == "keyup" && event.key == "Enter"){
                // When the enter key is hit, we trigger the action bound to the click for the selected menu element
                // and we cancel the natural key up event so it does not get sent to the editor (otherwise, will add a blank frame)
                event.preventDefault();
                event.stopImmediatePropagation();
                event.stopPropagation();
                (document.activeElement as HTMLElement).click();
            }


            if(event.type == "keydown" && ["Tab", "ArrowDown", "ArrowUp"].includes(event.key)){
                // When the tab key is hit, we handle the menu entry selection ourselves, because the default behaviour won't do it properly.
                // We loop through the available elements that can have focus. Note the modulo is done here based on this (https://web.archive.org/web/20090717035140if_/javascript.about.com/od/problemsolving/a/modulobug.htm)
                event.preventDefault();
                event.stopImmediatePropagation();
                event.stopPropagation();
                const newTabindexValue = (this.currentTabindexValue +  ((event.shiftKey || event.key == "ArrowUp") ? -1 : 1));
                this.currentTabindexValue = ((newTabindexValue % this.retrievedTabindexesCount) + this.retrievedTabindexesCount) % this.retrievedTabindexesCount;
                (document.querySelector(".bm-menu  [tabindex='" + this.currentTabindexValue + "']") as HTMLElement).focus();
            }
        },

        performUndoRedo(isUndo: boolean): void {
            this.appStore.undoRedo(isUndo);
        },

        setCurrentTabIndexFromEltId(elementId: string): void {
            const el = document.getElementById(elementId);
            if(el){
                this.currentTabindexValue = el.tabIndex;
            }
        },
    },
});
</script>

<style lang="scss">
.menu-icon-div {
    width: 100%;
    height: 24px;
    margin-bottom: 10px;
}

.editor-file-input {
    display: none;
} 

.show-menu-btn {
    border: none;
    outline:none;
    background-color: transparent;
    font-size: 200%;
    min-width: 45px;
    color: #6c757d;
    border-radius: 50%;
}

.strype-menu-link {
    margin-left: 5%;
    width: 100%;
    outline: none;
    border: $strype-menu-entry-border;
}

.strype-menu-item {
    outline: none;
}

.strype-menu-item:focus {
    border: $strype-menu-entry-focus-border;
}

.menu-separator-div {
    border-top: 1px solid #c5c4c1 !important;
    padding:0px !important;

}

.appMenu-prefs-div {
    margin-left: 5%;
    color: black;
}

.undoredo-div {
    margin-top: 20px;
}

.undoredo-img {
    width: 24px;
    height: 24px;
    display: block;
    margin: auto;
}

.load-project-lost-span{
    display: block;
}

.load-save-label {
    margin-right: 5px;
}

#feedbackLink {
    color: #3467FE;
    width:24px;
    font-size: 22px;
    margin:auto;
    display: block;
    bottom:0px;
    position:absolute;    
}

#feedbackLink:hover {
    color: #2648af;
}

//the following classes are overriding the default CSS for vue-burger-menu
.bm-cross-button {
    outline: none;
    border: $strype-menu-entry-border;
}

.bm-cross-button:focus{
    border: $strype-menu-entry-focus-border;
}

.bm-cross {
    background: #6c757d !important;
    top: 3px;
    left: 9px;
    width: 2px !important; // default is 3px, but to center the crosss in its container, better have this value
}

.bm-menu {
    background-color: #e2e7e0 !important;
    padding-top: 25px !important;
    border-right: black 1px solid !important;
}

.bm-item-list {
      color: #6d6c6a !important;
      margin-left: 0% !important;
      font-size: inherit !important;
}

.bm-item-list > :not(.menu-separator-div):not(.google-drive-container) {
      display: flex !important;
      text-decoration: none !important;
      padding: $strype-menu-entry-padding !important;
      width: $strype-menu-entry-width;
}

.bm-item-list > * > span {
      margin-left: 0px !important;
      font-weight: 700 !important;
      color: white !important;
}

.bm-item-list > hr {
    margin: 0;
    height: 1px !important;
}
</style>
