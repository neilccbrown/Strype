<template>
    <div class="commands">
        <div :id="buttonsContainerUIID" class="commands-container">
            /* IFTRUE_isMicrobit 
            <button type="button" v-if="uploadThroughUSB" @click="flash" v-t="'buttonLabel.uploadToMicrobit'" class="btn btn-secondary cmd-button-margin cmd-button"/>
            <button type="button" @click="downloadHex" v-t="(uploadThroughUSB)?'buttonLabel.downloadHex':'buttonLabel.sendToMicrobit'" class="btn btn-secondary cmd-button-margin cmd-button"/>
            FITRUE_isMicrobit */
            <button type="button" @click="downloadPython" v-t="'buttonLabel.downloadPython'" class="btn btn-secondary cmd-button"/>
            <GoogleDrive/>
        </div>
        <div v-if="showProgress" class="progress cmd-progress-container">
            <div 
                class="progress-bar progress-bar-striped bg-info" 
                role="progressbar"
                :style="progressPercentWidthStyle" 
                :aria-valuenow="progressPercent"
                aria-valuemin="0"
                aria-valuemax="100"
                >
                <span v-t="'action.uploadingToMicrobit'" class="progress-bar-text"></span>
            </div>
        </div>
        <div @mousedown.prevent.stop @mouseup.prevent.stop>
            /* IFTRUE_isMicrobit
            <b-tabs id="commandsTabs" content-class="mt-2" v-model="tabIndex">
                <b-tab :title="$t('commandTabs.0')" active :title-link-class="getTabClasses(0)" :disabled="isEditing">
            FITRUE_isMicrobit */
                    <div :id="commandsContainerUUID" class="command-tab-content" >
                        <div id="addFramePanel">
                            <div class="frameCommands">
                                <transition-group name="list" tag="p">
                                    <AddFrameCommand
                                        v-for="addFrameCommand in addFrameCommands"
                                        :key="addFrameCommand[0].type.type"
                                        :type="addFrameCommand[0].type.type"
                                        :shortcut="addFrameCommand[0].shortcut"
                                        :symbol="
                                            addFrameCommand[0].symbol !== undefined
                                                ? addFrameCommand[0].symbol
                                                : addFrameCommand[0].shortcut
                                        "
                                        :description="addFrameCommand[0].description"
                                        :tooltip="addFrameCommand[0].tooltip"
                                        :index="
                                            addFrameCommand[0].index!==undefined
                                            ? addFrameCommand[0].index
                                            : 0
                                        "
                                    />
                                </transition-group>
                            </div>
                        </div>
                    </div>
                /* IFTRUE_isMicrobit 
                </b-tab>
                    <b-tab :title="$t('commandTabs.1')" :title-link-class="getTabClasses(1)">
                        <APIDiscovery  class="command-tab-content"/>
                    </b-tab>
                FITRUE_isMicrobit */
            </b-tabs>
        </div>
        <text id="userCode"></text>
        <span id="keystrokeSpan"></span>

        /* IFTRUE_isPurePython
        <python-console id="pythonConsoleComponent"/>
        FITRUE_isPurePython */
    </div>
</template>

<script lang="ts">
import AddFrameCommand from "@/components/AddFrameCommand.vue";
import APIDiscovery from "@/components/APIDiscovery.vue";
import GoogleDrive from "@/components/GoogleDrive.vue";
import { downloadHex, downloadPython } from "@/helpers/download";
import { CustomEventTypes, getCommandsContainerUIID, getCommandsRightPaneContainerId, getEditorButtonsContainerUIID, getEditorMiddleUIID, getMenuLeftPaneUIID } from "@/helpers/editor";
import { flash } from "@/helpers/webUSB";
import { useStore } from "@/store/store";
import { AddFrameCommandDef, AllFrameTypesIdentifier, CaretPosition, FrameObject } from "@/types/types";
import $ from "jquery";
import Vue from "vue";
import browserDetect from "vue-browser-detect-plugin";
import { mapStores } from "pinia";
/* IFTRUE_isPurePython */
import PythonConsole from "@/components/PythonConsole.vue";
/* FITRUE_isPurePython */

export default Vue.extend({
    name: "Commands",

    components: {
        AddFrameCommand,
        APIDiscovery,
        GoogleDrive,
        /* IFTRUE_isPurePython */
        PythonConsole, 
        /* FITRUE_isPurePython */
    },

    data: function () {
        return {
            showProgress: false,
            progressPercent: 0,
            uploadThroughUSB: false,
            frameCommandsReactiveFlag: false, // this flag is only use to allow a reactive binding when the add frame commands are updated (language)
        };
    },

    beforeMount() {
        Vue.use(browserDetect);
        this.uploadThroughUSB = (this.$browserDetect.isChrome || this.$browserDetect.isOpera || this.$browserDetect.isEdge);
    },

    computed: {
        ...mapStores(useStore),
        
        tabIndex: {
            get(): number{
                return this.appStore.commandsTabIndex;
            },
            set(index: number){
                this.appStore.commandsTabIndex = index;
            },
        },

        buttonsContainerUIID(): string {
            return getEditorButtonsContainerUIID();
        },

        commandsContainerUUID(): string {
            return getCommandsContainerUIID();
        },

        isEditing(): boolean {
            return this.appStore.isEditing;
        },

        addFrameCommands(): Record<string, AddFrameCommandDef[]> {
            // Just use the flag data to bind this computed property to the flag, so that when the frame commands are changed, we can update the UI
            this.frameCommandsReactiveFlag;

            //We retrieve the add frame commands associated with the current frame 
            //if the frame is enabled, we always check, if it is disabled we return no frame when caret is body, and check when caret is below
            const currentFrame: FrameObject = this.appStore.getCurrentFrameObject;
            if(currentFrame.isDisabled && ((currentFrame.caretVisibility === CaretPosition.body) ? true : !this.appStore.canAddFrameBelowDisabled(currentFrame.id))){
                return {};
            }
            
            return this.appStore.generateAvailableFrameCommands(this.appStore.currentFrame.id, this.appStore.currentFrame.caretPosition);
        },

        progressPercentWidthStyle(): string {
            return "width: " + this.progressPercent + "%;";
        },
    },

    created() {
        if(this.appStore.showKeystroke){
            window.addEventListener(
                "dblclick",
                () => {
                    (document.getElementById("keystrokeSpan") as HTMLSpanElement).textContent = "[double click]";
                    //leave the message for a short moment only
                    setTimeout(()=> (document.getElementById("keystrokeSpan") as HTMLSpanElement).textContent = "", 1000);    
                }
            );
            
            window.addEventListener(
                "mousedown",
                (event: MouseEvent) => {
                    let mouseButton = "unknown mouse click";
                    switch(event.button){
                    case 0:
                        mouseButton = "left click";
                        break;
                    case 1:
                        mouseButton = "middle click";
                        break;
                    case 2:
                        mouseButton = "right click";
                        break;
                    }
                    (document.getElementById("keystrokeSpan") as HTMLSpanElement).textContent = "["+mouseButton+"]";
                    //leave the message for a short moment only
                    setTimeout(()=> (document.getElementById("keystrokeSpan") as HTMLSpanElement).textContent = "", 1000);    
                }
            );
        }

        window.addEventListener(
            "keydown",
            (event: KeyboardEvent) => {
                //if we requested to log keystroke, display the keystroke event in an unobtrusive location
                //when editing, we don't show the keystroke for basic keys (like [a-zA-Z0-1]), only those whose key value is longer than 1
                if(this.appStore.showKeystroke && (!this.appStore.isEditing || event.key.match(/^.{2,}$/))){
                    (document.getElementById("keystrokeSpan") as HTMLSpanElement).textContent = "["+event.key+"]";
                    //leave the message for a short moment only
                    setTimeout(()=> (document.getElementById("keystrokeSpan") as HTMLSpanElement).textContent = "", 1000);         
                }

                if((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y")) {
                    //undo-redo
                    this.appStore.undoRedo((event.key.toLowerCase() === "z"));
                    event.preventDefault();
                    return;
                }

                const isEditing = this.appStore.isEditing;

                //prevent default scrolling and navigation
                if (!isEditing && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "ArrowLeft" || event.key === "ArrowRight")) {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp" ) {
                        //first we remove the focus of the current active element (to avoid editable slots to keep it)
                        (document.activeElement as HTMLElement).blur();

                        if(event.shiftKey){
                            this.appStore.selectMultipleFrames(event.key);
                        }
                        else {
                            this.appStore.changeCaretPosition(event.key);
                        }
                    }
                    else{
                        //at this stage, left/right arrows are handled only if not editing: editing cases are directly handled by EditableSlots.
                        // We start by getting from the DOM all the available caret and editable slot positions
                        this.appStore.leftRightKey({ key:event.key });
                        event.stopImmediatePropagation();
                        event.preventDefault();
                    }
                    return;
                }

                //prevent default browser behaviours when an add frame command key is typed (letters and spaces) (e.g. Firefox "search while typing")
                if(!isEditing && !(event.ctrlKey || event.metaKey) && (event.key.match(/^[a-z A-Z=]$/) || event.key === "Backspace")){
                    event.preventDefault();
                    return;
                }

                //prevent specific characters in specific frames (cf details)
                if(isEditing){
                    const frameType = this.appStore.getCurrentFrameObject.frameType.type;
                    //space in import frame's editable slots
                    if((frameType === AllFrameTypesIdentifier.import || frameType === AllFrameTypesIdentifier.fromimport) && event.key === " "){
                        event.preventDefault();
                        return;
                    }
                }
            }
        );

        window.addEventListener("keyup", this.onKeyUp);
        
        document.addEventListener(CustomEventTypes.editorAddFrameCommandsUpdated, () => {
            // When the frame commands have been updated (i.e. language changed), we need to get this component to be re-rendered:
            // we use this reactive flag to trigger the recomputation of the computed property addFrameCommands
            this.frameCommandsReactiveFlag = !this.frameCommandsReactiveFlag;
        });
    },
    
    beforeDestroy() {
        window.removeEventListener("keyup", this.onKeyUp);
    },

    mounted() {
        //scroll events on the left pane (menu) and right pane (commands) are forwarded to the editor
        document.getElementById(getMenuLeftPaneUIID())?.addEventListener(
            "wheel",
            this.handleAppScroll,
            false
        );

        document.getElementById(getCommandsRightPaneContainerId())?.addEventListener(
            "wheel",
            this.handleAppScroll,
            false
        );
    },

    methods: {
        onKeyUp(event: KeyboardEvent) {
            const isEditing = this.appStore.isEditing;
            const ignoreKeyEvent = this.appStore.ignoreKeyEvent;
        
            if(event.key == "Escape"){
                if(this.appStore.areAnyFramesSelected){
                    this.appStore.unselectAllFrames();
                    this.appStore.makeSelectedFramesVisible();
                }
                if(isEditing){
                    (document.activeElement as HTMLElement).blur();
                    this.appStore.isEditing = false;
                }
            }
            else {
                if(!isEditing){
                    //cases when there is no editing:
                    if(!(event.ctrlKey || event.metaKey)){
                        if(event.key == "Delete" || event.key == "Backspace"){
                            if(!ignoreKeyEvent){
                                //delete a frame or a frame selection
                                this.appStore.deleteFrames(event.key);
                                event.stopImmediatePropagation();
                            }
                            else{
                                this.appStore.ignoreKeyEvent = false;
                            }
                        }
                        //add the frame in the editor if allowed
                        else if(this.addFrameCommands[event.key.toLowerCase()] !== undefined){
                            this.appStore.addFrameWithCommand(
                                this.addFrameCommands[event.key.toLowerCase()][0].type
                            );
                        }
                    }
                }
            }
        },
        
        handleAppScroll(event: WheelEvent) {
            const currentScroll = $("#"+getEditorMiddleUIID()).scrollTop();
            $("#"+getEditorMiddleUIID()).scrollTop((currentScroll??0) + (event as WheelEvent).deltaY/2);
        },

        flash() {
            flash(this.$data);
        },

        downloadHex() {
            downloadHex();
        },

        downloadPython() {
            downloadPython(); 
        },
        /* IFTRUE_isMicrobit */
        getTabClasses(tabIndex: number): string[] {
            const disabledClassStr = (this.isEditing) ? " commands-tab-disabled" : "";
            if(tabIndex == this.tabIndex){
                return ["commands-tab commands-tab-active"];
            }
            else {
                return ["commands-tab" + disabledClassStr];
            }
        },
        /*FITRUE_isMicrobit */
    },
});
</script>

<style lang="scss">
.commands {
    border-left: #383b40 1px solid;
    color: #252323;
    background-color: #E2E7E0;
    display: flex;
    flex-direction: column;
    height: 100vh;
}

.cmd-progress-container {
    margin-top: 5px;
    background-color: #E2E7E0 !important;
    border: 1px lightgrey solid;
}

@mixin centerer {
  position: absolute;
  left: 50%;
  transform: translate(-50%, -50%);
}

.progress-bar-text {
    @include centerer;
    color:#fefefe !important;
    text-align: left !important;
    font-weight: bold;
}

.commands-container{
    display: inline-block;
}

#keystrokeSpan{
    bottom:2px;
    left: 50%;
    transform: translate(-50%, 0);
    position: absolute;
    font-size:large;
    color:#666666;
}
/* IFTRUE_isPurePython */
#pythonConsoleComponent{
    margin-bottom:4px;
    overflow: hidden; // that is used to keep the margin https://stackoverflow.com/questions/44165725/flexbox-preventing-margins-from-being-respected
    flex-grow: 3;
    display: flex;
    flex-direction: column;    
    align-items: flex-start;
    justify-content: flex-end;
}        
/* FITRUE_isPurePython */

.cmd-button{
    padding: 1px 6px 1px 6px !important;
    margin-top: 5px;
}

.cmd-button-margin{
    margin-right: 5px;
}

.list-enter-active, .list-leave-active {
  transition: all .5s;
}

.list-enter, .list-leave-to {
  opacity: 0;
  transform: translate3d(3);
}

.commands-tab{
    color: #787978 !important;
    border-color: #bbc8b6 !important;
    background-color: transparent !important;
    margin-top: 10px;
}

.commands-tab-active{
    color: #274D19 !important;
    border-bottom-color: #E2E7E0 !important;
}

.command-tab-content {
    margin-left: 5px;
}

//the following overrides the bootstrap tab generated styles
#commandsTabs ul{
    border-bottom-color: #bbc8b6 !important;
}

.nav-item{
    cursor: no-drop;
}
</style>
