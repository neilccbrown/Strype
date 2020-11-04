<template>
    <div 
        class="caret-container"
        @click.prevent.stop="toggleCaret()"
        @mouseover.prevent.stop="mouseOverCaret(true)"
        @mouseleave.prevent.stop="mouseOverCaret(false)"
        @contextmenu.prevent.stop="handleClick($event, 'paste')"
        v-bind:key="uiid"
        v-bind:id="uiid"
    >
        <vue-simple-context-menu
            v-show="allowContextMenu"
            v-bind:elementId="uiid+'_pasteContextMenu'"
            v-bind:options="pasteOption"
            v-bind:ref="'pasteContextMenu'"
            @option-clicked="optionClicked"
        />
        <Caret
            v-bind:id="caretUIID"
            v-bind:isBlurred="overCaret"
            v-bind:isInvisible="isInvisible"
            v-blur="isCaretBlurred"
        />
    </div>
</template>


<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import store from "@/store/store";
import Caret from"@/components/Caret.vue";
import { CaretPosition, FrameObject } from "@/types/types";
import VueSimpleContextMenu, {VueSimpleContextMenuConstructor} from "vue-simple-context-menu";
import $ from "jquery";
import { getCaretUIID } from "@/helpers/editor";


//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "CaretContainer",
    store,

    components: {
        Caret,
        VueSimpleContextMenu,
    },

    props: {
        frameId: Number,
        caretVisibility: String, //Flag indicating this caret is visible or not
        caretAssignedPosition: String,
        isFrameDisabled: Boolean,
    },

    data: function () {
        return {
            overCaret: false,
        }
    },

    computed: {

        isEditing(): boolean {
            return store.getters.getIsEditing();
        },
        isInvisible(): boolean {
            return  !((this.caretVisibility === this.caretAssignedPosition || this.caretVisibility === this.caretPosition.both) && !this.isEditing); 
        },
        // Needed in order to use the `CaretPosition` type in the v-show
        caretPosition(): typeof CaretPosition {
            return CaretPosition;
        },
        uiid(): string {
            return "caret_"+this.caretAssignedPosition+"_of_frame_"+this.frameId;
        },
        caretUIID(): string {
            return getCaretUIID(this.caretAssignedPosition, this.frameId);
        },
        pasteAvailable(): boolean {
            return store.getters.getIsCopiedAvailable();
        },
        pasteOption(): {}[] {
            return this.pasteAvailable? [{name: "paste", method: "paste"}] : [{}];
        },
        allowContextMenu(): boolean {
            return store.getters.getContextMenuShownId() === this.uiid; 
        },
        isCaretBlurred(): boolean {
            //if the frame isn't disabled, we never blur the caret. If the frame is disabled, then we check if frames can be added to decide if we blur or not.
            return this.isFrameDisabled && ((this.caretAssignedPosition ===  CaretPosition.below) ? !store.getters.canAddFrameBelowDisabled(this.frameId) : true);
        },
    },
    
    methods: {
        handleClick (event: MouseEvent, action: string): void {

            store.commit("setContextMenuShownId",this.uiid);
            if(this.pasteAvailable) {        
                if(store.getters.getIfPositionAllowsFrame(this.frameId, this.caretAssignedPosition)) {
                    ((this.$refs.pasteContextMenu as unknown) as VueSimpleContextMenuConstructor).showMenu(event);
                }
            }
        },

        // Item is passed anyway in the event, in case the menu is attached to a list
        optionClicked (event: {item: any; option: {name: string; method: string}}): void {
            // `event.option.method` holds the name of the method to be called.
            // In case the menu gets more complex this can clear up the code. However, it is a bit unsafe - in the case you
            // misstype a method's name.
            const thisCompProps = Object.entries(this).find((entry) => entry[0] === event.option.method);
            if(thisCompProps){
                thisCompProps[1]();
            }
        },

        toggleCaret(): void {
            this.$data.overCaret = false;
            store.dispatch(
                "toggleCaret",
                {id:this.$props.frameId, caretPosition: this.caretAssignedPosition}
            );
        },

        mouseOverCaret(mouseovercaret: boolean): void {

            const currentFrame: FrameObject = store.getters.getCurrentFrameObject();
            let newVisibility: string = CaretPosition.none;
            
            // The other caret than the one I am
            const opositeCaret: CaretPosition = (this.caretAssignedPosition === CaretPosition.below)? CaretPosition.body : CaretPosition.below;

            // If this isn't the current frame, then just turn on this caret
            if(currentFrame.id !== this.$props.frameId) {
                newVisibility = ((mouseovercaret) ? this.caretAssignedPosition : CaretPosition.none)
            }
            else {
                // If visibility == 'both', that means that in the frame that I am in both my caret AND
                // the other caret (i.e. the opposite caret) are switched on. Hence, when the mouse moves
                // out of my caret, I want to keep the other caret on.
                if(currentFrame.caretVisibility === CaretPosition.both && mouseovercaret == false) {
                    newVisibility = opositeCaret;
                }
                // If visibility == [my oposite caret], that means that in the frame that I am in 
                // only the other caret (i.e. the opposite caret) is switched on. Hence, when the mouse enters
                // my caret, I want to turn visible 'both' carets
                else if(currentFrame.caretVisibility === opositeCaret && mouseovercaret == true) {
                    newVisibility = CaretPosition.both;
                }
                // The else refers to the case where we are over the actual visual caret
                // in that case we do not need to do anything.
                else {
                    return;
                }
            }
        
            this.$data.overCaret = mouseovercaret; 
            store.commit(
                "setCaretVisibility",
                {
                    frameId : this.$props.frameId,
                    caretVisibility : newVisibility,
                }
            );
        },

        paste(): void {
            store.dispatch(
                "pasteFrame",
                {
                    clickedFrameId: this.$props.frameId,
                    caretPosition: this.$props.caretAssignedPosition,
                }
            );
        },
    },
});

</script>

<style lang="scss">
.caret-container {
    padding-top: 0px;
    padding-bottom: 0px;
}
</style>