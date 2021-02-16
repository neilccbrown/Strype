<template>
    <div class="next-to-eachother">
        <input
            type="text"
            autocomplete="off"
            spellcheck="false"
            v-if="isComponentLoaded"
            :disabled="isDisabled"
            v-model="code"
            :placeholder="defaultText"
            v-focus="focused"
            @focus="onFocus()"
            @blur="onBlur()"
            @keyup.left.prevent.stop="onLRKeyUp($event)"
            @keyup.right.prevent.stop="onLRKeyUp($event)"
            @keyup.up.prevent.stop="onUDKeyUp($event)"
            @keyup.down.prevent.stop="onUDKeyUp($event)"
            @keydown.prevent.stop.esc
            @keyup.esc="onEscKeyUp($event)"
            @keydown.prevent.stop.enter
            @keyup.enter.prevent.stop="onEnterKeyUp($event)"
            @keyup="logCursorPosition()"
            :class="{editableSlot: focused, error: erroneous, hidden: isHidden}"
            :id="UIID"
            :key="UIID"
            class="input"
            :style="inputTextStyle"
        />
        <b-popover
          v-if="erroneous"
          :target="UIID"
          :title="this.$i18n.t('errorMessage.errorTitle')"
          triggers="hover focus"
          :content="errorMessage"
          class="popover"
        >
        </b-popover>
        <div 
            class="editableslot-placeholder"
            :id="placeholderUIID"
            :value="code"
        />
        <AutoCompletion
            v-show="focused && showAC" 
            :slotId="UIID"
            ref="AC"
            :token="token"
            :cursorPosition="cursorPosition"
            @acItemClicked="acItemClicked"
        />
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import store from "@/store/store";
import AutoCompletion from "@/components/AutoCompletion.vue";
import { CaretPosition, Definitions, FrameObject, CursorPosition, EditableSlotReachInfos} from "@/types/types";
import { getEditableSlotUIID, getAcSpanId , getDocumentationSpanId } from "@/helpers/editor";
import { getCandidatesForAC, getImportCandidatesForAC, resetCurrentContextAC } from "@/autocompletion/acManager";
import getCaretCoordinates from "textarea-caret";

export default Vue.extend({
    name: "EditableSlot",
    store,

    components: {
        AutoCompletion,
    },

    props: {
        defaultText: String,
        slotIndex: Number,
        frameId: Number,
        isDisabled: Boolean,
        optionalSlot: Boolean,
        isHidden: Boolean,
    },


    beforeDestroy() {
        store.commit("removePreCompileErrors",this.UIID);
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

            // used to filter the AC
            token: "",
            cursorPosition: {} as CursorPosition,
            showAC: false,
              
        };
    },
    
    computed: {
        placeholderUIID(): string {
            return "editplaceholder_" + getEditableSlotUIID(this.frameId, this.slotIndex);
        },

        initCode(): string {
            return store.getters.getInitContentForFrameSlot();
        },

        inputTextStyle(): Record<string, string> {
            return {
                "background-color": ((this.code.trim().length > 0) ? "transparent" : "#FFFFFF") + " !important",
                "width" : this.computeFitWidthValue(),
                "color" : (store.getters.getFrameObjectFromId(this.frameId).frameType.type === Definitions.CommentDefinition.type)
                    ? "#97971E"
                    : "#000",
            };
        },

        code: {
            get(){
                return store.getters.getContentForFrameSlot(
                    this.$parent.$props.frameId,
                    this.$props.slotIndex
                );
            },
            set(value: string){
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

                const inputField = document.getElementById(this.UIID) as HTMLInputElement;
                const frame: FrameObject = store.getters.getFrameObjectFromId(this.frameId);

                // if the imput field exists and it is not a comment
                if(inputField && frame.frameType.type !== Definitions.CommentDefinition.type){
                    //get the autocompletion candidates
                    const textBeforeCaret = inputField.value?.substr(0,inputField.selectionStart??0)??"";               
                    
                    //workout the correct context if we are in a code editable slot
                    const isImportFrame = (frame.frameType.type === Definitions.ImportDefinition.type)
                    const resultsAC = (isImportFrame) 
                        ? getImportCandidatesForAC(textBeforeCaret, this.frameId, this.slotIndex, getAcSpanId(this.UIID), getDocumentationSpanId(this.UIID))
                        : getCandidatesForAC(textBeforeCaret, this.frameId, getAcSpanId(this.UIID), getDocumentationSpanId(this.UIID));
                    this.showAC = resultsAC.showAC;
                    if(this.showAC){
                        this.token = resultsAC.tokenAC.toLowerCase();  
                    }
                }

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

        UIID(): string {
            return getEditableSlotUIID(this.$props.frameId, this.$props.slotIndex);
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
                        //when a slot gains focus, we check that it was reached via keyboard: if so, depending on the reaching direction
                        //we set the text cursor to the start or the end of the text. When it's not reached via keyboard (i.e. via mouse)
                        //we don't change the cursor ourselves as it will be set where the user clicked at.
                        const editableSlotReachingInfo: EditableSlotReachInfos = store.getters.getEditableSlotViaKeyboard();
                        if(editableSlotReachingInfo.isKeyboard){
                            const cursorPos = (editableSlotReachingInfo.direction === -1) ? ((el as HTMLInputElement).value.length??0) : 0;
                            (el as HTMLInputElement).setSelectionRange(cursorPos, cursorPos);
                            //reset the flag informing how the slot has been reached
                            store.commit("setEditableSlotViaKeyboard", false);
                        }

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
            //reset the AC context
            resetCurrentContextAC();
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
            this.showAC = false;
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
                else {
                    //no specific action to take, we just move the cursor to the left or to the right
                    const incrementStep = (event.key==="ArrowLeft") ? -1 : 1;
                    input.setSelectionRange(start + incrementStep, end + incrementStep);
                }
            }
        },

        onUDKeyUp(event: KeyboardEvent) {
            // If the AutoCompletion is on we just browse through it's contents
            if(this.showAC) {
                (this.$refs.AC as any).changeSelection((event.key === "ArrowUp")?-1:1);
            }
            // Else we move the caret
            else {  
                // In any case the focus is lost, and the caret is shown (below by default)
                this.onBlur();
                
                //If the up arrow is pressed you need to move the caret as well.
                if( event.key === "ArrowUp" ) {
                    store.dispatch(
                        "changeCaretPosition",
                        event.key
                    );
                }
            }
        },
        
        onEscKeyUp(event: KeyboardEvent) {
            // If the AC is loaded we want to close it with an ESC and stay focused on the editableSlot
            if(this.showAC) {
                event.preventDefault();
                event.stopPropagation();
                this.showAC = false;
            }
            // If AC is not loaded, we want to take the focus from the slot
            // when we reach at here, the "esc" key event is just propagated and acts as normal
        },

        onEnterKeyUp(event: KeyboardEvent){
            // If the AC is loaded we want to select the AC suggestion the user chose and stay focused on the editableSlot
            if(this.showAC) {
                event.preventDefault();
                event.stopPropagation();
                // We set the code to what it was up to the point before the token, and we replace the token with the selected Item
                this.code = this.code.substr(0,this.code.lastIndexOf(this.token)) + (document.querySelector(".selectedAcItem") as HTMLLIElement).textContent?.trim();
                this.showAC = false;
            }
            // If AC is not loaded, we want to take the focus from the slot
            else {
                this.onLRKeyUp(event);
            }
        },
        
        acItemClicked() {
            // We set the code to what it was up to the point before the token, and we replace the token with the selected Item
            const selectedItem = ((document.querySelector(".hoveredAcItem") as HTMLLIElement)?.textContent?.trim())??(((document.querySelector(".selectedAcItem") as HTMLLIElement)?.textContent?.trim())??"");
            const inputField = document.getElementById(this.UIID) as HTMLInputElement;
            const newCode = this.code.substr(0,inputField.selectionStart) + selectedItem.substring(this.token.length) + this.code.substr(inputField.selectionStart);
            //set the input field as well because it is used later when the code is updated
            const frame: FrameObject = store.getters.getFrameObjectFromId(this.frameId);
            // if the input field exists and it is not a comment
            if(frame.frameType.type !== Definitions.CommentDefinition.type){
                //get the autocompletion candidates
                inputField.value = newCode;
                inputField.setSelectionRange(newCode.length, newCode.length);
            }
                    
            this.code = newCode;
            this.showAC = false;
        },

        // store the cursor position to give it as input to AutoCompletionPopUp
        logCursorPosition() {
            const inputField = document.getElementById(this.UIID) as HTMLInputElement;
            this.$data.cursorPosition = getCaretCoordinates(inputField, inputField.selectionEnd??0)
        },
        
        computeFitWidthValue(): string {
            const placeholder = document.getElementById(this.placeholderUIID);
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
    white-space: nowrap;
}

.popover {
    //Nedded for understanding the formated errors that split multiple
    // errors with \n
    white-space: pre-line !important;
}

</style>