<template>
    <div class="joint-frame-container">
        <Draggable 
            v-model="jointFrames"
            v-bind:group="jointDraggableGroup"
            @change.self="handleDragAndDrop($event)"
            animation="200"
            :disabled="isEditing"
            v-bind:key="'Draggagle-Joint-'+this.jointParentId"
            @start="handleMultiDrag($event)"
        >
            <Frame
                v-for="frame in jointFrames"
                v-bind:key="frame.frameType.type + '-id:' + frame.id"
                v-bind:frameId="frame.id"
                v-bind:isDisabled="frame.isDisabled || isDisabled"
                v-bind:frameType="frame.frameType"
                v-bind:isJointFrame="true"
                v-bind:isParentSelected="isParentSelected"
                v-bind:allowChildren="frame.frameType.allowChildren"
                v-bind:caretVisibility="frame.caretVisibility"
                v-bind:class="{frame: (frame.frameType.draggableGroup===jointDraggableGroup)}"
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
import { FrameObject, DraggableGroupTypes , CaretPosition} from "@/types/types";


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

        handleDragAndDrop(event: Event): void {
            const eventType = Object.keys(event)[0];
            const chosenFrame = event[eventType].element;

            // If the frame is part of a selection
            if(store.getters.getIsSelected(chosenFrame.id)) {

                // The frame that we'll go under needs to be given as an input to `getIfPositionAllowsSelectedFrames`
                // However, if we are moving to the same parent, we need to find the frame we are going under
                // taking into account that its index will change. E.G. we have frames A,B,C,D and we
                // are moving A,B under D. D's index is 3 (becuase A & B have not been removed),
                // but it should be given as 2, because A & B are to be removed.

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
        
        handleMultiDrag(event: Event): void {
            const chosenFrame = this.jointFrames[event.oldIndex];
            // If the frame is part of a selection
            if(store.getters.getIsSelected(chosenFrame.id)) {
                // Make it appear as the whole selection is being dragged
                store.dispatch("prepareForMultiDrag",chosenFrame.id);
            }
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

// .selected {
//     border-left: 3px solid red !important;
//     border-right: 3px solid red !important;
// }
</style>
