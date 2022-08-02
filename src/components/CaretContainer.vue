<template>
    <div 
        class="caret-container"
        @click.exact.prevent.stop="toggleCaret()"
        @click.shift.exact.prevent.stop="frameSelection()"
        @contextmenu.prevent.stop="handleClick($event, 'paste')"
        :key="uiid"
        :id="uiid"
    >
        <vue-simple-context-menu
            v-show="allowContextMenu"
            :elementId="uiid+'_pasteContextMenu'"
            :options="pasteOption"
            :ref="'pasteContextMenu'"
            @option-clicked="optionClicked"
        />
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
import { useStore } from "@/store/store";
import Caret from"@/components/Caret.vue";
import { CaretPosition, FrameObject } from "@/types/types";
import VueSimpleContextMenu, {VueSimpleContextMenuConstructor} from "vue-simple-context-menu";
import $ from "jquery";
import { getCaretUIID, getEditorMiddleUIID } from "@/helpers/editor";
import { mapStores } from "pinia";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "CaretContainer",

    components: {
        Caret,
        VueSimpleContextMenu,
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
            return !(!this.isEditing && (this.caretVisibility === this.caretAssignedPosition || this.appStore.isDraggingFrame) ); 
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
        pasteOption(): Record<string, string>[] {
            return this.pasteAvailable? [{name: this.$i18n.t("contextMenu.paste") as string, method: "paste"}] : [{}];
        },
        allowContextMenu(): boolean {
            return this.appStore.contextMenuShownId === this.uiid; 
        },
        isCaretBlurred(): boolean {
            //if the frame isn't disabled, we never blur the caret. If the frame is disabled, then we check if frames can be added to decide if we blur or not.
            return this.isFrameDisabled && ((this.caretAssignedPosition ===  CaretPosition.below) ? !this.appStore.canAddFrameBelowDisabled(this.frameId) : true);
        },
    },

    mounted() {
        window.addEventListener("keyup", this.onKeyUp);
    },

    destroyed() {
        window.removeEventListener("keyup", this.onKeyUp)
    },

    updated() {
        // Ensure the caret (during navigation) is visible in the page viewport
        if(this.caretVisibility !== CaretPosition.none && this.caretVisibility === this.caretAssignedPosition) {
            const caretContainerEltRect = document.getElementById("caret_"+this.caretAssignedPosition+"_of_frame_"+this.frameId)?.getBoundingClientRect();
            //is caret outside the viewport?
            if(caretContainerEltRect && (caretContainerEltRect.bottom + caretContainerEltRect.height < 0 || caretContainerEltRect.top + caretContainerEltRect.height > document.documentElement.clientHeight)){
                //scroll the UI up/down depending on the direction we're going
                const scrollStep = (caretContainerEltRect.top + caretContainerEltRect.height > document.documentElement.clientHeight) ? 50 : -50;
                const currentScroll = $("#"+getEditorMiddleUIID()).scrollTop();
                $("#"+getEditorMiddleUIID()).scrollTop((currentScroll??0) + scrollStep);
            }
        }        
    },
    
    methods: {
        onKeyUp(event: KeyboardEvent) {
            if(!this.isEditing && (event.ctrlKey || event.metaKey) && (event.key === "v")) {
                // A paste via shortcut cannot get the verification that would be done via a click
                // so we check that 1) we are on the caret position that is currently selected and 2) that paste is allowed here
                const currentFrame: FrameObject = this.appStore.getCurrentFrameObject;
                if(currentFrame.id === this.frameId && currentFrame.caretVisibility === this.caretAssignedPosition && this.pasteAvailable && this.appStore.isPasteAllowedAtFrame(this.frameId, this.caretAssignedPosition)) { 
                    //we need to update the context menu as if it had been shown
                    this.appStore.contextMenuShownId = this.uiid;
                    this.paste();
                    event.stopImmediatePropagation();
                }
                event.preventDefault();
                return;
            }
        },

        handleClick (event: MouseEvent): void {
            this.appStore.contextMenuShownId = this.uiid;
            if(this.pasteAvailable && this.appStore.isPasteAllowedAtFrame(this.frameId, this.caretAssignedPosition)) {  
                ((this.$refs.pasteContextMenu as unknown) as VueSimpleContextMenuConstructor).showMenu(event);
            }
        },

        // Item is passed anyway in the event, in case the menu is attached to a list
        optionClicked (event: {item: any; option: {name: string; method: string}}): void {
            // `event.option.method` holds the name of the method to be called.
            // In case the menu gets more complex this can clear up the code. However, it is a bit unsafe - in the case you
            // misstype a method's name.
            const thisCompProps = Object.entries(this).find((entry) => entry[0] === event.option.method);
            if(thisCompProps){
                thisCompProps[1]();
            }
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

.caret-container:hover{
    cursor: pointer;
}
</style>