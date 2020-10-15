<template>
    <div class="next-to-eachother">
        <input
            type="text"
            v-if="isComponentLoaded"
            v-model="code"
            v-bind:placeholder="defaultText"
            v-focus="focused"
            @focus="onFocus()"
            @blur="onBlur()"
            @keyup.left.prevent.stop="onLRKeyUp($event)"
            @keyup.right.prevent.stop="onLRKeyUp($event)"
            @keyup.enter.prevent.stop="onLRKeyUp($event)"
            @keyup.up.prevent.stop="onUDKeyUp($event)"
            @keyup.down.prevent.stop="onUDKeyUp($event)"
            v-bind:class="{editableSlot: focused, error: erroneous}"
            v-bind:id="id"
            v-bind:key="id"
            class="input"
            v-bind:style="inputTextStyle"
        />
        <b-popover
          v-if="erroneous"
          v-bind:target="id"
          title="Error!"
          triggers="hover focus"
          v-bind:content="errorMessage"
        ></b-popover>
        <div 
            class="editableslot-placeholder"
            v-bind:id="placeholderId"
            v-bind:value="code"
        />
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import store from "@/store/store";
import { CaretPosition, Definitions} from "@/types/types";
import { getEditableSlotId } from "@/helpers/editor";

export default Vue.extend({
    name: "EditableSlot",
    store,

    props: {
        defaultText: String,
        slotIndex: Number,
        frameId: Number,
        optionalSlot: Boolean,
    },

    beforeDestroy() {
        store.commit("removePreCompileErrors",this.id);
    },

    mounted() {
        //when the component is loaded, the width of the editable slot cannot be computed yet based on the placeholder
        //because the placeholder hasn't been loaded yet. Here it is loaded so we can set the width again.
        this.isComponentLoaded  = true;
    },

    data() {
        return {
            //this flags indicates if the content of editable slot has been already modified during a sequence of action
            //as we don't want to save each single change of the content, but the full content change itself.
            isFirstChange: true, 
            
            //this flag is used to "delay" the computation of the input text field's width,
            //so that the width is rightfully computed when displayed for the first time
            isComponentLoaded : false,
        };
    },
    
    computed: {
        placeholderId(): string {
            return "editplaceholder_" + getEditableSlotId(this.frameId, this.slotIndex);
        },

        initCode(): string {
            return store.getters.getInitContentForFrameSlot();
        },

        inputTextStyle(): Record<string, string> {
            return {
                "background-color": ((this.code.trim().length > 0) ? "transparent" : "#FFFFFF") + " !important",
                "width" : this.computeFitWidthValue(),
                "color" : (store.getters.getFrameObjectFromId(this.frameId).frameType === Definitions.CommentDefinition)
                    ? "#97971E"
                    : "#000",
            };
        },

        code: {
            get() {
                return store.getters.getContentForFrameSlot(
                    this.$parent.$props.frameId,
                    this.$props.slotIndex
                );
            },
            set(value){
                store.dispatch(
                    "setFrameEditableSlotContent",
                    {
                        frameId: this.frameId,
                        slotId: this.slotIndex,
                        code: value,
                        initCode: this.initCode,
                        isFirstChange: this.isFirstChange,
                    }
                );
                this.isFirstChange = false;
            },
        },

        focused(): boolean {
            return store.getters.getIsEditableFocused(
                this.$props.frameId,
                this.$props.slotIndex
            );
        },

        erroneous(): boolean {
            return store.getters.getIsErroneousSlot(
                this.$props.frameId,
                this.$props.slotIndex
            );
        },

        id(): string {
            return getEditableSlotId(this.$props.frameId, this.$props.slotIndex);
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

        //Apparently focus happens first before blur when moving from one slot to another.
        onFocus(): void {
            this.isFirstChange = true;
            store.dispatch(
                "setFocusEditableSlot",
                {
                    frameId: this.$props.frameId,
                    slotId: this.$props.slotIndex,
                    caretPosition: (store.getters.getAllowChildren(this.$props.frameId)) ? CaretPosition.body : CaretPosition.below,
                }
            );           
        },

        onBlur(): void {
            store.dispatch(
                "updateErrorsOnSlotValidation",
                {
                    frameId: this.$props.frameId,
                    slotId: this.$props.slotIndex,
                    code: this.code.trim(),
                }   
            );
        },

        onLRKeyUp(event: KeyboardEvent) {
            //get the input field
            const input: HTMLInputElement = this.$el.firstElementChild as HTMLInputElement;
            if(input !== undefined){
                const start = input.selectionStart ?? 0;
                const end = input.selectionEnd ?? 0;
                
                if((start === 0 && event.key==="ArrowLeft") || (event.key === "Enter" || (end === input.value.length && event.key==="ArrowRight"))) {
                    
                    store.dispatch(
                        "leftRightKey",
                        event.key
                    );
                    this.onBlur();
                }
            }
        },

        onUDKeyUp(event: KeyboardEvent) {

            // In any case the focus is lost, and the caret is shown (below by default)
            this.onBlur();

            //If the up arrow is pressed you need to move the caret as well.
            if( event.key === "ArrowUp" ) {
                store.dispatch(
                    "changeCaretPosition",
                    event.key
                );
            }
        },
        
        computeFitWidthValue(): string {
            const placeholder = document.getElementById(this.placeholderId);
            let computedWidth = "150px"; //default value if cannot be computed
            const offset = 10;
            if (placeholder) {
                placeholder.textContent = (this.code.length > 0) ? this.code : this.defaultText;
                //the width is computed from the placeholder's width from which
                //we add extra space for the cursor.
                computedWidth = (placeholder.offsetWidth + offset) + "px";
            }
            return computedWidth;
        },

    },
});
</script>

<style lang="scss">
.error {
    border: 1px solid #FF0000 !important;
}

.input {
    border-radius: 5px;
    border: 1px solid transparent;;
}

.input:hover {
    border: 1px solid #B4B4B4;;
}

.editableslot-placeholder {
    position: absolute;
    display: inline-block;
    visibility: hidden;
}

</style>