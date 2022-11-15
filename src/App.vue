<template>
    <div id="app" class="container-fluid">
        <vue-confirm-dialog />
        <div v-if="showAppProgress" class="app-progress-pane">
            <div class="app-progress-container">
                <div class="progress">
                    <div 
                        class="progress-bar progress-bar-striped bg-info progress-bar-animated" 
                        role="progressbar"
                        style="width: 100%"
                        aria-valuenow="100"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        >
                        <span class="progress-bar-text">{{progressbarMessage}}</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="row">
            <div id="editor" class="col-8">
                <div class="top">
                    <MessageBanner 
                        v-if="showMessage"
                    />
                </div>
                <div class="row no-gutters" >
                    <Menu 
                        :id="menuUIID" 
                        @app-showprogress="applyShowAppProgress"
                        @app-reset-project="resetStrypeProject"
                        class="noselect"
                    />
                    <div class="col">
                        <div 
                            :id="editorUIID" 
                            :class="{'editor-code-div noselect':true, 'small-editor-code-div': isLargePythonConsole}" 
                            @click.self="onEditorClick"
                        >
                            <!-- cf. draggableGroup property for details, delay is used to avoid showing a drag -->
                            <Draggable
                                :list="[1,2]"
                                :move="onMoveFrameContainer"
                                :group="draggableGroup"
                                key="draggable-shadow-editor"
                                forceFallback="true"
                                delay="5000"
                            >
                                <FrameContainer
                                    v-for="container in containerFrames"
                                    :key="container.frameType.type + '-id:' + container.id"
                                    :id="getFrameContainerUIID(container.id)"
                                    :frameId="container.id"
                                    :containerLabel="container.frameType.labels[0].label"
                                    :caretVisibility="container.caretVisibility"
                                    :frameType="container.frameType"
                                />
                            </Draggable>
                        </div>
                    </div>
                </div>
            </div>
            <Commands :id="commandsContainerId" class="col-4 noselect" />
        </div>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import MessageBanner from "@/components/MessageBanner.vue";
import FrameContainer from "@/components/FrameContainer.vue";
import Commands from "@/components/Commands.vue";
import Menu from "@/components/Menu.vue";
import { useStore } from "@/store/store";
import { AppEvent, CaretPosition, DraggableGroupTypes, FrameObject, MessageTypes } from "@/types/types";
import { getFrameContainerUIID, getMenuLeftPaneUIID, getEditorMiddleUIID, getCommandsRightPaneContainerId, isElementEditableSlotInput, getFrameContextMenuUIID, CustomEventTypes, handleDraggingCursor, getFrameUIID } from "./helpers/editor";
import { getAPIItemTextualDescriptions } from "./helpers/microbitAPIDiscovery";
import { DAPWrapper } from "./helpers/partial-flashing";
import { mapStores } from "pinia";
import Draggable from "vuedraggable";
import scssVars  from "@/assets/style/exports.scss";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "App",
    
    components: {
        MessageBanner,
        FrameContainer,
        Commands,
        Menu,
        Draggable,
    },

    data: function() {
        return {
            newFrameType: "",
            currentParentId: 0,
            showAppProgress: false,
            progressbarMessage: "",
            autoSaveTimerId: -1,
            resetStrypeProjectFlag:false,
            isLargePythonConsole: false,
            autoSaveState: () => {},
        };
    },

    computed: {       
        ...mapStores(useStore),
             
        // gets the container frames objects which are in the root
        containerFrames(): FrameObject[] {
            return this.appStore.getFramesForParentId(0);
        },

        showMessage(): boolean {
            return this.appStore.isMessageBannerOn;
        },

        menuUIID(): string {
            return getMenuLeftPaneUIID();
        },

        editorUIID(): string {
            return getEditorMiddleUIID();
        },

        commandsContainerId(): string {
            return getCommandsRightPaneContainerId();
        },

        localStorageAutosaveKey(): string {
            let storageString = "PythonStrypeSavedState";
            /* IFTRUE_isMicrobit */
            storageString = "MicrobitStrypeSavedState";
            /*FITRUE_isMicrobit */
            return storageString;
        },

        draggableGroup(): Record<string, any> {
            // This is a showed draggable to allow management of the cursor (cf. handleDraggingCursor() for details)
            // Note: the component use a dummy list to not interfer with anything of the UI beyond just the ghost
            // image of the dragged frame container (it will never be dropped anywhere).
            return {
                name: DraggableGroupTypes.shadowEditorContainer,
                pull: false,
                put: function() {
                    // Handle the drag cursor
                    handleDraggingCursor(true, false);
                    return false;
                },
            };
        },
    },

    created() {
        this.autoSaveState = () => this.autoSaveStateToStore();
        window.addEventListener("beforeunload", (event) => {
            // Browsers won't display a customised message, and can detect when to prompt the user,
            // so we don't need to do anything special.
            event.returnValue = true;

            // Save the state before exiting
            if(!this.resetStrypeProjectFlag){
                this.autoSaveState();
            }
            else {
                // if the user cancels the reload, and that the reset was request, we need to restore the autosave process:
                // to make sure this doesn't happen right when the user validates the reload, we do it later: if the user had
                // cancelled the reload, the timeout will occur, and if the page has been reload, it won't (most likely)
                setTimeout(() =>  {
                    this.resetStrypeProjectFlag = true;
                    this.setAutoSaveState();
                }, 10000);
                
            }
        });

        // By means of protection against browser crashes or anything that could prevent auto-backup, we do a backup every 5 minutes
        this.setAutoSaveState();

        // Prevent the native context menu to be shown at some places we don't want it to be shown (basically everywhere but editable slots)
        window.addEventListener(
            "contextmenu",
            (event: MouseEvent) => {
                if(!isElementEditableSlotInput(event.target)){
                    event.stopImmediatePropagation();
                    event.preventDefault();
                }
                else{
                    const currentCustomMenuId: string = this.appStore.contextMenuShownId;
                    if(currentCustomMenuId.length > 0){
                        const customMenu = document.getElementById(getFrameContextMenuUIID(currentCustomMenuId));
                        customMenu?.setAttribute("hidden", "true");
                    }
                }
            }
        );

        /* IFTRUE_isPurePython */
        // Listen to the Python console display change events (as the editor needs to be resized too)
        document.addEventListener(CustomEventTypes.pythonConsoleDisplayChanged, (event) => {
            this.isLargePythonConsole = (event as CustomEvent).detail;
        });
        /* IFTRUE_isPurePython */

        /* IFTRUE_isMicrobit */
        // Register an event for WebUSB to detect when the micro:bit has been disconnected. We only do that once, and if WebUSB is available...
        if (navigator.usb) {
            navigator.usb.addEventListener("disconnect", () => this.appStore.previousDAPWrapper = {} as DAPWrapper);
        }
        
        // As the application starts up, we compile the microbit library with the appropriate language setting.
        getAPIItemTextualDescriptions(true);
        /* FITRUE_isMicrobit */
    },

    mounted() {
        // Check the local storage (WebStorage) to see if there is a saved project from the previous time the user entered the system
        // if browser supports localstorage
        if (typeof(Storage) !== "undefined") {
            const savedState = localStorage.getItem(this.localStorageAutosaveKey);
            if(savedState) {
                this.appStore.setStateFromJSONStr( 
                    {
                        stateJSONStr: savedState,
                        showMessage: false,
                        readCompressed: true,
                    }
                );
            }
        }
    },

    methods: {
        setAutoSaveState() {
            this.autoSaveTimerId = window.setInterval(() => {
                this.autoSaveState();
            }, 300000);
        },
        
        autoSaveStateToStore() : void {
            // save the project to the localStorage (WebStorage)
            if (!this.appStore.debugging && typeof(Storage) !== "undefined") {
                localStorage.setItem(this.localStorageAutosaveKey, this.appStore.generateStateJSONStrWithCheckpoint(true));
            }
        },

        applyShowAppProgress(event: AppEvent) {
            // If the progress bar is shown, we block the width of the application to the viewport
            // and revert it otherwise
            this.showAppProgress = event.requestAttention;
            if(event.requestAttention) {
                this.progressbarMessage = event.message ?? "";   
            }
            const heightVal = (this.showAppProgress) ? " 100vh": "100%";
            const overflowVal = (this.showAppProgress) ? "hidden" : "auto";
            (document.getElementsByTagName("html")[0] as HTMLHtmlElement).style.height = heightVal;
            (document.getElementsByTagName("body")[0] as HTMLBodyElement).style.height = heightVal;
            (document.getElementById("app") as HTMLDivElement).style.height = heightVal;
            (document.getElementById("app") as HTMLDivElement).style.overflow = overflowVal;
        },

        resetStrypeProject(){
            // To reset the project we:
            // 1) stop the autosave timer
            window.clearInterval(this.autoSaveTimerId);
            // 2) toggle the flag to disable saving on unload
            this.resetStrypeProjectFlag = true;
            // 3) delete the WebStorage key that refers to the current autosaved project
            if (typeof(Storage) !== "undefined") {
                localStorage.removeItem(this.localStorageAutosaveKey);
            }
            // finally, reload the page to reload the Strype default project
            window.location.reload();
        },

        getFrameContainerUIID(frameId: number){
            return getFrameContainerUIID(frameId);
        },

        toggleEdition(): void {
            this.appStore.isEditing = false;
        },

        messageTop(): boolean {
            return this.appStore.currentMessage.type !== MessageTypes.imageDisplay;
        },

        onMoveFrameContainer() {
            // We need that to avoid the frame containers to be even temporary swapping
            return false;
        },

        onEditorClick(event: MouseEvent) {
            // In most cases, we don't need to do anything about a click in the editor.
            // However, there is a small particular case that we should consider: 
            // if we click on the very bottom of the last frame of a frame container,
            // because the caret will hide on mousedown event for drag and drop management,
            // it might be seen as the browser as a click in the editor instead. Therefore, 
            // we check if we clicked near the end of a container that contains frames and 
            // if we did, we select the last frame of this container instead.
            if(document.getElementsByClassName("caret").length > 0){
                // Retrieve the size of the caret (https://dev.to/pecus/how-to-share-sass-variables-with-javascript-code-in-vuejs-55p3)
                const caretHeight = parseInt((scssVars.caretHeight as string).replace("px",""));
                const containersFrameIds = [this.appStore.getImportsFrameContainerId, this.appStore.getFuncDefsFrameContainerId, this.appStore.getMainCodeFrameContainerId];
                containersFrameIds.forEach((containerFrameId) => {
                    // If the container has no children we skip
                    if(this.appStore.frameObjects[containerFrameId].childrenIds.length > 0){
                        // Get the last child frame ID
                        const lastFrameId = [...this.appStore.frameObjects[containerFrameId].childrenIds].pop();
                        if(lastFrameId){
                            // Will be there... but keeping TS happy
                            // We retrieve the rect of the HTML element for that frame and check if the click is within 
                            // the band below that frame of the height of a caret
                            const frameDivRect = document.getElementById(getFrameUIID(lastFrameId))?.getBoundingClientRect();
                            if(frameDivRect && event.x >= frameDivRect.left && event.x <= frameDivRect.right
                                && event.y >= frameDivRect.bottom && event.y <= (frameDivRect.bottom + caretHeight)){
                                this.appStore.toggleCaret({id: lastFrameId, caretPosition: CaretPosition.below});
                            }
                        }
                    }
                });
            }
        },
    },
});
</script>

<style lang="scss">

html,body {
    margin: 0px;
    height: 100vh;
    background-color: #bbc6b6 !important;
}

.app-progress-pane {
    width: 100%;
    height: 100vh;
    background-color: rgba($color: gray, $alpha: 0.7);
    position: absolute;
    left: 0px;
    z-index: 5000;
}

.app-progress-container {
    position:relative;
    top: 50vh;
    padding-left: 10%;
    padding-right:10%;
 }

#app {
    font-family: 'Source Sans Pro', sans-serif;
    font-size: 17px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    color: #2c3e50;
    box-sizing: border-box;
    height: 100vh;
    max-height: 100vh;
    overflow:hidden;
}

#editor {
    height: 100vh;
    max-height: 100vh;
}

.editor-code-div {
    overflow-y: auto;
    height: 100vh;
    max-height: 100vh;
}

.small-editor-code-div {
    max-height: 50vh;
}

.top {
    text-align: center;
    margin-left:10px;
}

.noselect {
  -webkit-touch-callout: none; /* iOS Safari */
    -webkit-user-select: none; /* Safari */
     -khtml-user-select: none; /* Konqueror HTML */
       -moz-user-select: none; /* Old versions of Firefox */
        -ms-user-select: none; /* Internet Explorer/Edge */
            user-select: none; /* Non-prefixed version, currently
                                  supported by Chrome, Edge, Opera and Firefox */
}

.nohover{
    pointer-events: none;
}
</style>
