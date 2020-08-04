<template>
    <div>
        <div :style="frameStyle" class="block">
            <FrameHeader
                v-if="frameType.labels !== null"
                v-bind:frameId="id"
                v-bind:labels="frameType.labels"
            />
            <FrameBody 
                v-if="allowChildren"
                v-bind:frameId="id" 
                v-bind:caretVisibility="caretVisibility"
            />
            <div 
                class="frame-bottom-selector"
                v-on:click.self="toggleCaret($event)"
            >
            </div>
            <Caret v-show="caretVisibility===caretPosition.below" />
            <Frame
                v-for="frame in jointframes"
                v-bind:key="frame.frameType.type + '-id:' + frame.id"
                v-bind:id="frame.id"
                v-bind:frameType="frame.frameType"
                v-bind:isJointFrame="true"
                v-bind:allowChildren="frame.frameType.allowChildren"
                v-bind:caretVisibility="frame.caretVisibility"
            />
        </div>
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
import { FramesDefinitions, DefaultFramesDefinition, CaretPosition } from "@/types/types";

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
        if (components !== undefined) {
            components.FrameBody = require("./FrameBody.vue").default;
        }
    },

    props: {
        // NOTE that type declarations here start with a Capital Letter!!! (different to types.ts!)
        id: Number, // Unique Indentifier for each Frame
        frameType: {
            type: Object,
            default: () => DefaultFramesDefinition,
        }, //Type of the Frame
        isJointFrame: Boolean, //Flag indicating this frame is a joint frame or not
        caretVisibility: String,
        allowChildren: Boolean,
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
        // Needed in order to use the `CaretPosition` type in the v-show
        caretPosition: function(){
            return CaretPosition;
        },
    },

    methods: {
        toggleCaret: function () {
            store.dispatch(
                "toggleCaret",
                {id:this.$props.id, caretPosition: CaretPosition.below}
            );
        },
    },

});

</script>

<style lang="scss">
.block {
    color: #000 !important;
    // margin-top: 4px;
    padding-right: 4px;
    padding-bottom: 1px;
}
.frame-bottom-selector {
    padding-bottom: 4px;
}
</style>
