<template>
    <div
        class="frame-body-container"
        :class="{error: empty}"
        :id="uiid"
    >
        <div>
            <CaretContainer
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
                animation= "200"
                swapThreshold = "0.2"
                :disabled="isEditing"
                :key="'Draggagle-Body-'+this.frameId"
                @start="handleMultiDrag($event)"
                @end="multiDragEnd($event)"
                :hasCommentsToMove="this.hasCommentsToMove"
                filter="input"
                :preventOnFilter="false"
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
                v-if="empty"
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
import store from "@/store/store";
import Frame from "@/components/Frame.vue";
import CaretContainer from "@/components/CaretContainer.vue";
import Draggable from "vuedraggable";
import { CaretPosition, CommentDefinition, DraggableGroupTypes, FrameObject } from "@/types/types";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "FrameBody",
    store,

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

    data() {
        return{ 
            hasCommentsToMove: false,
        }
    },

    computed: {
        frames: {
            get(): FrameObject[] {
                // gets the frames objects which are nested in here (i.e. have this frameID as parent)
                return store.getters.getFramesForParentId(this.$props.frameId);
            },
            set() {
                return;
            },    
        },

        hasDisabledOrCommentFrames(): boolean {
            return (this.frames).filter((frame) => frame.isDisabled || frame.frameType.type === CommentDefinition.type).length > 0;
        },

        draggableGroup(): Record<string, any> {
            return {
                name: DraggableGroupTypes.code,
                put: function(to: any, from: any){
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
            return store.getters.getIsEditing();
        },

        uiid(): string {
            return "frameBodyId_" + this.$props.frameId;
        },

        empty(): boolean {
            let empty = false;
            //check if there are at least 1 frame, NOT disabled
            if(!this.isDisabled && (this.frames).filter((frame) => !frame.isDisabled && frame.frameType.type !== CommentDefinition.type).length < 1 && this.caretVisibility !== this.caretPosition.body) {
                empty = true;
                store.commit("addPreCompileErrors", {id: this.uiid, errorMsg: this.$i18n.t("errorMessage.emptyEditableSlot")});                
            }
            else {
                store.commit("removePreCompileErrors",this.uiid);
            }
            return empty;
        },

        errorMessage(): string {
            return (this.hasDisabledOrCommentFrames) 
                ? this.$i18n.t("errorMessage.noValidChildFrameBody") as string 
                : this.$i18n.t("errorMessage.emptyFrameBody") as string;
        },

    },

    beforeDestroy() {
        store.commit("removePreCompileErrors",this.uiid);
    },

    methods: {
        handleDragAndDrop(event: any): void {
            const eventType = Object.keys(event)[0];
            const chosenFrame = event[eventType].element;

            // If the frame is part of a selection
            if(store.getters.isFrameSelected(chosenFrame.id)) {
                //If the move can happen
                store.dispatch(
                    "moveSelectedFramesToPosition",
                    {
                        event: event,
                        parentId: this.$props.frameId,
                    }
                );
            }
            else{
                store.dispatch(
                    "updateFramesOrder",
                    {
                        event: event,
                        eventParentId: this.$props.frameId,
                    }
                );
            }
        },
        
        handleMultiDrag(event: any): void {
            const chosenFrame = this.frames[event.oldIndex];

            // If the frame is part of a selection
            if(store.getters.isFrameSelected(chosenFrame.id)) {
                //update the property indicating if dragging the frames in another container is allowed: 
                //we check that all the selected frames are comments (otherwise moving frames isn't allowed outside a different container group)
                this.$data.hasCommentsToMove = (store.getters.getSelectedFrameIds() as number[])
                    .find((frameId) => store.getters.getFrameObjectFromId(frameId).frameType.type !== CommentDefinition.type) === undefined
                
                // Make it appear as the whole selection is being dragged
                store.dispatch("prepareForMultiDrag",chosenFrame.id);
            }
            else{
                //update the property indicating if dragging the frame in another container is allowed: 
                //we check that the moving frame is a comment
                this.$data.hasCommentsToMove = (chosenFrame.frameType.type === CommentDefinition.type);
            }
        },   

        multiDragEnd(event: any): void {
            store.commit("removeMultiDragStyling");
        },   


        // Some times, when draging and droping in the original position of where the
        // selected frames were taken, the `change` event is not fired; hence you need to
        // catch the `unchoose` event
        showSelectedFrames(): void {
            store.commit("makeSelectedFramesVisible");
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
    margin-right: 0px;
    margin-left: 12px;
    border-color: #000 !important;
    border-radius: 8px;

}

.error {
    border: 1px solid #d66 !important;
}

</style>
