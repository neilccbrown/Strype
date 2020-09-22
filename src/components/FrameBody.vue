<template>
    <div
        class="frame-body-container"
        v-bind:class="{error: empty}"
        v-bind:id="id"
    >
        <div 
            class="caretContainer"
            @mouseover="mouseOverCaret(true)"
            @mouseleave="mouseOverCaret(false)"
            @click.prevent.stop="toggleCaret()"
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
                v-show=" (caretVisibility === caretPosition.body || caretVisibility === caretPosition.both)  && !isEditing" 
                v-bind:isBlured="overCaret"
            />
        </div>
        <Draggable
            v-model="frames"
            group="code"
            @change.self="handleDragAndDrop($event)"
            animation= "200"
            :disabled="isEditing"
            v-bind:key="'Draggagle-Body-'+this.frameId"
        >
            <Frame
                v-for="frame in frames"
                v-bind:key="frame.frameType.type  + '-id:' + frame.id"
                v-bind:frameId="frame.id"
                v-bind:frameType="frame.frameType"
                v-bind:isJointFrame="false"
                v-bind:caretVisibility="frame.caretVisibility"
                v-bind:allowChildren="frame.frameType.allowChildren"
                class="frame content-children"
            />
        </Draggable>
        <b-popover
          v-if="empty"
          v-bind:target="id"
          title="Error!"
          triggers="hover focus"
          content="Body cannot be empty"
        ></b-popover>
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
import { CaretPosition, FrameObject, DraggableGroupTypes } from "@/types/types";
import ContextMenu from "vue-context-menu";

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
        ContextMenu,
    },
    
    props: {
        frameId: Number,
        caretVisibility: String, //Flag indicating this caret is visible or not
    },

    data: function () {
        return {
            overCaret: false,
        }
    },

    computed: {
        frames(): FrameObject[] {
            // gets the frames objects which are nested in here (i.e. have this frameID as parent)
            return store.getters.getFramesForParentId(this.$props.frameId);
        },

        draggableGroup(): DraggableGroupTypes {
            return store.getters.getDraggableGroupById(this.$props.frameId); 
        },

        // Needed in order to use the `CaretPosition` type in the v-show
        caretPosition(): typeof CaretPosition {
            return CaretPosition;
        }, 

        isEditing(): boolean {
            return store.getters.getIsEditing();
        },

        id(): string {
            return "frameBodyId_" + this.$props.frameId;
        },

        empty(): boolean {
            let empty = false;
            if(this.frames.length < 1 && this.caretVisibility !== this.caretPosition.body) {
                empty = true;
                store.commit("addPreCompileErrors",this.id);                
            }
            else {
                store.commit("removePreCompileErrors",this.id);
            }
            return empty;
        },

        pasteAvailable(): boolean {
            return store.getters.getCopiedFrameId()!== -100;
        },
    },

    beforeDestroy() {
        store.commit("removePreCompileErrors",this.id);
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
            this.$data.overCaret = false;
            store.dispatch(
                "toggleCaret",
                {id:this.frameId, caretPosition: CaretPosition.body}
            );
        },

        mouseOverCaret(flag: boolean): void {
            const currentFrame: FrameObject = store.getters.getCurrentFrameObject();
            let newVisibility: CaretPosition = CaretPosition.none;

            if(currentFrame.id !== this.$props.frameId) {
                newVisibility = ((flag) ? CaretPosition.body : CaretPosition.none)
            }
            else {
                if(currentFrame.caretVisibility === CaretPosition.both && flag == false) {
                    newVisibility = CaretPosition.below;
                }
                else if(currentFrame.caretVisibility === CaretPosition.below && flag == true) {
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
.content-children {
    margin-left: 0px;
}

.frame-body-container {
    background-color: #FFF !important;
    margin-bottom: 4px;
    margin-right: 0px;
    margin-left: 12px;
    border-color: #000 !important;
    border-radius: 8px;

}

.caretContainer {
    padding-top: 2px;
    padding-bottom: 2px;
}

.error {
    border: 1px solid #d66 !important;

}
</style>
