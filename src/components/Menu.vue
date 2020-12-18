<template>
    <div>
        <Slide 
            :isOpen="showMenu"
            :burgerIcon="false"
            @closeMenu="toggleMenuOnOff"
            width="200"
        >
            <div style="width: 100%;">
                <div class="project-name-div">
                    <input
                        v-if="isComponentLoaded"
                        v-model="projectName" 
                        @mouseover="hover = true"
                        @mouseleave="hover = false"
                        @focus="onFocus()"
                        @blur="onBlur()"
                        @keyup.enter.prevent.stop="blur()"
                        @keypress="validateInput($event)"
                        class="project-name"
                        id="name-input-field"
                        autocomplete="off"
                        :style="inputTextStyle"
                    />                    
                    <i 
                        style="margin-left: 2px;" 
                        class="fa fa-pencil-alt"
                        :class="{penHidden: !hover}"></i>  
                </div>
            </div> 
            <hr/>
            <a class="project-impexp-div" href="#" @click="importFile()" v-t="'appMenu.importFile'" />
            <a class="project-impexp-div" href="#" @click="exportFile()" v-t="'appMenu.exportFile'"/>
            <hr/>
            <span v-t="'appMenu.prefs'"/>
            <div class="appMenu-prefs-div">
                <div>
                    <label for="appLangSelect" v-t="'appMenu.lang'"/>&nbsp;
                    <select name="lang" id="appLangSelect" v-model="appLang">
                        <option value="en">English</option>
                        <option value="ja">日本语</option>
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
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import store from "@/store/store";
import {saveContentToFile, readFileContent} from "@/helpers/common";
import { AppEvent, FormattedMessage, FormattedMessageArgKeyValuePlaceholders, MessageDefinitions } from "@/types/types";
import { fileImportSupportedFormats, getEditorMenuUIID } from "@/helpers/editor";
import $ from "jquery";
import { Slide } from "vue-burger-menu"

//////////////////////
//     Component    //
//////////////////////
const maxProjetNameWidth = 150; //this value (in pixels) is used as a max-width value when computing the input text width dynamically

export default Vue.extend({
    name: "Menu",
    store,
    components: {
        Slide,
    },

    data() {
        return {
            showMenu: false,
            hover: false,
            //this flag is used to "delay" the computation of the input text field's width,
            //so that the width is rightfully computed when displayed for the first time
            isComponentLoaded : false,
        };
    },

    mounted() {
        //when the component is loaded, the width of the editable slot cannot be computed yet based on the placeholder
        //because the placeholder hasn't been loaded yet. Here it is loaded so we can set the width again.
        this.isComponentLoaded  = true;
    },

    computed: {
        menuUIID(): string {
            return getEditorMenuUIID();
        },
        isUndoDisabled(): boolean {
            return store.getters.getIsUndoRedoEmpty("undo");
        },
        isRedoDisabled(): boolean {
            return store.getters.getIsUndoRedoEmpty("redo");
        },
        undoImagePath(): string {
            return (this.isUndoDisabled) ? require("@/assets/images/disabledUndo.svg") : require("@/assets/images/undo.svg");
        },
        redoImagePath(): string {
            return (this.isRedoDisabled) ? require("@/assets/images/disabledRedo.svg") : require("@/assets/images/redo.svg");
        },
        editorFileMenuOption(): {}[] {
            return  [{name: "import", method: "importFile"}, {name: "export", method: "exportFile"}];
        },

        acceptedInputFileFormat(): string {
            //The format needs to be as ".<ext1>, .<ext2>,..., .<extn>"
            return fileImportSupportedFormats.map((extension) => "." + extension).join(", ");
        },

        projectName: {
            get(): string {
                return store.getters.getProjectName();
            },
            set(value: string) {
                if(value.trim().length === 0){
                    value = (this.$i18n.t("appMenu.defaultProjName") as string);
                }
                store.commit("setProjectName",value);
            },
        },

        inputTextStyle(): Record<string, string> {
            return {"width" : this.computeFitWidthValue()};
        },
        
        appLang: {
            get(): string {
                return store.getters.getAppLang();
            },
            set(lang: string) {
                store.commit("setAppLang",lang);
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
                                store.dispatch(
                                    "setStateFromJSONStr", 
                                    {
                                        stateJSONStr: content,
                                    }
                                );
                                emitPayload.requestAttention=false;
                                this.$emit("app-showprogress", emitPayload);
                            }, 
                            (reason) => store.dispatch(
                                "setStateFromJSONStr", 
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

                    store.commit(
                        "setMessageBanner",
                        message
                    );
                }
                
                //reset the input file element value to empty (so further changes can be notified)
                (this.$refs.importFileInput as HTMLInputElement).value = "";
            }
        },

        exportFile(): void {
            //save the JSON file of the state 
            saveContentToFile(store.getters.getStateJSONStrWithCheckpoints(), store.getters.getProjectName()+".wpy");
        },

        toggleMenuOnOff(e: Event): void {
            const isMenuOpening = (e !== undefined);
            if(isMenuOpening) {
                //cf online issues about vue-burger-menu https://github.com/mbj36/vue-burger-menu/issues/33
                e.preventDefault();
                e.stopPropagation();
            }
            this.$data.showMenu = isMenuOpening;
            store.commit("setIsAppMenuOpened", isMenuOpening);
        },

        computeFitWidthValue(): string {
            const placeholder = document.getElementById("projectNameDiv");
            let width = 5;
            const offset = 2;
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
            store.commit(
                "setEditFlag",
                true
            );    
        },

        onBlur(): void {
            store.commit(
                "setEditFlag",
                false
            ); 
        },
        
        // Explicit blur method for "enter" key event
        blur(): void {
            // We are taking the focus away from the input.
            $("#name-input-field").blur();
        },

        performUndoRedo(isUndo: boolean): void {
            store.dispatch(
                "undoRedo",
                isUndo
            );
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

.project-name {
    border: 0;
    padding: 0; 
    background: transparent;
    text-align:center;
}

.project-name-div {
    margin: 0 auto;
    display: inline;
}

.project-name-div input {
    outline: none;
    color: #274D19;
}

.penHidden {
    visibility: hidden;
}

.project-impexp-div {
    margin-left: 5%;
}

.bm-item-list > hr {
    margin: 0;
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

//the following classes are overriding the default CSS for vue-burger-menu
.bm-cross {
    background: #6c757d;
}

.bm-menu {
    background-color: #e2e7e0;
    padding-top: 25px;
    border-right: black 1px solid;
}

 .bm-item-list {
      color: #6d6c6a;
      margin-left: 0%;
      font-size: inherit;
}

.bm-item-list > * {
      display: flex;
      text-decoration: none;
      padding: 0.4em;
}

.bm-item-list > * > span {
      margin-left: 0px;
      font-weight: 700;
      color: white;
}
</style>

