<template>
    <div>
        <div 
            v-if="multiDragPosition === 'middle' || multiDragPosition === 'last'"
            class="draggedWithOtherFramesAbove"
        >
        </div>
        <div 
            v-show="isVisible"
            :class="frameSelectedCssClass"
        >
            <div 
                :style="frameStyle" 
                :class="{'block frameDiv': true, statementOrJoint: isStatementOrJointFrame}"
                :id="uiid"
                @click="toggleCaret($event)"
                @contextmenu="handleClick($event,'frame-context-menu')"
            >
                <vue-simple-context-menu
                    v-show="allowContextMenu"
                    :elementId="uiid+'frameContextMenu'"
                    :options="this.frameContextMenuOptions"
                    :ref="'frameContextMenu'"
                    @option-clicked="optionClicked"
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
                    v-if="allowsJointChildren && hasJointFrameObjects"
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
import { useStore } from "@/store/store";
import { DefaultFramesDefinition, CaretPosition, Definitions, CommentDefinition, CurrentFrame } from "@/types/types";
import VueSimpleContextMenu, {VueSimpleContextMenuConstructor}  from "vue-simple-context-menu";
import { getParent, getParentOrJointParent } from "@/helpers/storeMethods";
import { getFrameContextMenuUIID } from "@/helpers/editor";
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
            //prepare an empty version of the menu: it will be updated as required in handleClick()
            frameContextMenuOptions: [] as {name: string; method: string; type?: "divider"}[],
        }
    },

    computed: {
        ...mapStores(useStore),
        
        hasJointFrameObjects(): boolean {
            return this.appStore.getJointFramesForFrameId(
                this.frameId,
                "all"
            ).length >0;
        },

        allowsJointChildren(): boolean {
            return this.appStore.getAllowedJointChildren(this.frameId);
        },

        frameStyle(): Record<string, string> {
            return this.isJointFrame === true
                ? {"color":"#000 !important"}
                : {
                    "background-color": `${this.getFrameBgColor()} !important`,
                    "color": (this.frameType.type === Definitions.CommentDefinition.type) ? "#97971E !important" : "#000 !important",
                };
        },

        frameMarginStyle(): Record<string, Record<string, string>> {
            return {"header": (this.isJointFrame)? {"margin-left": "13px"} : {"margin-left": "14px"},
                    "body": (this.isJointFrame)? {"margin-left": "11px"} : {"margin-left": "12px"}}
        },

        frameSelectedCssClass(): string {
            let frameClass = "";
            frameClass += (this.selectedPosition !== "unselected")? "selected " : ""; 
            frameClass += (this.selectedPosition === "first")? "selectedTop " : ""; 
            frameClass += (this.selectedPosition === "last")? "selectedBottom " : ""; 
            frameClass += (this.selectedPosition === "first-and-last")? "selectedTopBottom " : "";  
            return frameClass;
        },

        // Needed in order to use the `CaretPosition` type in the v-show
        caretPosition(): typeof CaretPosition {
            return CaretPosition;
        },

        uiid(): string {
            return "frame_id_"+this.frameId;
        },

        allowContextMenu(): boolean {
            return this.appStore.contextMenuShownId === this.uiid; 
        },

        selectedPosition(): string {
            return this.appStore.getFrameSelectionPosition(this.frameId);
        },

        isStatementOrJointFrame(): boolean {
            return this.frameType.isJointFrame || !this.frameType.allowChildren;
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
    },

    mounted() {
        window.addEventListener("keydown", this.onKeyDown);
    },

    destroyed() {
        window.removeEventListener("keydown", this.onKeyDown);
    },

    methods: {
        onKeyDown(event: KeyboardEvent) {
            // Cutting/copying by shortcut is only available for a frame selection*.
            // To prevent the command to be called on all frames, but only once (first of a selection), we check that the current frame is a first of a selection.
            // * "this.isPartOfSelection" is necessary because it is only set at the right value in a subsequent call. 
            if(this.isPartOfSelection && (this.appStore.getFrameSelectionPosition(this.frameId) as string).startsWith("first") && (event.ctrlKey || event.metaKey) && (event.key === "c" || event.key === "x")) {
                if(event.key === "c"){
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
            // In most cases, the background colour is the one defined in the frame types.
            // The exception is for comments, which will take the same colour as their container.
            if(this.frameType.type !== CommentDefinition.type){
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
                this.frameContextMenuOptions = [
                    {name: this.$i18n.t("contextMenu.cut") as string, method: "cut"},
                    {name: this.$i18n.t("contextMenu.copy") as string, method: "copy"},
                    {name: this.$i18n.t("contextMenu.duplicate") as string, method: "duplicate"},
                    {name: "", method: "", type: "divider"},
                    {name: this.$i18n.t("contextMenu.disable") as string, method: "disable"},
                    {name: "", method: "", type: "divider"},
                    {name: this.$i18n.t("contextMenu.delete") as string, method: "delete"}];

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

                //prevent default menu to show
                event.preventDefault();
                event.stopPropagation();
            }
        },

        // Item is passed anyway in the event, in case the menu is attached to a list
        optionClicked (event: {item: any; option: {name: string; method: string}}) {
            // `event.option.method` holds the name of the method to be called.
            // In case the menu gets more complex this can clear up the code. However, it is a bit unsafe - in the case you
            // misstype a method's name.
            const thisCompProps = Object.entries(this).find((entry) => entry[0] === event.option.method);
            if(thisCompProps){
                thisCompProps[1]();
            }
        },

        toggleCaret(event: MouseEvent): void {
            const frame: HTMLDivElement = event.srcElement as HTMLDivElement;

            // This checks the propagated click events, and prevents the parent event to handle the event as well. 
            // Stop and Prevent do not work in this case, as the event needs to be propagated 
            // (for the context menu to close) but it does not need to trigger always a caret change.
            if(frame.id !== this.uiid ){
                return;
            }

            // get the rectangle of the div with its coordinates
            const rect = frame.getBoundingClientRect();
            
            let position: CaretPosition = CaretPosition.none;
            // if clicked above the middle, or if I click on the label show the body caret
            if((frame.className === "frame-header" || event.y <= rect.top + rect.height/2) && this.allowChildren) {
                position = CaretPosition.body;
            }
            //else show caret below
            else{
                position = CaretPosition.below;
            }
            this.appStore.toggleCaret({id:this.frameId, caretPosition: position});
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
    },
});
</script>

<style lang="scss">
.block {    
    padding-top: 1px;
    padding-bottom: 1px;
    border-radius: 8px;
    border: 1px solid transparent;
}

.statementOrJoint {
    border: 1px solid transparent;
}

.block:hover{
    border-color: #B4B4B4;
    cursor: grab;
}

.block:active{
    cursor: grabbing;
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
