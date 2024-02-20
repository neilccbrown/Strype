
<template>
    <div :class="{largeConsoleDiv: isLargeConsole}">
        <div id="consoleControlsDiv" :class="{'expanded-console': isLargeConsole}">           
            <button @click="runClicked" :title="$t('console.run') + ' (Ctrl+Enter)'">{{this.consoleRunLabel}}</button>
            <button @click="toggleConsoleDisplay">
                <i :class="{fas: true, 'fa-expand': !isLargeConsole, 'fa-compress': isLargeConsole}"></i>
                {{this.consoleDisplayCtrlLabel}}
            </button>
            <button @click="runCodeOnPyTurtleCanvas">test turtle</button>
        </div>
        <textarea 
            id="pythonConsole"
            ref="pythonConsole"
            v-if="!showTurtleCanvas"
            @focus="onFocus()"
            @change="onChange"
            @wheel.stop
            @keydown.self.stop="handleKeyEvent"
            @keyup.self="handleKeyEvent"
            disabled
            spellcheck="false"
        >    
        </textarea>
        <div v-if="showTurtleCanvas" id="pythonTurtleCanvas" ref="pythonTurtleCanvas"/>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import { useStore } from "@/store/store";
import Parser from "@/parser/parser";
import { runPythonConsole, runTurtleCanvas } from "@/helpers/runPythonConsole";
import { mapStores } from "pinia";
import { checkEditorCodeErrors, countEditorCodeErrors, CustomEventTypes, getAppSimpleMsgDlgId, getEditorCodeErrorsHTMLElements, getFrameUIID, getLabelSlotUIID, hasEditorCodeErrors, hasPrecompiledCodeError, isElementEditableLabelSlotInput, isElementUIIDFrameHeader, parseFrameHeaderUIID, parseLabelSlotUIID, setDocumentSelection } from "@/helpers/editor";
import i18n from "@/i18n";
import { SlotCoreInfos, SlotCursorInfos, SlotType } from "@/types/types";

enum RunningState {
    NotRunning,
    Running,
    RunningAwaitingStop,
}

export default Vue.extend({
    name: "PythonConsole",

    data: function() {
        return {
            isLargeConsole: false,
            runningState: RunningState.NotRunning,
            showTurtleCanvas: false,
        };
    },

    mounted(){
        // Observe when the console (textarea) positon changes: buttons need to be positioned accordingly
        // (note that we only do this for appearance reasons: before, the buttons were naturally positioned above the textarea, but that means that
        // if we want to show a scoll in the commands, there will be a gap between the commands and the textarea when the console is extended, the gap
        // being the space the button takes in a natural position. We cheat by stacking the buttons and the texarea and positioning the buttons manually)
        const pythonConsole = document.getElementById("pythonConsole");
        const consoleControlsDiv = document.getElementById("consoleControlsDiv");
        if(pythonConsole != undefined && consoleControlsDiv != undefined){
            const consolePosChangeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    if (entry.contentBoxSize) {
                        // Setting "bottom" doesn't seem to do the right thing, "top" works fine..
                        consoleControlsDiv.style.top = (this.isLargeConsole)
                            ? "5px"
                            : "auto";   
                    }
                }
            });
            consolePosChangeObserver.observe(pythonConsole);
        }
    },

    computed:{
        ...mapStores(useStore),

        consoleDisplayCtrlLabel(): string {
            return " " + ((this.isLargeConsole) ? i18n.t("console.collapse") as string : i18n.t("console.expand") as string);           
        },
        
        consoleRunLabel(): string {
            switch (this.runningState) {
            case RunningState.NotRunning:
                return "▶ " + i18n.t("console.run");
            case RunningState.Running:
                return "◼ " + i18n.t("console.stop");
            case RunningState.RunningAwaitingStop:
                return i18n.t("console.stopping") as string;
            }
            return "";
        },
    },

    methods: {
        runClicked() {
            switch (this.runningState) {
            case RunningState.NotRunning:
                this.runningState = RunningState.Running;
                this.runCodeOnPyConsole();
                return;
            case RunningState.Running:
                // Skulpt checks this property regularly while running, via a callback,
                // so just setting the variable is enough to "request" a stop 
                this.runningState = RunningState.RunningAwaitingStop;
                return;
            case RunningState.RunningAwaitingStop:
                // Nothing more we can do at the moment, just waiting for Skulpt to see it
                return;
            }
        },
        
        runCodeOnPyConsole() {
            const console = this.$refs.pythonConsole as HTMLTextAreaElement;
            console.value = "";
            // Make sure the text area is disabled when we run the code
            console.disabled = true;
            this.appStore.wasLastRuntimeErrorFrameId =  undefined;
            // Make sure there is no document selection for our editor
            this.appStore.setSlotTextCursors(undefined, undefined);
                
            // Before doing anything, we make sure there are no errors found in the code
            // We DELAY the action to make sure every other UI actions has been done, notably the error checking from LabelSlotsStructure.
            setTimeout(() => {
                // In case the error happens in the current frame (empty body) we have to give the UI time to update to be able to notify changes
                if(hasPrecompiledCodeError()) {
                    this.$nextTick().then(() => {
                        this.reachFirstError();                        
                    }); 
                    return;
                }

                const parser = new Parser();
                const userCode = parser.getFullCode();
                parser.getErrorsFormatted(userCode);
                // Trigger the actual console launch
                runPythonConsole(console, userCode, parser.getFramePositionMap(),() => this.runningState != RunningState.RunningAwaitingStop, () => this.runningState = RunningState.NotRunning);
                // We make sure the number of errors shown in the interface is in line with the current state of the code
                // As the UI should update first, we do it in the next tick
                this.$nextTick().then(() => {
                    checkEditorCodeErrors();
                    this.appStore.errorCount = countEditorCodeErrors();
                    // If there is an error, we reach it
                    if(this.appStore.errorCount > 0){
                        this.reachFirstError();
                    }
                }); 
            }, 1000);           
        },

        runCodeOnPyTurtleCanvas(){
            // Show the canvas
            this.showTurtleCanvas = true;

            this.$nextTick(() => {
                // In case the error happens in the current frame (empty body) we have to give the UI time to update to be able to notify changes
                if(hasEditorCodeErrors()) {
                    this.appStore.simpleModalDlgMsg = this.$i18n.t("appMessage.preCompiledErrorNeedFix") as string;
                    this.$root.$emit("bv::show::modal", getAppSimpleMsgDlgId());
                    return;
                }

                const parser = new Parser();
                const userCode = parser.getFullCode();
                runTurtleCanvas(this.$refs.pythonTurtleCanvas as HTMLDivElement, userCode);
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

        reachFirstError(): void {
            this.$nextTick(() => {
                // We should get only the run time error here, or at least 1 precompiled error
                // but for sanity check, we make sure it's still there
                const errors = getEditorCodeErrorsHTMLElements();
                if(errors && errors.length > 0){
                    const errorElement = errors[0];
                    // We focus on the slot of the error -- if the erroneous HTML is a slot, we just give it focus. If the error is at the frame scope
                    // we put the focus in the first slot that is editable.
                    const errorSlotInfos: SlotCoreInfos = (isElementEditableLabelSlotInput(errorElement))
                        ? parseLabelSlotUIID(errorElement.id)
                        : {frameId: parseFrameHeaderUIID(errorElement.id), labelSlotsIndex: 0, slotId: "0", slotType: SlotType.code};
                    const errorSlotCursorInfos: SlotCursorInfos = {slotInfos: errorSlotInfos, cursorPos: 0}; 
                    this.appStore.setSlotTextCursors(errorSlotCursorInfos, errorSlotCursorInfos);
                    setDocumentSelection(errorSlotCursorInfos, errorSlotCursorInfos);  
                    // It's necessary to programmatically click the slot we gave focus to, so we can toggle the edition mode event chain
                    if(isElementUIIDFrameHeader(errorElement.id)){
                        document.getElementById(getLabelSlotUIID(errorSlotInfos))?.click();
                    }
                    else{
                        errorElement.click();
                    }
                }
            });
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
        margin: 0px !important;
    }

    .largeConsoleDiv #pythonConsole {
        max-height: 45vh;
    }

    #consoleControlsDiv {
        display: flex;
        column-gap: 5px;        
        padding-top: 5px;
    }

    #consoleControlsDiv.expanded-console {
        position: absolute;
        padding-top: 0 !important;
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
        min-height: 15vh;
        max-height: 30vh;
        background-color: #0a090c;
        color: white;
        flex-grow: 2;
        font-size: 15px;
        tab-size: 8;
        font-family: monospace;
    }

    #pythonConsole:disabled {
        -webkit-text-fill-color: #ffffff; // Required for Safari
        color: white;
    }

    // Mac Safari: always show scrollbar (when content is large enough to require one), and make it light
    #pythonConsole::-webkit-scrollbar {
        width: 8px;
    }    
    #pythonConsole::-webkit-scrollbar-track {
        background: #0a090c;
    }
    #pythonConsole::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 5px;
    }

    #pythonTurtleCanvas {
        width:100%;
        min-height: 5vh;
        max-height: 30vh;
        background-color: white;
        flex-grow: 2;
    }
</style>
