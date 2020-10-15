<template>
    <div>
        <div>
            <button 
                id="showHideMenu" 
                href="#" 
                tabindex="0" 
                @click="toggleMenuOnOff"
            >
                <div v-html="buttonLabel"></div>
            </button>
            <b-popover 
                target="showHideMenu" 
                triggers="click blur"
                @hidden="toggleMenuOnOff()"
                id="menu"
            >
                <template v-slot:title >
                    <input
                        v-model="projectName" 
                        @mouseover="hover = true"
                        @mouseleave="hover = false"
                        @focus="onFocus()"
                        @blur="onBlur()"
                        @keyup.enter.prevent.stop="blur($event)"
                        class="project-name"
                        id="project-name"
                        v-bind:style="inputTextStyle"
                        ref="nameinput"
                    />
                    <i v-if="hover" class="fa fa-pencil-alt"></i>
                </template>
                <table>
                    <tr>
                        <td >
                            <a href="#" @click="importFile()">
                                Import from file
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <a href="#" @click="exportFile()">
                                Export to file
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <a href="#">
                                Preferences
                            </a>
                        </td>
                    </tr>
                </table>
            </b-popover>
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
         <input 
                type="image" 
                :src="undoImagePath"
                :disabled="isUndoDisabled"
                @click="performUndoRedo(true)"
                class="undoredo-img"
                :title="this.$i18n.t('contextMenu.undo')"
            />        
            <input 
                type="image" 
                :src="redoImagePath"
                :disabled="isRedoDisabled"
                @click="performUndoRedo(false)"
                class="undoredo-img"
                :title="this.$i18n.t('contextMenu.redo')"
            />       
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
import { fileImportSupportedFormats } from "@/helpers/editor";
import $ from "jquery";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "Menu",
    store,


    data() {
        return {
            buttonLabel: "&#x2630;",
            hover: false,
        };
    },

    computed: {
        isUndoDisabled(): boolean {
            return store.state.diffToPreviousState.length == 0;
        },
        isRedoDisabled(): boolean {
            return store.getters.getIsUndoRedoEmpty(false);
        },
        undoImagePath(): string {
            return (this.isUndoDisabled) ? require("@/assets/images/disabledUndo.png") : require("@/assets/images/undo.png");
        },
        redoImagePath(): string {
            return (this.isRedoDisabled) ? require("@/assets/images/disabledRedo.png") : require("@/assets/images/redo.png");
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
                store.commit("setProjectName",value);
            },
        },

        inputTextStyle(): Record<string, string> {
            return {"width" : this.computeFitWidthValue()};
        },
    },

    methods: {

        importFile(): void {
            //users should be warned about current editor's content loss
            const confirmMsg = this.$i18n.t("appMessages.editorConfirmChangeCode");
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

        toggleMenuOnOff(): void {
            this.buttonLabel = (this.buttonLabel === "x")? "&#x2630;" : "x" ;
        },

        computeFitWidthValue(): string {
            const placeholder = document.getElementById("project-name");
            let computedWidth = "150px"; //default value if cannot be computed
            const offset = 10;
            if (placeholder) {
                //the width is computed from the placeholder's width from which
                //we add extra space for the cursor.
                computedWidth = (placeholder.offsetWidth + offset) + "px";
            }
            return computedWidth;
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
        blur(event: KeyboardEvent): void {
            // We are taking the focus away from the input. We are not calling 
            // input.blur() as this propagates and closes the whole menu.
            $("#menu").focus();
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

.file-menu-img {
    outline: none;
}

.editor-file-input {
    display: none;
} 

.project-name {
    border: 0; 
    background: transparent;
    text-align:center;
}

table {
    width: 100%
}

td {
    padding-bottom: 10px;
    width: 100%;
}

a {
    width: 100%;
    display: inline-block;
    text-decoration: none !important;
    color: black !important;
}


td:hover {
    background-color: #dededebf;
}

#showHideMenu{
    border: none;
    outline:none;
    background-color: transparent;
    font-size: 200%;
    min-width: 45px;
    color: #6c757d;
    border-radius: 50%;
}

.undoredo-img {
    width: 20px;
    height: 20px;
    display: block;
}

</style>

