<template>
    <div class="frame-container" :style="frameStyle">
        <div class="frame-container-header">
            <button class="frame-container-btn-collapse" @click="toggleCollapse">{{collapseButtonLabel}}</button>
            <span class="frame-container-label-span" @click.self="toggleCollapse">{{containerLabel}}</span>
        </div>

        <!-- keep the tabindex attribute, it is necessary to handle focus properly -->
        <div :id="this.frameUIID" :style="containerStyle" class="container-frames" @click="onFrameContainerClick" tabindex="-1">
            <CaretContainer
                :frameId="this.frameId"
                :caretVisibility="this.caretVisibility"
                :caretAssignedPosition="caretPosition.body"
            />

            <Draggable
                v-model="frames" 
                :group="draggableGroup"
                @change.self="handleDragAndDrop($event)"
                @unchoose="showSelectedFrames()"
                forceFallback="true"
                :animation="300"
                swapThreshold = "0.2"
                :disabled="isEditing"
                :key="'Draggable-Container-'+this.frameId"
                :id="'Draggable-Container-'+this.frameId"
                @start ="handleMultiDrag"
                @end="multiDragEnd"
                :hasCommentsToMove="this.hasCommentsToMove"
                filter="input"
                :preventOnFilter="false"
                class="frame-container-minheight"
            >
                <Frame 
                    v-for="frame in frames" 
                    :ref="setFrameRef(frame.id)"
                    :key="frame.frameType.type + '-id:' + frame.id"
                    :frameId="frame.id"
                    :isDisabled="frame.isDisabled"
                    :frameType="frame.frameType"
                    :isJointFrame="false"
                    :allowChildren="frame.frameType.allowChildren"
                    :caretVisibility="frame.caretVisibility"
                />
            </Draggable>
        </div>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import Frame from "@/components/Frame.vue";
import CaretContainer from "@/components/CaretContainer.vue";
import { useStore } from "@/store/store";
import Draggable from "vuedraggable";
import { CaretPosition, FrameObject, DefaultFramesDefinition, FramesDefinitions, FrameContainersDefinitions, getFrameDefType, AllFrameTypesIdentifier } from "@/types/types";
import { mapStores } from "pinia";
import { getFrameUIID, handleDraggingCursor, notifyDragEnded, notifyDragStarted } from "@/helpers/editor";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "FrameContainer",

    components: {
        Frame,
        Draggable,
        CaretContainer,
    },

    data: function() {
        return {
            hasCommentsToMove: false,
        };
    },

    props: {
        frameId: Number,
        caretVisibility: String,
        containerLabel: String,
        frameType: {
            type: Object,
            default: () => DefaultFramesDefinition,
        }, //Type of the Frame  
    },

    computed: {
        ...mapStores(useStore),

        frameUIID(): string{
            return getFrameUIID(this.frameId);
        },
        
        frames: {
            get(): FrameObject[] {
                // gets the frames objects which are nested in here (i.e. have this frameID as parent)
                return this.appStore.getFramesForParentId(this.frameId);
            },
            set() {
                return;
            },    
        },

        draggableGroup(): Record<string, any> {
            return {
                name: this.appStore.getDraggableGroupById(this.frameId),
                put: function(to: any, from: any){
                    //Handle drag cursor
                    handleDraggingCursor(true, true);
                   
                    //Frames can be added if they are of the same group and/or only comments are being move
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

        frameStyle(): Record<string, string> {
            return {
                "background-color": `${
                    (this.frameType as FramesDefinitions).colour
                } !important`,
            };
        },

        id(): string {
            return "frameContainerId_" + this.frameId;
        },

        isCollapsed: {
            get(): boolean {
                return this.appStore.isContainerCollapsed(this.frameId);
            },
            set(value: boolean){
                this.appStore.setCollapseStatusContainer(
                    {
                        frameId: this.frameId,
                        isCollapsed: value,
                    }
                );
            },
        },

        collapseButtonLabel(): string {
            return (this.isCollapsed) ? "\u25B6" : "\u25BC";
        },

        containerStyle(): Record<string, string> {
            return {
                "display": (this.isCollapsed) ? "none" : "block",
                "backgroundColor": `${(this.frameType.type === FrameContainersDefinitions.ImportsContainerDefinition.type || this.frameType.type == FrameContainersDefinitions.FuncDefContainerDefinition.type) 
                    ? getFrameDefType(AllFrameTypesIdentifier.import).colour
                    : getFrameDefType(AllFrameTypesIdentifier.return).colour}`,
            };
        },
    },

    methods: {
        setFrameRef(frameId: number) {
            return getFrameUIID(frameId);
        },
        
        toggleCollapse(): void {
            this.isCollapsed = !this.isCollapsed;
        },
        
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
                    .find((frameId) => this.appStore.frameObjects[frameId].frameType.type !== AllFrameTypesIdentifier.comment) === undefined;
                
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

        onFrameContainerClick(): void  {
            // If there are no frames in this container, a click should toggle the caret of this container
            if(this.frames.length == 0){
                this.appStore.toggleCaret({id: this.frameId, caretPosition: CaretPosition.body});
            }
        },
    },
});

</script>

<style lang="scss">
.frame-container {
    margin-bottom: 5px;
    margin-left:10px;
}

.frame-container-btn-collapse {
    border-color: transparent;
    background-color: transparent;
    outline:none;
}

.frame-container-btn-collapse:focus {
    outline: none;
}

.frame-container-label-span {       
    margin-left: 5px;
    cursor:default;
    color: #274D19;
    font-weight: 600;
}

.container-frames {
    margin-left: 14px; // 1px less than for the right margin to wake the rendering neat
    margin-right: 15px;  
    margin-bottom: 15px;
    border-radius: 8px;
    border: 1px solid #B4B4B4;
    outline: none;
}

.frame-container-minheight {
    min-height: $frame-container-min-height;
}

</style>
