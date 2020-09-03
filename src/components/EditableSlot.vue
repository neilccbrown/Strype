<template>
    <div class="next-to-eachother">
        <input
            type="text"
            v-model="code"
            v-bind:placeholder="defaultText"
            v-on:focus="onFocus"
            v-on:blur="onBlur"
            v-focus="focused"
            v-on:keyup.left.prevent.stop="onLRKeyUp($event)"
            v-on:keyup.right.prevent.stop="onLRKeyUp($event)"
            v-on:keyup.up.prevent.stop="onUDKeyUp($event)"
            v-on:keyup.down.prevent.stop="onUDKeyUp($event)"
            v-bind:class="{error: erroneous}"
            v-bind:id="id"
        />
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
import Vue from "vue";
import store from "@/store/store";
import { CaretPosition} from "@/types/types";


export default Vue.extend({
    name: "EditableSlot",
    store,
    props: {
        defaultText: String,
        slotIndex: Number,
        frameId: Number,
        optionalSlot: Boolean,
    },

    data() {
        return {
            code: store.getters.getContentForFrameSlot(
                this.$parent.$props.frameId,
                this.$props.slotIndex
            ),
        };
    },

    computed: {
        focused(): boolean {
            // gets the frames objects which are nested in here (i.e. have this frameID as parent)
            return store.getters.getIsEditableFocused(
                this.$props.frameId,
                this.$props.slotIndex
            );
        },

        erroneous(): boolean {
            return store.getters.getErroneousSlot(
                this.$props.frameId,
                this.$props.slotIndex
            );
        },

        id(): string {
            return "input_frameId_"+this.$props.frameId+"_slot_"+this.$props.slotId;
        },

        errorMessage(): string{
            return store.getters.getErrorForSlot(
                this.$props.frameId,
                this.$props.slotIndex
            );
        },
    },

   
    directives: {
        focus: {
            //This is needed to set the focus when a frame with slots has just been added (i.e. when `leftRightKey` is called after `addFrameWithCommand` in Commands.vue)
            inserted: function (el,binding) {
                if(binding.value) {
                    el.focus();
                }
            },
            // Used so the store can set the focus of this element
            componentUpdated: function (el, binding) {
                if(binding.value !== binding.oldValue) {
                    if(binding.value){
                        el.focus();
                    }
                    else {
                        el.blur();
                    }
                }
            },
        },
    },


    methods: {
        onFocus(): void {

            store.commit(
                "toggleEditFlag",
                true
            );
            //We need to first set the curretFrame to this so that the user
            store.commit(
                "setCurrentFrame",
                {
                    id: this.$props.frameId,
                    caretPosition: (store.getters.getAllowChildren(this.$props.frameId)) ? CaretPosition.body : CaretPosition.below,
                }
            );

            store.commit(
                "setEditableFocus",
                {
                    frameId: this.$props.frameId,
                    slotId: this.$props.slotIndex,
                    focused: true,
                }
            );
            
        },
        onBlur(): void {
            store.commit(
                "toggleEditFlag",
                false
            );

            store.commit(
                "setEditableFocus",
                {
                    frameId: this.$props.frameId,
                    slotId: this.$props.slotIndex,
                    focused: false,
                }
            );

            if(this.$data.code !== "") {
                store.commit(
                    "setFrameEditorSlot",
                    {
                        frameId: this.$parent.$props.frameId,
                        slotId: this.$props.slotIndex,
                        code: this.$data.code,
                    }   
                );
                //if the user entered text on previously left blank slot, remove the error
                if(!this.$props.optionalSlot && this.errorMessage === "Input slot cannot be empty") {
                    store.commit(
                        "setSlotErroneous", 
                        {
                            frameId: this.$parent.$props.frameId, 
                            slotIndex: this.$props.slotIndex, 
                            error: "",
                        }
                    );
                    store.commit("removePreCompileErrors",this.id);
                }
            }
            else if(!this.$props.optionalSlot){
                store.commit(
                    "setSlotErroneous", 
                    {
                        frameId: this.$parent.$props.frameId, 
                        slotIndex: this.$props.slotIndex, 
                        error: "Input slot cannot be empty",
                    }
                );
                store.commit("addPreCompileErrors",this.id);
            }
        },

        onLRKeyUp(event: KeyboardEvent) {
            //get the input field
            const input: HTMLInputElement = this.$el.firstElementChild as HTMLInputElement;
            if(input !== undefined){
                const start = input.selectionStart ?? 0;
                const end = input.selectionEnd ?? 0;
                
                if((start === 0 && event.key==="ArrowLeft") || (end === input.value.length && event.key==="ArrowRight")) {
                    
                    store.dispatch(
                        "leftRightKey",
                        event.key
                    );
                    this.onBlur();
                }
            }
        },

        onUDKeyUp(event: KeyboardEvent) {

            // In any case the focus is lost
            this.onBlur();

            //If the up arrow is pressed you need to move the caret as well.
            if( event.key === "ArrowUp" ) {
                store.dispatch(
                    "changeCaretPosition",
                    event.key
                );
            }
        },
    },
});
</script>

<style lang="scss">
.error {
    border: 1px solid #d66;
}

</style>