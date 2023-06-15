
<template>
    <div :class="{largeConsoleDiv: isLargeConsole}">
        <div id="consoleControlsDiv">           
            <button @click="runCodeOnPyConsole" v-html="'▶ '+$t('console.run')"></button>
            <button @click="toggleConsoleDisplay">
                <i :class="{fas: true, 'fa-expand': !isLargeConsole, 'fa-compress': isLargeConsole}"></i>
                {{this.consoleDisplayCtrlLabel}}
            </button>
        </div>
        <textarea 
            id="pythonConsole"
            ref="pythonConsole"
            @focus="onFocus()"
            @change="onChange"
            @wheel.stop
            @keydown.self.stop="handleKeyEvent"
            @keyup.self="handleKeyEvent"
            disabled
            spellcheck="false"
        >    
        </textarea>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import { useStore } from "@/store/store";
import { storeCodeToDOM } from "@/autocompletion/acManager";
import Parser from "@/parser/parser";
import { runPythonConsole } from "@/helpers/runPythonConsole";
import { mapStores } from "pinia";
import { CustomEventTypes, getAppSimpleMsgDlgId, getFrameUIID, hasEditorCodeErrors } from "@/helpers/editor";
import i18n from "@/i18n";

export default Vue.extend({
    name: "PythonConsole",

    data: function() {
        return {
            isLargeConsole: false,
        };
    },

    computed:{
        ...mapStores(useStore),

        consoleDisplayCtrlLabel(): string {
            return " " + ((this.isLargeConsole) ? i18n.t("console.collapse") as string : i18n.t("console.expand") as string);           
        },
    },

    methods: {
        runCodeOnPyConsole() {
            // Before doing anything, we make sure there are no errors found in the code
            this.$nextTick(() => {
                // In case the error happens in the current frame (empty body) we have to give the UI time to update to be able to notify changes
                if(hasEditorCodeErrors()) {
                    this.appStore.simpleModalDlgMsg = this.$i18n.t("appMessage.preCompiledErrorNeedFix") as string;
                    this.$root.$emit("bv::show::modal", getAppSimpleMsgDlgId());
                    return;
                }

                const console = this.$refs.pythonConsole as HTMLTextAreaElement;
                console.value = "";
                const parser = new Parser();
                const userCode = parser.getFullCode();
                parser.getErrorsFormatted(userCode);
                storeCodeToDOM(userCode);
                // Trigger the actual console launch
                runPythonConsole(console, userCode, parser.getFramePositionMap());
                // Make sure there is no document selection for our editor
                this.appStore.setSlotTextCursors(undefined, undefined);
            });           
        },

        onFocus(): void {
            this.appStore.isEditing = false;
        },

        onChange(): void {
            const consoleTextarea = this.$refs.pythonConsole as HTMLTextAreaElement;
            consoleTextarea.scrollTop = consoleTextarea.scrollHeight;
        },

        handleKeyEvent(event: KeyboardEvent) {
            // Key events are captured by the UI to navigate the blue cursor and add frames -- for the console, we don't want to propagate the event
            // but we have to propagate at least for key up because otherwise we can't get the input validation of the console working well.
            if(event.type == "keyup" || event.type == "keydown"){
                this.appStore.ignoreKeyEvent = true;
            }
            if(event.key.toLowerCase() == "enter" && event.type == "keyup"){
                // With Safari, we don't get the focus back to the editor, so we need to explicitly give it to the right element.
                document.getElementById(getFrameUIID(this.appStore.currentFrame.id))?.focus(); 
            }
        },

        toggleConsoleDisplay(){
            this.isLargeConsole = !this.isLargeConsole;
            // Other parts of the UI need to be updated when the console default size is changed, so we emit an event
            document.dispatchEvent(new CustomEvent(CustomEventTypes.pythonConsoleDisplayChanged, {detail: this.isLargeConsole}));
        },
    },

});
</script>

<style lang="scss">
    .largeConsoleDiv {
        width: 100vw;
        top:50vh;
        bottom:0px;
        left:0px;
        position:fixed;
    }

    .largeConsoleDiv #pythonConsole {
        max-height: 50vh;
    }

    #consoleControlsDiv {
        display: flex;
        column-gap: 5px;
    }

    .show-error-icon {
        padding: 0px 2px; 
        border: 2px solid #d66;
    }
    
    textarea {
        -webkit-box-sizing: border-box; /* Safari/Chrome, other WebKit */
        -moz-box-sizing: border-box;    /* Firefox, other Gecko */
        box-sizing: border-box;         /* Opera/IE 8+ */
    }
    
    #pythonConsole {
        width:100%;
        min-height: 5vh;
        max-height: 30vh;
        font-size: 12px;
        background-color: #0a090c;
        color: white;
        flex-grow: 2;
        font-size: 17px;
    }

    #pythonConsole:disabled {
        -webkit-text-fill-color: #ffffff; // Required for Safari
        color: white;
    }
</style>
