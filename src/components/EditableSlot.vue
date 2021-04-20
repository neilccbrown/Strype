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
            @keyup.enter.prevent.stop="onEnterOrTabKeyUp($event)"
            @keydown.tab="onTabKeyDown($event)"
            @keyup.tab="onEnterOrTabKeyUp($event)"
            @keydown="onEqualOrSpaceKeyDown($event)"
            @keyup="logCursorPosition()"
            :class="{editableSlot: focused, error: erroneous, hidden: isHidden}"
            :id="UIID"
            :key="UIID"
            class="editableslot-input"
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
            v-if="focused && showAC" 
            :slotId="UIID"
            :context="contextAC"
            ref="AC"
            :key="UIID+'_Autocompletion'"
            :id="UIID+'_Autocompletion'"
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
import { getEditableSlotUIID, getAcSpanId , getDocumentationSpanId, getReshowResultsId, getTypesSpanId } from "@/helpers/editor";
import { CaretPosition, Definitions, FrameObject, CursorPosition, EditableSlotReachInfos, VarAssignDefinition} from "@/types/types";
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
            contextAC: "",
            //used to force a text cursor position, for example after inserting an AC candidate
            textCursorPos: -1,              
        };
    },
    
    computed: {
        placeholderUIID(): string {
            return "editplaceholder_" + getEditableSlotUIID(this.frameId, this.slotIndex);
        },

        initCode(): string {
            return store.getters.getInitContentForFrameSlot();
        },

        
        frameType(): string{
            return store.getters.getFrameObjectFromId(this.frameId).frameType.type;
        },

        inputTextStyle(): Record<string, string> {
            return {
                "background-color": ((this.code.trim().length > 0) ? "rgba(255, 255, 255, 0.6)" : "#FFFFFF") + " !important",
                "width" : this.computeFitWidthValue(),
                "color" : (this.frameType === Definitions.CommentDefinition.type)
                    ? "#97971E"
                    : "#000",
            };
        },

        code: {
            get(): string{
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
                        ? getImportCandidatesForAC(textBeforeCaret, this.frameId, this.slotIndex, getAcSpanId(this.UIID), getDocumentationSpanId(this.UIID), getTypesSpanId(this.UIID), getReshowResultsId(this.UIID))
                        : getCandidatesForAC(textBeforeCaret, this.frameId, getAcSpanId(this.UIID), getDocumentationSpanId(this.UIID), getTypesSpanId(this.UIID), getReshowResultsId(this.UIID));
                    this.showAC = resultsAC.showAC;
                    this.contextAC = resultsAC.contextAC;
                    if(this.showAC){
                        this.token = resultsAC.tokenAC.toLowerCase();  
                    }
                }

                //if we specify a text cursor position, set it in the input field at the next tick (because code needs to be updated first)
                if(this.textCursorPos > -1){
                    this.$nextTick(() => {
                        inputField.setSelectionRange(this.textCursorPos, this.textCursorPos);
                        this.textCursorPos = -1;
                    });
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
            return this.code.trim().length == 0 && store.getters.getIsErroneousSlot(
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
                    //when entering a new editableslot, we make sure to reset the flag informing how the slot has been reache
                    store.commit("setEditableSlotViaKeyboard", {isKeyboard: false, direction: 1});

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
                            store.commit("setEditableSlotViaKeyboard", {isKeyboard: false, direction: 1});
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
            //if a key modifier (ctrl, shift or meta) is pressed, we don't do anything special
            if(!(event.ctrlKey || event.shiftKey || event.metaKey)){
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
                        const cursorPos = (incrementStep == -1) ? start : end;
                        input.setSelectionRange(cursorPos + incrementStep, cursorPos + incrementStep);
                    }
                }
            }
        },

        onUDKeyUp(event: KeyboardEvent) {
            //if a key modifier (ctrl, shift or meta) is pressed, we don't do anything special
            if(!(event.ctrlKey || event.shiftKey || event.metaKey)){
                // If the AutoCompletion is on we just browse through it's contents
            // The `results` check, prevents `changeSelection()` when there are no results matching this token
            // And instead, since there is no AC list to show, moves to the next slot
                if(this.showAC && (this.$refs.AC as any).results.length > 0) {
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

        onTabKeyDown(event: KeyboardEvent){
            // We keep the default browser behaviour when tab is pressed AND we're not having AC on.
            // As browsers would use the "keydown" event, we have to intercept the event at this stage.
            if(this.showAC && document.querySelector(".selectedAcItem")) {
                event.preventDefault();
                event.stopPropagation();
            }
        },

        onEnterOrTabKeyUp(event: KeyboardEvent){
            // If the AC is loaded we want to select the AC suggestion the user chose and stay focused on the editableSlot
            if(this.showAC && document.querySelector(".selectedAcItem")) {
                event.preventDefault();
                event.stopPropagation();
                // We set the code to what it was up to the point before the token, and we replace the token with the selected Item
                this.acItemClicked(document.querySelector(".selectedAcItem")?.id??"");
            }
            // If AC is not loaded or no selection is available, we want to take the focus from the slot
            // (for Enter --> we use onLRKeyUp(); for Tab --> we don't do anything special, keep the default browser behaviour)
            else {
                if(event.key == "Enter") {
                    this.onLRKeyUp(event);
                }
                this.showAC = false;
            }
        },

        onEqualOrSpaceKeyDown(event: KeyboardEvent){
            // If the frame is a variable assignment frame and we are in the left hand side editable slot,
            // pressing "=" or space keys move to RHS editable slot
            // Note: because 1) key code value is deprecated and 2) "=" is coded a different value between Chrome and FF, 
            // we explicitly check the "key" property value check here as any other key could have been typed
            if((event.key === "=" || event.key === " ") && this.frameType === VarAssignDefinition.type && this.slotIndex === 0){
                this.onLRKeyUp(new KeyboardEvent("keydown", { key: "Enter" })); // simulate an Enter press to make sure we go to the next slot
                event.preventDefault();
                event.stopPropagation();
            }
        },
        
        acItemClicked(item: string) {
            const selectedItem = (document.getElementById(item) as HTMLLIElement)?.textContent?.trim()??"";
            if(selectedItem === undefined) {
                return;
            }
            // We set the code to what it was up to the point before the token, and we replace the token with the selected Item
            const inputField = document.getElementById(this.UIID) as HTMLInputElement;
            const currentTextCursorPos = inputField.selectionStart??0;
            // If the selected AC results is a method or a function we need to add parenthesis to the autocompleted text
            const typeOfSelected: string  = store.getters.getTypeOfAcResult(selectedItem);
            const isSelectedFunction =  (typeOfSelected.includes("function") || typeOfSelected.includes("method"));

            const newCode = this.code.substr(0, currentTextCursorPos - this.token.length) 
            + selectedItem 
            + ((isSelectedFunction)?"()":"")
            + this.code.substr(currentTextCursorPos);
            
            // position the text cursor just after the AC selection - in the parenthesis for functions
            this.textCursorPos = currentTextCursorPos + selectedItem.length - this.token.length + ((isSelectedFunction)?1:0) ;
            
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
            const offset = 8;
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

.editableslot-input {
    border-radius: 5px;
    border: 1px solid transparent;
}

.editableslot-input:hover {
    border: 1px solid #615f5f;
}

.editableslot-input:focus {
    border: 1px solid #615f5f;
}

.editableslot-input::placeholder { /* Chrome, Firefox, Opera, Safari 10.1+ */
  font-style: italic;
}

.editableslot-input:-ms-input-placeholder { /* Internet Explorer 10-11 */
  font-style: italic;
}

.editableslot-input::-ms-input-placeholder { /* Microsoft Edge */
  font-style: italic;
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