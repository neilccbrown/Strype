<template>
    <div :class="{dragging: isDragTop}">
        <!-- this "fake" caret is only used to show something valid while doing drag and drop -->
        <Caret
            :class="{'caret-drop': isDragTop}"
            v-blur="false"
        />
        <div 
            v-if="multiDragPosition === 'middle' || multiDragPosition === 'last'"
            class="draggedWithOtherFramesAbove"
        >
        </div>
        <div 
            v-show="isVisible"
            :class="frameSelectedCssClass"
        >
            <!-- keep both mousedown & click events: we need mousedown to manage the caret rendering during drag & drop -->
            <div 
                :style="frameStyle" 
                :class="{frameDiv: true, frameDivHover: !isDragging, blockFrameDiv: isBlockFrame && !isJointFrame, statementFrameDiv: !isBlockFrame && !isJointFrame}"
                :id="uiid"
                @mousedown.left="hideCaretAtClick"
                @click="toggleCaret($event)"
                @contextmenu="handleClick($event,'frame-context-menu')"
            >
                <vue-simple-context-menu
                    v-show="allowContextMenu"
                    :elementId="uiid+'frameContextMenu'"
                    :options="this.frameContextMenuOptions"
                    :ref="'frameContextMenu'"
                    @option-clicked="optionClicked"
                    @menu-closed="onContextMenuClosed"
                />

                <FrameHeader
                    v-if="frameType.labels !== null"
                    :isDisabled="isDisabled"
                    v-blur="isDisabled"
                    :frameId="frameId"
                    :frameType="frameType.type"
                    :labels="frameType.labels"
                    class="frame-header"
                    :style="frameMarginStyle['header']"
                    :frameAllowChildren="allowChildren"
                />
                <FrameBody
                    v-if="allowChildren"
                    :frameId="frameId"
                    :isDisabled="isDisabled"
                    :caretVisibility="caretVisibility"
                    ref="frameBody"
                    :style="frameMarginStyle['body']"
                />
                <JointFrames 
                    v-if="allowsJointChildren"
                    :jointParentId="frameId"
                    :isDisabled="isDisabled"
                    :isParentSelected="isPartOfSelection"
                />
            </div>
            <div>
                <CaretContainer
                    v-if="!isJointFrame"
                    :frameId="this.frameId"
                    :caretVisibility="this.caretVisibility"
                    :caretAssignedPosition="caretPosition.below"
                    :isFrameDisabled="this.isDisabled"
                    @hide-context-menus="handleClick($event,'paste')"
                />
            </div>
        </div>
        <div 
            v-if="multiDragPosition === 'middle' || multiDragPosition === 'first'"
            class="draggedWithOtherFramesBelow"
        >
        </div>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import FrameHeader from "@/components/FrameHeader.vue";
import CaretContainer from "@/components/CaretContainer.vue"
import Caret from "@/components/Caret.vue"
import { useStore } from "@/store/store";
import { DefaultFramesDefinition, CaretPosition, CurrentFrame, NavigationPosition, AllFrameTypesIdentifier } from "@/types/types";
import VueSimpleContextMenu, {VueSimpleContextMenuConstructor}  from "vue-simple-context-menu";
import { getAboveFrameCaretPosition, getAllChildrenAndJointFramesIds, getParent, getParentOrJointParent, isFramePartOfJointStructure, isLastInParent } from "@/helpers/storeMethods";
import { getDraggedSingleFrameId, getFrameBodyUIID, getFrameContextMenuUIID, getFrameUIID, isIdAFrameId } from "@/helpers/editor";
import { mapStores } from "pinia";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "Frame",

    components: {
        FrameHeader,
        VueSimpleContextMenu,
        CaretContainer,
        Caret,
    },

    beforeCreate() {
        const components = this.$options.components;
        if (components !== undefined) {
            /* eslint-disable */
            components.FrameBody = require("@/components/FrameBody.vue").default;
            /* eslint-disable */
            components.JointFrames = require("@/components/JointFrames.vue").default;
        }
    },

    props: {
        // NOTE that type declarations here start with a Capital Letter!!! (different to types.ts!)
        frameId: Number, // Unique Indentifier for each Frame
        isDisabled: Boolean,
        frameType: {
            type: Object,
            default: () => DefaultFramesDefinition,
        }, //Type of the Frame
        isJointFrame: Boolean, //Flag indicating this frame is a joint frame or not
        caretVisibility: String,
        allowChildren: Boolean,
        isParentSelected: Boolean,
    },

    data: function () {
        return {
            // Prepare an empty version of the menu: it will be updated as required in handleClick()
            frameContextMenuOptions: [] as {name: string; method: string; type?: "divider"}[],
            // Flag to indicate a frame is selected via the context menu (differs from a user selection)
            contextMenuEnforcedSelect: false,
            // And an associated observer used to check when the menu made hidden to change the flag above
            // we only set the observer later as we need to access other data within the observer
            contextMenuObserver: new MutationObserver(() => {return}), 
        }
    },

    computed: {
        ...mapStores(useStore),

        allowsJointChildren(): boolean {
            return this.appStore.getAllowedJointChildren(this.frameId);
        },

        frameStyle(): Record<string, string> {
            return {
                "background-color": `${this.getFrameBgColor()} !important`,
                "color": (this.frameType.type === AllFrameTypesIdentifier.comment) ? "#97971E !important" : "#000 !important",
            };
        },

        frameMarginStyle(): Record<string, Record<string, string>> {
            return {"header": (this.isJointFrame)? {"margin-left": "5px"} : {"margin-left": "6px"},
                    "body": {...(this.isJointFrame)? {"margin-left": "28px"} : {"margin-left": "30px"}, "margin-right": "28px"}}
        },

        frameSelectedCssClass(): string {
            let frameClass = "";
            frameClass += (this.selectedPosition !== "unselected" || this.contextMenuEnforcedSelect)? "selected " : ""; 
            frameClass += (this.selectedPosition === "first")? "selectedTop " : ""; 
            frameClass += (this.selectedPosition === "last")? "selectedBottom " : ""; 
            frameClass += (this.selectedPosition === "first-and-last" || this.contextMenuEnforcedSelect)? "selectedTopBottom " : "";  
            return frameClass;
        },

        deletableFrame(): boolean{
            return (this.appStore.potentialDeleteFrameIds?.includes(this.frameId)) ?? false;
        },

        // Needed in order to use the `CaretPosition` type in the v-show
        caretPosition(): typeof CaretPosition {
            return CaretPosition;
        },

        uiid(): string {
            return getFrameUIID(this.frameId);
        },

        allowContextMenu(): boolean {
            return this.appStore.contextMenuShownId === this.uiid; 
        },

        selectedPosition(): string {
            return this.appStore.getFrameSelectionPosition(this.frameId);
        },

        isBlockFrame(): boolean {
            return this.frameType.allowChildren;
        },

        // Joint frames can also be "selected" if their parent is selected
        isPartOfSelection(): boolean {
            return (this.selectedPosition !== "unselected") || (this.isParentSelected);
        },

        isVisible(): boolean {
            return this.appStore.isFrameVisible(this.frameId);
        },

        multiDragPosition(): string {
            return this.appStore.getMultiDragPosition(this.frameId);
        },

        isDragTop(): boolean {
            // We show a "fake" positional caret when dragging frames. 
            // Either for the very first frame of a selection, or the one being dragged if there is only one.
            return this.appStore.isDraggingFrame && 
                (((this.appStore.selectedFrames.length > 0) 
                    ? this.appStore.selectedFrames[0] 
                    : getDraggedSingleFrameId()) === this.frameId);
        },
        
        isDragging(): boolean{
            // Contrary to isDragTop, this property is set whenever dragging is happening, not just for the 
            // dragged elements. We need that to control some CSS rendering of the cursors.
            return this.appStore.isDraggingFrame;
        }   
    },

    mounted() {
        window.addEventListener("keydown", this.onKeyDown);

        // Observe when the context menu when the context menu is closed
        // in order to reset the enforced selection flag
        // (we cannot solely use the menu-closed event of the component because it doesn't trigger between menu openings)
        const contextMenuContainer = document.getElementById(getFrameContextMenuUIID(this.uiid))?.parentElement;
        if(contextMenuContainer){
            this.contextMenuObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutationRecord) => {
                    if((mutationRecord.target as HTMLElement).style.display == "none"){
                        this.contextMenuEnforcedSelect = false;
                    }
                });
            });
            this.contextMenuObserver.observe(contextMenuContainer,{attributes: true, attributeFilter: ['style']});
        }
    },

    destroyed() {
        window.removeEventListener("keydown", this.onKeyDown);

        // Probably not required but for safety, remove the observer set up in mounted()
        this.contextMenuObserver.disconnect();
    },

    methods: {
        onKeyDown(event: KeyboardEvent) {
            // When a up/down arrow is hit, we don't want to keep the menu open and potential menu enforced selection
            if(event.key == "ArrowUp" || event.key == "ArrowDown"){
                document.querySelector(".vue-simple-context-menu--active")?.classList.remove("vue-simple-context-menu--active");
                this.contextMenuEnforcedSelect = false;
            }
            
            // Cutting/copying by shortcut is only available for a frame selection*.
            // To prevent the command to be called on all frames, but only once (first of a selection), we check that the current frame is a first of a selection.
            // * "this.isPartOfSelection" is necessary because it is only set at the right value in a subsequent call. 
            if(this.isPartOfSelection && (this.appStore.getFrameSelectionPosition(this.frameId) as string).startsWith("first") && (event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "c" || event.key.toLowerCase() === "x")) {
                if(event.key.toLowerCase() === "c"){
                    this.copy();
                }
                else{
                    this.cut();
                }
                event.preventDefault();
                return;
            }
        },

        getFrameBgColor(): string {
            // If we show the indicator background that a frame can be delete (hovering the delete / delete outer entry menus)
            // then we have a specific colour - to avoid colours to add up together when going deeper in the frames,
            // we only apply that colour to the frames that have not a parent set to deletable         
            if(this.deletableFrame && this.appStore.potentialDeleteFrameIds){
                const isParentDeletable = this.appStore.potentialDeleteFrameIds.includes(getParentOrJointParent(this.appStore.frameObjects, this.frameId));
                return (!isParentDeletable) ? "rgba(255,0,0,0.6)" : "transparent"; 
            }

            // In most cases, the background colour is the one defined in the frame types.
            // The exception is for comments and joint frames, which will take the same colour as their container.
            // For comments, we keep them transparent, for joints, we retrieve the parent's colour, so that it shows up when dragging them.
            if(this.frameType.type !== AllFrameTypesIdentifier.comment){
                if(this.isJointFrame){
                    return this.appStore.frameObjects[this.appStore.frameObjects[this.frameId].jointParentId].frameType.colour;
                }
                return this.frameType.colour;
            }
            else{
                return "transparent";
            }
        },

        handleClick (event: MouseEvent, action: string) {
            this.appStore.contextMenuShownId = this.uiid;

            // only show the frame menu if we are not editing
            if(this.appStore.isEditing){
                return;
            }

            if(action === "frame-context-menu") {
                const deleteMethod = "delete";
                const deleteOuterMethod = "deleteOuter";
                this.frameContextMenuOptions = [
                    {name: this.$i18n.t("contextMenu.cut") as string, method: "cut"},
                    {name: this.$i18n.t("contextMenu.copy") as string, method: "copy"},
                    {name: this.$i18n.t("contextMenu.duplicate") as string, method: "duplicate"},
                    {name: "", method: "", type: "divider"},
                    {name: this.$i18n.t("contextMenu.pasteAbove") as string, method: "pasteAbove"},
                    {name: this.$i18n.t("contextMenu.pasteBelow") as string, method: "pasteBelow"},
                    {name: "", method: "", type: "divider"},
                    {name: this.$i18n.t("contextMenu.disable") as string, method: "disable"},
                    {name: "", method: "", type: "divider"},
                    {name: this.$i18n.t("contextMenu.delete") as string, method: deleteMethod},
                    {name: this.$i18n.t("contextMenu.deleteOuter") as string, method: deleteOuterMethod}];

                // Not all frames should be duplicated (e.g. Else)
                // The target id, for a duplication, should be the same as the copied frame 
                // except if that frame has joint frames: the target is the last joint frame.
                const targetFrameJointFrames = this.appStore.getJointFramesForFrameId(this.frameId, "all");
                const targetFrameId = (targetFrameJointFrames.length > 0) ? targetFrameJointFrames[targetFrameJointFrames.length-1].id : this.frameId;
                // Duplication allowance should be examined based on whether we are talking about a single frame or a selection frames
                const canDuplicate = (this.isPartOfSelection) ?
                    this.appStore.isPositionAllowsSelectedFrames(targetFrameId, CaretPosition.below, false) : 
                    this.appStore.isPositionAllowsFrame(targetFrameId, CaretPosition.below, this.frameId); 
                if(!canDuplicate){
                    const duplicateOptionContextMenuPos = this.frameContextMenuOptions.findIndex((entry) => entry.method === "duplicate");
                    //We don't need the duplication option: remove it from the menu options if not present
                    if(duplicateOptionContextMenuPos > -1){
                        this.frameContextMenuOptions.splice(
                            duplicateOptionContextMenuPos,
                            1
                        );
                    }
                }

                // Similarly to duplication, not all frames can be pasted at a specifc location.
                // We show the paste entries depending on the possiblity to paste the clipboard. 
                let canPasteAboveFrame: boolean, canPasteBelowFrame: boolean;
                if(!this.appStore.isCopiedAvailable || this.isPartOfSelection){
                    // If there are no frame to copy, of the click is part of a selection of frames
                    // we just remove all paste menu entries (and the divider following them)
                    const pasteOptionContextMenuPos = this.frameContextMenuOptions.findIndex((entry) => entry.method === "pasteAbove");
                    this.frameContextMenuOptions.splice(
                            pasteOptionContextMenuPos,
                            3 //2 paste menu entries + divider
                        );
                    canPasteAboveFrame = false;
                    canPasteBelowFrame = false;
                }
                else{
                    // Check each paste menu entry potential
                    // We need to deal with joint frames (*).. the rules are, when we have a joint frames structure:
                    // for the parent root joint frame: allow pasting any allowed frames above and below (joint will be pasted below the root)
                    // for intermediate joint frames: only allow (tentative) joint frames above and below
                    // for the last joint frame: only allow (tentative) joint frame above, and any allowed frames below 
                    // (*) joint frames cannot be copied within a selection, it can only be one joint frame.
                    const isCopyJointFrame = (this.appStore.copiedFrames[this.appStore.copiedFrameId]?.frameType.isJointFrame) ?? false;
                    const isAllowedForJointAbove = (!this.isJointFrame) || (this.isJointFrame && isCopyJointFrame);
                    const isAllowedForJointBelow = !this.isJointFrame
                        || (this.isJointFrame && isCopyJointFrame && !isLastInParent(this.appStore.frameObjects, this.frameId))
                        || (this.isJointFrame && isLastInParent(this.appStore.frameObjects, this.frameId));
                    const caretNavigationPositionAbove = getAboveFrameCaretPosition(this.frameId);
                    const targetPasteBelow = this.getTargetPasteBelow();
                    canPasteAboveFrame = isAllowedForJointAbove && (this.appStore.isPasteAllowedAtFrame(caretNavigationPositionAbove.id, caretNavigationPositionAbove.caretPosition as CaretPosition));
                    canPasteBelowFrame = isAllowedForJointBelow && (this.appStore.isPasteAllowedAtFrame(targetPasteBelow.id, targetPasteBelow.caretPosition));
                    const sliceNumber = (!canPasteAboveFrame && !canPasteBelowFrame)
                        ? 3 // both paste menu entries and divider
                        : 1; // one of the paste menu entries
                    const pasteBelowOptionIndex = this.frameContextMenuOptions.findIndex((entry) => entry.method === "pasteBelow");
                    const pasteOptionContextMenuPos = (!canPasteAboveFrame)
                        ? this.frameContextMenuOptions.findIndex((entry) => entry.method === "pasteAbove") // position of first paste entry menu 
                        : pasteBelowOptionIndex; // position of second paste entry menu
                    if(!canPasteAboveFrame || ! canPasteBelowFrame){
                        this.frameContextMenuOptions.splice(
                            pasteOptionContextMenuPos,
                            sliceNumber
                        );
                    }
                    // For paste below, one exception can happen: when we want to paste a joint frame below the joint frame root (if it has already joint children)
                    // the selection may be showing the whole structure paste will be below the root: so we change the menu label when this happens
                    // Note: joint frames cannot be part of a selection, so we know there would only be 1 frame
                    if(canPasteBelowFrame && isCopyJointFrame && this.appStore.frameObjects[targetPasteBelow.id].jointFrameIds.length > 0){
                        // offset the index by 1: a joint frame can never be pasted above a root, we know "paste above" won't be shown...
                        this.frameContextMenuOptions[pasteBelowOptionIndex - 1].name = this.$i18n.t("contextMenu.pasteBelowJointRoot") as string;
                    }
                }

                // We only show "delete outer" if the top level frame(s) to delete are all block frames and not function definitions
                const canDeleteOuter = (this.isPartOfSelection) 
                    ? !this.appStore
                        .selectedFrames
                        .map((frameId) => this.appStore.frameObjects[frameId].frameType.allowChildren && this.appStore.frameObjects[frameId].frameType.type != AllFrameTypesIdentifier.funcdef)
                        .includes(false)
                    : this.isBlockFrame && this.frameType.type != AllFrameTypesIdentifier.funcdef;
                if(!canDeleteOuter){
                    const deleteOuterOptionContextMenuPos = this.frameContextMenuOptions.findIndex((entry) => entry.method === "deleteOuter");
                    // We don't need the delete outer option: remove it from the menu options if not present
                    if(deleteOuterOptionContextMenuPos > -1){
                        this.frameContextMenuOptions.splice(
                            deleteOuterOptionContextMenuPos,
                            1
                        );
                    }
                }
                
                //if a frame is disabled [respectively, enabled], show the enable [resp. disable] option
                const disableOrEnableOption = (this.isDisabled) 
                    ?  {name: this.$i18n.t("contextMenu.enable"), method: "enable"}
                    :  {name: this.$i18n.t("contextMenu.disable"), method: "disable"};
                const enableDisableIndex = this.frameContextMenuOptions.findIndex((entry) => entry.method === "enable" || entry.method === "disable");
                Vue.set(
                    this.frameContextMenuOptions,
                    enableDisableIndex,
                    disableOrEnableOption
                );

                // overwrite readonly properties pageX and set correct value
                Object.defineProperty(event, "pageX", {
                    value: event.pageX - 60,
                    writable: true,
                });
                
                ((this.$refs.frameContextMenu as unknown) as VueSimpleContextMenuConstructor).showMenu(event);
                //the menu could have "forcely" been disabled by us to prevent duplicated menu showing in the editable slots
                //so we make sure we restore the visibility of that menu
                const contextMenu = document.getElementById(getFrameContextMenuUIID(this.uiid));  
                contextMenu?.removeAttribute("hidden");

                // We add a hover event on the delete menu entries to show cue in the UI on what the entry will act upon
                // need to be done in the next tick to make sure the menu has been generated.
                // The other entries are all ignored, as we will show a selection when the menu opens (if there is no selection already for that frame)
                this.$nextTick(() => {
                    if(contextMenu){
                        //We prepare the indexes of the "delete" entries to add events on. "Delete" will always be added.
                        const deleteEntriesIndexes = [this.frameContextMenuOptions.findIndex((option) => option.method == deleteMethod)];
                        if(canDeleteOuter){
                            deleteEntriesIndexes.push(this.frameContextMenuOptions.findIndex((option) => option.method == deleteOuterMethod));
                        }
                        // Add the listeners for delete entries
                        deleteEntriesIndexes.forEach((indexValue, index) => {
                            const isDeleteOuter = (index > 0);
                            const menuEntryElement = contextMenu.childNodes[indexValue];
                            menuEntryElement.addEventListener("mouseenter", () => this.onDeleteEntryContextMenuHover(true, isDeleteOuter));
                            menuEntryElement.addEventListener("mouseleave", () => this.onDeleteEntryContextMenuHover(false, isDeleteOuter));
                        });

                        // If there are no frame(s) selected by the user already in a multi selection
                        // then we select this frame when the context menu opens.
                        // Since it is only for presentation, we don't actually register the selected frame as a selection
                        if(!this.isPartOfSelection){
                            this.contextMenuEnforcedSelect = true;
                            // Other items may however be selected so we deselect them
                            this.appStore.unselectAllFrames();
                        }
                    }
                });                   

                //prevent default menu to show
                event.preventDefault();
                event.stopPropagation();
            }
        },

        onContextMenuClosed() {
            this.contextMenuEnforcedSelect = false;
        },

        onDeleteEntryContextMenuHover(entering: boolean, isOuterDelete: boolean): void {
            // For compatibility with the tool previous versions, set the property in the store if not existing before
            if(!this.appStore.potentialDeleteFrameIds){
                this.appStore.potentialDeleteFrameIds = [];
                this.appStore.potentialDeleteIsOuter = false;
            }

            // Set the frame flag indicating we want to show in the UI that a frame could be deleted
            if(!entering){
                this.appStore.potentialDeleteFrameIds.splice(0);
            }
            else{
                // Add the target frames Ids in the flag array - they will always be shown no matter it's a single or outer delete
                const potentialDeleteFrameIDs = (this.appStore.selectedFrames.length > 0) ? [...this.appStore.selectedFrames] : [this.frameId];
                [...potentialDeleteFrameIDs].forEach((targetFrameId) => {
                    if(isOuterDelete){
                        // Add the joint frames (if any) in the flag array if we are in an outer delete
                        potentialDeleteFrameIDs.push(...this.appStore.frameObjects[targetFrameId].jointFrameIds);
                    }
                    else{
                        // Add all the children and joints of the targets in the flag array if we are in a single delete
                        potentialDeleteFrameIDs.push(...getAllChildrenAndJointFramesIds(this.appStore.frameObjects, targetFrameId));
                    }
                });
                this.appStore.potentialDeleteFrameIds.push(...potentialDeleteFrameIDs);
                this.appStore.potentialDeleteIsOuter = isOuterDelete;
            }
        },

        // Item is passed anyway in the event, in case the menu is attached to a list
        optionClicked (event: {item: any; option: {name: string; method: string}}) {
            // Remove all the potential deletable frames
            this.appStore.potentialDeleteFrameIds.splice(0);
            // `event.option.method` holds the name of the method to be called.
            // In case the menu gets more complex this can clear up the code. However, it is a bit unsafe - in the case you
            // misstype a method's name.
            const thisCompProps = Object.entries(this).find((entry) => entry[0] === event.option.method);
            if(thisCompProps){
                thisCompProps[1]();
            }
        },

        hideCaretAtClick(event: MouseEvent): void {
            // First check if we are not clicking on the context menu: if so, we don't hide the caret.
            // (don't use the ids to check things because the event bubbles through the frames)
            if(event.composedPath().find((target) => (target as HTMLElement).tagName?.toLowerCase()=="ul" && (target as HTMLElement).classList.contains("vue-simple-context-menu"))){
                return;
            }

            // Force the caret to become invisible at click. That is required for being able to show a drag and drop "image" that 
            // doesn't contain the blue caret if we drag the frame which currently holds the caret. The caret visibility will be restored
            // either when the drop of a drag and drop happens or when click is notified (cf. toggleCaret()) if the drag and drop had not be performed.
            // Note: we do it directly in JS as reactive change via store is too late for the rendering.
            for(const navigationCaret of document.getElementsByClassName("caret")){
                if(!navigationCaret.classList.contains("invisible")){
                    navigationCaret.classList.add("invisible");
                }
            }

            // But to keep things clean in the store, we still need to do the necessary amendments
            Vue.set(
                this.appStore.frameObjects[this.appStore.currentFrame.id],
                "caretVisibility",
                CaretPosition.none
            );
        },

        toggleCaret(event: MouseEvent): void {
            const clickedDiv: HTMLDivElement = event.target as HTMLDivElement;

            // This checks the propagated click events, and prevents the parent frame to handle the event as well. 
            // Stop and Prevent do not work in this case, as the event needs to be propagated 
            // (for the context menu to close) but it does not need to trigger always a caret change.
            // Note: previous version checked the id, but that's not reliable as the div triggering the click may not have an id (or as formatted for the frame div)
            // therefore, another approach is to check that the clicked object is either the frame object (as done before) or find what it's nearest parent and get its ID.
            let frameDivParent = clickedDiv;
            while(!isIdAFrameId(frameDivParent.id)){
                frameDivParent = frameDivParent.parentElement as HTMLDivElement
            }            
            if(frameDivParent.id !== this.uiid){
                return;
            }

            this.changeToggledCaretPosition(event.clientY, frameDivParent);
        },

        changeToggledCaretPosition(clickY: number, frameClickedDiv: HTMLDivElement): void{
            const frameRect = frameClickedDiv.getBoundingClientRect();
            const headerRect = document.querySelector("#"+this.uiid+ " .frame-header")?.getBoundingClientRect();
            if(headerRect){            
                let newCaretPosition: NavigationPosition = {id: this.frameId, caretPosition: CaretPosition.none, isSlotNavigationPosition: false}; 
                // The following logic applies to select a caret position based on the frame and the location of the click:
                // if a click occurs between the top of a frame and its header top mid half
                //    --> get the cursor visually above the frame
                // if a click occurs within the frame header bottom mid half
                //    --> get the cursor below the frame (if statement) or top of body (if block)
                // if a click occurs below the header mid half
                //    --> get the cursor below the frame (if statement) or at the nearest above/below position (if block)
                //Note: joint frames overlap their root parent, they get the click as a standalone frame
                if(clickY <= (frameRect.top + headerRect.height/2)){
                    newCaretPosition = getAboveFrameCaretPosition(this.frameId);
                }
                else{
                    if(this.isBlockFrame){
                        // When we are here, we try to find the nearest above or below position of the block's child (if any)
                        // We get all the mid frame positions that will decided whether we are targetting above or below a frame.
                        // We traverse each positions until we found where the click (vertically) occured, if nothing is found, we
                        // then assume the click is vertically beyond the children and therefore toggle the caret below the current frame
                        const midFramePositions = this.getBodyMidFramePositions();
                        let hasPassedPosition = false;
                        let previousThreshold = 0;
                        for(const midFrameThresholdPos of midFramePositions){
                            hasPassedPosition = (clickY >= previousThreshold && clickY < midFrameThresholdPos.midYThreshold);
                            previousThreshold = midFrameThresholdPos.midYThreshold;
                            if(hasPassedPosition){
                                newCaretPosition.id = midFrameThresholdPos.caretPos.id;
                                newCaretPosition.caretPosition = midFrameThresholdPos.caretPos.caretPosition;
                                break;
                            }
                        }
                        if(!hasPassedPosition){
                            // If we have passed the mid frame vertical threshold of the last body's child
                            // the caret position would be the bottom of that containing frame, except in
                            // the case of a joint structure when in between joints: since the below positions
                            // in between joints are disabled, the caret will be still be at the last child's bottom.
                            // If that joint has no children, we keep in its body.
                            // If the joint frame is the last of the structure, then we need to show the caret below for the root parent.
                            if(isFramePartOfJointStructure(this.appStore.frameObjects, this.frameId)){
                                if(this.appStore.frameObjects[this.frameId].jointParentId > 0 && isLastInParent(this.appStore.frameObjects, this.frameId)){
                                    // Case of a joint frame which is last of of the joint structure
                                    newCaretPosition.id = this.appStore.frameObjects[this.frameId].jointParentId;
                                    newCaretPosition.caretPosition = CaretPosition.below;
                                }
                                else{
                                    // Case of root joint frame or  joint frame which is not last of the joint structure
                                    if(this.appStore.frameObjects[this.frameId].childrenIds.length > 0){
                                        newCaretPosition.id = [...this.appStore.frameObjects[this.frameId].childrenIds].pop() as number;// get the last joint child frame id
                                        newCaretPosition.caretPosition = CaretPosition.below;
                                    }
                                    else{
                                        newCaretPosition.caretPosition = CaretPosition.body;
                                    }    
                                }                                                
                            } 
                            else{
                                newCaretPosition.caretPosition = CaretPosition.below;   
                            }
                        }
                    }
                    else{
                        newCaretPosition.caretPosition = CaretPosition.below;
                    }
                }
               
                this.appStore.toggleCaret({id: newCaretPosition.id, caretPosition: newCaretPosition.caretPosition as CaretPosition});
            }
        },

        getBodyMidFramePositions(): {caretPos: CurrentFrame, midYThreshold: number}[] {
            // The mid frame positions for the "body" part of a block frames have at least 1 entity:
            // - A) the parent's body position (top of the body) that would be selected 
            //    when the click vertical position is above the middle of the first child (when there are children) or above the middle of the empty body space (if no children)
            // If there are frames in the body, we have B) all the mid frame positions of the children
            const midFramePosArray: {caretPos: CurrentFrame, midYThreshold: number}[] = [];
            const frameBodyRect = document.getElementById(getFrameBodyUIID(this.frameId))?.getBoundingClientRect() as DOMRect;
                        
            const bodyFrameIds = this.appStore.frameObjects[this.frameId].childrenIds;
            if(bodyFrameIds.length > 0){
                // A) + B)
                bodyFrameIds.forEach((childFrameId) => {
                    const childFrameDivRect = document.getElementById(getFrameUIID(childFrameId))?.getBoundingClientRect() as DOMRect;
                    const prevPos = getAboveFrameCaretPosition(childFrameId);
                    midFramePosArray.push({caretPos: {id: prevPos.id, caretPosition: prevPos.caretPosition as CaretPosition},
                        midYThreshold: childFrameDivRect.top + childFrameDivRect.height/2 });
                });

                // Add the last part (after the last frame) of B)
                const lastChildFrameId = bodyFrameIds[bodyFrameIds.length - 1];
                const lastChildFrameDivRect = document.getElementById(getFrameUIID(lastChildFrameId))?.getBoundingClientRect() as DOMRect;
                midFramePosArray.push({caretPos: {id: lastChildFrameId, caretPosition: CaretPosition.below},
                    midYThreshold: lastChildFrameDivRect.bottom + (frameBodyRect.bottom - lastChildFrameDivRect.bottom)/2});
            } 
            else{
                // Add A) for no children body: the mid frame position is then taken as the 3/4 frame of the containing frame
                // because we want to have a bit more space for clicking within the empty body to get the caret inside the body
                midFramePosArray.push({caretPos: {id: this.frameId, caretPosition: CaretPosition.body},
                    midYThreshold: frameBodyRect.top + frameBodyRect.height*0.75});
            }

            return midFramePosArray;
        },

        duplicate(): void {
            if(this.isPartOfSelection){
                this.appStore.copySelectedFramesToPosition(
                    {
                        newParentId: (this.isJointFrame)
                            ? getParent(this.appStore.frameObjects, this.appStore.frameObjects[this.frameId])
                            : getParentOrJointParent(this.appStore.frameObjects, this.frameId),
                    }
                );
            }
            else {
                this.appStore.copyFrameToPosition(
                    {
                        frameId : this.frameId,
                        newParentId: getParentOrJointParent(this.appStore.frameObjects, this.frameId),
                        newIndex: this.appStore.getIndexInParent(this.frameId)+1,
                    }
                );
            }
        },

        cut(): void {
            //cut prepares a copy, then we delete the selection / frame copied
            if(this.isPartOfSelection){
                this.appStore.copySelection(); 
                //for deleting a selection, we don't care if we simulate "delete" or "backspace" as they behave the same
                this.appStore.deleteFrames("Delete");
            }
            else{
                this.appStore.copyFrame(this.frameId);
                //when deleting the specific frame, we place the caret below and simulate "backspace"
                this.appStore.setCurrentFrame({id: this.frameId, caretPosition: CaretPosition.below} as CurrentFrame);
                this.appStore.deleteFrames("Backspace");
            }                    
        },

        copy(): void {
            if(this.isPartOfSelection){
                this.appStore.copySelection(); 
            }
            else{
                this.appStore.copyFrame(this.frameId);
            }
        },

        pasteAbove(): void {
            // Perform a paste above this frame
            const caretNavigationPositionAbove = getAboveFrameCaretPosition(this.frameId);
            if(this.appStore.isSelectionCopied){
                    this.appStore.pasteSelection(
                        {
                            clickedFrameId: caretNavigationPositionAbove.id,
                            caretPosition: caretNavigationPositionAbove.caretPosition as CaretPosition,
                        }
                    );
                }
                else {
                    this.appStore.pasteFrame(
                        {
                            clickedFrameId: caretNavigationPositionAbove.id,
                            caretPosition: caretNavigationPositionAbove.caretPosition as CaretPosition,
                        }
                    );
                }
        },

        pasteBelow(): void {
            // Perform a paste below this frame
            const targetPasteBelow = this.getTargetPasteBelow();
            if(this.appStore.isSelectionCopied){
                this.appStore.pasteSelection(
                    {
                        clickedFrameId: targetPasteBelow.id,
                        caretPosition: targetPasteBelow.caretPosition,
                    }
                );
            }
            else {
                this.appStore.pasteFrame(
                    {
                        clickedFrameId: targetPasteBelow.id,
                        caretPosition: targetPasteBelow.caretPosition,
                    }
                );
            }
        },

        getTargetPasteBelow(): CurrentFrame {
            // Because of joint frames, pasting below isn't as straight forward as using the clicked (target) frame and caret below position:
            // if we are pasting a non joint frame below the last joint child, then we need to paste as if it was the joint root parent below,
            // if we are pasting a joint frame below another joint frame, then we need to paste as if it was below the last child of target joint
            //    or in the target joint frame body if there are no children.
            const isCopyJointFrame = (this.appStore.copiedFrames[this.appStore.copiedFrameId]?.frameType.isJointFrame) ?? false;
            const targetFrameId = (this.isJointFrame && isLastInParent(this.appStore.frameObjects, this.frameId) && !isCopyJointFrame) 
                ? this.appStore.frameObjects[this.frameId].jointParentId
                : (isFramePartOfJointStructure(this.appStore.frameObjects, this.frameId) && isCopyJointFrame) 
                    ? ([...this.appStore.frameObjects[this.frameId].childrenIds].pop())??this.frameId 
                    : this.frameId;
            const caretPosition = (isFramePartOfJointStructure(this.appStore.frameObjects, this.frameId) && isCopyJointFrame 
                && this.appStore.frameObjects[this.frameId].childrenIds.length == 0)
                ? CaretPosition.body
                : CaretPosition.below;
            return  {id: targetFrameId, caretPosition: caretPosition};
         
        },

        disable(): void {
            if(this.isPartOfSelection){
                this.appStore.changeDisableSelection(true);
            }
            else {
                this.appStore.changeDisableFrame(
                    {
                        frameId: this.frameId,
                        isDisabling: true,
                    }
                );
            }
        },
        
        enable(): void {
            if(this.isPartOfSelection){
                this.appStore.changeDisableSelection(false);
            }
            else {
                this.appStore.changeDisableFrame(
                    {
                        frameId: this.frameId,
                        isDisabling: false,
                    }
                );
            }
        },

        delete(): void {
            if(this.isPartOfSelection){
                //for deleting a selection, we don't care if we simulate "delete" or "backspace" as they behave the same
                this.appStore.deleteFrames("Delete");
            }
            else{
                //when deleting the specific frame, we place the caret below and simulate "backspace"
                this.appStore.setCurrentFrame({id: this.frameId, caretPosition: CaretPosition.below});
                this.appStore.deleteFrames("Backspace");
            }       
        },

        deleteOuter(): void {
            this.appStore.deleteOuterFrames(this.frameId);
        }
    },
});
</script>

<style lang="scss">
.frameDiv {    
    padding-top: 1px;
    padding-bottom: 1px;
    border-radius: 8px;
    border: 1px solid transparent;
}

// This should be ".frameDiv:hover" but drag and drop is messing things up
// so we use another class to only be used when drag and drop doesn't occur
.frameDivHover:hover{
    cursor: pointer;
}

.dragging-frame-allowed {
    // This cursor will be shown when dragging occurs and we are within a draggable component 
    // regardless dropping is allowed or not (because we won't want a constant flicker of cursor)
    cursor: grabbing !important;
}

.dragging-frame-not-allowed {
     // This cursor will be shown when dragging occurs and we are oustide the editor's containers
    cursor: url(~@/assets/images/forbidden-cursor.png), auto !important;
}

.blockFrameDiv {
    border-color: #8e8e8e;
}

.statementFrameDiv:hover {
    border-color: #d6d6d6;
}

.selected {
    border-left: 3px solid #000000 !important;
    border-right: 3px solid #000000 !important;
}

.selectedTop {
    border-top: 3px solid #000000 !important;
}

.selectedBottom {
    border-bottom: 3px solid #000000 !important;
}

.selectedTopBottom{
    border-top: 3px solid #000000 !important;
    border-bottom: 3px solid #000000 !important;
}

.draggedWithOtherFramesAbove {
    border-top: 3px solid #000000 !important;
    border-left: 3px solid #000000 !important;
    border-right: 3px solid #000000 !important;
    border-bottom: 3px solid #000000 !important;
    border-radius: 5px 5px 0px 0px;
    padding-bottom: 5px;

}

.draggedWithOtherFramesBelow{
    border-top: 3px solid #000000 !important;
    border-bottom: 3px solid #000000 !important;
    border-radius: 0px 0px 5px 5px;
    border-left: 3px solid #000000 !important;
    border-right: 3px solid #000000 !important;
    padding-top: 5px;
}
</style>
