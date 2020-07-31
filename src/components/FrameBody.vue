<template>
    <div
        class="frame-body-container"
        v-on:click.self="toggleCaret($event)"
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
import { CaretPosition } from "@/types/types";


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
            get: function () {
                return store.getters.getFramesForParentId(this.$props.frameId);
            },
            // setter
            set: function () {
                // Nothing to be done here.
                // Event handlers call mutations which change the state
            },
        },
        // Needed in order to use the `CaretPosition` type in the v-show
        caretPosition: function(){
            return CaretPosition;
        },
    },

    methods: {
        handleDragAndDrop: function (event: Event) {
            store.dispatch(
                "updateFramesOrder",
                {
                    event: event,
                    eventParentId: this.$props.frameId,
                }
            );
        },

        toggleCaret: function () {
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
