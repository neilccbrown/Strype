<template>
    <div>
        <Slide 
            :isOpen="showMenu"
            :burgerIcon="false"
            @closeMenu="toggleMenuOnOff(null)"
            width="200"
        >
            <div style="width: 100%;">
                <div class="project-name-div">
                    <input
                        ref="projectNameInput"
                        v-if="isComponentLoaded"
                        v-model="projectName" 
                        spellcheck="false"
                        @click="nameEditing = true"
                        @focus="onFocus()"
                        @blur="onBlur()"
                        @keyup.enter.prevent.stop="blur()"
                        @keypress="validateInput($event)"
                        :class="{'project-name': true, 'project-name-noborder': !nameEditing}"
                        id="name-input-field"
                        autocomplete="off"
                        :style="inputTextStyle"
                    />                    
                    <i 
                        style="margin-left: 2px;" 
                        @click="onProjectPenEditClick()"
                        :class="{fa: true, 'fa-check': nameEditing, 'fa-pencil-alt': !nameEditing}"></i>  
                </div>
            </div> 
            <div class="menu-separator-div"></div>
            <a v-if="showMenu" class="project-impexp-div" @click="importFile();toggleMenuOnOff(null);" v-t="'appMenu.loadProject'" />
            <a v-if="showMenu" class="project-impexp-div" @click="exportFile();toggleMenuOnOff(null);" v-t="'appMenu.saveProject'"/>
            <a v-if="showMenu" class="project-impexp-div" @click="resetProject();toggleMenuOnOff(null);" v-t="'appMenu.resetProject'" :title="$t('appMenu.resetProjectTooltip')"/>
            <div class="menu-separator-div"></div>
            <span v-t="'appMenu.prefs'"/>
            <div class="appMenu-prefs-div">
                <div>
                    <label for="appLangSelect" v-t="'appMenu.lang'"/>&nbsp;
                    <select name="lang" id="appLangSelect" v-model="appLang" @change="toggleMenuOnOff(null)">
                        <option value="en">English</option>
                        <option value="fr">Français</option>
                        <option value="el">Ελληνικά</option>
                    </select>
                </div> 
            </div>   
        </Slide>
        <div 
                class="editableslot-placeholder"
                id="projectNameDiv"
                :value="projectName"
        />
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
import {saveContentToFile, readFileContent} from "@/helpers/common";
import { AppEvent, FormattedMessage, FormattedMessageArgKeyValuePlaceholders, MessageDefinitions } from "@/types/types";
import { fileImportSupportedFormats, getEditorMenuUIID } from "@/helpers/editor";
import $ from "jquery";
import { Slide } from "vue-burger-menu"
import { mapStores } from "pinia";

//////////////////////
//     Component    //
//////////////////////
const maxProjetNameWidth = 150; //this value (in pixels) is used as a max-width value when computing the input text width dynamically
export default Vue.extend({
    name: "Menu",

    components: {
        Slide,
    },

    data: function() {
        return {
            showMenu: false,
            nameEditing: false,
            //this flag is used to "delay" the computation of the input text field's width,
            //so that the width is rightfully computed when displayed for the first time
            isComponentLoaded : false,
        };
    },

    mounted() {
        //when the component is loaded, the width of the editable slot cannot be computed yet based on the placeholder
        //because the placeholder hasn't been loaded yet. Here it is loaded so we can set the width again.
        this.isComponentLoaded  = true;

        //we also register the keyboad event handling for the menu here
        window.addEventListener(
            "keydown",
            (event: KeyboardEvent) => {
                //handle the Ctrl/Meta + S command for saving the project
                if(event.key === "s" && (event.metaKey || event.ctrlKey)){
                    this.exportFile();
                    event.stopImmediatePropagation();
                    event.preventDefault();
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

        projectName: {
            get(): string {
                return this.appStore.projectName;
            },
            set(value: string) {
                if(value.trim().length === 0){
                    value = (this.$i18n.t("appMenu.defaultProjName") as string);
                }
                this.appStore.projectName = value;
            },
        },

        inputTextStyle(): Record<string, string> {
            return {"width" : this.computeFitWidthValue()};
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

        exportFile(): void {
            //save the JSON file of the state 
            saveContentToFile(this.appStore.generateStateJSONStrWithCheckpoint(), this.appStore.projectName+".spy");
        },

        resetProject(): void {
            //resetting the project means removing the WebStorage saved project and reloading the page
            //we emit an event to the App so that handlers are done properly
            this.$emit("app-reset-project");
        },

        toggleMenuOnOff(e: Event): void {
            const isMenuOpening = (e !== null);
            if(isMenuOpening) {
                //cf online issues about vue-burger-menu https://github.com/mbj36/vue-burger-menu/issues/33
                e.preventDefault();
                e.stopPropagation();
            }
            this.showMenu = isMenuOpening;
            this.appStore.isAppMenuOpened = isMenuOpening;
        },

        computeFitWidthValue(): string {
            const placeholder = document.getElementById("projectNameDiv");
            let width = 5;
            const offset = 8; //2+2*padding value + border
            if (placeholder) {
                placeholder.textContent = this.projectName 
                //the width is computed from the placeholder's width from which
                //we add extra space for the cursor.
                const calculatedWidth = (placeholder.offsetWidth + offset);
                //checks that we don't go over the max width (note: no min as we don't leave an empty input possible)
                width = (calculatedWidth > maxProjetNameWidth) ? maxProjetNameWidth : calculatedWidth;
            }
            
            return width + "px";
        },

        validateInput(event: KeyboardEvent): boolean {
            // For file names allow only A–Z a–z 0–9 . _ - ()
            const fileNameRegex = /[\d\w\s\-\\_\\(\\)]+/;
            if(event.key.match(fileNameRegex) !== null) {
                return true;
            }
            else {
                event.preventDefault();
                return false;
            }
        },

        //Apparently focus happens first before blur when moving from one slot to another.
        onFocus(): void {
            this.appStore.isEditing = true;    
        },

        onBlur(): void {
            //just change the flag with a sligh a delay to avoid the issue that when being in the input field and clicking on the tick, the flag has already changed
            setTimeout(() => {
                this.nameEditing = false;
            }, 500);
            this.appStore.isEditing = false; 
        },
        
        // Explicit blur method for "enter" key event
        blur(): void {
            // We are taking the focus away from the input.
            $("#name-input-field").blur();
        },

        performUndoRedo(isUndo: boolean): void {
            this.appStore.undoRedo(isUndo);
        },

        onProjectPenEditClick(): void {
            if(!this.nameEditing){
                // When the pen is shown (i.e. the project name is not being edited) we toggle the flag
                // and get the focus on the input field and
                this.nameEditing = true;
                (this.$refs.projectNameInput as HTMLInputElement).focus();                
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

.file-menu-img {
    outline: none;
}

.editor-file-input {
    display: none;
} 

.show-menu-btn{
    border: none;
    outline:none;
    background-color: transparent;
    font-size: 200%;
    min-width: 45px;
    color: #6c757d;
    border-radius: 50%;
}

.project-name {
    //don't forget to update the autosize offset if padding or borderis changed!
    border: #6d6c6a solid 1px;
    padding: 0px 2px; 
    background: transparent;
    text-align:center;
    color: #274D19;
    outline: none;
}

.project-name-div {
    margin: 0 auto;
    display: inline;
}

.project-name-noborder {
     border-width: 0px;
}

.project-impexp-div {
    margin-left: 5%;
}

.bm-item-list > hr {
    margin: 0;
    height: 1px !important;
}

.menu-separator-div {
    border-top: 1px solid #c5c4c1 !important;
    padding:0px;

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
    width:24px1;
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
.bm-cross {
    background: #6c757d !important;
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

.bm-item-list > :not(.menu-separator-div) {
      display: flex !important;
      text-decoration: none !important;
      padding: 0.4em !important;
}

.bm-item-list > * > span {
      margin-left: 0px !important;
      font-weight: 700 !important;
      color: white !important;
}
</style>

