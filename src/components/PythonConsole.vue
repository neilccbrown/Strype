
<template>
    <div :class="{largeConsoleDiv: isLargeConsole}">
        <div id="consoleControlsDiv" :class="{'expanded-console': isLargeConsole}">           
            <button @click="runClicked" :title="$t('console.run') + ' (Ctrl+Enter)'">{{this.consoleRunLabel}}</button>
            <button @click="toggleConsoleSize">
                <i :class="{fas: true, 'fa-expand': !isLargeConsole, 'fa-compress': isLargeConsole}"></i>
                {{this.consoleDisplayCtrlLabel}}
            </button>
            <div class="flex-padding"/>
            <b-tabs v-show="includeTurtleGraphics" id="consoleDisplayTabs" v-model="consoleDisplayTabIndex" no-key-nav>
                <b-tab :title="'\u2771\u23BD'" title-link-class="console-display-toggle" active></b-tab>
                <b-tab :title="'\uD83D\uDC22'" title-link-class="console-display-toggle"></b-tab>
            </b-tabs>
        </div>
        <textarea 
            id="pythonConsole"
            ref="pythonConsole"
            v-show="consoleDisplayTabIndex==0"
            @focus="onFocus()"
            @change="onChange"
            @wheel.stop
            @keydown.self.stop="handleKeyEvent"
            @keyup.self="handleKeyEvent"
            disabled
            spellcheck="false"
        >    
        </textarea>
        <div v-if="includeTurtleGraphics" v-show="consoleDisplayTabIndex==1" id="pythonTurtleDiv" ref="pythonTurtleDiv"/>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import { useStore } from "@/store/store";
import Parser from "@/parser/parser";
import { runPythonConsole } from "@/helpers/runPythonConsole";
import { mapStores } from "pinia";
import { checkEditorCodeErrors, countEditorCodeErrors, CustomEventTypes, getEditorCodeErrorsHTMLElements, getFrameUIID, getLabelSlotUIID, hasPrecompiledCodeError, isElementEditableLabelSlotInput, isElementUIIDFrameHeader, parseFrameHeaderUIID, parseLabelSlotUIID, setDocumentSelection } from "@/helpers/editor";
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
            includeTurtleGraphics: false, // by default, Turtle isn't visible - it will be activated when we detect the import (see event registration in mounted())
            consoleDisplayTabIndex: 0, // the index of the console display tabs (console/turtle), we use it equally as a flag to indicate if we are on Turtle
            interruptedTurtle: false,
        };
    },

    mounted(){
        const pythonConsole = document.getElementById("pythonConsole");
        if(pythonConsole != undefined){
            // Register an event listener on the textarea for the request focus event
            pythonConsole.addEventListener(CustomEventTypes.pythonConsoleRequestFocus, this.handleConsoleFocusRequest);
            // Register an event listener on the textarea for handling post-input
            pythonConsole.addEventListener(CustomEventTypes.pythonConsoleAfterInput, this.handlePostInputConsole);
            // Register an event listener on this component for the notification of the turtle library import usage
            document.getElementById("pythonConsole")?.addEventListener(CustomEventTypes.notifyTurtleUsage, (event) => {
                this.includeTurtleGraphics = (event as CustomEvent).detail;
                const pythonTurtleDiv = document.getElementById("pythonTurtleDiv");
                if(!this.includeTurtleGraphics && pythonTurtleDiv != undefined) {
                    // If we don't show turtle anymore, we should make sure we get back on the console and stop observing changes...
                    this.consoleDisplayTabIndex = 0;
                }
            });    
        }
    },

    updated(){
        // When the component is updated, we add tooltips to the console display tabs (console/Turtle) programmatically.
        // We cannot define them directly in the template because the tabs are generated with Bootstrap, and "title" is used by Bootstrap
        // as an attribute to show the tab's text. But as we know the tabs are rendered as li elements, we can just add the attribute there.
        // (We do this in the updated hook for 2 reasons: first because Bootstrap won't generate the DOM right in when the component is mounted,
        // but mainly because we need to be able to have the right translation if the app locale is changed.)
        document.querySelectorAll("#consoleDisplayTabs li")
            .forEach((listEl, index) => listEl.setAttribute("title", (index == 0) ? i18n.t("console.show") as string : i18n.t("console.TurtleGraphics") as string));
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
            default: return "";
            }
        },
    },

    methods: {
        runClicked() {
            // The console execution has a 3-ways states:
            // - not running when nothing happens, click will trigger "running"
            // - running when some code is running, click will trigger "running awaiting stop"
            // - running awaiting stop will do nothing
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
                // Else, nothing more we can do at the moment, just waiting for Skulpt to see it
                return;
            }
        },
        
        runCodeOnPyConsole() {
            const pythonConsole = this.$refs.pythonConsole as HTMLTextAreaElement;
            pythonConsole.value = "";
            // Make sure the text area is disabled when we run the code
            pythonConsole.disabled = true;
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
                        // If we have an error, the code didn't actually run so we need to reflect this properly in the running state
                        this.runningState = RunningState.NotRunning;            
                    }); 
                    return;
                }

                const parser = new Parser();
                const userCode = parser.getFullCode();
                parser.getErrorsFormatted(userCode);
                // Trigger the actual console launch
                runPythonConsole(pythonConsole, this.$refs.pythonTurtleDiv as HTMLDivElement, userCode, parser.getFramePositionMap(),() => this.runningState != RunningState.RunningAwaitingStop, () => this.runningState = RunningState.NotRunning);
                // We make sure the number of errors shown in the interface is in line with the current state of the code
                // As the UI should update first, we do it in the next tick
                this.$nextTick().then(() => {
                    checkEditorCodeErrors();
                    this.appStore.errorCount = countEditorCodeErrors();
                    // If there is an error, we reach it and, if Turtle is active, we make sure we show the Python console
                    if(this.appStore.errorCount > 0){
                        this.reachFirstError();
                        this.consoleDisplayTabIndex = 0;
                    }
                }); 
            }, 1000);           
        },

        onFocus(): void {
            this.appStore.isEditing = false;
            if(this.includeTurtleGraphics){
                this.consoleDisplayTabIndex = 0;
            }
        },

        handleConsoleFocusRequest(): void {
            // This method is responsible for handling when a focus on the console (textarea) is requrested programmatically
            // (typically when the Python input() function is encountered)
            
            //First we switch between Turtle and the console shall the Turtle be showing at the moment
            if(this.includeTurtleGraphics && this.consoleDisplayTabIndex == 1){
                this.interruptedTurtle = true;
                this.consoleDisplayTabIndex = 0;
            }

            //In any case, then we focus the console (keep setTimeout rather than nextTick to have enough time to be effective)
            setTimeout(() => document.getElementById("pythonConsole")?.focus(), 200);
        },

        handlePostInputConsole(): void {
            // This method is responsible for handling what to do after the console input (Python) has been invoked.
            // If there was a Turtle being shown, we get back to it. If not, we just stay on the console.
            if(this.includeTurtleGraphics && this.interruptedTurtle){
                this.interruptedTurtle = false;
                this.consoleDisplayTabIndex = 1;
            }
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

        toggleConsoleSize(){
            this.isLargeConsole = !this.isLargeConsole;
            // Other parts of the UI need to be updated when the console default size is changed, so we emit an event
            // (in case we rely on the current changes, we do it a bit later)
            this.$nextTick(() => document.dispatchEvent(new CustomEvent(CustomEventTypes.pythonConsoleDisplayChanged, {detail: this.isLargeConsole})));
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

    .largeConsoleDiv #pythonConsole,
    .largeConsoleDiv #pythonTurtleDiv {
        max-height: none;
    }

    #consoleControlsDiv {
        display: flex;
        column-gap: 5px;        
        padding-top: 5px;
        width:100%;
    }

    .flex-padding {
        flex-grow: 2;
    }

    #consoleControlsDiv.expanded-console {
        padding-top: 0 !important;
    }

    #consoleControlsDiv button {
        z-index: 10;
    }

    .show-error-icon {
        padding: 0px 2px; 
        border: 2px solid #d66;
    }

    .python-display-switch {
        display: flex;
    }

    .console-display-toggle {
        color: black;
    }

    .console-display-toggle:hover {
        color: black;
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

    #pythonTurtleDiv {
        width:100%;
        min-height: 15vh;
        max-height: 30vh;
        background-color: white;
        flex-grow: 2;
    }
</style>
