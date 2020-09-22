<template>
    <div class="frame-container">
        <div class="frame-container-header">
            <button class="frame-container-btn-collapse" @click="toggleCollapse">{{collapseButtonLabel}}</button>
            <span class="frame-container-label-span" @click.self="toggleCaret($event)">{{containerLabel}}</span>
        </div>

        <div v-bind:style="containerStyle" class="container-frames">
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
                    v-show="caretVisibility===caretPosition.body"
                    v-bind:isBlured="overCaret" 
                />
            </div>

            <Draggable
                v-model="frames" 
                v-bind:group="draggableGroup"
                @change.self="handleDragAndDrop($event)"
                v-bind:animation="300"
                v-bind:disabled="isEditing"
                v-bind:key="'Draggagle-Container-'+this.frameId"
                v-bind:id="'Draggagle-Container-'+this.frameId"
            >
                <Frame 
                    v-for="frame in frames" 
                    v-bind:key="frame.frameType.type + '-id:' + frame.id"
                    v-bind:frameId="frame.id"
                    v-bind:frameType="frame.frameType"
                    v-bind:isJointFrame="false"
                    v-bind:allowChildren="frame.frameType.allowChildren"
                    v-bind:caretVisibility="frame.caretVisibility"
                    class="frame" 
                />
            </Draggable>
        </div>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import Frame from "@/components/Frame.vue";
import Caret from "@/components/Caret.vue";
import store from "@/store/store";
import Draggable from "vuedraggable";
import { CaretPosition, FrameObject, DraggableGroupTypes } from "@/types/types";
import ContextMenu from "vue-context-menu";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "FrameContainer",
    store,

    components: {
        Frame,
        Caret,
        Draggable,
        ContextMenu,
    },

    data() {
        return {
            collapseButtonLabel: "\u25BC",
            containerStyle: {display:"block"},
            isCollapsed: false,
            overCaret: false,
        }
    },

    props: {
        frameId: Number,
        caretVisibility: String,
        containerLabel: String,
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

        pasteAvailable(): boolean {
            return store.getters.getCopiedFrameId()!== -100;
        },

        id(): string {
            return "frameContainerId_" + this.$props.frameId;
        },
    },

    methods: {
        toggleCollapse(): void {
            this.$data.isCollapsed = !this.$data.isCollapsed;
            //update the button label
            this.$data.collapseButtonLabel = (this.$data.isCollapsed) ? "\u25B6" : "\u25BC";
            //update the div style
            this.$data.containerStyle = (this.$data.isCollapsed) ? {display:"none"} : {display:"block"};
        },
        handleDragAndDrop(event: Event): void {
            store.commit(
                "updateFramesOrder",
                {
                    event: event,
                    eventParentId: this.frameId,
                }
            );
        },
        toggleCaret(): void {
            this.$data.overCaret = false;
            store.dispatch(
                "toggleCaret",
                {id: this.$props.frameId, caretPosition: CaretPosition.body}
            );
            //expand the container
            this.$data.isCollapsed = true;
            this.toggleCollapse();
        },

        mouseOverCaret(flag: boolean): void {
            const currentFrame: FrameObject = store.getters.getCurrentFrameObject();
            let newVisibility: CaretPosition = CaretPosition.none;

            if(currentFrame.id !== this.$props.frameId) {
                newVisibility = ((flag) ? CaretPosition.body : CaretPosition.none)
            }
            else {
                // The else refers to the case where we are over the actual visual caret
                // in that case we do nothing.

                return;                
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
.frame-container {
    margin-bottom: 5px;
    margin-left:10px;
    border: #888 1px solid;
    background-color: #ECECC8;

}
.frame-container-btn-collapse {
    background-color: #ECECC8;
    border-color: transparent;
}
.frame-container-label-span {       
    margin-left: 5px;
    cursor:default;
    color: #274D19;
}

.container-frames {
    margin-left: 15px;
    margin-right: 15px;  
    margin-bottom: 15px;
    border-radius: 8px;
    border: 1px solid #B4B4B4;
    background-color: #F6F2E9 !important;
}

.caretContainer {
    padding-top: 2px;
    padding-bottom: 2px;
}

</style>
