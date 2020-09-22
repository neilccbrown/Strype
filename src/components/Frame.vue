<template>
    <div>
        <div 
            v-bind:style="frameStyle" 
            class="block frameDiv" 
            v-bind:class="{error: erroneous}"
            v-bind:id="id"
            @click.prevent.stop="toggleCaret($event)"
            @contextmenu.prevent="$refs.ctxMenu.open"
        >
            <ContextMenu 
                v-bind:id="id+'-copy-context-menu'" 
                v-bind:key="id+'-context-menu'" 
                ref="ctxMenu"
            >
                <b-button-group vertical  class="w-100">
                    <b-button 
                        @click="duplicate()" 
                        variant="light"
                    >
                            Duplicate
                    </b-button>
                    <b-button 
                        variant="light" 
                        @click="copy()"
                    >
                        Copy
                    </b-button>
                </b-button-group>
            </ContextMenu>

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
            <div 
                class="frame-bottom-selector"
                @click.self="toggleCaretBelow()"
                @mouseover="mouseOverCaret(true)"
                @mouseleave="mouseOverCaret(false)"
                @contextmenu.prevent="$refs.ctxPasteMenu.open"
            >
                <ContextMenu
                    v-bind:id="id+'-paste-context-menu'" 
                    v-bind:key="id+'-paste-context-menu'" 
                    ref="ctxPasteMenu"
                >
                    <b-button 
                        v-if="pasteAvailable"
                        @click="paste()"
                        variant="light"
                    >
                        Paste
                    </b-button>
                </ContextMenu>
                <Caret
                    v-show="(caretVisibility === caretPosition.below || caretVisibility === caretPosition.both) && !isEditing" 
                    v-bind:isBlured="overCaret"
                />
            </div>
            
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
import { FramesDefinitions, DefaultFramesDefinition, CaretPosition, FrameObject } from "@/types/types";
import ContextMenu from "vue-context-menu";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "Frame",
    store,

    components: {
        FrameHeader,
        Caret,
        ContextMenu,
    },

    beforeCreate() {
        const components = this.$options.components;
        if (components !== undefined) {
            components.FrameBody = require("@/components/FrameBody.vue").default;
            components.JointFrames = require("@/components/JointFrames.vue").default;
        }
    },

    data: function () {
        return {
            overCaret: false,
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

        pasteAvailable(): boolean {
            return store.getters.getCopiedFrameId()!== -100;
        },
        
    },

    methods: {
        toggleCaret(event: MouseEvent): void {
            const frame: HTMLDivElement = event.srcElement as HTMLDivElement;

            // get the rectangle of the div with its coordinates
            const rect = frame.getBoundingClientRect();
            
            // if clicked above the middle, or if I click on the label show the body caret
            if((frame.className === "frame-header" || event.y <= rect.top + rect.height/2) && this.allowChildren) {
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
            this.$data.overCaret = false;
            store.dispatch(
                "toggleCaret",
                {id:this.$props.frameId, caretPosition: CaretPosition.below}
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

        paste(): void {
            store.dispatch(
                "pasteFrame",
                {
                    newParentId: store.getters.getParentOfFrame(this.frameId),
                    newIndex: 0,
                }
            )
        },

        mouseOverCaret(flag: boolean): void {
            const currentFrame: FrameObject = store.getters.getCurrentFrameObject();
            let newVisibility: CaretPosition = CaretPosition.none;

            if(currentFrame.id !== this.$props.frameId) {
                newVisibility = ((flag) ? CaretPosition.below : CaretPosition.none)
            }
            else {
                if(currentFrame.caretVisibility === CaretPosition.both && flag == false) {
                    newVisibility = CaretPosition.body;
                }
                else if(currentFrame.caretVisibility === CaretPosition.body && flag == true) {
                    newVisibility = CaretPosition.both;
                }
                // The else refers to the case where we are over the actual visual caret
                // in that case we do nothing.
                else {
                    return;
                }
            }
        
            this.$data.overCaret = flag;
            store.commit(
                "setCaretVisibility",
                {
                    frameId : this.$props.frameId,
                    caretVisibility : newVisibility,
                }
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
    padding-top: 2px;
    padding-bottom: 2px;
}

.error {
    border: 1px solid #FF0000 !important;
}
</style>
