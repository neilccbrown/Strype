<template>
    <div class="commands">
        <div class="project-name-container">
            <span class="project-name">{{projectName}}</span>
            <div v-if="isSyncingInGoogleDrive" :title="autoSaveGDriveTooltip">
                <img :src="require('@/assets/images/logoGDrive.png')" alt="Google Drive" class="gdrive-logo"/>   
                <span class="gdrive-sync-label" v-if="isSyncingInGoogleDrive && !isEditorContentModifiedFlag" v-t="'appMessage.autosaveGDrive'" />
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
        <python-console class="run-code-container"/>
        FITRUE_isPurePython */
        /* IFTRUE_isMicrobit      
        <div class="run-code-container">  
            <div v-if="showProgress" class="progress cmd-progress-container">
                <div 
                    class="progress-bar progress-bar-striped bg-info" 
                    role="progressbar"
                    :style="progressPercentWidthStyle" 
                    aria-valuenow="progressPercent"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    >
                    <span v-t="'action.uploadingToMicrobit'" class="progress-bar-text"></span>
                </div>
            </div>
            <div class="commands-container">
                <button type="button" @click="runToMicrobit" v-t="'buttonLabel.runOnMicrobit'" class="btn btn-secondary cmd-button"/>
            </div>
        </div>
        FITRUE_isMicrobit */
    </div>
</template>

<script lang="ts">
import AddFrameCommand from "@/components/AddFrameCommand.vue";
import { autoSaveFreqMins, CustomEventTypes, getCommandsContainerUIID, getCommandsRightPaneContainerId, getEditorMiddleUIID, getMenuLeftPaneUIID } from "@/helpers/editor";
import { useStore } from "@/store/store";
import { AddFrameCommandDef, AllFrameTypesIdentifier, CaretPosition, FrameObject, StrypeSyncTarget } from "@/types/types";
import $ from "jquery";
import Vue from "vue";
import browserDetect from "vue-browser-detect-plugin";
import { mapStores } from "pinia";
import { getFrameSectionIdFromFrameId } from "@/helpers/storeMethods";
/* IFTRUE_isPurePython */
import PythonConsole from "@/components/PythonConsole.vue";
import { isMacOSPlatform } from "@/helpers/common";
/* FITRUE_isPurePython */
/* IFTRUE_isMicrobit */
import APIDiscovery from "@/components/APIDiscovery.vue";
import { flash } from "@/helpers/webUSB";
import { downloadHex } from "@/helpers/download";
/* FITRUE_isMicrobit */

export default Vue.extend({
    name: "Commands",

    components: {
        AddFrameCommand,
        /* IFTRUE_isMicrobit */
        APIDiscovery,
        /* FITRUE_isMicrobit */
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

    /* IFTRUE_isMicrobit */
    beforeMount() {
        Vue.use(browserDetect);
        this.uploadThroughUSB = (this.$browserDetect.isChrome || this.$browserDetect.isOpera || this.$browserDetect.isEdge);
    },
    /* FITRUE_isMicrobit */

    computed: {
        ...mapStores(useStore),

        projectName(): string {
            // When the project is updated, we reflect this into the HTML meta-data.
            document.title = "Strype - " + this.appStore.projectName;
            return this.appStore.projectName;
        },

        isEditorContentModifiedFlag(): boolean {
            return (this.appStore.isEditorContentModified);
        },

        isSyncingInGoogleDrive(): boolean {
            return this.appStore.syncTarget == StrypeSyncTarget.gd;
        },

        autoSaveGDriveTooltip(): string{
            return this.$i18n.t("appMessage.autoSaveGDriveTooltip", {freq: autoSaveFreqMins}) as string;
        },
        
        /* IFTRUE_isMicrobit */
        tabIndex: {
            get(): number{
                return this.appStore.commandsTabIndex;
            },
            set(index: number){
                this.appStore.commandsTabIndex = index;
            },
        },
        /* FITRUE_isMicrobit */
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

                // If a modal is open, we let the event be handled by the browser
                if(this.appStore.isModalDlgShown){
                    return;
                }

                if((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y")) {
                    //undo-redo
                    this.appStore.undoRedo((event.key.toLowerCase() === "z"));
                    event.preventDefault();
                    return;
                }

                const isEditing = this.appStore.isEditing;

                //prevent default scrolling and navigation
                if (!isEditing && ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Tab", "Home", "End"].includes(event.key)) {
                    if(this.appStore.ignoreKeyEvent){
                        this.appStore.ignoreKeyEvent = false;
                        return;
                    }
                    
                    if (event.key === "ArrowDown" || event.key === "ArrowUp" ) {
                        if(event.shiftKey){
                            this.appStore.selectMultipleFrames(event.key);
                        }
                        else {
                            // The navigation is "level scope" when the ctrl key is pressed (alt key for macOS)
                            this.appStore.changeCaretPosition(event.key, ((event.ctrlKey && !isMacOSPlatform()) || (event.altKey && isMacOSPlatform())));
                        }
                    }
                    else if(event.key == "Home" || event.key == "End"){
                        // For the "home" and "end" key, we move the blue caret to the first or last position of the current main section the caret is in.
                        // This is overriding the natural browser behaviour that scrolls to the top or bottom of the page (at least with Chrome)
                        event.stopImmediatePropagation();
                        event.stopPropagation();
                        event.preventDefault();
                        // Look for the section we're in
                        const sectionId = getFrameSectionIdFromFrameId(this.appStore.currentFrame.id);
                        // Update the caret to the first/last position within this section
                        const isMovingHome = (event.key == "Home");
                        const isSectionEmpty = (this.appStore.frameObjects[sectionId].childrenIds.length == 0);
                        const newCaretId = (isMovingHome || isSectionEmpty) ? sectionId : this.appStore.frameObjects[sectionId].childrenIds.at(-1) as number;
                        const newCaretPosition = (isMovingHome || isSectionEmpty) ? CaretPosition.body : CaretPosition.below;
                        this.appStore.toggleCaret({id: newCaretId, caretPosition: newCaretPosition});
                    }    
                    else{
                        // At this stage, tab and left/right arrows are handled only if not editing: editing cases are directly handled by LabelSlotsStructure.
                        // We start by getting from the DOM all the available caret and editable slot positions
                        this.appStore.leftRightKey({ key: event.key, isShiftKeyHold: event.shiftKey});
                        event.stopImmediatePropagation();
                        event.preventDefault();
                    }
                    return;
                }

                //prevent default browser behaviours when an add frame command key is typed (letters and spaces) (e.g. Firefox "search while typing")
                if(!isEditing && !this.appStore.isAppMenuOpened && !(event.ctrlKey || event.metaKey) && (event.key.match(/^[a-z A-Z=]$/) || event.key === "Backspace")){
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

            // If a modal is open, we let the event be handled by the browser
            if(this.appStore.isModalDlgShown){
                return;
            }
        
            if(event.key == "Escape"){
                if(this.appStore.areAnyFramesSelected){
                    this.appStore.unselectAllFrames();
                    this.appStore.makeSelectedFramesVisible();
                }
            }
            else {
                if(!isEditing && !this.appStore.isAppMenuOpened){
                    // Cases when there is no editing:
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
                            if(!ignoreKeyEvent){
                                this.appStore.addFrameWithCommand(
                                    this.addFrameCommands[event.key.toLowerCase()][0].type
                                );
                            }
                            else{
                                this.appStore.ignoreKeyEvent = false;
                            }
                        }
                    }
                }
            }
        },
        
        handleAppScroll(event: WheelEvent) {
            const currentScroll = $("#"+getEditorMiddleUIID()).scrollTop();
            $("#"+getEditorMiddleUIID()).scrollTop((currentScroll??0) + (event as WheelEvent).deltaY/2);
        },

        /* IFTRUE_isMicrobit */
        runToMicrobit() {
            // If we can directly upload on microbit, we run the method flash().
            // If we cannot, we run downloadHex(), it already contains code to show a message to the user.
            if(this.uploadThroughUSB){
                flash(this.$data);
            }
            else{
                downloadHex(true);
            }
        },
        
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
.project-name-container {
    display: flex;
    align-items: center;
    justify-content: center;
}

.project-name {
    color: #274D19;
}

.gdrive-logo {
    width: 16px;
    height: 16px;
    margin-left: 5px;
    margin-right: 2px;
}

.gdrive-sync-label {
    color: #2e641b;
    font-size: 80%;
}

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
    width: 100%;
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

.commands-container {
    display: inline-block;
}

#keystrokeSpan {
    bottom:2px;
    left: 50%;
    transform: translate(-50%, 0);
    position: absolute;
    font-size:large;
    color:#666666;
}

.run-code-container {
    /* IFTRUE_isPurePython */
    margin-bottom: 4px;
    /* FITRUE_isPurePython */
    /* IFTRUE_isMicrobit */
    margin-bottom: 90px;
    /* FITRUE_isMicrobit */
    overflow: hidden; // that is used to keep the margin https://stackoverflow.com/questions/44165725/flexbox-preventing-margins-from-being-respected
    flex-grow: 3;
    display: flex;
    flex-direction: column;    
    align-items: flex-start;
    justify-content: flex-end;
}

.cmd-button {
    padding: 1px 6px 1px 6px !important;
    margin-top: 5px;
}

.list-enter-active, .list-leave-active {
  transition: all .5s;
}

.list-enter, .list-leave-to {
  opacity: 0;
  transform: translate3d(3);
}

.commands-tab {
    color: #787978 !important;
    border-color: #bbc8b6 !important;
    background-color: transparent !important;
    margin-top: 10px;
}

.commands-tab-active {
    color: #274D19 !important;
    border-bottom-color: #E2E7E0 !important;
}

.command-tab-content {
    margin-left: 5px;
}

//the following overrides the bootstrap tab generated styles
#commandsTabs ul {
    border-bottom-color: #bbc8b6 !important;
}

.nav-item{
    cursor: no-drop;
}
</style>
