<template>
    <div class="joint-frame-container">
        <Draggable 
            v-model="jointFrames"
            :group="jointDraggableGroup"
            @change.self="handleDragAndDrop($event)"
            animation="200"
            swapThreshold = "0.2"
            :disabled="isEditing"
            :key="'Draggagle-Joint-'+this.jointParentId"
            @start="handleMultiDrag($event)"
            @end="multiDragEnd()"
        >
            <Frame
                v-for="frame in jointFrames"
                :key="frame.frameType.type + '-id:' + frame.id"
                :frameId="frame.id"
                :isDisabled="frame.isDisabled || isDisabled"
                :frameType="frame.frameType"
                :isJointFrame="true"
                :isParentSelected="isParentSelected"
                :allowChildren="frame.frameType.allowChildren"
                :caretVisibility="frame.caretVisibility"
                :class="{frame: (frame.frameType.draggableGroup===jointDraggableGroup)}"
                class="joint-frame-child"
            />
        </Draggable>
        
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import store from "@/store/store";
import Frame from "@/components/Frame.vue";
import Draggable from "vuedraggable";
import { FrameObject, DraggableGroupTypes } from "@/types/types";


//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "JointFrames",
    store,

    components: {
        Frame,
        Draggable,
    },

    props: {
        // NOTE that type declarations here start with a Capital Letter!!! (different to types.ts!)
        jointParentId: Number, // Unique Indentifier for each Frame
        isDisabled: Boolean,
        isParentSelected: Boolean,
    },

    computed: {
    
        jointFrames: {
            get(): FrameObject[]  {
                return store.getters.getJointFramesForFrameId(
                    this.$props.jointParentId,
                    "all"
                );
            },
            set() {
                return;
            },    
        },

        jointDraggableGroup(): DraggableGroupTypes {
            return store.getters.getDraggableJointGroupById(this.$props.jointParentId); 
        },

        isEditing(): boolean {
            return store.getters.getIsEditing();
        },
    },

    methods: {

        handleDragAndDrop(event: any): void {
            const eventType = Object.keys(event)[0];
            const chosenFrame = event[eventType].element;

            // If the frame is part of a selection
            if(store.getters.isFrameSelected(chosenFrame.id)) {

                store.dispatch(
                    "moveSelectedFramesToPosition",
                    {
                        event: event,
                        parentId: this.$props.jointParentId,
                    }
                );
            }
            else{
                store.dispatch(
                    "updateFramesOrder",
                    {
                        event: event,
                        eventParentId: this.$props.jointParentId,
                    }
                );
            }
        },
        
        handleMultiDrag(event: any): void {
            const chosenFrame = this.jointFrames[event.oldIndex];
            // If the frame is part of a selection
            if(store.getters.isFrameSelected(chosenFrame.id)) {
                // Make it appear as the whole selection is being dragged
                store.dispatch("prepareForMultiDrag",chosenFrame.id);
            }
        },   

        multiDragEnd(): void {
            store.commit("removeMultiDragStyling");
        },   

    },

});
</script>

<style lang="scss">
.content-children {
    margin-left: 0px;
}

.joint-frame-container {
    visibility: visible;
}
.joint-frame-child {
    visibility: visible;
}

</style>
