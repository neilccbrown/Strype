
<template>
    <div :class="{largeConsoleDiv: isLargeConsole}" ref="peaComponent">
        <div id="consoleControlsDiv" :class="{'expanded-console': isLargeConsole}">           
            <b-tabs id="consoleDisplayTabs" v-model="consoleDisplayTabIndex" no-key-nav>
                <b-tab :title="'\u2771\u23BD '+$t('console.pythonConsole')" title-link-class="console-display-toggle" active></b-tab>
                <b-tab :title="'\uD83D\uDC22 '+$t('console.TurtleGraphics')" title-link-class="console-display-toggle"></b-tab>
            </b-tabs>
            <div class="flex-padding"/>
            <button @click="runClicked" :title="$t('console.run') + ' (Ctrl+Enter)'">{{this.consoleRunLabel}}</button>
        </div>
        <div id="tabContentContainerDiv">
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
            <div v-show="consoleDisplayTabIndex==1" id="pythonTurtleContainerDiv" @wheel.stop>
                <div><!-- this div is a flex wrapper just to get scrolling right, see https://stackoverflow.com/questions/49942002/flex-in-scrollable-div-wrong-height-->
                    <div id="pythonTurtleDiv" ref="pythonTurtleDiv"></div>
                </div>
            </div>
            <div @click="toggleConsoleSize" :class="{'console-display-size-button': true,'dark-mode': (consoleDisplayTabIndex==0)}">
                <span :class="{'fas': true, 'fa-expand': !isLargeConsole, 'fa-compress': isLargeConsole,'hidden': !isHovered}" :title="$t((isLargeConsole)?'console.collapse':'console.expand')"></span>
            </div>
            <span id="noTurtleSpan" v-if="consoleDisplayTabIndex==1 && !turtleGraphicsImported">{{$t('console.importTurtle')}}</span> 
        </div>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import { useStore } from "@/store/store";
import Parser from "@/parser/parser";
import { runPythonConsole } from "@/helpers/runPythonConsole";
import { mapStores } from "pinia";
import { checkEditorCodeErrors, countEditorCodeErrors, CustomEventTypes, getEditorCodeErrorsHTMLElements, getFrameUIID, getLabelSlotUIID, hasPrecompiledCodeError, isElementEditableLabelSlotInput, isElementUIIDFrameHeader, parseFrameHeaderUIID, parseLabelSlotUIID, setDocumentSelection, setPythonExecAreaExpandButtonPos, setPythonExecutionAreaTabsContentMaxHeight } from "@/helpers/editor";
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
            turtleGraphicsImported: false, // by default, Turtle isn't imported - this flag is updated when we detect the import (see event registration in mounted())
            consoleDisplayTabIndex: 0, // the index of the console display tabs (console/turtle), we use it equally as a flag to indicate if we are on Turtle
            interruptedTurtle: false,
            isHovered: false,
        };
    },

    mounted(){
        // Register an event listen on hover (in/out) to handle some styling
        (this.$refs.peaComponent as HTMLDivElement).addEventListener("mouseenter", () => this.isHovered = true);
        (this.$refs.peaComponent as HTMLDivElement).addEventListener("mouseleave", () => this.isHovered = false);

        const pythonConsole = document.getElementById("pythonConsole");
        const turtlePlaceholderDiv = document.getElementById("pythonTurtleDiv");
        const tabContentContainerDiv = document.getElementById("tabContentContainerDiv");
        if(pythonConsole != undefined && turtlePlaceholderDiv != undefined && tabContentContainerDiv != undefined){
            // Register an event listener on the textarea for the request focus event
            pythonConsole.addEventListener(CustomEventTypes.pythonConsoleRequestFocus, this.handleConsoleFocusRequest);

            // Register an event listener on the textarea for handling post-input
            pythonConsole.addEventListener(CustomEventTypes.pythonConsoleAfterInput, this.handlePostInputConsole);

            // Register an event listener on this component for the notification of the turtle library import usage
            document.getElementById("pythonConsole")?.addEventListener(CustomEventTypes.notifyTurtleUsage, (event) => {
                this.turtleGraphicsImported = (event as CustomEvent).detail;
                const pythonTurtleDiv = document.getElementById("pythonTurtleDiv");
                if(!this.turtleGraphicsImported && pythonTurtleDiv != undefined) {
                    // If we don't import turtle anymore, we "clear" any potential graphics to have the "import Turtle" message clearly showing.
                    document.querySelectorAll("#pythonTurtleDiv canvas").forEach((canvasEl) => pythonTurtleDiv.removeChild(canvasEl));                    
                }
            });    

            // Register a mutation observer on the Turtle div placeholder to know when canvases are added/removed,
            // so we can, in turn, set a resize observer on these canvases to compute how to scale them.
            // (Note: that is very important because every time the user code is run, Skulpt regenerates the canvases)
            const turtleDivPlaceholderObserver = new MutationObserver(() => {
                // We don't need to change the canvas size for EVERY canvases added by Skulpt, we only do it on the first one added.
                if(document.querySelectorAll("#pythonTurtleDiv canvas").length == 1){
                    this.scaleTurtleCanvas(tabContentContainerDiv, turtlePlaceholderDiv);
                }
            });
            turtleDivPlaceholderObserver.observe(turtlePlaceholderDiv, {childList: true});   
            
            // Register an observer when the tab content dimension changes: we need to reflect this on the canvas scaling (cf. above)
            // DO NOT use ResizeObserver to do so: it gets messy with the events loop ("ResizeObserver loop completed with undelivered notifications.")
            tabContentContainerDiv.addEventListener("pythonExecutionAreaResized", () => {
                // We should only scale the canvas if there is at lease a canvas to scale! (i.e. we show turtle graphics...)
                if (document.querySelectorAll("#pythonTurtleDiv canvas").length > 0) {
                    this.$nextTick(() =>this.scaleTurtleCanvas(tabContentContainerDiv, turtlePlaceholderDiv));
                }
            });
        }
    },

    computed:{
        ...mapStores(useStore),
        
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

    watch: {
        consoleDisplayTabIndex(){
            // When we change tab, we also check the position of the expand/collapse button
            setPythonExecAreaExpandButtonPos();
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
            setPythonExecAreaExpandButtonPos();
            
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
                runPythonConsole(pythonConsole, this.$refs.pythonTurtleDiv as HTMLDivElement, userCode, parser.getFramePositionMap(),() => this.runningState != RunningState.RunningAwaitingStop, () => {
                    this.runningState = RunningState.NotRunning;
                    setPythonExecAreaExpandButtonPos();
                });
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
            this.consoleDisplayTabIndex = 0;
        },

        handleConsoleFocusRequest(): void {
            // This method is responsible for handling when a focus on the console (textarea) is requrested programmatically
            // (typically when the Python input() function is encountered)
            
            //First we switch between Turtle and the console shall the Turtle be showing at the moment
            if(this.consoleDisplayTabIndex == 1){
                this.interruptedTurtle = true;
                this.consoleDisplayTabIndex = 0;
            }

            //In any case, then we focus the console (keep setTimeout rather than nextTick to have enough time to be effective)
            setTimeout(() => document.getElementById("pythonConsole")?.focus(), 200);
        },

        handlePostInputConsole(): void {
            // This method is responsible for handling what to do after the console input (Python) has been invoked.
            // If there was a Turtle being shown, we get back to it. If not, we just stay on the console.
            if(this.turtleGraphicsImported && this.interruptedTurtle){
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

            // As typing may result in the scrollbar appearing, we can check the position of the expand/collapse button here
            setPythonExecAreaExpandButtonPos();
        },

        toggleConsoleSize(){
            this.isLargeConsole = !this.isLargeConsole;
            // We handle the styling for the console tab sizing here.
            if(!this.isLargeConsole){
                // When the console is minimized, we remove any max height styling that had been added when enlarging the console: defined CSS will be used.
                (document.getElementById("tabContentContainerDiv") as HTMLDivElement).style.maxHeight = "";
            }
            else{
                // When the console is maximized, we set the max height via styling: this rules over CSS.
                setPythonExecutionAreaTabsContentMaxHeight();
            }
            document.getElementById("tabContentContainerDiv")?.dispatchEvent(new CustomEvent(CustomEventTypes.peaResized));

            setPythonExecAreaExpandButtonPos();
            
            // Other parts of the UI need to be updated when the console default size is changed, so we emit an event
            // (in case we rely on the current changes, we do it a bit later)
            this.$nextTick(() => document.dispatchEvent(new CustomEvent(CustomEventTypes.pythonConsoleDisplayChanged, {detail: this.isLargeConsole})));
        },

        scaleTurtleCanvas(tabContentContainerDiv: HTMLElement, turtlePlaceholderDiv: HTMLElement){
            // Resize and scale the console display accordingly to the Turtle canvas:
            // - scale the placeholder to fit the shortest dimension in the viewport (the tab) and preserve the canvas ratio
            // - set the placeholder container (the flex div) to the correct dimension to make sure the positioning (centered) is preserved
            //    and the scrolls are right -- SCALING WITH CSS DOES NOT MAKES THE DOM SEEING NEW DIMENSIONS
            const turtleCanvas = document.querySelector("#pythonTurtleDiv canvas") as HTMLCanvasElement;
            const canvasW = turtleCanvas.width;
            const canvasH = turtleCanvas.height;
            const isCanvasWShortest = (canvasW < canvasH);
                
            // The parent keeps a 5px margin around the turtle placeholder div, so we need to take it into account when computing the scaling.
            // Also, we check if a scrollbar would be generated to accomodate it
            const tabContentElementBoundingClientRect = tabContentContainerDiv.getBoundingClientRect();
            const {width: tabContentW, height: tabContentH} = tabContentElementBoundingClientRect;
            const preCheckTurtleCanvasScaleRatio = (isCanvasWShortest) ? ((tabContentW - 10.0) / canvasW) : ((tabContentH - 10.0) / canvasH);
            // To deal with scrollbars, first pass: we look if doing a simple ratio to fit the smallest dimension implies the largest to overflow
            const preCheckLargestSideScrollOffset = (isCanvasWShortest) 
                ? ((canvasH*preCheckTurtleCanvasScaleRatio > (tabContentH - 10)) ? 20 : 0)
                : ((canvasW*preCheckTurtleCanvasScaleRatio > (tabContentW - 10)) ? 20 : 0);
            // Second pass:we get the new scale ratio that would include the largest dimension's scroll bar, but as we scale both W and H, will the largest
            // dimension's scrollbar actually still be required? if so, we keep the new scale ratio, if not, we don't and will accept having 2 scrollbars
            // and the keep the preCheck scale ratio.
            const preCheck2TurtleCanvasScaleRatio = (isCanvasWShortest) ? ((tabContentW - 10.0 - preCheckLargestSideScrollOffset) / canvasW) : ((tabContentH - 10.0 - preCheckLargestSideScrollOffset) / canvasH);
            const preCheck2LargestSideScrollOffset = (isCanvasWShortest) 
                ? ((canvasH*preCheck2TurtleCanvasScaleRatio > (tabContentH - 10)) ? 20 : 0)
                : ((canvasW*preCheck2TurtleCanvasScaleRatio > (tabContentW - 10)) ? 20 : 0);
            const largestSideScrollOffset = (preCheckLargestSideScrollOffset > 0) 
                ? (preCheck2LargestSideScrollOffset > 0) ? 20 : 0 
                : 0;
            const turtleCanvasScaleRatio = (largestSideScrollOffset > 0) ? preCheck2TurtleCanvasScaleRatio : preCheckTurtleCanvasScaleRatio;
            (turtlePlaceholderDiv as HTMLDivElement).style.scale = ""+turtleCanvasScaleRatio;
   
            // We can now set the dimension of the flex div to fit to the scaled content new dimensions: 
            // the rule is: check what is each dimension of the scaled canvas and use the max between that scaled dimension and the tab content dimension
            // (to make sure we don't fit to a smaller size than the tab content itself!)
            (turtlePlaceholderDiv.parentElement as HTMLDivElement).style.width = Math.max((canvasW * turtleCanvasScaleRatio + 10), tabContentW - ((isCanvasWShortest) ? largestSideScrollOffset : 0)) +"px";
            (turtlePlaceholderDiv.parentElement as HTMLDivElement).style.height = Math.max((canvasH * turtleCanvasScaleRatio + 10), tabContentH - ((isCanvasWShortest) ? 0 : largestSideScrollOffset)) +"px";
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

    #consoleControlsDiv {
        display: flex;
        column-gap: 5px;        
        width:100%;
        background-color: rgb(240,240,240);
    }

    .flex-padding {
        flex-grow: 2;
    }

    #consoleControlsDiv.expanded-console {
        padding-top: 0 !important;
    }

    #consoleControlsDiv button {
        z-index: 10;
        border-radius: 10px;
        border: 1px solid transparent;
    }

    #consoleControlsDiv button:hover {
        border-color: lightgray !important;
    }

    .console-display-size-button {
        position: absolute;
        bottom: $strype-python-exec-area-expand-button-pos-offset;
        right: $strype-python-exec-area-expand-button-pos-offset;
        color: black;
        cursor: pointer;
        padding: 8px;
    }

    .console-display-size-button.dark-mode {        
        color: white !important;
    }

    .console-display-size-button:hover {        
        background: rgb(151, 151, 151) !important;
        border-radius: 50px;
    }

    .console-display-size-button.dark-mode:hover {        
        background: rgb(69, 68, 68) !important;
    }

    .console-display-size-button span{        
        display: block; // to ensure the containing div wraps the span tight
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
        background-color: lightgray !important;
    }

    #tabContentContainerDiv {
        flex-grow: 2;
        width: 100%;
        max-height: 30vh;
        position: relative;
    }

    textarea {
        -webkit-box-sizing: border-box; /* Safari/Chrome, other WebKit */
        -moz-box-sizing: border-box;    /* Firefox, other Gecko */
        box-sizing: border-box;         /* Opera/IE 8+ */
        resize: none !important;
    }
    
    #pythonConsole {
        width:100%;
        height: 100%;
        background-color: #0a090c;
        color: white;
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

    #pythonTurtleContainerDiv {
        width:100%;
        height: 100%;
        background-color: grey;
        overflow:auto;
    }

    #pythonTurtleContainerDiv > div {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    #pythonTurtleDiv {
        background-color: white;
        margin:5px;
    }
    
    #noTurtleSpan {
        position: absolute;
        top: 10px;
        left: 10px;
    }    
</style>
