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
        />
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
        focus: Boolean,
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
        focused: {
            // gets the frames objects which are nested in here (i.e. have this frameID as parent)
            get(): boolean {
                return store.getters.getIsEditableFocused(
                    this.$props.frameId,
                    this.$props.slotIndex
                );
            },
            // setter
            set(): void {
                // Nothing to be done here.
            },
        },
    },

    directives: {
        focus: {
            // Used so the store can set the focus of this element
            update: function (el,binding) {
                if(binding.value){
                    el.focus();
                    // this.onFocus();
                }
                else {
                    el.blur();
                    // this.onBlur();
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

            store.commit(
                "setFrameEditorSlot",
                {
                    frameId: this.$parent.$props.frameId,
                    slotId: this.$props.slotIndex,
                    code: this.$data.code,
                }
            );
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
            if( event.key === "ArrowDown" ) {
                this.onBlur();
            }
            else {
                store.dispatch(
                    "changeCaretPosition",
                    event.key
                );
            }
        },
    },
});
</script>
