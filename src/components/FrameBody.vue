<template>
    <div 
        class="frame-body-container"
        v-on:click.self="toggleCaret()"
    >
        <Draggable
            v-model="frames"
            group="a"
            draggable=".frame"
            v-on:change="handleDragAndDrop($event)"
        >
            <Caret v-show="caretVisibility===caretPosition.body" />
            <Frame
                v-for="frame in frames"
                v-bind:key="frame.frameType.type  + '-id:' + frame.id"
                v-bind:id="frame.id"
                v-bind:frameType="frame.frameType"
                v-bind:isJointFrame="false"
                v-bind:caretVisibility="frame.caretVisibility"
                v-bind:allowChildren="frame.frameType.allowChildren"
                class="frame content-children"
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
import Caret from "@/components/Caret.vue";
import Draggable from "vuedraggable";
import { CaretPosition, FrameObject } from "@/types/types";


//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "FrameBody",
    store,

    components: {
        Frame,
        Draggable,
        Caret,
    },

    props: {
        frameId: Number,
        caretVisibility: String, //Flag indicating this caret is visible or not
    },

    computed: {
        frames: {
            // gets the frames objects which are nested in here (i.e. have this frameID as parent)
            get(): FrameObject[] {
                return store.getters.getFramesForParentId(this.$props.frameId);
            },
            // setter
            set(): void {
                // Nothing to be done here.
                // Event handlers call mutations which change the state
            },
        },

        // Needed in order to use the `CaretPosition` type in the v-show
        caretPosition(): typeof CaretPosition {
            return CaretPosition;
        }, 
    },

    methods: {
        handleDragAndDrop(event: Event): void {
            store.dispatch(
                "updateFramesOrder", 
                {
                    event: event,
                    eventParentId: this.$props.frameId,
                }
            );
        },

        toggleCaret(): void {
            store.dispatch(
                "toggleCaret",
                {id:this.frameId, caretPosition: CaretPosition.body}
            );
        },
    },
});
</script>

<style lang="scss">
.content-children {
    margin-left: 0px;
}

.frame-body-container {
    background-color: #FFF !important;
    // padding-bottom: 4px;
    padding-top: 4px;
    margin-bottom: 4px;
    margin-right: 0px;
    border: 0px;
    border-color: #000 !important;
}
</style>
