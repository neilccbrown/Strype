<template>
    <div>
        <div 
            v-bind:style="frameStyle" 
            class="block frameDiv" 
            v-bind:class="{error: erroneous}"
            v-bind:id="id"
            @click.prevent.stop="toggleCaret($event)"
        >
            <FrameHeader
                v-if="frameType.labels !== null"
                v-bind:frameId="frameId"
                v-bind:labels="frameType.labels"
            />
            <FrameBody
                v-if="allowChildren"
                v-bind:frameId="frameId"
                v-bind:caretVisibility="caretVisibility"
            />
            <div 
                class="frame-bottom-selector"
                @click.self="toggleCaretBelow()"
            >
            </div>
            <Caret v-show="(caretVisibility === caretPosition.below) && !isEditing" />
            <JointFrames 
                v-if="hasJointFrameObjects"
                v-bind:jointParentId="frameId"
            />
        </div>
        <b-popover
          v-if="erroneous"
          v-bind:target="id"
          title="Error!"
          triggers="hover focus"
          v-bind:content="errorMessage"
        ></b-popover>
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
        frameId: Number, // Unique Indentifier for each Frame
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
                this.frameId,
                "all"
            ).length >0;
        },

        frameStyle(): Record<string, string> {
            return this.isJointFrame === true
                ? {}
                : {
                    "background-color": `${
                        (this.frameType as FramesDefinitions).colour
                    } !important`,
                    "padding-left": "2px",
                };
        },

        // Needed in order to use the `CaretPosition` type in the v-show
        caretPosition(): typeof CaretPosition {
            return CaretPosition;
        },

        isEditing(): boolean {
            return store.getters.getIsEditing();
        },

        erroneous(): boolean {
            return store.getters.getIsErroneousFrame(
                this.$props.frameId
            );
        },

        id(): string {
            return "frame_id_"+this.$props.frameId;
        },

        errorMessage(): string{
            return store.getters.getErrorForFrame(
                this.$props.frameId
            );
        },
        
    },

    methods: {
        toggleCaret(event: MouseEvent): void {
            const frame: HTMLDivElement = event.srcElement as HTMLDivElement;

            // get the rectangle of the div with its coordinates
            const rect = frame.getBoundingClientRect();
            
            // if clicked below the middle, show the body caret
            if(this.allowChildren && event.y <= rect.top + rect.height/2) {
                store.dispatch(
                    "toggleCaret",
                    {id:this.$props.frameId, caretPosition: CaretPosition.body}
                );
            }
            //else show caret below
            else{
                this.toggleCaretBelow();
            }
            
        },

        toggleCaretBelow(): void {
            store.dispatch(
                "toggleCaret",
                {id:this.$props.frameId, caretPosition: CaretPosition.below}
            );
        },
    },

});

</script>

<style lang="scss">
.block {
    color: #000 !important;
    padding-right: 4px;
    padding-top: 1px;
    padding-bottom: 1px;
    border-radius: 8px;
    border: 1px solid #B4B4B4;
}
.frame-bottom-selector {
    padding-bottom: 4px;
}

.error {
    border: 1px solid #FF0000 !important;
}
</style>
