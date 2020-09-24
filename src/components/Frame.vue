<template>
    <div>
        <div 
            v-bind:style="frameStyle" 
            class="block frameDiv" 
            v-bind:class="{error: erroneous}"
            v-bind:id="id"
            @click.prevent.stop="toggleCaret($event)"
            @contextmenu.prevent="handleClick($event,'copy-duplicate')"
        >
            <vue-simple-context-menu
                :elementId="id+'copyContextMenu'"
                :options="copyDuplicateOtions"
                :ref="'copyContextMenu'"
                @option-clicked="optionClicked"
            />

            <FrameHeader
                v-if="frameType.labels !== null"
                v-bind:frameId="frameId"
                v-bind:labels="frameType.labels"
                class="frame-header"
            />
            <FrameBody
                v-if="allowChildren"
                v-bind:frameId="frameId"
                v-bind:caretVisibility="caretVisibility"
            />
            <CaretContainer
                v-bind:frameId="this.frameId"
                v-bind:caretVisibility="this.caretVisibility"
                v-bind:caretAssignedPosition="caretPosition.below"
            />
            
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
import CaretContainer from "@/components/CaretContainer.vue"
import store from "@/store/store";
import { FramesDefinitions, DefaultFramesDefinition, CaretPosition, FrameObject } from "@/types/types";
import VueSimpleContextMenu from "vue-simple-context-menu"

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "Frame",
    store,

    components: {
        FrameHeader,
        VueSimpleContextMenu,
        CaretContainer,
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

        copyDuplicateOtions(): {}[] {
            return [{name: "Copy", method: "copy"}, {name: "Duplicate", method: "duplicate"}];
        },

    },

    methods: {

        handleClick (event: MouseEvent, action: string) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if(action === "copy-duplicate") {
                this.$refs.copyContextMenu.showMenu(event);
            }
        },

        // Item is passed anyway in the event, in case the menu is attached to a list
        optionClicked (event: {item: any; option: {name: string; method: string}}) {
            //call the appropriate method
            this[event.option.method]();
        },

        toggleCaret(event: MouseEvent): void {
            const frame: HTMLDivElement = event.srcElement as HTMLDivElement;

            // get the rectangle of the div with its coordinates
            const rect = frame.getBoundingClientRect();
            
            let position: CaretPosition = CaretPosition.none;
            // if clicked above the middle, or if I click on the label show the body caret
            if((frame.className === "frame-header" || event.y <= rect.top + rect.height/2) && this.allowChildren) {
                position = CaretPosition.body;
            }
            //else show caret below
            else{
                position = CaretPosition.below;
            }

            store.dispatch(
                "toggleCaret",
                {id:this.$props.frameId, caretPosition: position}
            );
        },


        duplicate(): void {
            store.dispatch(
                "copyFrameToPosition",
                {
                    frameId : this.$props.frameId,
                    newParentId: store.getters.getParentOfFrame(this.frameId),
                    newIndex: store.getters.getIndexInParent(this.frameId)+1,
                }
            );
        },

        copy(): void {
            store.dispatch(
                "copyFrameId",
                this.$props.frameId
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


.error {
    border: 1px solid #FF0000 !important;
}
</style>
