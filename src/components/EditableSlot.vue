<template>
    <div class="next-to-eachother editable-slot">
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
            @keydown.left="onLRKeyDown($event)"
            @keydown.right="onLRKeyDown($event)"
            @keydown.up.prevent.stop="onUDKeyDown($event)"
            @keydown.down.prevent.stop="onUDKeyDown($event)"
            @keydown.prevent.stop.esc
            @keyup.esc="onEscKeyUp($event)"
            @keydown.prevent.stop.enter
            @keyup.enter.prevent.stop="onEnterOrTabKeyUp($event)"
            @keydown.tab="onTabKeyDown($event)"
            @keyup.tab="onEnterOrTabKeyUp($event)"
            @keydown.backspace="onBackSpaceKeyDown()"
            @keyup.backspace="onBackSpaceKeyUp()"
            @keydown="onEqualOrSpaceKeyDown($event)"
            @keyup="logCursorPositionAndCheckBracket($event)"
            :class="{editableSlot: focused, error: erroneous(), hidden: isHidden}"
            :id="UIID"
            :key="UIID"
            class="editableslot-input navigationPosition"
            :style="inputTextStyle"
        />
        <div id="editableSlotSpans" :style="spanTextStyle">
            <!--Span for the code parts, DO NOT CHANGE THE INDENTATION, we don't want spaces to be added here -->
            <span 
                :key="UIID+'_'+index" 
                v-for="(styledCodePart, index) in this.styledCodeParts" 
                :class="styledCodePart.style"
                :data-placeholder="defaultText"
            >{{styledCodePart.code}}</span>
        </div>
        <b-popover
            v-if="erroneous()"
            :target="UIID"
            :title="this.$i18n.t('errorMessage.errorTitle')"
            triggers="hover focus"
            :content="errorMessage"
            custom-class="error-popover"
        >
        </b-popover>

        <div 
            class="editableslot-placeholder"
            :id="placeholderUIID"
            :value="code"
        />

        <AutoCompletion
            v-if="focused && showAC" 
            class="ac"
            :slotId="UIID"
            :context="contextAC"
            ref="AC"
            :key="UIID+'_Autocompletion'"
            :id="UIID+'_Autocompletion'"
            :token="token"
            :cursorPosition="cursorPosition"
            :isImportFrame="isImportFrame()"
            @acItemClicked="acItemClicked"
        />
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import store from "@/store/store";
import AutoCompletion from "@/components/AutoCompletion.vue";
import { getEditableSlotUIID, getAcSpanId , getDocumentationSpanId, getReshowResultsId, getTypesSpanId } from "@/helpers/editor";
import { CaretPosition, FrameObject, CursorPosition, EditableSlotReachInfos, VarAssignDefinition, ImportDefinition, FromImportDefinition, CommentDefinition, StyledCodePart, CodeStyle} from "@/types/types";
import { getCandidatesForAC, getImportCandidatesForAC, resetCurrentContextAC } from "@/autocompletion/acManager";
import getCaretCoordinates from "textarea-caret";
import { getStyledCodeLiteralsSplits } from "@/parser/parser";

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
            //used the flags to indicate whether the user has explictly marked a pause when deleting text with backspace
            //or that the slot is initially empty
            canBackspaceDeleteFrame: true,   
            stillBackSpaceDown: false,
            //use to make sure that a tab event is a proper sequence (down > up) within an editable slot
            tabDownTriggered: false,
            //an array of code "parts" associated with styles (to emphasis the literal types i.e. numbers, strings and booleans)
            styledCodeParts: [] as StyledCodePart[],
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
                "background-color": ((this.focused) ? ((this.code.trim().length > 0) ? "rgba(255, 255, 255, 0.6)" : "#FFFFFF") : "rgba(255, 255, 255, 0)") + " !important", //when the input doesn't have focus, we set the background to fully transparent to allow the spans to be seen underneath
                "width" : this.computeFitWidthValue(),
                "color" : (this.frameType === CommentDefinition.type)
                    ? "#97971E"
                    : (this.focused) ? "#000" : "transparent", //when the input doesn't have focus, we set the colour to transparent to allow the spans to be seen underneath
            };
        },

        spanTextStyle(): Record<string, string> {
            //when the input has focus, we hide the spans, otherwise we show the right background colours
            return (this.focused) 
                ? {"visibility": "hidden"} 
                : {"background-color": ((this.code.trim().length > 0) ? "rgba(255, 255, 255, 0.6)" : "#FFFFFF") + " !important"};
        },

        code: {
            get(): string{
                const code = store.getters.getContentForFrameSlot(
                    this.$parent.$props.frameId,
                    this.$props.slotIndex
                );
                if(code.length > 0){
                    this.setBreakSpaceFlag(false);
                }
                this.generateStyledCodeParts(code);
                return code;
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

                // if the input field exists and it is not a "free texting" slot
                // e.g. : comment, function definition name and args slots, variable assignment LHS slot.
                if(inputField && ((frame.frameType.labels[this.slotIndex].acceptAC)??true)){
                    //get the autocompletion candidates
                    const textBeforeCaret = inputField.value?.substr(0,inputField.selectionStart??0)??"";
                    
                    //workout the correct context if we are in a code editable slot
                    const isImportFrame = (frame.frameType.type === ImportDefinition.type || frame.frameType.type === FromImportDefinition.type)
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

        UIID(): string {
            return getEditableSlotUIID(this.$props.frameId, this.$props.slotIndex);
        },

        errorMessage(): string{
            return store.getters.getErrorForSlot(
                this.$props.frameId,
                this.$props.slotIndex
            );
        },

        isFirstVisibleInFrame(): boolean{
            return store.getters.getIsSlotFirstVisibleInFrame(this.frameId, this.slotIndex);
        },

        debugAC(): boolean{
            return store.getters.getDebugAC();
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
        setBreakSpaceFlag(value: boolean){
            this.canBackspaceDeleteFrame = value;
        },

        generateStyledCodeParts(code: string){
            this.styledCodeParts.splice(0, this.styledCodeParts.length);
            if(code.trim().length === 0){
                this.styledCodeParts[0] = {code: "", style: CodeStyle.empty}
            }
            else{
                //get the "bits" of code that are literals
                const styledCodeSplits = getStyledCodeLiteralsSplits(code);
                let codePos = 0;
                styledCodeSplits.forEach((codeSplit) => {
                    //if the start index is ahead of the current position index, we make a first token
                    if(codeSplit.start > codePos){
                        this.styledCodeParts.push({code: code.substring(codePos, codeSplit.start), style: CodeStyle.none});
                    } 
                    this.styledCodeParts.push({code: code.substring(codeSplit.start, codeSplit.end), style: codeSplit.style});
                    codePos=codeSplit.end;
                })
                //check for a potential trailing part
                if(codePos < code.length){
                    this.styledCodeParts.push({code: code.substring(codePos), style: CodeStyle.none});
                }
            }
        },

        erroneous(): boolean {
            // Only show the popup when there is an error and the code hasn't changed
            return this.isFirstChange && store.getters.getIsErroneousSlot(
                this.$props.frameId,
                this.$props.slotIndex
            );
        },

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
            // When there is no code, we can suppose that we are in a new frame.
            // So, for import frames (from/import slots only) we show the AC automatically
            if((this.frameType === ImportDefinition.type || this.frameType === FromImportDefinition.type) && this.slotIndex < 2 && this.code.length === 0){
                const resultsAC = getImportCandidatesForAC("", this.frameId, this.slotIndex, getAcSpanId(this.UIID), getDocumentationSpanId(this.UIID), getTypesSpanId(this.UIID), getReshowResultsId(this.UIID));   
                this.showAC = resultsAC.showAC;
                this.contextAC = resultsAC.contextAC;
                if(this.showAC){
                    this.token = resultsAC.tokenAC.toLowerCase();  
                }
            }
        },

        onBlur(): void {
            if(!this.debugAC) {
                this.showAC = false;
                store.dispatch(
                    "updateErrorsOnSlotValidation",
                    {
                        frameId: this.$props.frameId,
                        slotId: this.$props.slotIndex,
                        code: this.code.trim(),
                    }   
                );
                //reset the flag for first code change
                this.isFirstChange = true;
            }
        },

        onLRKeyDown(event: KeyboardEvent) {
            //if a key modifier (ctrl, shift or meta) is pressed, we don't do anything special (browser handles it)
            if(!(event.ctrlKey || event.shiftKey || event.metaKey)){
                //get the input field
                const input: HTMLInputElement = this.$el.firstElementChild as HTMLInputElement;
                if(input !== undefined){
                    const start = input.selectionStart ?? 0;
                    const end = input.selectionEnd ?? 0;
                
                    // If we're trying to go off the bounds of this slot
                    if((start === 0 && event.key==="ArrowLeft") || (event.key === "Enter" || (end === input.value.length && event.key==="ArrowRight"))) {
                        store.dispatch(
                            "leftRightKey",
                            {
                                key: event.key,
                            }
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
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        },

        onUDKeyDown(event: KeyboardEvent) {
            //if a key modifier (ctrl, shift or meta) is pressed, we don't do anything special
            if(!(event.ctrlKey || event.shiftKey || event.metaKey)){
                // If the AutoCompletion is on we just browse through it's contents
                // The `results` check, prevents `changeSelection()` when there are no results matching this token
                // And instead, since there is no AC list to show, moves to the next slot
                if(this.showAC && (this.$refs.AC as any)?.areResultsToShow()) {
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
                this.showAC = this.debugAC;
            }
            // If AC is not loaded, we want to take the focus from the slot
            // when we reach at here, the "esc" key event is just propagated and acts as normal
        },

        onTabKeyDown(event: KeyboardEvent){
            // We keep the default browser behaviour when tab is pressed AND we're not having AC on, and we don't use the Shift modifier key
            // As browsers would use the "keydown" event, we have to intercept the event at this stage.
            if(!event.shiftKey && this.showAC && document.querySelector(".selectedAcItem")) {
                event.preventDefault();
                event.stopPropagation();
                this.tabDownTriggered = true;
            }
        },

        onEnterOrTabKeyUp(event: KeyboardEvent){
            //if the tab event has not been triggered by this component, we should ignore it
            if(event.key === "Tab" && !this.tabDownTriggered) {
                return;
            }

            // If the AC is loaded we want to select the AC suggestion the user chose and stay focused on the editableSlot
            if(this.showAC && document.querySelector(".selectedAcItem")) {
                event.preventDefault();
                event.stopPropagation();
                // We set the code to what it was up to the point before the token, and we replace the token with the selected Item
                this.acItemClicked(document.querySelector(".selectedAcItem")?.id??"");
            }
            // If AC is not loaded or no selection is available, we want to take the focus from the slot
            // (for Enter --> we use onLRKeyDown(); for Tab --> we don't do anything special, keep the default browser behaviour)
            else {
                if(event.key == "Enter") {
                    this.onLRKeyDown(event);
                }
            }
            this.showAC = this.debugAC;
            this.tabDownTriggered = false;
        },

        onEqualOrSpaceKeyDown(event: KeyboardEvent){
            // If the frame is a variable assignment frame and we are in the left hand side editable slot,
            // pressing "=" or space keys move to RHS editable slot
            // Note: because 1) key code value is deprecated and 2) "=" is coded a different value between Chrome and FF, 
            // we explicitly check the "key" property value check here as any other key could have been typed
            if((event.key === "=" || event.key === " ") && this.frameType === VarAssignDefinition.type && this.slotIndex === 0){
                this.onLRKeyDown(new KeyboardEvent("keydown", { key: "Enter" })); // simulate an Enter press to make sure we go to the next slot
                event.preventDefault();
                event.stopPropagation();
            }
            // We also prevent start trailing spaces on all slots except comments, to avoid indentation errors
            else if(this.frameType !== CommentDefinition.type && event.key === " "){
                const inputField = document.getElementById(this.UIID) as HTMLInputElement;
                const currentTextCursorPos = inputField.selectionStart??0;
                if(currentTextCursorPos == 0){
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        },

        onBackSpaceKeyDown(){
            // When the backspace key is hit we delete the container frame when:
            //  1) there is no text in the slot
            //  2) we are in the first slot of a frame (*first that appears in the UI*) 
            // To avoid unwanted deletion, we "force" a delay before removing the frame.
            this.stillBackSpaceDown = true;
            if(this.isFirstVisibleInFrame && this.code.length == 0){
                //if the user had already released the key up, no point waiting, we delete straight away
                if(this.canBackspaceDeleteFrame){
                    this.onBlur();
                    store.dispatch(
                        "deleteFrameFromSlot",
                        this.frameId
                    );
                }
                else{        
                    setTimeout(()=>{
                        if(this.stillBackSpaceDown){
                            this.onBlur();
                            store.dispatch(
                                "deleteFrameFromSlot",
                                this.frameId
                            );
                        }
                    }, 600);
                }
            }
        },

        onBackSpaceKeyUp(){
            this.canBackspaceDeleteFrame = (this.code.length == 0);
            this.stillBackSpaceDown = false;
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
            const typeOfSelected: string  = (this.$refs.AC as any).getTypeOfSelected(item);

            const isSelectedFunction =  (typeOfSelected.includes("function") || typeOfSelected.includes("method"));

            const newCode = this.code.substr(0, currentTextCursorPos - this.token.length) 
            + selectedItem 
            + ((isSelectedFunction)?"()":"")
            + this.code.substr(currentTextCursorPos);
            
            // position the text cursor just after the AC selection - in the parenthesis for functions
            this.textCursorPos = currentTextCursorPos + selectedItem.length - this.token.length + ((isSelectedFunction)?1:0) ;
            
            this.code = newCode;
            this.showAC = this.debugAC;
        },

        // store the cursor position to give it as input to AutoCompletionPopUp
        // Also checks if s bracket is opened, so it closes it
        logCursorPositionAndCheckBracket(event: KeyboardEvent) {
            //on Windows with non English keyboard layouts, some of the brackets/quotes are produced with a key combination,
            //so key.up will be called several times
            //to avoid problems, we ignore those keys
            if(["Control", "AltGraph", "Alt", "Shift", "Delete", "Backspace"].includes(event.key)){
                return;
            }

            // get the input field
            const inputField = document.getElementById(this.UIID) as HTMLInputElement;
            const currentTextCursorPos = inputField.selectionStart??0;
            this.$data.cursorPosition = getCaretCoordinates(inputField, inputField.selectionEnd??0)


            //get the hit key informations. Don't key.event here because the result isn't consistent with different keyboard layouts
            const openBracketCharacters = ["(","{","[","\"","'"];
            const characterIndex= openBracketCharacters.indexOf(this.code[(inputField.selectionStart??1)-1]);
            const charValue = openBracketCharacters[characterIndex];

            // if we are adding a " or a ' character, it may not be an opening one, but a closing one.
            if(charValue === "\"" || charValue === "'") {
                // if the the count of " or ' is an even number it means that there we are adding a
                // closing character rather than an opening. [ *Bear in mind that it is even because the
                // character has already been added to this stage, as we are on a keyup event* ]
                if((this.code.match(new RegExp(charValue, "g")) || []).length % 2 === 0) {
                    return
                }
            }

            //check if the character we are addign is an openBracketCharacter
            if(characterIndex !== -1) {
                //create a list with the closing bracket for each one of the opening in the same index
                const closeBracketCharacters = [")","}","]","\"","'"];

                // add the closing bracket to the text
                const newCode = this.code.substr(0, currentTextCursorPos) 
                + closeBracketCharacters[characterIndex] // the needed closing bracket or punctuation mark
                + this.code.substr(currentTextCursorPos);

                this.showAC = false;
                // set the text in the input field and move the cursor inside the brackets
                this.textCursorPos  = currentTextCursorPos;
                this.code = newCode;
            }

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

        isImportFrame(): boolean {
            return store.getters.isImportFrame(this.frameId)
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
    padding: 1px 2px;
    position:absolute;
    top: 0%;
    left: 0%;
    outline: none;
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

#editableSlotSpans{
    border: 1px solid transparent;
    border-radius: 5px;
    padding: 1px 2px;
}

.editableSlotSpansHidden {
    visibility: hidden;
}

#editableSlotSpans span{
    outline: none;
    white-space: pre;
}

.editableslot-placeholder {
    position: absolute;
    display: inline-block;
    visibility: hidden;
    white-space: pre; //as this div placeholder is used to dynamically compute the width of the input field, we have to preserve the spaces exactly written by the user in the input field.
}

.error-popover {
    // Nedded for the code to understand the formated errors which split multiple
    // errors with \n
    white-space: pre-line !important;
}

.editable-slot{
    position: relative;
}

.ac {
    position: absolute;
    left: 0px;
    z-index: 10;
}

// Classes implenting the style tokens defined in type.ts (for the interface StyledCodePart)
.string-token {
    color: #006600;
}

.number-token {
    color: blue;
}

.bool-token {
    color: purple; 
}

.empty-token {
    font-style: italic;
    color: grey;
}

.empty-token:empty::before {
    content:attr(data-placeholder);
}
</style>