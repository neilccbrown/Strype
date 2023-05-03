<template>
    <div @keydown="handleKeyEvent" @keyup="handleKeyEvent" tabindex="-1">
        <Slide 
            :isOpen="showMenu"
            :burgerIcon="false"
            @openMenu="handleMenuOpen"
            @closeMenu="toggleMenuOnOff(null)"
            width="200"
        >
            /* IFTRUE_isMicrobit 
            <a v-if="showMenu" class="strype-menu-link strype-menu-item" @click="downloadHex();showMenu=false;" v-t="'appMenu.downloadHex'" />
            FITRUE_isMicrobit */
            <a v-if="showMenu" class="strype-menu-link strype-menu-item" @click="downloadPython();showMenu=false;" v-t="'appMenu.downloadPython'" />
            <div class="menu-separator-div"></div>
            <a v-if="showMenu" class="strype-menu-link strype-menu-item" @click="importFile();showMenu=false;" v-t="'appMenu.loadProject'"/>
            <a v-if="showMenu" class="strype-menu-link strype-menu-item" @click="exportFile();showMenu=false;;" v-t="'appMenu.saveProject'"/>
            <div v-if="!isSignedInGoogleDrive" class="menu-separator-div"></div>
            <GoogleDrive v-show="showMenu" @strype-menu-action-performed="onActionPerformed" @google-drive-signed="isSignedInGoogleDrive=true"/>
            <div class="menu-separator-div"></div>
            <a v-if="showMenu" class="strype-menu-link strype-menu-item" @click="resetProject();showMenu=false;;" v-t="'appMenu.resetProject'" :title="$t('appMenu.resetProjectTooltip')"/>
            <div class="menu-separator-div"></div>
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
import {saveContentToFile, readFileContent, fileNameRegex} from "@/helpers/common";
import { AppEvent, FormattedMessage, FormattedMessageArgKeyValuePlaceholders, MessageDefinitions } from "@/types/types";
import { fileImportSupportedFormats, getEditorMenuUIID, getFrameUIID } from "@/helpers/editor";
import { Slide } from "vue-burger-menu";
import { mapStores } from "pinia";
import GoogleDrive from "@/components/GoogleDrive.vue";
import { downloadHex, downloadPython } from "@/helpers/download";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "Menu",

    components: {
        Slide,
        GoogleDrive,
    },

    data: function() {
        return {
            showMenu: false,
            // This flag is used to know if we've added the tabindex value for the closing "button", and get the number of indexes
            retrievedTabindexesCount: -1,
            // The tabindex of the currently focused element of the menu
            currentTabindexValue: 0,
            isSignedInGoogleDrive: false,
        };
    },

    mounted() {
        // We register the keyboad event handling for the menu here
        window.addEventListener(
            "keydown",
            (event: KeyboardEvent) => {
                //handle the Ctrl/Meta + S command for saving the project
                if(event.key.toLowerCase() === "s" && (event.metaKey || event.ctrlKey)){
                    this.exportFile(true);
                    event.stopImmediatePropagation();
                    event.preventDefault();
                    this.toggleMenuOnOff(null);
                }
            }
        );
    },

    computed: {
        ...mapStores(useStore),
        
        menuUIID(): string {
            return getEditorMenuUIID();
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
        editorFileMenuOption(): Record<string,string>[] {
            return  [{name: "import", method: "importFile"}, {name: "export", method: "exportFile"}];
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
    },

    methods: {
        downloadHex() {
            downloadHex();
        },

        downloadPython() {
            downloadPython(); 
        },
        
        importFile(): void {
            //users should be warned about current editor's content loss
            const confirmMsg = this.$i18n.t("appMessage.editorConfirmChangeCode");
            Vue.$confirm({
                message: confirmMsg,
                button: {
                    yes: this.$i18n.t("buttonLabel.yes"),
                    no: this.$i18n.t("buttonLabel.no"),
                },
                callback: (confirm: boolean) => {
                    if(confirm){
                        (this.$refs.importFileInput as HTMLInputElement).click();
                    }                        
                },
            });    
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
                                    }
                                );
                                emitPayload.requestAttention=false;
                                this.$emit("app-showprogress", emitPayload);
                            }, 
                            (reason) => this.appStore.setStateFromJSONStr( 
                                {
                                    stateJSONStr: "",
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

        exportFile(keyboardShortcutCall?: boolean): void {
            // Propose the user a chance to chance or specify the project name when they use the keyboard shortcut
            const confirmMsg = this.$i18n.t("appMessage.exportFileProjectName") as string;
            const promptValue = (keyboardShortcutCall) ? prompt(confirmMsg, this.appStore.projectName) : null;
            let cancelExport = false;
            if(promptValue != null){
                if(promptValue.match(fileNameRegex) == null){
                    const confirmMsg = this.$i18n.t("appMessage.fileNameError");
                    Vue.$confirm({
                        message: confirmMsg,
                        button: {
                            yes: this.$i18n.t("buttonLabel.ok"),
                        },
                    });    
                    cancelExport = true;
                }
                else{
                    this.appStore.projectName = promptValue;
                }
            }            
            if(!cancelExport){
                // Save the JSON file of the state 
                saveContentToFile(this.appStore.generateStateJSONStrWithCheckpoint(), this.appStore.projectName+".spy");
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

        onActionPerformed(){
            // When a menu action is performed, we close the menu
            this.showMenu = false;
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
