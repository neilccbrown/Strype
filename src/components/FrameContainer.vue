<template>
    <div class="frame-container" :style="frameStyle">
        <div class="frame-container-header">
            <button class="frame-container-btn-collapse" @click="toggleCollapse">{{collapseButtonLabel}}</button>
            <span class="frame-container-label-span" @click.self="toggleCollapse">{{containerLabel}}</span>
        </div>

        <div :style="containerStyle" class="container-frames">
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
                :animation="300"
                swapThreshold = "0.2"
                :disabled="isEditing"
                :key="'Draggagle-Container-'+this.frameId"
                :id="'Draggagle-Container-'+this.frameId"
                @start ="handleMultiDrag($event)"
                @end="multiDragEnd()"
                :hasCommentsToMove="this.hasCommentsToMove"
                filter="input"
                :preventOnFilter="false"
            >
                <Frame 
                    v-for="frame in frames" 
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
import store from "@/store/store";
import Draggable from "vuedraggable";
import { CaretPosition, FrameObject, DefaultFramesDefinition, FramesDefinitions, Definitions, FrameContainersDefinitions, CommentDefinition } from "@/types/types";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "FrameContainer",
    store,

    components: {
        Frame,
        Draggable,
        CaretContainer,
    },

    data() {
        return {
            overCaret: false,
            hasCommentsToMove: false,
        }
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
        frames: {
            get(): FrameObject[] {
                // gets the frames objects which are nested in here (i.e. have this frameID as parent)
                return store.getters.getFramesForParentId(this.$props.frameId);
            },
            set() {
                return;
            },    
        },

        draggableGroup(): Record<string, any> {
            return {
                name: store.getters.getDraggableGroupById(this.$props.frameId),
                put: function(to: any, from: any){
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
            return store.getters.getIsEditing();
        },

        frameStyle(): Record<string, string> {
            return {
                "background-color": `${
                    (this.frameType as FramesDefinitions).colour
                } !important`,
            };
        },

        id(): string {
            return "frameContainerId_" + this.$props.frameId;
        },

        isCollapsed: {
            get(): boolean {
                return store.getters.getContainerCollapsed(this.frameId);
            },
            set(value: boolean){
                store.commit(
                    "setCollapseStatusContainer",
                    {
                        frameId: this.frameId,
                        isCollapsed: value,
                    }
                )
            },
        },

        collapseButtonLabel(): string {
            return (this.isCollapsed) ? "\u25B6" : "\u25BC";
        },

        containerStyle(): Record<string, string> {
            return {
                "display": (this.isCollapsed) ? "none" : "block",
                "backgroundColor": `${(this.frameType === FrameContainersDefinitions.ImportsContainerDefinition) 
                    ? Definitions.ImportDefinition.colour
                    : (this.frameType === FrameContainersDefinitions.FuncDefContainerDefinition)
                        ? Definitions.FuncDefDefinition.colour
                        : Definitions.ReturnDefinition.colour}`,
            };
        },
    },

    methods: {
        toggleCollapse(): void {
            this.isCollapsed = !this.isCollapsed;
        },
        
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

        multiDragEnd(): void {
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
    margin-left: 15px;
    margin-right: 15px;  
    margin-bottom: 15px;
    border-radius: 8px;
    border: 1px solid #B4B4B4;
}

</style>
