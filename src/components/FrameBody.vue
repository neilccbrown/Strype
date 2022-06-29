<template>
    <div
        :class="{'frame-body-container frame-container-minheight':true, error: empty, 'body-deletable': bodyDeletable}"
        :id="uiid"
    >
        <div>
            <CaretContainer
            :id="uiid+'_caret_container'"
            :frameId="this.frameId"
            :caretVisibility="this.caretVisibility"
            :caretAssignedPosition="caretPosition.body"
            :isFrameDisabled="this.isDisabled"
            />        
            <Draggable
                v-model="frames"
                :group="draggableGroup"
                @change.self="handleDragAndDrop($event)"
                @unchoose="showSelectedFrames()"
                forceFallback="true"
                animation= "200"
                swapThreshold = "0.2"
                :disabled="isEditing"
                :key="'Draggable-Body-'+this.frameId"
                @start="handleMultiDrag"
                @end="multiDragEnd"
                :hasCommentsToMove="this.hasCommentsToMove"
                filter="input"
                :preventOnFilter="false"
                class="frame-container-minheight"
            >
                <Frame
                    v-for="frame in frames"
                    :key="frame.frameType.type  + '-id:' + frame.id"
                    :frameId="frame.id"
                    :isDisabled="frame.isDisabled"
                    :frameType="frame.frameType"
                    :isJointFrame="false"
                    :caretVisibility="frame.caretVisibility"
                    :allowChildren="frame.frameType.allowChildren"
                    class="frame content-children"
                />
            </Draggable>
            <b-popover
                v-if="empty && !isDraggingFrame"
                :target="uiid"
                :title="this.$i18n.t('errorMessage.errorTitle')"
                triggers="hover focus"
                placement="left"
                :content="errorMessage"
            ></b-popover>
        </div>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import { useStore } from "@/store/store";
import Frame from "@/components/Frame.vue";
import CaretContainer from "@/components/CaretContainer.vue";
import Draggable from "vuedraggable";
import { AllFrameTypesIdentifier, CaretPosition, DraggableGroupTypes, FrameObject } from "@/types/types";
import { mapStores } from "pinia";
import { getFrameBodyUIID, handleDraggingCursor, notifyDragEnded, notifyDragStarted } from "@/helpers/editor";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "FrameBody",

    components: {
        Frame,
        Draggable,
        CaretContainer,
    },
    
    props: {
        frameId: Number,
        isDisabled: Boolean,
        caretVisibility: String, //Flag indicating this caret is visible or not
    },

    data: function() {
        return{ 
            hasCommentsToMove: false,
        }
    },

    computed: {
        ...mapStores(useStore),
        
        frames: {
            get(): FrameObject[] {
                // gets the frames objects which are nested in here (i.e. have this frameID as parent)
                return this.appStore.getFramesForParentId(this.frameId);
            },
            set() {
                return;
            },    
        },

        hasDisabledOrCommentFrames(): boolean {
            return (this.frames).filter((frame) => frame.isDisabled || frame.frameType.type === AllFrameTypesIdentifier.comment).length > 0;
        },

        draggableGroup(): Record<string, any> {
            return {
                name: DraggableGroupTypes.code,
                put: function(to: any, from: any){
                    //Handle the drag cursor
                    handleDraggingCursor(true, true);

                    //Frames can be added if they are of the same group and/or only comments are being moved
                    return from.options.hasCommentsToMove || to.options.group.name === from.options.group.name;
                },
            };      
        },

        // Needed in order to use the `CaretPosition` type in the v-show
        caretPosition(): typeof CaretPosition {
            return CaretPosition;
        }, 

        isEditing(): boolean {
            return this.appStore.isEditing;
        },

        uiid(): string {
            return getFrameBodyUIID(this.frameId);
        },

        empty(): boolean {
            let empty = false;
            const currentFrameId = this.appStore.currentFrame.id;
            //check if there are at least 1 frame, NOT disabled, and that we are not inside that frame body
            if(!this.isDisabled && (this.frames).filter((frame) => !frame.isDisabled && frame.frameType.type !== AllFrameTypesIdentifier.comment).length < 1 &&  !(this.caretVisibility === this.caretPosition.body && this.frameId===currentFrameId)) {
                empty = true;
                this.appStore.addPreCompileErrors(this.uiid);                
            }
            else {
                this.appStore.removePreCompileErrors(this.uiid);
            }
            return empty;
        },

        errorMessage(): string {
            return (this.hasDisabledOrCommentFrames) 
                ? this.$i18n.t("errorMessage.noValidChildFrameBody") as string 
                : this.$i18n.t("errorMessage.emptyFrameBody") as string;
        },

        isDraggingFrame(): boolean{
            return this.appStore.isDraggingFrame;
        },

        bodyDeletable(): boolean{
            // We need to get the body background at the deletable colour only if this frame is deletable
            // and we are not deleting the outer frames
            if(this.appStore.potentialDeleteFrameIds){
                return this.appStore.potentialDeleteFrameIds.includes(this.frameId) 
                    && !this.appStore.potentialDeleteIsOuter; 
            }
            // For compatibility with previous versions of the store
            return false;                       
        },
    },

    beforeDestroy() {
        this.appStore.removePreCompileErrors(this.uiid);
    },

    methods: {
        handleDragAndDrop(event: any): void {
            const eventType = Object.keys(event)[0];
            const chosenFrame = event[eventType].element;

            // If the frame is part of a selection
            if(this.appStore.isFrameSelected(chosenFrame.id)) {
                //If the move can happen
                this.appStore.moveSelectedFramesToPosition(
                    {
                        event: event,
                        parentId: this.frameId,
                    }
                );
            }
            else{
                this.appStore.updateFramesOrder(
                    {
                        event: event,
                        eventParentId: this.frameId,
                    }
                );
            }
        },
        
        handleMultiDrag(event: any): void {
            const chosenFrame = this.frames[event.oldIndex];

            // If the frame is part of a selection
            if(this.appStore.isFrameSelected(chosenFrame.id)) {
                //update the property indicating if dragging the frames in another container is allowed: 
                //we check that all the selected frames are comments (otherwise moving frames isn't allowed outside a different container group)
                this.hasCommentsToMove = this.appStore.selectedFrames
                    .find((frameId) => this.appStore.frameObjects[frameId].frameType.type !== AllFrameTypesIdentifier.comment) === undefined
                
                // Notify the start of a drag and drop
                notifyDragStarted();

                // Make it appear as the whole selection is being dragged
                this.appStore.prepareForMultiDrag(chosenFrame.id);
            }
            else{
                //update the property indicating if dragging the frame in another container is allowed: 
                //we check that the moving frame is a comment
                this.hasCommentsToMove = (chosenFrame.frameType.type === AllFrameTypesIdentifier.comment);
                 
                // Notify the start of a drag and drop for a particular frame
                notifyDragStarted(chosenFrame.id);
            }
        },   

        multiDragEnd(event: any): void {
            this.appStore.removeMultiDragStyling();

            // Notify the end of a drag and drop
            notifyDragEnded(event.clone);
        },   

        // Some times, when draging and droping in the original position of where the
        // selected frames were taken, the `change` event is not fired; hence you need to
        // catch the `unchoose` event
        showSelectedFrames(): void {
            this.appStore.makeSelectedFramesVisible();
        },
    },
});
</script>

<style lang="scss">
.content-children {
    margin-left: 0px;
}

.frame-body-container {
    background-color: #F6F2E9;
    margin-bottom: 4px;
    margin-top: 4px;
    margin-right: 4px;
    border-color: #000 !important;
    border-radius: 8px;
}

.error {
    border: 2px solid #d66 !important;
}

.body-deletable {
    background-color: transparent !important;
}
</style>
