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
                :class="{'joint-frame-child': true, frame: (frame.frameType.draggableGroup===jointDraggableGroup)}"
            />
        </Draggable>
        
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import { useStore } from "@/store/store";
import Frame from "@/components/Frame.vue";
import Draggable from "vuedraggable";
import { FrameObject, DraggableGroupTypes } from "@/types/types";
import { mapStores } from "pinia";


//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "JointFrames",

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
        ...mapStores(useStore),
        
        jointFrames: {
            get(): FrameObject[]  {
                return this.appStore.getJointFramesForFrameId(
                    this.jointParentId,
                    "all"
                );
            },
            set() {
                return;
            },    
        },

        jointDraggableGroup(): DraggableGroupTypes {
            return this.appStore.getDraggableJointGroupById(this.jointParentId); 
        },

        isEditing(): boolean {
            return this.appStore.isEditing;
        },
    },

    methods: {
        handleDragAndDrop(event: any): void {
            const eventType = Object.keys(event)[0];
            const chosenFrame = event[eventType].element;

            // If the frame is part of a selection
            if(this.appStore.isFrameSelected(chosenFrame.id)) {
                this.appStore.moveSelectedFramesToPosition(
                    {
                        event: event,
                        parentId: this.jointParentId,
                    }
                );
            }
            else{
                this.appStore.updateFramesOrder(
                    {
                        event: event,
                        eventParentId: this.jointParentId,
                    }
                );
            }
        },
        
        handleMultiDrag(event: any): void {
            const chosenFrame = this.jointFrames[event.oldIndex];
            // If the frame is part of a selection
            if(this.appStore.isFrameSelected(chosenFrame.id)) {
                // Make it appear as the whole selection is being dragged
                this.appStore.prepareForMultiDrag(chosenFrame.id);
            }
        },   

        multiDragEnd(): void {
            this.appStore.removeMultiDragStyling();
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
