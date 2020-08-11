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
            <JointFrames 
                v-if="hasJointFrameObjects"
                v-bind:jointParentId="id"
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

    beforeCreate() {
        const components = this.$options.components;
        if (components !== undefined) {
            components.FrameBody = require("@/components/FrameBody.vue").default;
            components.JointFrames = require("@/components/JointFrames.vue").default;
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
        hasJointFrameObjects(): boolean {
            return store.getters.getJointFramesForFrameId(
                this.id,
                "all"
            ).length >0;
        },
        frameStyle(): Record<string, string> {
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
        caretPosition(): typeof CaretPosition {
            return CaretPosition;
        },
        
    },

    methods: {
        toggleCaret(): void {
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
