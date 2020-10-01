<template>
    <div>
        <vue-simple-context-menu
            :elementId="'editorFileContextMenu'"
            :options="editorFileMenuOption"
            :ref="'editorFileContextMenu'"
            @option-clicked="optionClicked"
        />
        <input 
            type="image" 
            :src="fileImagePath"
            class="file-menu-img"
            @click.prevent.stop="handleClick($event)"
            @contextmenu.prevent.stop="handleClick($event)"
            />
        <div>
            <input type="file" ref="importFileInput" @change="selectedFile" class="editor-file-input"> 
        </div>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import VueSimpleContextMenu, {VueSimpleContextMenuConstructor} from "vue-simple-context-menu";
import store from "@/store/store";
import {saveContentToFile, readFileContent} from "@/helpers/common";
import { AppEvent } from "@/types/types";

export default Vue.extend({
    name: "EditorFileManager",
    store,

    components: {
        VueSimpleContextMenu,
    },

    computed: {
        fileImagePath(): string {
            return require("@/assets/images/file.png");
        },
        editorFileMenuOption(): {}[] {
            return  [{name: "import", method: "importFile"}, {name: "export", method: "exportFile"}];
        },
    },

    methods: {
        handleClick (event: MouseEvent): void {
            ((this.$refs.editorFileContextMenu as unknown) as VueSimpleContextMenuConstructor).showMenu(event);
        },

        // Item is passed anyway in the event, in case the menu is attached to a list
        optionClicked (event: {item: any; option: {name: string; method: string}}): void {
            //call the appropriate method
            const thisCompProps = Object.entries(this).find((entry) => entry[0] === event.option.method);
            if(thisCompProps){
                thisCompProps[1]();
            }
        },

        importFile(): void {
            //users should be warned about current editor's content loss
            const confirmMsg = this.$i18n.t("appMessages.editorConfirmChangeCode");
            //note: the following conditional test is only for TS... the message should always be found
            if (confirm((typeof confirmMsg === "string") ? confirmMsg : "Current editor's content will be permanently lost.\nDo you want to continue?")) {
                (this.$refs.importFileInput as HTMLInputElement).click();    
            }            
        },
        
        selectedFile() {
            const files = (this.$refs.importFileInput as HTMLInputElement).files;
            if(files){
                const emitPayload: AppEvent = {requestAttention: true};
                emitPayload.message = this.$i18n.t("appMessages.editorFileUpload").toString();
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
                
                //reset the input file element value to empty (so further changes can be notified)
                (this.$refs.importFileInput as HTMLInputElement).value = "";
            }
        },

        exportFile(): void {
            //save the JSON file of the state 
            saveContentToFile(store.getters.getStateJSONStrWithCheckpoints(), "microbit_webframes_code.json");
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
</style>
