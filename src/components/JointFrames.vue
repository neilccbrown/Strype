<template>
    <div class="joint-frame-container">
        <Draggable 
            v-model="jointFrames"
            v-bind:group="jointDraggableGroup"
            @change.self="handleDragAndDrop($event)"
            animation="200"
            :disabled="isEditing"
            v-bind:key="'Draggagle-Joint-'+this.jointParentId"
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

        handleDragAndDrop(event: Event): void {
            store.dispatch(
                "updateFramesOrder", 
                {
                    event: event,
                    eventParentId: this.$props.jointParentId,
                }
            );
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
