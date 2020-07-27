<template>
    <Draggable
        v-model="frames"
        group="a"
        draggable=".frame"
        v-on:change="handleDragAndDrop($event)"
    >
        <Caret v-if="caretBody" />

        <Frame
            v-for="frame in frames"
            v-bind:key="frame.frameType + '-id:' + frame.id"
            v-bind:id="frame.id"
            v-bind:frameType="frame.frameType"
            v-bind:isJointFrame="false"
            v-bind:caretBody="frame.caretBody"
            v-bind:caretBelow="frame.caretBelow"
            class="frame content-children"
        />
    </Draggable>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import store from "@/store/store";
import Frame from "./Frame.vue";
import Caret from "@/components/Caret.vue";
import Draggable from "vuedraggable";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "FrameBody",
    store,

    components: {
        Frame,
        Draggable,
        Caret
    },

    props: {
        frameId: Number,
        caretBody: Boolean, //Flag indicating this caret is visible or not

    },

    computed: {
        frames: {
            // gets the frames objects which are nested in here (i.e. have this frameID as parent)
            get: function () {
                return store.getters.getFramesForParentId(this.$props.frameId);
            },
            // setter
            set: function () {
                // Nothing to be done here.
                // Event handlers call mutations which change the state
            },
        },
    },

    methods: {
        handleDragAndDrop: function (event: Event) {
            store.commit("updateFramesOrder", {
                event: event,
                eventParentId: this.$props.frameId,
            });
        },
    },
});
</script>

<style lang="scss">
.content-children {
    margin-left: 20px;
}
</style>
