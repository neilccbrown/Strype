<template>
    <div id="app" class="container-fluid">
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
            <Splitpanes class="strype-split-theme">
                <Pane key="1" size="66" min-size="33">
                    <!-- These data items are to enable testing: -->
                    <div id="editor" :data-slot-focus-id="slotFocusId" :data-slot-cursor="slotCursorPos">
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
                                            :ref="getFrameContainerUIID(container.id)"
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
                </Pane>
                <Pane key="2" size="34">
                    <Commands :id="commandsContainerId" class="noselect" />
                </Pane>
            </SplitPanes>
        </div>
        <SimpleMsgModalDlg :dlgId="simpleMsgModalDlgId"/>
        <ModalDlg :dlgId="importDiffVersionModalDlgId" :useYesNo="true">
            <span v-t="'appMessage.editorFileUploadWrongVersion'" />                
        </ModalDlg>
        <div :id="getSkulptBackendTurtleDivId" class="hidden"></div>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import MessageBanner from "@/components/MessageBanner.vue";
import FrameContainer from "@/components/FrameContainer.vue";
import Frame from "@/components/Frame.vue";
import FrameBody from "@/components/FrameBody.vue";
import JointFrames from "@/components/JointFrames.vue";
import Commands from "@/components/Commands.vue";
import Menu from "@/components/Menu.vue";
import ModalDlg from "@/components/ModalDlg.vue";
import SimpleMsgModalDlg from "@/components/SimpleMsgModalDlg.vue";
import {Splitpanes, Pane} from "splitpanes";
import { useStore } from "@/store/store";
import { AppEvent, AutoSaveFunction, BaseSlot, CaretPosition, DraggableGroupTypes, FrameObject, MessageTypes, Position, SaveRequestReason, SlotCursorInfos, SlotsStructure, SlotType, StringSlot } from "@/types/types";
import { getFrameContainerUIID, getMenuLeftPaneUIID, getEditorMiddleUIID, getCommandsRightPaneContainerId, isElementLabelSlotInput, CustomEventTypes, handleDraggingCursor, getFrameUIID, parseLabelSlotUIID, getLabelSlotUIID, getFrameLabelSlotsStructureUIID, getSelectionCursorsComparisonValue, setDocumentSelection, getSameLevelAncestorIndex, autoSaveFreqMins, getImportDiffVersionModalDlgId, getAppSimpleMsgDlgId, getFrameContextMenuUIID, getFrameBodyRef, getJointFramesRef, getCaretContainerRef, getActiveContextMenu, checkIsTurtleImported } from "./helpers/editor";
/* IFTRUE_isMicrobit */
import { getAPIItemTextualDescriptions } from "./helpers/microbitAPIDiscovery";
import { DAPWrapper } from "./helpers/partial-flashing";
/* FITRUE_isMicrobit */
import { mapStores } from "pinia";
import Draggable from "vuedraggable";
import scssVars  from "@/assets/style/_export.module.scss";
import { getFrameContainer, getSlotIdFromParentIdAndIndexSplit, getSlotParentIdAndIndexSplit, retrieveParentSlotFromSlotInfos, retrieveSlotFromSlotInfos } from "./helpers/storeMethods";
import { cloneDeep } from "lodash";
import CaretContainer from "./components/CaretContainer.vue";
import { VueContextConstructor } from "vue-context";
import { BACKEND_SKULPT_DIV_ID } from "./autocompletion/ac-skulpt";

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
        ModalDlg,
        SimpleMsgModalDlg,
        Splitpanes,
        Pane,
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
            autoSaveState: [] as AutoSaveFunction[],
        };
    },

    computed: {       
        ...mapStores(useStore),
             
        // gets the container frames objects which are in the root
        containerFrames(): FrameObject[] {
            return this.appStore.getFramesForParentId(0);
        },

        slotFocusId() : string {
            const slotCoreInfos = useStore().focusSlotCursorInfos?.slotInfos;
            return slotCoreInfos ? getLabelSlotUIID(slotCoreInfos) : "";
        },
        
        slotCursorPos() : number {
            return useStore().focusSlotCursorInfos?.cursorPos ?? -1;
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

        simpleMsgModalDlgId(): string{
            return getAppSimpleMsgDlgId();
        },

        importDiffVersionModalDlgId(): string {
            return getImportDiffVersionModalDlgId();
        },

        getSkulptBackendTurtleDivId(): string {
            return BACKEND_SKULPT_DIV_ID;
        },
    },

    created() {
        this.autoSaveState[0] = {name: "WS", function: (reason: SaveRequestReason) => this.autoSaveStateToWebLocalStorage(reason)};
        window.addEventListener("beforeunload", (event) => {
            // No matter the choice the user will make on saving the page, and because it is not straight forward to know what action has been done,
            // we systematically exit any slot being edited to have a state showing the blue caret.
            // We do so by simulating a key down event (which exits the current slot)
            const focusCursorInfos = useStore().focusSlotCursorInfos;
            if(useStore().isEditing && focusCursorInfos){
                useStore().ignoreFocusRequest = false;
                document.getElementById(getFrameLabelSlotsStructureUIID(focusCursorInfos.slotInfos.frameId, focusCursorInfos.slotInfos.labelSlotsIndex))?.dispatchEvent(
                    new KeyboardEvent("keydown", {
                        key: "ArrowDown",
                    })
                );
            }

            // Browsers won't display a customised message, and can detect when to prompt the user,
            // so we don't need to do anything special.
            event.returnValue = true;

            // Save the state before exiting
            if(!this.resetStrypeProjectFlag){
                this.autoSaveState.forEach((asf) => asf.function(SaveRequestReason.unloadPage));
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

        // By means of protection against browser crashes or anything that could prevent auto-backup, we do a backup every 2 minutes
        this.setAutoSaveState();

        // Prevent the native context menu to be shown at some places we don't want it to be shown (basically everywhere but editable slots)
        // We can't know if that is called because of a click or because of the keyboard shortcut - and it's important to know because we need to process
        // things differently based on one or the other. That's why we have a flag on the keyboard shortcut (in keydown even registration) to make the distinction.
        window.addEventListener(
            "contextmenu", (event) => this.handleContextMenu(event)
        );

        window.addEventListener("keydown", (event: KeyboardEvent) => {
            if(this.appStore.selectedFrames.length > 0 && (event.key == " " || event.key.toLowerCase() == "enter")){
                // Wait a bit to process keys before showing the context menu
                setTimeout(() => {
                    this.appStore.isContextMenuKeyboardShortcutUsed = true;
                    this.handleContextMenu(new MouseEvent(""));
                }, 200);
            }
            
            // We need to register if the keyboard shortcut has been used to get the context menu
            // so we set the flag here. It will be reset when the context menu actions are consumed.
            if(event.key.toLowerCase() == "contextmenu"){
                this.appStore.isContextMenuKeyboardShortcutUsed  = true;
            }
        });

        /* IFTRUE_isPurePython */
        // Listen to the Python console display change events (as the editor needs to be resized too)
        document.addEventListener(CustomEventTypes.pythonConsoleDisplayChanged, (event) => {
            this.isLargePythonConsole = (event as CustomEvent).detail;
        });
        /* FITRUE_isPurePython */

        /* IFTRUE_isMicrobit */
        // Register an event for WebUSB to detect when the micro:bit has been disconnected. We only do that once, and if WebUSB is available...
        if (navigator.usb) {
            navigator.usb.addEventListener("disconnect", () => this.appStore.previousDAPWrapper = {} as DAPWrapper);
        }
        
        // As the application starts up, we compile the microbit library with the appropriate language setting.
        getAPIItemTextualDescriptions(true);
        /* FITRUE_isMicrobit */

        // Add an event listener for text selection changes. It will be used for changes of text selection and text cursors (start/end).
        document.addEventListener("selectionchange", this.handleDocumentSelectionChange);

        // Add en event listener for the mouse up events, it will be used for detecting the end of a drag in the context of slots/text selection.
        document.addEventListener("mouseup", this.checkMouseSelection);

        // Add a listener for the mouse scroll events. We do not want to allow scrolling when the context menu is shown
        document.addEventListener("wheel", this.blockScrollOnContextMenu, {passive:false});
    },

    destroyed() {
        // Removes the listeners
        document.removeEventListener("selectionchange", this.handleDocumentSelectionChange);
        document.removeEventListener("mouseup", this.checkMouseSelection);
        document.removeEventListener("wheel", this.blockScrollOnContextMenu);

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
                        callBack: () => {},
                        showMessage: false,
                        readCompressed: true,
                    }
                );
            }
        }

        // Register a listener to handle the context menu hovers (cf onContextMenuHover())
        this.$root.$on(CustomEventTypes.contextMenuHovered, (menuElement: HTMLElement) => this.onContextMenuHover(menuElement));

        // Register a listener for a request to close a caret context menu (used by Frame.vue)
        this.$root.$on(CustomEventTypes.requestCaretContextMenuClose, () => {
            // We find the CaretContainer component currently active to properly close the menu using the component close() method.
            const currentFrameComponent = this.getFrameComponent(this.appStore.currentFrame.id);
            if(currentFrameComponent){
                const currentCaretContainerComponent = this.getCaretContainerComponent(currentFrameComponent);
                ((currentCaretContainerComponent.$refs.menu as unknown) as VueContextConstructor).close();
            }
        });

        this.$root.$on(CustomEventTypes.addFunctionToEditorAutoSave, (asf: AutoSaveFunction) => {
            // Before adding a new function to execute in the autosave mechanism, we stop the current time, and will restart it again once the function is added.
            // That is because, if the new function is added just before the next tick of the timer is due, we don't want to excecuted actions just yet to give
            // time to the user to sign in to Google Drive first, then load a potential project without saving the project that is in the editor in between.
            window.clearInterval(this.autoSaveTimerId);
            const asfEntry = this.autoSaveState.find((asfEntry) => (asfEntry.name == asf.name));
            if(asfEntry){
                // There is already some function set for that type of autosave, we just update the function
                asfEntry.function = asf.function;
            }
            else{
                // Nothing yet set for this type of autosave, we add the entry this.autoSaveState
                this.autoSaveState.push(asf);
            }
            this.setAutoSaveState();
        });

        this.$root.$on(CustomEventTypes.removeFunctionToEditorAutoSave, (asfName: string) => {           
            const toDeleteIndex = this.autoSaveState.findIndex((asf) => asf.name == asfName);
            if(toDeleteIndex > -1){
                window.clearInterval(this.autoSaveTimerId);
                this.autoSaveState.splice(toDeleteIndex, 1);
                this.setAutoSaveState();
            }            
        });

        // Listen to event for requesting the autosave now
        this.$root.$on(CustomEventTypes.requestEditorAutoSaveNow, (saveReason: SaveRequestReason) => this.autoSaveState.forEach((asf) => asf.function(saveReason)));

        // This case may not happen, but if we had a Strype version that contains a default initial state working with Turtle,
        // the UI should reflect it (showing the Turtle tab) so we look for Turtle in any case.
        checkIsTurtleImported();
    },

    methods: {
        setAutoSaveState() {
            this.autoSaveTimerId = window.setInterval(() => {
                this.autoSaveState.forEach((asf) => asf.function(SaveRequestReason.autosave));
            }, autoSaveFreqMins * 60000);
        },
        
        autoSaveStateToWebLocalStorage(reason: SaveRequestReason) : void {
            // save the project to the localStorage (WebStorage)
            if (!this.appStore.debugging && typeof(Storage) !== "undefined") {
                localStorage.setItem(this.localStorageAutosaveKey, this.appStore.generateStateJSONStrWithCheckpoint(true));
                // If that's the only element of the auto save functions, then we can notify we're done when we save for loading
                if(reason==SaveRequestReason.loadProject && this.autoSaveState.length == 1){
                    this.$root.$emit(CustomEventTypes.saveStrypeProjectDoneForLoad);
                }
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

        handleDocumentSelectionChange(){
            // When the selection has changed, we update the cursor infos in the store.
            const docSelection = document.getSelection();
            if(docSelection){
                let anchorSpanElement = docSelection?.anchorNode?.parentElement;
                let focusSpanElement =  docSelection?.focusNode?.parentElement;
                // When the editable slots are empty, the span doesn't get the focus, but the container div does.
                // So we need to retrieve the right HTML component by hand.      
                // (usually, the first level div container gets the selection, but with FF, the second level container can also get it)     
                if(anchorSpanElement?.tagName.toLowerCase() == "div"){
                    if(anchorSpanElement.className.match(/(^| )labelSlot-container($| )/) != null){
                        // The most common case
                        anchorSpanElement = anchorSpanElement.firstElementChild as HTMLSpanElement;
                    }
                    else if(anchorSpanElement.firstElementChild?.className.match(/(^| )labelSlot-container($| )/) != null){
                        // The odd case in FF
                        anchorSpanElement = anchorSpanElement.firstElementChild.firstElementChild as HTMLSpanElement;
                    }
                }
                if(focusSpanElement?.tagName.toLowerCase() == "div"){
                    if(focusSpanElement.className.match(/(^| )labelSlot-container($| )/) != null){
                        // The most common case
                        focusSpanElement = focusSpanElement.firstElementChild as HTMLSpanElement;
                    }
                    else if(focusSpanElement.firstElementChild?.className.match(/(^| )labelSlot-container($| )/) != null){
                        // The odd case in FF
                        focusSpanElement = focusSpanElement.firstElementChild.firstElementChild as HTMLSpanElement;
                    }
                }
                if(anchorSpanElement && focusSpanElement && isElementLabelSlotInput(anchorSpanElement) && isElementLabelSlotInput(focusSpanElement)){
                    const anchorSlotInfo = parseLabelSlotUIID(anchorSpanElement.id);
                    const focusSlotInfo = parseLabelSlotUIID(focusSpanElement.id);
                    this.appStore.setSlotTextCursors({slotInfos: anchorSlotInfo, cursorPos: docSelection.anchorOffset},
                        {slotInfos: focusSlotInfo, cursorPos: docSelection.focusOffset});
                }
            }
        },

        handleContextMenu(event: MouseEvent) {
            // This method can be called either when the mouse has been right-clicked (context menu) or a keyboard shortcut for context menu has been hit
            if(this.appStore.isContextMenuKeyboardShortcutUsed){                    
                // Handle the context menu triggered by the keyboard here.
                // 3 cases should be considered 
                //  1) we are editing (so in a slot: we do nothing special, because we want to show the native context menu),
                //  2) we are not editing and there is a frame selection: get the frames context menu opened for that selection
                //  3) we are not editing and there is no frame selection: get the caret context menu opened for that position (i.e. paste...)
                if(!this.appStore.isEditing) {
                    // We wait for the next tick even to show the menu, because the flag about the key need to be reset
                    // in the call of this handleClick() (for frames context menu)
                    const areFramesSelected = (this.appStore.selectedFrames.length > 0);
                    this.$nextTick(() => {
                        // Prepare positioning stuff before showing the menu; then use the position informations to call the handleClick method
                        const menuPosition = this.ensureFrameKBShortcutContextMenu(areFramesSelected);
                        // We retrieve the element on which we need to call the menu: the first frame of the selection if some frames are selected,
                        // the current blue caret otherwise
                        const frameComponent = this.getFrameComponent((areFramesSelected) ? this.appStore.selectedFrames[0] : this.appStore.currentFrame.id);
                        if(frameComponent) {
                            if(areFramesSelected){
                                (frameComponent as InstanceType<typeof Frame>).handleClick(event, menuPosition);
                            }
                            else{
                                // When there is no selection, the menu to open is for the current caret, which can either be inside a frame's body or under a frame
                                const caretContainerComponent = this.getCaretContainerComponent(frameComponent);
                                caretContainerComponent.handleClick(event, menuPosition);
                            }
                        }
                    });  
                    // Prevent the default browser's handling of a context menu here
                    event.stopImmediatePropagation();
                    event.preventDefault();
                }
                this.appStore.isContextMenuKeyboardShortcutUsed = false;
            }
            else{
                // Handling the context menu triggered by a click here.
                if(!isElementLabelSlotInput(event.target)){
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
        },

        checkMouseSelection(){
            // Contrary to the keyboard selection, we do not have a very easy way to control the mouse selection,
            // and the browser's handling selection may end up with a wrong selection in the sense of our slot structure.
            // (However it will not exceed the scope of the frame label slots struct the selection is currently in.)
            // When the mouse button is released we check that we have a mutli slot selectiond that it is coherent, if not we updated it.
            // Note that calling this on dragend event won't work, I think because the event is captured by the frame drag and drop already
            this.$nextTick(() => {
                const anchorSlotCursorInfos = this.appStore.anchorSlotCursorInfos;
                const focusSlotCursorInfos = this.appStore.focusSlotCursorInfos;
                if(anchorSlotCursorInfos && focusSlotCursorInfos){
                    const anchorParentSlotId = getSlotParentIdAndIndexSplit(anchorSlotCursorInfos.slotInfos.slotId).parentId;
                    const focusParentSlotId = getSlotParentIdAndIndexSplit(focusSlotCursorInfos.slotInfos.slotId).parentId;
                    // If one of the anchor/focus is a string and the other isn't the same string (case A),or the anchor and focus are not in the same level (tree-wise) (case B)
                    // then we need to amend the selection
                    const anchorLevel =  (anchorSlotCursorInfos?.slotInfos.slotId.split(",").length)??0;
                    const focusLevel = (focusSlotCursorInfos?.slotInfos.slotId.split(",").length)??0;
                    const sameLevelDiffParents = (focusLevel == anchorLevel && anchorParentSlotId != focusParentSlotId);
                    const hasStringSelected = (focusSlotCursorInfos.slotInfos.slotType == SlotType.string || anchorSlotCursorInfos.slotInfos.slotType == SlotType.string);
                    const isSelectionNotAllowed = (focusLevel != anchorLevel) || sameLevelDiffParents
                        || (hasStringSelected && focusSlotCursorInfos.slotInfos.slotId != anchorSlotCursorInfos.slotInfos.slotId);
                    let amendedSelectionFocusCursorSlotInfos = cloneDeep(anchorSlotCursorInfos) as SlotCursorInfos;
                    if(isSelectionNotAllowed) {
                        const forwardSelection = ((getSelectionCursorsComparisonValue() as number) < 0);
                        // Case A: problem with string selection :
                        // if the anchor is a string we reach the beginning or the end of that string depending on the selection direction
                        // if the anchor is not a string then we stop just before or after the target string depending on the selection direction
                        //     and the validity of where we would "land" --> cf case B
                        if(hasStringSelected && anchorSlotCursorInfos.slotInfos.slotType == SlotType.string){
                            const anchorSlot = (retrieveSlotFromSlotInfos(anchorSlotCursorInfos.slotInfos) as StringSlot);
                            amendedSelectionFocusCursorSlotInfos.cursorPos = (forwardSelection) ? anchorSlot.code.length : 0;
                        }
                        else{
                            // Case B: different levels of slots or destination is a string
                            if ((focusLevel < anchorLevel) || sameLevelDiffParents) {
                                // Case B.1: if we go from a deeper level to an outer level, then we stop at the last [resp. first] sibling of the anchor level when selection forwards [resp. backwards]
                                const anchorParentSlot = retrieveParentSlotFromSlotInfos(anchorSlotCursorInfos.slotInfos) as SlotsStructure;
                                const siblingSlotId = getSlotIdFromParentIdAndIndexSplit(anchorParentSlotId,  (forwardSelection) ? anchorParentSlot.fields.length - 1 : 0);
                                amendedSelectionFocusCursorSlotInfos.slotInfos.slotId = siblingSlotId;
                                const siblingSlot = retrieveSlotFromSlotInfos(amendedSelectionFocusCursorSlotInfos.slotInfos);
                                amendedSelectionFocusCursorSlotInfos.cursorPos = (forwardSelection) ? (siblingSlot as BaseSlot).code.length : 0;
                            }
                            else{
                                // case B.2: if we go from an outer level to a deeper level, then need to find where is the focus "ancestor" in same level of the anchor, and stop before [resp. after] if going forwards [resp. backwards]
                                const ancestorIndex = getSameLevelAncestorIndex(focusSlotCursorInfos.slotInfos.slotId, anchorParentSlotId);
                                const closestAncestorNeighbourSlotId = getSlotIdFromParentIdAndIndexSplit(anchorParentSlotId,  (forwardSelection) ? ancestorIndex - 1 : ancestorIndex + 1);
                                const closestAncestorNeighbourSlot = retrieveSlotFromSlotInfos({...amendedSelectionFocusCursorSlotInfos.slotInfos, slotId: closestAncestorNeighbourSlotId}) as BaseSlot;
                                amendedSelectionFocusCursorSlotInfos.slotInfos.slotId = closestAncestorNeighbourSlotId;
                                amendedSelectionFocusCursorSlotInfos.cursorPos = (forwardSelection) ? closestAncestorNeighbourSlot.code.length : 0;
                            } 
                        }
                    }

                    // Update the selection now 
                    const focusCursorInfoToUse = (isSelectionNotAllowed) ? amendedSelectionFocusCursorSlotInfos : focusSlotCursorInfos;
                    this.appStore.setSlotTextCursors(anchorSlotCursorInfos, focusCursorInfoToUse);
                    setDocumentSelection(anchorSlotCursorInfos, focusCursorInfoToUse);
                    // Explicitly set the focused property to the focused slot
                    this.appStore.setFocusEditableSlot({frameSlotInfos: focusCursorInfoToUse.slotInfos, 
                        caretPosition: (this.appStore.frameObjects[focusCursorInfoToUse.slotInfos.frameId].frameType.allowChildren) ? CaretPosition.body : CaretPosition.below});
                }
            });     
        },

        getFrameComponent(frameId: number, innerLookDetails?: {frameParentComponent: InstanceType<typeof Frame> | InstanceType<typeof FrameContainer> | InstanceType<typeof FrameBody> | InstanceType<typeof JointFrames>, listOfFrameIdToCheck: number[]}): InstanceType<typeof Frame> | InstanceType<typeof FrameContainer> | undefined {
            // This methods gets the (Vue) reference of a frame based on its ID, or undefined if we could not find it.
            // The logic to retrieve the reference relies on the implementation of the editor, as we look in 
            // the frame containers which are supposed to hold the frames, and within frame body/joint when a frame can have children/joint frames.
            // If no root is provided, we assume we search the frame eference everywhere in the editor, meaning we look into the frame containers of App (this)
            // IMPORTANT NOTE: we are getting arrays of refs here when retrieving the refs, because the referenced elements are within a v-for
            // https://laracasts.com/discuss/channels/vue/ref-is-an-array 
            let result = undefined;
            if(innerLookDetails){                
                for(const childFrameId of innerLookDetails.listOfFrameIdToCheck){
                    const childFrameComponent = ((innerLookDetails.frameParentComponent.$refs[getFrameUIID(childFrameId)] as (Vue|Element)[])[0] as InstanceType<typeof Frame>);
                    if(childFrameId == frameId){
                        // Found the frame directly inside this list of frames
                        result =  childFrameComponent;
                        break;
                    }
                    else if(this.appStore.frameObjects[childFrameId].childrenIds.length > 0 || this.appStore.frameObjects[childFrameId].jointFrameIds.length > 0){
                        // That frame isn't the one we want, but maybe it contains the one we want so we look into it.
                        // We first look into the children, the joint frames (which may have children as well)
                        const frameBodyComponent = (childFrameComponent.$refs[getFrameBodyRef()] as InstanceType<typeof FrameBody>); // There is 1 body in a frame, no v-for is used, we have 1 element
                        result = this.getFrameComponent(frameId, {frameParentComponent: frameBodyComponent, listOfFrameIdToCheck: this.appStore.frameObjects[childFrameId].childrenIds});

                        if(!result){
                            // Check joints if we didn't find anything in the children
                            const jointFramesComponent = (childFrameComponent.$refs[getJointFramesRef()] as InstanceType<typeof FrameBody>); // There is 1 joint frames strcut in a frame, no v-for is used, we have 1 element
                            result = this.getFrameComponent(frameId, {frameParentComponent: jointFramesComponent, listOfFrameIdToCheck: this.appStore.frameObjects[childFrameId].jointFrameIds});
                        }
                    }
                }
            }
            else{
                // When we look for the frame from the whole editor, we need to find in wich frame container that frame lives.
                // We don't need to parse recursively for getting the refs/frames as we can just find out what frame container it is in first directly...
                // And if we are already in the container (body), then we just return this component 
                const frameContainerId = (frameId < 0) ? frameId : getFrameContainer(frameId); 
                const containerElementRefs = this.$refs[getFrameContainerUIID(frameContainerId)] as (Vue|Element)[];
                if(containerElementRefs) {
                    result = (frameId < 0) 
                        ? containerElementRefs[0] as InstanceType<typeof FrameContainer>
                        : this.getFrameComponent(frameId,{frameParentComponent: containerElementRefs[0] as InstanceType<typeof FrameContainer>, listOfFrameIdToCheck: this.appStore.frameObjects[frameContainerId].childrenIds});
                }
            }

            return result;
        },

        getCaretContainerComponent(frameComponent: InstanceType<typeof Frame> | InstanceType<typeof FrameContainer>): InstanceType<typeof CaretContainer> {
            const caretContainerComponent = (this.appStore.currentFrame.id < 0 || this.appStore.currentFrame.caretPosition == CaretPosition.below)
                ? (frameComponent.$refs[getCaretContainerRef()] as InstanceType<typeof CaretContainer>)
                : ((frameComponent.$refs[getFrameBodyRef()] as InstanceType<typeof FrameBody>).$refs[getCaretContainerRef()] as InstanceType<typeof CaretContainer>); 
            return caretContainerComponent;                              
        },

        ensureFrameKBShortcutContextMenu(isTargetFrames: boolean): Position {
            // This method is called when the context menu for selected frames or the blue caret is going to be shown because of a keyboard shortcut.
            // We need to make sure the frame(s) / caret and the context menu will be visible, as the user may have scrolled and left the selection (partially or fully) out of view.
            // We need to force a position for that menu, because the mouse is not the reference when using the keyboard shortcut
            // We do it like that: if top of the target position + estimated large menu height for safety can be visible, we make sure the top of the target position, and place the menu with both X and Y offsets from the top;
            // if the top of the target + estimated large menu height can't be visible (for example when we are at the down-most frames) then we make sure the bottom
            // of the target is in view, and place the menu with a X offset based on the bottom positions
            const menuHeightSpace = (isTargetFrames) ? 320 : 90, menuOffsetY = 5, menuOffsetX = 40;
            const firstSelectedTargetElement = (isTargetFrames) 
                ? document.getElementById(getFrameUIID(this.appStore.selectedFrames[0]))
                : document.querySelector(".caret-container:has(> .navigationPosition.caret:not(.invisible)"); // We want to retrieve the caret container of the currently visible caret
            const lastSelectedTargetElement = (isTargetFrames) 
                ? document.getElementById(getFrameUIID(this.appStore.selectedFrames.at(-1) as number)) 
                : document.querySelector(".caret-container:has(> .navigationPosition.caret:not(.invisible)");
            // For the editor, we need to get whole editor container, not the space in the middle that is adapted to the viewport
            const editorViewingElement = document.getElementById(getEditorMiddleUIID());
            const editorElement = editorViewingElement?.children[0];
            const positionToReturn: Position = {};
            if(firstSelectedTargetElement && lastSelectedTargetElement && editorElement && editorViewingElement){
                if(firstSelectedTargetElement.getBoundingClientRect().top + menuHeightSpace < editorElement.getBoundingClientRect().bottom){
                    // The menu can be shown from the top of the selection, we just make sure we give enough visibility below the top of the frame
                    const positionOfBottomMenu = firstSelectedTargetElement.getBoundingClientRect().top + menuHeightSpace;
                    if(positionOfBottomMenu > editorViewingElement.getBoundingClientRect().height || firstSelectedTargetElement.getBoundingClientRect().top < 0){
                        editorViewingElement.scroll(0, firstSelectedTargetElement.getBoundingClientRect().top);
                    }
                    positionToReturn.top = firstSelectedTargetElement.getBoundingClientRect().top + menuOffsetY;                                      
                    positionToReturn.left = firstSelectedTargetElement.getBoundingClientRect().left + menuOffsetX;
                }
                else{
                    // The menu cannot be shown from the top of the selection
                    const positionOfTopMenu = lastSelectedTargetElement.getBoundingClientRect().bottom - menuHeightSpace;
                    if(positionOfTopMenu < 0 || lastSelectedTargetElement.getBoundingClientRect().bottom > editorViewingElement.getBoundingClientRect().height){
                        editorViewingElement.scroll(0, positionOfTopMenu);
                    }
                    positionToReturn.bottom = lastSelectedTargetElement.getBoundingClientRect().bottom;     
                    positionToReturn.left = lastSelectedTargetElement.getBoundingClientRect().left + menuOffsetX;
                }
            }
            
            return positionToReturn;                          
        },

        blockScrollOnContextMenu(event :Event) {
            if(getActiveContextMenu()){
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        },

        onContextMenuHover(menuTarget: HTMLElement) {
            // When a context menu entry is hovered, we want to make it as selected. 
            // If we didn't, then there would be a confusion between a selected item with the keyboard, and another hovered item with the mouse.
            // Doing so guarantee that only 1 element is selected in the menu
            menuTarget.focus();
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
    font-size: 15px;
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

/**
 * Style defined for the context menus (based on CSS templates from the Vue-Context component library)
 * (note that the method onContextMenuHover() in this component handle conflicts between selection and hovering)
 */
$black: #333;
$hover-blue: #5a7bfc;
$background-grey: #ecf0f1;
$divider-grey: darken($background-grey, 15%);

.v-context,
.v-context ul {
    background-color: $background-grey;
    display:block;
    margin:0;
    padding: 0;
    min-width:10rem;
    z-index:1500;
    position:fixed;
    list-style:none;
    max-height:calc(100% - 50px);
    overflow-y:auto;
    border-color: transparent;
    border-bottom-width: 0px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen",
        "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue",
        sans-serif;
    box-shadow: 0 3px 6px 0 rgba($black, 0.2);
    border-radius: 4px;
}

.v-context > li,
.v-context ul > li {
    margin:0;
    position:relative
}

.v-context > li > a,
.v-context ul > li > a {
    display:block;
    padding: 5px 10px;
    color:$black !important;
    text-decoration:none;
    white-space:nowrap;
    background-color:transparent;
    border:0
}

.v-context > li > a:focus,
.v-context ul > li > a:focus,
.acItem.acItemSelected {
    text-decoration:none;
    color:white !important;
    background-color: $hover-blue;
}

.v-context:focus,
.v-context > li > a:focus,
.v-context ul:focus,
.v-context ul > li > a:focus{
    outline:0
}

.v-context__sub > a:after{
    content:"\203A";
    float:right;
    padding-left:1rem
}

.v-context__sub > ul{
    display:none
}

.v-context > li {
    &:first-of-type {
      margin-top: 4px;
    }

    &:last-of-type {
      margin-bottom: 4px;
    }
  }

.v-context > ul > li > hr,
.v-context > li > hr{
    box-sizing: content-box;
    height: 1px;
    background-color: $divider-grey;
    padding: 3px 0;
    margin: 0;
    background-clip: content-box;
    pointer-events: none;
    border: none;
}

/* 
 * The following classes are to be used for styling the spliters component.
 * We just don't include the default CSS of the component and change whichever
 * part of the styling we want to change, like the background colours for instance.
 */
.splitpanes {
	display: -webkit-box;
	display: -ms-flexbox;
	display: flex;
	width: 100%;
	height: 100%
}

.splitpanes--vertical {
	-webkit-box-orient: horizontal;
	-webkit-box-direction: normal;
	-ms-flex-direction: row;
	flex-direction: row
}

.splitpanes--horizontal {
	-webkit-box-orient: vertical;
	-webkit-box-direction: normal;
	-ms-flex-direction: column;
	flex-direction: column
}

.splitpanes--dragging * {
	-webkit-user-select: none;
	-moz-user-select: none;
	-ms-user-select: none;
	user-select: none
}

.splitpanes__pane {
	width: 100%;
	height: 100%;
	overflow: hidden
}

.splitpanes--vertical .splitpanes__pane {
	-webkit-transition: width .2s ease-out;
	-o-transition: width .2s ease-out;
	transition: width .2s ease-out
}

.splitpanes--horizontal .splitpanes__pane {
	-webkit-transition: height .2s ease-out;
	-o-transition: height .2s ease-out;
	transition: height .2s ease-out
}

.splitpanes--dragging .splitpanes__pane {
	-webkit-transition: none;
	-o-transition: none;
	transition: none
}

.splitpanes__splitter {
	-ms-touch-action: none;
	touch-action: none
}

.splitpanes--vertical>.splitpanes__splitter {
	min-width: 1px;
	cursor: col-resize
}

.splitpanes--horizontal>.splitpanes__splitter {
	min-height: 1px;
	cursor: row-resize
}

.splitpanes.strype-split-theme .splitpanes__pane {
	background-color: transparent;
}

.splitpanes.strype-split-theme .splitpanes__splitter {
	//background-color: #fff;
    background-color: transparent;
	-webkit-box-sizing: border-box;
	box-sizing: border-box;
	position: relative;
	-ms-flex-negative: 0;
	flex-shrink: 0
}

/*
.splitpanes.strype-split-theme .splitpanes__splitter:before,
.splitpanes.strype-split-theme .splitpanes__splitter:after {
	content: "";
	position: absolute;
	top: 50%;
	left: 50%;
	background-color: #00000026;
	-webkit-transition: background-color .3s;
	-o-transition: background-color .3s;
	transition: background-color .3s
}

.splitpanes.strype-split-theme .splitpanes__splitter:hover:before,
.splitpanes.strype-split-theme .splitpanes__splitter:hover:after {
	background-color: #00000040;
}*/

.splitpanes.strype-split-theme .splitpanes__splitter:first-child {
	cursor: auto
}

.strype-split-theme.splitpanes .splitpanes .splitpanes__splitter {
	z-index: 1
}

.strype-split-theme.splitpanes--vertical>.splitpanes__splitter,
.strype-split-theme .splitpanes--vertical>.splitpanes__splitter {
	width: 2px;
	//border-left: 1px solid #eee;
    border-right: 1px solid #383b40;
	margin-left: -1px
}

.strype-split-theme.splitpanes--vertical>.splitpanes__splitter:before,
.strype-split-theme.splitpanes--vertical>.splitpanes__splitter:after,
.strype-split-theme .splitpanes--vertical>.splitpanes__splitter:before,
.strype-split-theme .splitpanes--vertical>.splitpanes__splitter:after {
	-webkit-transform: translateY(-50%);
	-ms-transform: translateY(-50%);
	transform: translateY(-50%);
	width: 1px;
	height: 30px
}

.strype-split-theme.splitpanes--vertical>.splitpanes__splitter:before,
.strype-split-theme .splitpanes--vertical>.splitpanes__splitter:before {
	margin-left: -2px
}

.strype-split-theme.splitpanes--vertical>.splitpanes__splitter:after,
.strype-split-theme .splitpanes--vertical>.splitpanes__splitter:after {
	margin-left: 1px
}

.strype-split-theme.splitpanes--horizontal>.splitpanes__splitter,
.strype-split-theme .splitpanes--horizontal>.splitpanes__splitter {
	height: 7px;
	border-top: 1px solid #eee;
	margin-top: -1px
}

.strype-split-theme.splitpanes--horizontal>.splitpanes__splitter:before,
.strype-split-theme.splitpanes--horizontal>.splitpanes__splitter:after,
.strype-split-theme .splitpanes--horizontal>.splitpanes__splitter:before,
.strype-split-theme .splitpanes--horizontal>.splitpanes__splitter:after {
	-webkit-transform: translateX(-50%);
	-ms-transform: translateX(-50%);
	transform: translate(-50%);
	width: 30px;
	height: 1px
}

.strype-split-theme.splitpanes--horizontal>.splitpanes__splitter:before,
.strype-split-theme .splitpanes--horizontal>.splitpanes__splitter:before {
	margin-top: -2px
}

.strype-split-theme.splitpanes--horizontal>.splitpanes__splitter:after,
.strype-split-theme .splitpanes--horizontal>.splitpanes__splitter:after {
	margin-top: 1px
}
</style>
