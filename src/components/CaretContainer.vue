<template>
    <div 
        :class="{'caret-container': true, 'static-caret-container': isStaticCaretContainer}"
        @click.exact.prevent.stop="toggleCaret()"
        @contextmenu.prevent.stop="handleClick($event)"
        :key="uiid"
        :id="uiid"
    >
        <!-- Make sure the click events are stopped in the links because otherwise, events pass through and mess the toggle of the caret in the editor.
             Also, the element MUST have the hover event handled for proper styling (we want hovering and selecting to go together) -->
        <vue-context ref="menu" @close="appStore.isContextMenuKeyboardShortcutUsed=false">
            <li><a v-if="showPasteMenuItem" @click.stop="paste(); closeContextMenu()" @mouseover="handleContextMenuHover">{{$i18n.t("contextMenu.paste")}}</a></li>
            <li><hr v-if="showPasteMenuItem" /></li>
            <li class="v-context__sub">
                <a @click.stop @mouseover="handleContextMenuHover">{{$i18n.t("contextMenu.insert")}}</a>
                <ul class="v-context">
                    <li v-for="menuItem, index in insertFrameMenuItems" :key="`caretContextMenuItem_${frameId}_${index}`">
                        <a @click.stop="menuItem.method();closeContextMenu();" @mouseover="handleContextMenuHover">{{menuItem.name}}</a>
                    </li>
                </ul>
            </li>
        </vue-context>
        <Caret
            :class="{navigationPosition: true, caret:!this.appStore.isDraggingFrame}"
            :id="caretUIID"
            :isInvisible="isInvisible"
            :isTransparentForDnD="isTransparentForDnD"
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
import {AllFrameTypesIdentifier, CaretPosition, Position, MessageDefinitions, FormattedMessage, FormattedMessageArgKeyValuePlaceholders, PythonExecRunningState} from "@/types/types";
import { getCaretUIID, adjustContextMenuPosition, setContextMenuEventClientXY, getAddFrameCmdElementUIID, CustomEventTypes } from "@/helpers/editor";
import { mapStores } from "pinia";
import { copyFramesFromParsedPython } from "@/helpers/pythonToFrames";
import { cloneDeep } from "lodash";

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
            return !(!this.isEditing && (this.caretVisibility === this.caretAssignedPosition || this.caretVisibility == CaretPosition.dragAndDrop) || this.appStore.isDraggingFrame); 
        },

        isTransparentForDnD(): boolean {
            return (this.caretVisibility == CaretPosition.dragAndDrop);
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

        isPythonExecuting(): boolean {
            return (this.appStore.pythonExecRunningState ?? PythonExecRunningState.NotRunning) != PythonExecRunningState.NotRunning;
        },

        pasteAvailable(): boolean {
            return this.appStore.isCopiedAvailable;
        },

        isCaretBlurred(): boolean {
            //if the frame isn't disabled, we never blur the caret. If the frame is disabled, then we check if frames can be added to decide if we blur or not.
            return this.isFrameDisabled && ((this.caretAssignedPosition ===  CaretPosition.below) ? !this.appStore.canAddFrameBelowDisabled(this.frameId) : true);
        },
    },

    data: function () {
        return {
            showPasteMenuItem: false,
            insertFrameMenuItems: [] as {name: string, method: VoidFunction}[],
        };
    },

    mounted() {
        window.addEventListener("paste", this.pasteIfFocused);
        // When a frame is added, we need to make sure it will be visible in the view port. This is particularly true
        // when a paste or duplicate action is performed.
        this.putCaretContainerInView();
    },

    destroyed() {
        window.removeEventListener("paste", this.pasteIfFocused);
    },

    updated() {
        // Ensure the caret (during navigation) is visible in the page viewport
        this.putCaretContainerInView();
        
        // Close the context menu if there is edition or loss of blue caret (for when a frame context menu is present, see Frame.vue)
        if(this.isEditing || this.caretAssignedPosition == CaretPosition.none || this.caretAssignedPosition == CaretPosition.dragAndDrop){
            ((this.$refs.menu as unknown) as VueContextConstructor).close();
        }        
    },
    
    methods: {
        putCaretContainerInView(){
            if(this.caretVisibility !== CaretPosition.none  && this.caretVisibility != CaretPosition.dragAndDrop && this.caretVisibility === this.caretAssignedPosition) {
                const caretContainerElement = document.getElementById("caret_"+this.caretAssignedPosition+"_of_frame_"+this.frameId);
                const caretContainerEltRect = caretContainerElement?.getBoundingClientRect();
                //is caret outside the viewport? if so, scroll into view (we need to wait a bit for the UI to be ready before we can perform the scroll)
                if(caretContainerEltRect && (caretContainerEltRect.bottom + caretContainerEltRect.height < 0 || caretContainerEltRect.top + caretContainerEltRect.height > document.documentElement.clientHeight)){
                    setTimeout(() => caretContainerElement?.scrollIntoView({block:"nearest"}), 100);
                }
            }  
        },

        pasteIfFocused(event: Event) {
            // A paste via shortcut cannot get the verification that would be done via a click
            // so we check that 1) we are on the caret position that is currently selected and 2) that paste is allowed here.
            // We should know the action is about pasting frames or text if some text is present in the clipboard (we clear it when copying frames)
            if (!this.isPythonExecuting && !this.isEditing && this.caretVisibility !== CaretPosition.none && (this.caretVisibility === this.caretAssignedPosition)) {
                const pythonCode = (event as ClipboardEvent).clipboardData?.getData("text");
                if (this.pasteAvailable && (pythonCode == undefined || pythonCode.trim().length == 0)) {
                    // We check if pasting frames is possible here, if not, show a message.
                    //we need to update the context menu as if it had been shown
                    const isPasteAllowedAtFrame = this.appStore.isPasteAllowedAtFrame(this.frameId, this.caretAssignedPosition);
                    if(isPasteAllowedAtFrame){
                        this.appStore.contextMenuShownId = this.uiid;
                        this.doPaste();
                    }
                    else{
                        this.appStore.showMessage(MessageDefinitions.ForbiddenFramePaste, 3000);
                        return;
                    }
                }
                else {
                    // Note we don't permanently trim the code because we need to preserve leading indent.
                    // But we trim for the purposes of checking if there's any content at all:
                    if (pythonCode?.trim()) {
                        const error = copyFramesFromParsedPython(pythonCode);
                        if (error) {
                            useStore().currentMessage = cloneDeep(MessageDefinitions.InvalidPythonParsePaste);
                            const msgObj = useStore().currentMessage.message as FormattedMessage;
                            msgObj.args[FormattedMessageArgKeyValuePlaceholders.error.key] = msgObj.args.errorMsg.replace(FormattedMessageArgKeyValuePlaceholders.error.placeholderName, error);

                            //don't leave the message for ever
                            setTimeout(() => useStore().currentMessage = MessageDefinitions.NoMessage, 5000);
                        }
                        else {
                            this.doPaste();
                        }
                    }
                    // Must take ourselves off the clipboard after:
                    useStore().copiedFrames = {};
                    useStore().copiedSelectionFrameIds = [];
                }
            }
        },

        closeContextMenu() {
            // The context menu doesn't close because we need to stop the click event propagation (cf. template), we do it here
            ((this.$refs.menu as unknown) as VueContextConstructor).close();
        },

        handleClick (event: MouseEvent, positionForMenu?: Position): void {
            // Do not show any menu if the user's code is being executed
            if(this.isPythonExecuting){
                return;
            }
            
            if(this.appStore.isContextMenuKeyboardShortcutUsed){
                // The logic for handling the context menu opened via a keyboard shortcut is handled by App
                return;
            }

            this.appStore.contextMenuShownId = this.uiid;

            this.showPasteMenuItem = this.pasteAvailable && this.appStore.isPasteAllowedAtFrame(this.frameId, this.caretAssignedPosition);
            this.prepareInsertFrameSubMenu();

            // Overwrite readonly properties clientX and clientY (to position the menu if needed)
            setContextMenuEventClientXY(event, positionForMenu);
            ((this.$refs.menu as unknown) as VueContextConstructor).open(event);

            this.$nextTick(() => {
                const contextMenu = document.getElementById(this.uiid);  
                if(contextMenu){
                    // We make sure the menu can be shown completely. 
                    adjustContextMenuPosition(event, contextMenu, positionForMenu);
                }
            });           
        },

        handleContextMenuHover(event: MouseEvent) {
            this.$root.$emit(CustomEventTypes.contextMenuHovered, event.target as HTMLElement);
        },

        toggleCaret(): void {
            this.appStore.toggleCaret(
                {id:this.frameId, caretPosition: this.caretAssignedPosition}
            );
        },

        paste(): void {
            // We check upon the context menu informations because a click could be generated on a hovered caret and we can't distinguish 
            // by any other mean which caret is the one the user clicked on.
            const currentShownContextMenuUUID: string = this.appStore.contextMenuShownId;
            if(currentShownContextMenuUUID === this.uiid){
                this.doPaste();
            }
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
    
        prepareInsertFrameSubMenu(): void {
            // The list of frames we can insert depends on the current position, therefore, the submenu options are constructed dynamically
            // for that specific position we're at.
            this.insertFrameMenuItems = [];
            const addFrameCommands = this.appStore.generateAvailableFrameCommands(this.appStore.currentFrame.id, this.appStore.currentFrame.caretPosition);
            Object.values(addFrameCommands).forEach((addFrameCmdDef) => {
                this.insertFrameMenuItems.push({name: addFrameCmdDef[0].description, method: () => {
                    // This method is called by the submenu and it triggers a click on the AddFrameCommand component,
                    // but we delay it enough so the chain of key events (if applicable) related to the menu terminates,
                    // because otherwise that chain and the key event chain from adding a frame interfer.
                    setTimeout(() => document.getElementById(getAddFrameCmdElementUIID(addFrameCmdDef[0].type.type))?.click(), 250);
                }});
            });
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
