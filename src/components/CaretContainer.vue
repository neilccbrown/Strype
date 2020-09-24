<template>
    <div 
        class="caret-container"
        @click.prevent.stop="toggleCaret()"
        @mouseover.prevent.stop="mouseOverCaret(true)"
        @mouseleave.prevent.stop="mouseOverCaret(false)"
        @contextmenu.prevent.stop="handleClick($event, 'paste')"
        v-bind:key="id"
        v-bind:id="id"
    >
        <vue-simple-context-menu
            :elementId="id+'_pasteContextMenu'"
            :options="pasteOption"
            :ref="'pasteContextMenu'"
            @option-clicked="optionClicked"
        />
        <Caret
            v-show="(caretVisibility === caretAssignedPosition || caretVisibility === caretPosition.both) && !isEditing" 
            v-bind:isBlured="overCaret"
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
import VueSimpleContextMenu from "vue-simple-context-menu"


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
        // Needed in order to use the `CaretPosition` type in the v-show
        caretPosition(): typeof CaretPosition {
            return CaretPosition;
        },
        id(): string {
            return "caret_"+this.caretAssignedPosition+"_of_frame_"+this.frameId;
        },
        pasteAvailable(): boolean {
            return store.getters.getCopiedFrameId()!== -100;
        },
        pasteOption(): {}[] {
            return this.pasteAvailable? [{name: "paste", method: "paste"}] : [{}];
        },
    },
    
    methods: {
        handleClick (event: MouseEvent, action: string): void {
            if(this.pasteAvailable) {        
                this.$refs.pasteContextMenu.showMenu(event);
            }

        },

        // Item is passed anyway in the event, in case the menu is attached to a list
        optionClicked (event: {item: any; option: {name: string; method: string}}): void {
            //call the appropriate method
            this[event.option.method]();
        },

        toggleCaret(): void {
            this.$data.overCaret = false;
            store.dispatch(
                "toggleCaret",
                {id:this.$props.frameId, caretPosition: this.caretAssignedPosition}
            );
        },

        mouseOverCaret(flag: boolean): void {

            const currentFrame: FrameObject = store.getters.getCurrentFrameObject();
            let newVisibility: string = CaretPosition.none;
            
            // The other caret than the one I am
            const opositeCaret: CaretPosition = (this.caretAssignedPosition === CaretPosition.below)? CaretPosition.body : CaretPosition.below;

            // If this isn't the current frame, then just turn on this caret
            if(currentFrame.id !== this.$props.frameId) {
                newVisibility = ((flag) ? this.caretAssignedPosition : CaretPosition.none)
            }
            else {
                // If visibility == 'both' I need to switch to the Opposite curret
                if(currentFrame.caretVisibility === CaretPosition.both && flag == false) {
                    newVisibility = opositeCaret;
                }
                // If visibility == [my oposite caret] I need to switch to 'both' so I can show as well
                else if(currentFrame.caretVisibility === opositeCaret && flag == true) {
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

        paste(): void {
            const index: number = (this.caretAssignedPosition === CaretPosition.body) ? 0 : store.getters.getIndexInParent(this.frameId)+1;
            const parentId: number = (this.caretAssignedPosition === CaretPosition.body) ? this.frameId : store.getters.getParentOfFrame(this.frameId);
            store.dispatch(
                "pasteFrame",
                {
                    newParentId: parentId,
                    newIndex: index,
                }
            )
        },
    },
});

</script>

<style lang="scss">
.caret-container {
    padding-top: 2px;
    padding-bottom: 2px;
}
</style>