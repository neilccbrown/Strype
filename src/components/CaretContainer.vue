<template>
    <div 
        :class="{'caret-container': true, 'static-caret-container': isStaticCaretContainer}"
        @click.exact.prevent.stop="toggleCaret()"
        @click.shift.exact.prevent.stop="frameSelection()"
        @contextmenu.prevent.stop="handleClick($event)"
        :key="uiid"
        :id="uiid"
    >
        <!-- Make sure the click events are stopped in the links because otherwise, events pass through and mess the toggle of the caret in the editor.
             Also, the element MUST have the hover event handled for proper styling (we want hovering and selecting to go together) -->
        <vue-context ref="menu" @close="appStore.isContextMenuKeyboardShortcutUsed=false">
            <li><a @click.stop="paste" @mouseover="handleContextMenuHover">{{$i18n.t("contextMenu.paste")}}</a></li>
        </vue-context>
        <Caret
            :class="{navigationPosition: true, caret:!this.appStore.isDraggingFrame}"
            :id="caretUIID"
            :isInvisible="isInvisible"
            v-blur="isCaretBlurred"
        />
    </div>
</template>


<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue, { PropType } from "vue";
import VueContext, { VueContextConstructor } from "vue-context";
import { useStore } from "@/store/store";
import Caret from"@/components/Caret.vue";
import { AllFrameTypesIdentifier, CaretPosition, Position } from "@/types/types";
import { getCaretUIID, adjustContextMenuPosition, setContextMenuEventPageXY, CustomEventTypes } from "@/helpers/editor";
import { mapStores } from "pinia";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "CaretContainer",

    components: {
        Caret,
        VueContext,
    },

    props: {
        frameId: Number,
        caretVisibility: String, //Flag indicating this caret is visible or not
        caretAssignedPosition: {
            type: String as PropType<CaretPosition>,
        },
        isFrameDisabled: Boolean,
    },

    computed: {
        ...mapStores(useStore),
        
        isEditing(): boolean {
            return this.appStore.isEditing;
        },

        isInvisible(): boolean {
            // The caret is only visible when editing is off, 
            // and either one frame is currently selected 
            // OR a frame is hovered during drag & drop of frames
            return !(!this.isEditing && (this.caretVisibility === this.caretAssignedPosition || this.appStore.isDraggingFrame)); 
        },

        isStaticCaretContainer(): boolean {
            // Function definition frames are spaced, so we keep the caret container static (with the caret height) 
            // for such frames (meaning if there are more than 1 frame, all but last caret container should be static)
            const frameType = this.appStore.frameObjects[this.frameId].frameType.type;
            const parentFrame = this.appStore.frameObjects[this.appStore.frameObjects[this.frameId].parentId];
            return (frameType == AllFrameTypesIdentifier.funcdef && this.caretAssignedPosition == CaretPosition.below &&
             parentFrame.childrenIds.length > 1 && parentFrame.childrenIds.at(-1) != this.frameId);
        },

        // Needed in order to use the `CaretPosition` type in the v-show
        caretPosition(): typeof CaretPosition {
            return CaretPosition;
        },

        uiid(): string {
            return "caret_"+this.caretAssignedPosition+"_of_frame_"+this.frameId;
        },

        caretUIID(): string {
            return getCaretUIID(this.caretAssignedPosition, this.frameId);
        },

        pasteAvailable(): boolean {
            return this.appStore.isCopiedAvailable;
        },

        isCaretBlurred(): boolean {
            //if the frame isn't disabled, we never blur the caret. If the frame is disabled, then we check if frames can be added to decide if we blur or not.
            return this.isFrameDisabled && ((this.caretAssignedPosition ===  CaretPosition.below) ? !this.appStore.canAddFrameBelowDisabled(this.frameId) : true);
        },
    },

    mounted() {
        window.addEventListener("paste", this.pasteIfFocused);
    },

    destroyed() {
        window.removeEventListener("paste", this.pasteIfFocused);
    },

    updated() {
        // Ensure the caret (during navigation) is visible in the page viewport
        if(this.caretVisibility !== CaretPosition.none && this.caretVisibility === this.caretAssignedPosition) {
            const caretContainerElement = document.getElementById("caret_"+this.caretAssignedPosition+"_of_frame_"+this.frameId);
            const caretContainerEltRect = caretContainerElement?.getBoundingClientRect();
            //is caret outside the viewport?
            if(caretContainerEltRect && (caretContainerEltRect.bottom + caretContainerEltRect.height < 0 || caretContainerEltRect.top + caretContainerEltRect.height > document.documentElement.clientHeight)){
                caretContainerElement?.scrollIntoView({block:"center"});
            }
        }  
        
        // Close the context menu if there is edition or loss of blue caret (for when a frame context menu is present, see Frame.vue)
        if(this.isEditing || this.caretAssignedPosition == CaretPosition.none){
            ((this.$refs.menu as unknown) as VueContextConstructor).close();
        }        
    },
    
    methods: {
        pasteIfFocused() {
            // A paste via shortcut cannot get the verification that would be done via a click
            // so we check that 1) we are on the caret position that is currently selected and 2) that paste is allowed here
            if (!this.isEditing && this.caretVisibility !== CaretPosition.none && (this.caretVisibility === this.caretAssignedPosition) && this.pasteAvailable && this.appStore.isPasteAllowedAtFrame(this.frameId, this.caretAssignedPosition)) {
                //we need to update the context menu as if it had been shown
                this.appStore.contextMenuShownId = this.uiid;
                this.doPaste();
            }
        },

        handleClick (event: MouseEvent, positionForMenu?: Position): void {
            if(this.appStore.isContextMenuKeyboardShortcutUsed){
                // The logic for handling the context menu opened via a keyboard shortcut is handled by App
                return;
            }

            this.appStore.contextMenuShownId = this.uiid;

            if(this.pasteAvailable && this.appStore.isPasteAllowedAtFrame(this.frameId, this.caretAssignedPosition)) {  
                // Overwrite readonly properties pageX and set correct value
                setContextMenuEventPageXY(event, positionForMenu);
                ((this.$refs.menu as unknown) as VueContextConstructor).open(event);

                this.$nextTick(() => {
                    const contextMenu = document.getElementById(this.uiid);  
                    if(contextMenu){
                        // We make sure the menu can be shown completely. 
                        adjustContextMenuPosition(event, contextMenu, positionForMenu);
                    }
                });
            }
            //this.caretMenuOptions.push({name: this.$i18n.t("contextMenu.insert") as string, method: "showInsertFrameSubMenu", type: "submenu"});
        },

        handleContextMenuHover(event: MouseEvent) {
            this.$root.$emit(CustomEventTypes.contextMenuHovered, event.target as HTMLElement);
        },

        toggleCaret(): void {
            this.appStore.toggleCaret(
                {id:this.frameId, caretPosition: this.caretAssignedPosition}
            );
        },

        frameSelection(): void {
            this.appStore.shiftClickSelection(
                {clickedFrameId:this.frameId, clickedCaretPosition: this.caretAssignedPosition}
            );
        },

        paste(): void {
            // We check upon the context menu informations because a click could be generated on a hovered caret and we can't distinguish 
            // by any other mean which caret is the one the user clicked on.
            const currentShownContextMenuUUID: string = this.appStore.contextMenuShownId;
            if(currentShownContextMenuUUID === this.uiid){
                this.doPaste();
            }

            // The context menu doesn't close because we need to stop the click event propagation (cf. template), we do it here
            ((this.$refs.menu as unknown) as VueContextConstructor).close();
        },
        
        doPaste() : void {
            if(this.appStore.isSelectionCopied){
                this.appStore.pasteSelection(
                    {
                        clickedFrameId: this.frameId,
                        caretPosition: this.caretAssignedPosition,
                    }
                );
            }
            else {
                this.appStore.pasteFrame(
                    {
                        clickedFrameId: this.frameId,
                        caretPosition: this.caretAssignedPosition,
                    }
                );
            }
        },
    },
});

</script>

<style lang="scss">
.caret-container {
    padding-top: 0px;
    padding-bottom: 0px;
}

.static-caret-container{
    height: $caret-height;
}

.caret-container:hover{
    cursor: pointer;
}
</style>
