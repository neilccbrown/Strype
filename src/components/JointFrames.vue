<template>
    <div class="joint-frame-container">
        <Draggable 
            v-model="draggableJointFrames"
            :group="jointDraggableGroup"
            v-on:change.self="handleDragAndDrop($event)"
            animation="200"
            v-bind:key="'Draggagle-Joint-'+this.jointParentId"
            draggable=".frame"
        >
            <Frame
                v-for="frame in draggableJointFrames"
                v-bind:key="frame.frameType.type + '-id:' + frame.id"
                v-bind:id="frame.id"
                v-bind:frameType="frame.frameType"
                v-bind:isJointFrame="true"
                v-bind:allowChildren="frame.frameType.allowChildren"
                v-bind:caretVisibility="frame.caretVisibility"
                class="frame joint-frame-child"
            />
        </Draggable>
        <Frame
            v-for="frame in staticJointFrames"
            v-bind:key="frame.frameType.type + '-id:' + frame.id"
            v-bind:id="frame.id"
            v-bind:frameType="frame.frameType"
            v-bind:isJointFrame="true"
            v-bind:allowChildren="frame.frameType.allowChildren"
            v-bind:caretVisibility="frame.caretVisibility"
            class="frame joint-frame-child"
        />  
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
    },

    computed: {

        draggableJointFrames: {
            get(): FrameObject[] {
                return store.getters.getJointFramesForFrameId(
                    this.$props.jointParentId,
                    "draggable"
                )
            },
            // setter
            set(): void {
                // Nothing to be done here.
                // Event handlers call mutations which change the state
            },
        },

        staticJointFrames: {
            get(): FrameObject[] {
                return store.getters.getJointFramesForFrameId(
                    this.$props.jointParentId,
                    "static"
                )
            },
            // setter
            set(): void {
                // Nothing to be done here.
                // Event handlers call mutations which change the state
            },
        },

        jointDraggableGroup(): DraggableGroupTypes {
            return store.getters.getDraggableJointGroupById(this.$props.jointParentId); 
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
