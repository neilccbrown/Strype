<template>
    <div :style="frameStyle" class="block">
        <FrameHeader
            v-if="frameType.labels !== null"
            v-bind:frameId="id"
            v-bind:labels="frameType.labels"
        />
        <FrameBody 
            v-if="allowChildren"
            v-bind:frameId="id" 
            v-bind:caretBody="caretBody"
        />
        <Frame
            v-for="frame in jointframes"
            v-bind:key="frame.frameType.type + '-id:' + frame.id"
            v-bind:id="frame.id"
            v-bind:frameType="frame.frameType"
            v-bind:isJointFrame="true"
            v-bind:allowChildren="frame.frameType.allowChildren"

        />
        <Caret v-if="caretBelow" />
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import FrameHeader from "@/components/FrameHeader.vue";
import Caret from "@/components/Caret.vue";
import store from "@/store/store";
import { FramesDefinitions, DefaultFramesDefinition } from "@/types/types";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "Frame",
    store,

    components: {
        FrameHeader,
        Caret,
    },

    beforeCreate: function() {
        const components = this.$options.components;
        if (components !== undefined)
            components.FrameBody = require("./FrameBody.vue").default;
    },

    props: {
        // NOTE that type declarations here start with a Capital Letter!!! (different to types.ts!)
        id: Number, // Unique Indentifier for each Frame
        frameType: {
            type: Object,
            default: () => DefaultFramesDefinition,
        }, //Type of the Frame
        parent: Number, //ID of the parent
        isJointFrame: Boolean, //Flag indicating this frame is a joint frame or not
        caretBody: Boolean, 
        caretBelow: Boolean,
        allowChildren: Boolean,
    },

    data: function() {
        return {
            // `False` if a single line frame and `True` if a block
            compound: false,

            // The body can be one of the following two:
            // 1) An editable slot, if our `Frame` is a single-line statement (eg. method call, variable assignment)
            // 2) A `Frame` in order to hold more frames in it
            body: null,
        };
    },

    computed: {
        // Frame label holds the initialisation object for the frame
        // frameLabel: function() {
        //     return this.$store.getters.getLabelsByName(this.frameType);
        // },
        jointframes: function() {
            return store.getters.getJointFramesForFrameId(this.id);
        },
        frameStyle: function() {
            return this.isJointFrame === true
                ? {}
                : {
                      "border-left": `6px solid ${
                          (this.frameType as FramesDefinitions).colour
                      } !important`,
                      "background-color": `${
                          (this.frameType as FramesDefinitions).colour
                      }33 !important`,
                      "padding-left": "2px",
                  };
        },
    },
});
</script>

<style lang="scss">
.block {
    color: #000 !important;
    margin-top: 7px;
}
</style>
