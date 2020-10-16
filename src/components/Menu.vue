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
            <div 
                class="editableslot-placeholder"
                id="projectNameDiv"
                v-bind:value="projectName"
            />
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
        fileImagePath(): string {
            return require("@/assets/images/file.png");
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
            const confirmMsg = this.$i18n.t("appMessage.editorConfirmChangeCode");
            //note: the following conditional test is only for TS... the message should always be found
            if (confirm((typeof confirmMsg === "string") ? confirmMsg : "Current editor's content will be permanently lost.\nDo you want to continue?")) {
                (this.$refs.importFileInput as HTMLInputElement).click();    
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
            const placeholder = document.getElementById("projectNameDiv");
            let width = 100;
            const offset = 20;
            if (placeholder) {
                placeholder.textContent = this.projectName 
                //the width is computed from the placeholder's width from which
                //we add extra space for the cursor.
                const calculatedWidth = (placeholder.offsetWidth + offset)
                width = ( calculatedWidth < 250)?
                    ((calculatedWidth < width)? width : calculatedWidth ) :
                    250;
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
            // We are taking the focus away from the input. We are not calling 
            // input.blur() as this propagates and closes the whole menu.
            $("#menu").focus();
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

.editableslot-placeholder {
    position: absolute;
    display: inline-block;
    visibility: hidden;
}

</style>

