<template>
    <div :id="'div_'+UIID" :class="{'next-to-eachother labelSlot-container': true, nohover: isDraggingFrame}">
        <span
            autocomplete="off"
            spellcheck="false"
            :disabled="isDisabled"
            :placeholder="defaultText"
            :contenteditable="isEditableSlot"
            @click.stop="onGetCaret"
            @slotGotCaret="onGetCaret"
            @slotLostCaret="onLoseCaret"
            @keydown.up.prevent.stop="onUDKeyDown($event)"
            @keydown.down.prevent.stop="onUDKeyDown($event)"
            @keydown.prevent.stop.esc
            @keyup.esc="onEscKeyUp($event)"
            @keydown.prevent.stop.enter
            @keyup.enter.prevent.stop="onEnterOrTabKeyUp($event)"
            @keydown.tab="onTabKeyDown($event)"
            @keyup.tab="onEnterOrTabKeyUp($event)"
            @keydown.backspace="onBackSpaceKeyDown"
            @keydown.delete="onDeleteKeyDown"
            @keyup.backspace="onBackSpaceKeyUp"
            @keydown="onKeyDown($event)"
            @paste.prevent.stop="onCodePaste($event)"
            :class="{'labelSlot-input': true, navigationPosition: isEditableSlot, error: erroneous(), [getSpanTypeClass]: true, bold: isEmphasised}"
            :id="UIID"
            :key="UIID"
            :style="spanStyle"
            @input="onSlotSpanChange"
            v-text="code"
        >
        </span>
               
        <b-popover
            v-if="erroneous()"
            :target="UIID"
            :title="errorHeader"
            triggers="hover focus"
            :content="errorMessage"
            custom-class="error-popover"
            placement="bottom"
        >
        </b-popover>

        <AutoCompletion
            v-if="focused && showAC"
            :class="{ac: true, hidden: !acRequested}"
            :slotId="UIID"
            :context.sync="contextAC"
            :token.sync="tokenAC"
            ref="AC"
            :key="UIID+'_Autocompletion'"
            :id="UIID+'_Autocompletion'"
            :cursorPosition="cursorPosition"
            :isImportFrame="isImportFrame()"
            @acItemClicked="acItemClicked"
        />
    </div>
</template>

<script lang="ts">
import Vue, { PropType } from "vue";
import { useStore } from "@/store/store";
import AutoCompletion from "@/components/AutoCompletion.vue";
import { getLabelSlotUIID, getAcSpanId , getDocumentationSpanId, getReshowResultsId, getTypesSpanId, getAcContextPathId, CustomEventTypes, getFrameHeaderUIID, getTextStartCursorPositionOfHTMLElement, closeBracketCharacters, getTextEndCursorPositionOfHTMLElement, getMatchingBracket, operators, openBracketCharacters, keywordOperatorsWithSurroundSpaces, stringQuoteCharacters, getFocusedEditableSlotTextSelectionStartEnd, parseCodeLiteral, getNumPrecedingBackslashes, setDocumentSelection, getFrameLabelSlotsStructureUIID } from "@/helpers/editor";
import { CaretPosition, FrameObject, CursorPosition, AllFrameTypesIdentifier, SlotType, SlotCoreInfos, isFieldBracketedSlot, SlotsStructure, BaseSlot, StringSlot, isFieldStringSlot, SlotCursorInfos, areSlotCoreInfosEqual} from "@/types/types";
import { getCandidatesForAC, getImportCandidatesForAC, resetCurrentContextAC } from "@/autocompletion/acManager";
import { mapStores } from "pinia";
import { evaluateSlotType, getFlatNeighbourFieldSlotInfos, retrieveParentSlotFromSlotInfos, retrieveSlotFromSlotInfos } from "@/helpers/storeMethods";
import Parser from "@/parser/parser";

export default Vue.extend({
    name: "LabelSlot",

    components: {
        AutoCompletion,
    },

    props: {
        defaultText: String,
        code: String,
        labelSlotsIndex: Number,
        slotId: String,
        slotType: {
            type: Number as PropType<SlotType>,
        },
        frameId: Number,
        isDisabled: Boolean,
        isEditableSlot: Boolean,
        isEmphasised: Boolean,
    },

    beforeUpdate(){
        // If the text isn't set again here, despite "code" being reactive, we end up with "duplicated" insert with operators.
        const spanElement = document.getElementById(this.UIID);
        if(spanElement && this.appStore.anchorSlotCursorInfos && this.appStore.focusSlotCursorInfos){ // Keep TS happy
            const prevTextContent = spanElement.textContent;
            spanElement.textContent = this.code;
            // After changing the code here, FF requires the right caret position to be reassigned, otherwise the caret moves back to the first
            // position. The condition ensure we do this only for the right slot, and when the text is in line with the selection we are going to set.
            if(areSlotCoreInfosEqual(this.appStore.focusSlotCursorInfos.slotInfos, this.coreSlotInfo) && prevTextContent === this.code){
                setDocumentSelection(this.appStore.anchorSlotCursorInfos, this.appStore.focusSlotCursorInfos);
            }
        }
    },

    beforeDestroy() {
        this.appStore.removePreCompileErrors(this.UIID);
    },

    data: function() {
        return {
            //this flags indicates if the content of editable slot has been already modified during a sequence of action
            //as we don't want to save each single change of the content, but the full content change itself.
            isFirstChange: true, 
            cursorPosition: {} as CursorPosition,
            showAC: false,
            acRequested: false,
            contextAC: "",
            tokenAC: "",
            //used to force a text cursor position, for example after inserting an AC candidate
            textCursorPos: 0,    
            //used the flags to indicate whether the user has explicitly marked a pause when deleting text with backspace
            //or that the slot is initially empty
            canBackspaceDeleteFrame: true,   
            stillBackSpaceDown: false,
            //use to make sure that a tab event is a proper sequence (down > up) within an editable slot
            tabDownTriggered: false,
            //we need to track the key.down events for the bracket/quote closing method (cf details there)
            keyDownStr: "",
        };
    },
    
    computed: {
        ...mapStores(useStore),

        coreSlotInfo(): SlotCoreInfos{
            return {
                frameId: this.frameId,
                labelSlotsIndex: this.labelSlotsIndex,
                slotId: this.slotId,
                slotType: this.slotType,
            };
        },

        initCode(): string {
            return this.appStore.currentInitCodeValue;
        },

        stringQuote(): string {
            // Keep information of the quote for string slots (empty string for other types of slot)
            if(this.slotType == SlotType.string){
                return (retrieveSlotFromSlotInfos(this.coreSlotInfo) as StringSlot).quote;
            }
            return "";
        },
        
        frameType(): string{
            return this.appStore.frameObjects[this.frameId].frameType.type;
        },

        spanStyle(): Record<string, string> {
            const isStructureSingleSlot = this.appStore.frameObjects[this.frameId].labelSlotsDict[this.labelSlotsIndex].slotStructures.fields.length == 1;
            const isSlotOptional = this.appStore.frameObjects[this.frameId].frameType.labels[this.labelSlotsIndex].optionalSlot;
            
            return {
                // Background: if the field has a value, it's set to a semi transparent background when focused, and transparent when not
                // if the field doesn't have a value, it's always set to a white background unless it is not the only field of the current structure 
                // and content isn't optional (then it's transparent) - that is to distinguish the fields that are used for cursors placeholders 
                // to those indicating there is no compulsory value
                "background-color": ((this.focused) 
                    ? ((this.getSlotContent().trim().length > 0) ? "rgba(255, 255, 255, 0.6)" : "#FFFFFF") 
                    : ((isStructureSingleSlot && !isSlotOptional && this.code.trim().length == 0) ? "#FFFFFF" : "rgba(255, 255, 255, 0)")) 
                    + " !important",
                "color": (this.frameType === AllFrameTypesIdentifier.comment)
                    ? "#97971E"
                    : "#000", 
            };
        }, 

        getSpanTypeClass(): string {
            // Returns the class name for a span type (code, int, operator...)
            let codeTypeCSS = "";
            switch(this.slotType){
            case SlotType.operator:
                codeTypeCSS = "operator-slot";
                break;
            case SlotType.string:
            case SlotType.openingQuote:
            case SlotType.closingQuote:
                codeTypeCSS = "string-slot";
                break;
            case SlotType.number:
                codeTypeCSS = "number-slot";
                break;
            case SlotType.bool:
                codeTypeCSS = "bool-slot";
                break;
            }
            return codeTypeCSS;
        },

        focused(): boolean {
            return this.appStore.isEditableFocused(this.coreSlotInfo);
        },

        UIID(): string {
            return getLabelSlotUIID(this.coreSlotInfo);
        },

        errorMessage(): string{
            return this.appStore.getErrorForSlot(this.coreSlotInfo);
        },

        errorHeader(): string{
            return this.appStore.getErrorHeaderForSlot(this.coreSlotInfo);
        },

        debugAC(): boolean{
            return this.appStore.debugAC;
        },

        isDraggingFrame(): boolean{
            return this.appStore.isDraggingFrame;
        },

        isFrameEmpty(): boolean {
            // This computed property checks that all the (visible) editable slots of a frame, and if applies, its body, are empty
            const isEmpty = !(Object.values(this.appStore.frameObjects[this.frameId].labelSlotsDict).some((labelSlotContent) => ((labelSlotContent.shown??true) && 
                (labelSlotContent.slotStructures.fields.length > 1 || (labelSlotContent.slotStructures.fields[0] as BaseSlot).code.trim().length > 0))) 
                || this.appStore.frameObjects[this.frameId].childrenIds.length > 0);
            return isEmpty;
        },
    },

    methods: {
        getSlotContent(): string{
            // If the input span hasn't yet be created, we return an empty string
            if(document.getElementById(this.UIID) == null) {
                return "";
            }            
            return (document.getElementById(this.UIID) as HTMLSpanElement).textContent ?? "";
        },

        setSlotContent(value: string){
            (document.getElementById(this.UIID) as HTMLSpanElement).textContent = value;
            this.onSlotSpanChange();
        },

        onSlotSpanChange(){
            const spanElement = (document.getElementById(this.UIID) as HTMLSpanElement);
            this.textCursorPos = getTextStartCursorPositionOfHTMLElement(spanElement);

            // Send an event to the frame that need to know that an editable slot got focus (no extra information needed as args for the moment)
            document.getElementById(getFrameHeaderUIID(this.frameId))?.dispatchEvent(new Event(CustomEventTypes.frameContentEdited));
            
            // Event will only get the unitary input rather than the resulting change, so we get the data from the element directly to pass it in the store
            this.appStore.setFrameEditableSlotContent(
                {
                    ...this.coreSlotInfo,
                    code: (spanElement.textContent??""),
                    initCode: this.initCode,
                    isFirstChange: this.isFirstChange,
                }
            );

            // The cursor position is not maintained because of the changes in the store and reactivity
            // so we reposition it correctly, at the next tick (because code needs to be updated first)
            this.$nextTick(() => {
                const slotCursorInfo: SlotCursorInfos = {slotInfos: this.coreSlotInfo, cursorPos: this.textCursorPos};
                setDocumentSelection(slotCursorInfo, slotCursorInfo);
            });

            this.isFirstChange = false;
        },

        erroneous(): boolean {
            // Only show the popup when there is an error and the code hasn't changed
            return this.isFirstChange && this.appStore.isErroneousSlot(this.coreSlotInfo);
        },

        // Event callback equivalent to what would happen for a focus event callback 
        // (the spans don't get focus anymore because the containg editable div grab it)
        onGetCaret(): void {
            this.isFirstChange = true;
            //reset the AC context
            resetCurrentContextAC();
            this.appStore.setFocusEditableSlot(
                {
                    frameSlotInfos: this.coreSlotInfo,
                    caretPosition: (this.appStore.getAllowedChildren(this.frameId)) ? CaretPosition.body : CaretPosition.below,
                }
            );

            // Reset the flag here as we have consumed the focus event (cf. directives > focus)
            useStore().editableSlotViaKeyboard = {isKeyboard: false, direction: 1};

            this.updateAC();
        },
        
        updateAC() : void {
            const frame: FrameObject = this.appStore.frameObjects[this.frameId];
            const selectionStart = getFocusedEditableSlotTextSelectionStartEnd(this.UIID).selectionStart;

            // If the slot accepts auto-complete, i.e. it is not a "free texting" slot
            // e.g. : comment, function definition name and args slots, variable assignment LHS slot.
            if((frame.frameType.labels[this.labelSlotsIndex].acceptAC)??true){
                //get the autocompletion candidates
                const textBeforeCaret = this.code.substr(0,selectionStart??0)??"";

                //workout the correct context if we are in a code editable slot
                const isImportFrame = (frame.frameType.type === AllFrameTypesIdentifier.import || frame.frameType.type === AllFrameTypesIdentifier.fromimport);
                const resultsAC = (isImportFrame)
                    ? getImportCandidatesForAC(textBeforeCaret, this.frameId, this.labelSlotsIndex, getAcSpanId(this.UIID), getDocumentationSpanId(this.UIID), getTypesSpanId(this.UIID), getReshowResultsId(this.UIID), getAcContextPathId(this.UIID))
                    : getCandidatesForAC(textBeforeCaret, this.frameId, getAcSpanId(this.UIID), getDocumentationSpanId(this.UIID), getTypesSpanId(this.UIID), getReshowResultsId(this.UIID), getAcContextPathId(this.UIID));
                this.showAC = resultsAC.showAC;
                this.contextAC = resultsAC.contextAC;
                if(resultsAC.showAC){
                    this.tokenAC = resultsAC.tokenAC.toLowerCase();
                }

                this.$nextTick(() => {
                    this.getACresultsFromBrython();
                });
            }
        },


        // Event callback equivalent to what would happen for a blur event callback 
        // (the spans don't get focus anymore because the containg editable div grab it)
        onLoseCaret(): void {
            // Before anything, we make sure that the current frame still exists.
            if(this.appStore.frameObjects[this.frameId] != undefined){
                if(!this.debugAC) {
                    this.showAC = false;
                    this.acRequested = false;
                    if(this.appStore.bypassEditableSlotBlurErrorCheck || this.appStore.isSelectingMultiSlots){
                        this.appStore.setEditableFocus(
                            {
                                ...this.coreSlotInfo,
                                focused: false,
                            }
                        );
                    }
                    else{
                        this.appStore.updateErrorsOnSlotValidation(
                            {
                                ...this.coreSlotInfo,
                                code: this.getSlotContent().trim(),
                                initCode: this.initCode,
                                isFirstChange: this.isFirstChange,
                            }   
                        );
                    }
                    //reset the flag for first code change
                    this.isFirstChange = true;

                    // As we leave a slot, we reset the slot cursor infos EXCEPT when the keyboard event is ignored
                    // or when we are doing multislot selection
                    if(!this.appStore.ignoreKeyEvent && !this.appStore.isSelectingMultiSlots){
                        this.appStore.setSlotTextCursors(undefined, undefined);
                    }
                    this.appStore.ignoreKeyEvent = false;
                }
            }
        },

        onUDKeyDown(event: KeyboardEvent) {
            this.appStore.isSelectingMultiSlots = false; // reset the flag
            //if a key modifier (ctrl, shift or meta) is pressed, we don't do anything special
            if(!(event.ctrlKey || event.shiftKey || event.metaKey)){
                // If the AutoCompletion is on we just browse through it's contents
                // The `results` check, prevents `changeSelection()` when there are no results matching this token
                // And instead, since there is no AC list to show, moves to the next slot
                if(this.showAC && this.acRequested && (this.$refs.AC as any)?.areResultsToShow()) {
                    (this.$refs.AC as any).changeSelection((event.key === "ArrowUp")?-1:1);
                }
                // Else we move the caret
                else {  
                    // In any case the focus is lost, and the caret is shown (visually below by default)
                    this.onLoseCaret();
                    //If the up arrow is pressed you need to move the caret as well.
                    if( event.key === "ArrowUp" ) {
                        this.appStore.changeCaretPosition(event.key);
                    }
                    else{
                        // Restore the caret visibility
                        this.appStore.frameObjects[this.appStore.currentFrame.id].caretVisibility = this.appStore.currentFrame.caretPosition;
                    }

                    // Make sure there is no longer a selection
                    this.appStore.setSlotTextCursors(undefined, undefined);
                    document.getSelection()?.removeAllRanges();

                    this.appStore.ignoreKeyEvent = true;
                }
            }
        },
        
        onEscKeyUp(event: KeyboardEvent) {
            // If the AC is loaded we want to close it with an ESC and stay focused on the editableSlot
            if(this.showAC && this.acRequested) {
                event.preventDefault();
                event.stopPropagation();
                this.showAC = this.debugAC;
                this.acRequested = false;
            }
            // If AC is not loaded, we want to take the focus from the slot
            // when we reach at here, the "esc" key event is just propagated and acts as normal
        },

        onTabKeyDown(event: KeyboardEvent){
            // We keep the default browser behaviour when tab is pressed AND we're not having AC on, and we don't use the Shift modifier key
            // As browsers would use the "keydown" event, we have to intercept the event at this stage.
            if(!event.shiftKey && this.showAC && this.acRequested && document.querySelector(".selectedAcItem")) {
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
            if(this.showAC && this.acRequested && document.querySelector(".selectedAcItem")) {
                event.preventDefault();
                event.stopPropagation();
                // We set the code to what it was up to the point before the token, and we replace the token with the selected Item
                this.acItemClicked(document.querySelector(".selectedAcItem")?.id??"");
            }
            // If AC is not loaded or no selection is available, we want to take the focus from the slot
            // (for Enter --> we use onLRKeyDown(); for Tab --> we don't do anything special, keep the default browser behaviour)
            else {
                if(event.key == "Enter") {
                    // Pretend we move the caret to the last possible position of this side
                    const slotCursorInfo: SlotCursorInfos = {slotInfos: this.coreSlotInfo, cursorPos: this.code.length};
                    this.appStore.setSlotTextCursors(slotCursorInfo, slotCursorInfo);
                    document.getElementById(getFrameLabelSlotsStructureUIID(this.frameId, this.labelSlotsIndex))?.dispatchEvent(
                        new KeyboardEvent("keydown", {
                            key: "ArrowRight",
                        })
                    );
                }
            }
            this.showAC = this.debugAC;
            this.acRequested = false;
            this.tabDownTriggered = false;
        },

        onKeyDown(event: KeyboardEvent){
            // We store the key.down key event.key value for the bracket/quote closing method (cf details there)
            this.keyDownStr = event.key;

            // We capture the key shortcut for opening the a/c
            if((event.metaKey || event.ctrlKey) && event.key == " "){
                console.log("AC requested");
                this.acRequested = true;
            }

            // We already handle some keys separately, so no need to process any further (i.e. deletion)
            // We can just discard any keys with length > 0
            if(event.key.length > 1 || event.ctrlKey || event.metaKey || event.altKey){
                return;
            }

            const inputSpanField = document.getElementById(this.UIID) as HTMLSpanElement;
            const inputSpanFieldContent = inputSpanField.textContent ?? "";
            const currentStartTextCursor = getTextStartCursorPositionOfHTMLElement(inputSpanField);
            const currentEndTextCursor = getTextEndCursorPositionOfHTMLElement(inputSpanField);
            const currentSlot = retrieveSlotFromSlotInfos(this.coreSlotInfo) as BaseSlot;
            const parentSlot = retrieveParentSlotFromSlotInfos(this.coreSlotInfo);
            const nextSlotInfos = getFlatNeighbourFieldSlotInfos(this.coreSlotInfo, true, true);
  
            const {selectionStart, selectionEnd} = getFocusedEditableSlotTextSelectionStartEnd(this.UIID);

            // If the frame is a variable assignment frame and we are in the left hand side editable slot,
            // pressing "=" or space keys move to RHS editable slot (but we allow the a/c to be activated)
            // Note: because 1) key code value is deprecated and 2) "=" is coded a different value between Chrome and FF, 
            // we explicitly check the "key" property value check here as any other key could have been typed
            if(((event.key === "=" || event.key === " ") && !event.ctrlKey) && this.frameType === AllFrameTypesIdentifier.varassign && this.labelSlotsIndex === 0){
                // Simulate a right arrow key press to make sure we go to the next slot
                document.getElementById(getFrameLabelSlotsStructureUIID(this.frameId, this.labelSlotsIndex))?.dispatchEvent(
                    new KeyboardEvent(event.type, {
                        key: "ArrowRight",
                    })
                );
                event.preventDefault();
                event.stopPropagation();
            }
            // We also prevent start trailing spaces on all slots except comments, to avoid indentation errors
            else if(event.key === " " && this.frameType !== AllFrameTypesIdentifier.comment && currentStartTextCursor == 0){
                event.preventDefault();
                event.stopPropagation();
            }
            
            // Finally, we check the case an operator, bracket or quote has been typed and the slots within this frame need update
            // First we check closing brackets or quote as they have a specifc behaviour, then keep working out the other things
            else if((closeBracketCharacters.includes(event.key) && !isFieldStringSlot(currentSlot)) || (isFieldStringSlot(currentSlot) && stringQuoteCharacters.includes(event.key))){
                // Closing bracket / quote: key hits are ignored except for escaping a quote in a string
                // However, when no text is highlighted and we are just before that same closing bracket / quote (no text between text cursor and bracket)
                // we move the text cursor in the next slot, as we consider the user closed an existing already closed bracket / quote.
                let shouldMoveToNextSlot = (selectionStart == selectionEnd);
                // Checking if we are escaping the quote used for this string (i.e. we are after an escaping \, and there is no quote following the caret)
                const isEscapingString = isFieldStringSlot(currentSlot) && currentStartTextCursor > 0 && (getNumPrecedingBackslashes(inputSpanFieldContent, currentStartTextCursor) % 2) == 1
                    && ((currentStartTextCursor < inputSpanFieldContent.length && inputSpanFieldContent[currentStartTextCursor]!= event.key) || currentStartTextCursor == inputSpanFieldContent.length);
                if(isEscapingString){
                    this.insertSimpleTypedKey(event.key, true);
                    return;
                }
                if(shouldMoveToNextSlot){
                    if(isFieldStringSlot(currentSlot)){
                        // Check for string quotes first, note that contrary to brackets, trailing spaces in a string are meaningful
                        shouldMoveToNextSlot = currentStartTextCursor == inputSpanFieldContent.length 
                            && (currentSlot as StringSlot).quote == event.key;
                        if(!shouldMoveToNextSlot && (currentSlot as StringSlot).quote != event.key){
                            // If a quote that is NOT the same as this slot's quote was typed, we can add it.
                            // So, we just don't do anything special in that situation.
                            this.insertSimpleTypedKey(event.key, true);
                            return;
                        }
                    }
                    else{
                        // It's not a string, check for bracket
                        const parentBracketSlot = (parentSlot && isFieldBracketedSlot(parentSlot)) ? parentSlot as SlotsStructure : undefined;
                        shouldMoveToNextSlot = inputSpanFieldContent.substring(currentEndTextCursor).trim().length == 0
                            // make sure we are inside a bracketed structure and that the opening bracket is the counterpart of the key value (closing bracket)
                            && parentBracketSlot != undefined && parentBracketSlot.openingBracketValue == getMatchingBracket(event.key, false);
                    }
                    if(shouldMoveToNextSlot){
                        // focus the subslot following the closing bracket, in the next tick
                        this.$nextTick(() => {
                            if(nextSlotInfos){
                                //Should always find something because a bracket or a string slot are followed by a text slot
                                const afterBracketOrStringSlotCursorInfo: SlotCursorInfos = {slotInfos: {...this.coreSlotInfo, slotId: nextSlotInfos.slotId, slotType: nextSlotInfos.slotType}, cursorPos: 0};
                                this.appStore.editableSlotViaKeyboard.isKeyboard = true; // in order to get the focused editable subslot performing the bracket checks in onGetCaret()
                                document.getElementById(getLabelSlotUIID(afterBracketOrStringSlotCursorInfo.slotInfos))?.dispatchEvent(new Event(CustomEventTypes.editableSlotGotCaret));
                                this.appStore.setSlotTextCursors(afterBracketOrStringSlotCursorInfo, afterBracketOrStringSlotCursorInfo);
                            }               
                        });
                    }
                }
                event.preventDefault();
                event.stopImmediatePropagation();
            }
            else{
                // In any other scenario, we capture the key ourselves to handle the UI changes
                event.preventDefault();
                event.stopPropagation();
                this.appStore.ignoreKeyEvent = true;
                let insertKey = true;

                // Check that if we are in a string slot, all characters but the quote of that string are allowed
                // note: string quotes logic is already handled by checking the closing brackets/quotes above
                if(isFieldStringSlot(currentSlot)) {
                    if((currentSlot as StringSlot).quote == event.key){
                        return;
                    }
                    this.insertSimpleTypedKey(event.key);
                }
                else{
                    // Brackets, quotes or operators have been typed. For operators:
                    // a symbol style operator is either one by itself or the second character of one operator (e.g. "=="),
                    // a text style operator is detected in the slot (eg " and "), we split the slot to insert that operator
                    // In Python, "!" is NOT an operator, but "!=" is. Therefore we need to deal with "!" here if it composes "!=".
                    let textualOperator  = ""; // we need this to be able to find out which textual operator we have found
                    let potentialOutput = inputSpanFieldContent.substring(0, currentStartTextCursor) + event.key + inputSpanFieldContent.substring(currentEndTextCursor);
                    const isSymbolicOperator = operators.includes(event.key);
                    const isBang = (event.key === "!");
                    const isBracket = openBracketCharacters.includes(event.key);
                    const isStringQuote = stringQuoteCharacters.includes(event.key);
                    if(isSymbolicOperator 
                    || isBang
                    || keywordOperatorsWithSurroundSpaces.some((operator) => {
                        textualOperator = operator.trim();
                        return (potentialOutput.includes(operator) || potentialOutput.startsWith(textualOperator + " "));
                    })
                    || isBracket
                    || isStringQuote
                    ){
                    // If we are in the LHS of a function definition, of a variable assignment, of a for; or in an import, then we just don't allow 
                    // the operator, bracket or quote
                        const forbidOperator = [AllFrameTypesIdentifier.funcdef, AllFrameTypesIdentifier.varassign, AllFrameTypesIdentifier.for].includes(this.frameType) 
                        && this.labelSlotsIndex == 0
                        || this.frameType == AllFrameTypesIdentifier.import;
                        insertKey = !forbidOperator;
                        if(!forbidOperator){
                            if(isBracket || isStringQuote){
                                insertKey = false;
                                // add the counter part here, so the parser can work things out properly with slots
                                inputSpanField.textContent = inputSpanFieldContent.substring(0, currentStartTextCursor)
                                    + event.key 
                                    + inputSpanFieldContent.substring(selectionStart, selectionEnd) 
                                    + ((isBracket) ? getMatchingBracket(event.key, true) : event.key)
                                    + inputSpanFieldContent.substring(currentStartTextCursor + (selectionEnd - selectionStart));
                                // If there is no text selection, we "autocomplete" the opening token and want to get after it, into the structure, at position 0
                                // if there text selection, we are wrapping the text with the tokens and we want to get after the closing token
                                const newPos = (selectionStart == selectionEnd) ? selectionStart + 1 : (currentStartTextCursor + 2 + (selectionEnd -  selectionStart));
                                this.appStore.setSlotTextCursors({slotInfos: this.coreSlotInfo, cursorPos: newPos}, {slotInfos: this.coreSlotInfo, cursorPos: newPos});
                            }               
                        }
                    }
                    if(insertKey){
                    // Add the typed key manually
                        this.insertSimpleTypedKey(event.key);
                    }
                }
                // The logic is as such, we handle the insertion in the slot (with adequate adaptation if needed, see above)
                // let the parsing and slot factorisation do the checkup later
                // (we handle the insertion even if there is specific adapation because in the call to emit, the DOM has not updated)
                this.$emit("requestSlotsRefactoring", this.UIID);
            }            
        },

        insertSimpleTypedKey(keyValue: string, forcedInsert?: boolean){
            const inputSpanField = document.getElementById(this.UIID) as HTMLSpanElement;
            const inputSpanFieldContent = inputSpanField.textContent ?? "";  
            const {selectionStart, selectionEnd} = getFocusedEditableSlotTextSelectionStartEnd(this.UIID);
            inputSpanField.textContent = inputSpanFieldContent.substring(0, selectionStart)
                        + keyValue 
                        + inputSpanFieldContent.substring(selectionEnd);
            // Update the focus cusor infos (to the next character position)
            const newPos = selectionStart + 1;
            this.appStore.setSlotTextCursors({slotInfos: this.coreSlotInfo, cursorPos: newPos}, {slotInfos: this.coreSlotInfo, cursorPos: newPos}); 
            // In some cases (i.e. editing inside a string) we do not call the slot refactoring which will handle the selection properly 
            if(forcedInsert){
                this.appStore.setFrameEditableSlotContent(
                    {
                        ...this.coreSlotInfo,
                        code: inputSpanField.textContent,
                        initCode: this.initCode,
                        isFirstChange: this.isFirstChange,
                    }
                ).then(() => {
                    const slotCursorInfos: SlotCursorInfos = {slotInfos: this.coreSlotInfo, cursorPos: newPos};
                    setDocumentSelection(slotCursorInfos, slotCursorInfos);
                });
            }          
        },

        onCodePaste(event: ClipboardEvent){
            // Pasted code is done in 3 steps:
            // 1) correct the code literal if needed (for example pasting "(a" will result in pasting "(a)")
            // 2) add the corrected code at the current location 
            // 3) set the text cursor at the right location       
            // 4) check if the slots need to be refactorised
            this.appStore.ignoreKeyEvent = true;
            const inputSpanField = document.getElementById(this.UIID);
            const clipboardData = event.clipboardData;
            const {selectionStart, selectionEnd} = getFocusedEditableSlotTextSelectionStartEnd(this.UIID);
            if(inputSpanField && inputSpanField.textContent != undefined && clipboardData){ //Keep TS happy
                // part 1 - note that if we are in a string, we just copy as is except for the quotes that must be parsed
                let cursorOffset = 0;
                let correctedPastedCode = "";
                if(this.slotType == SlotType.string){
                    const regex = (this.stringQuote =="\"")
                        ? /(^|[^\\])(")/g
                        : /(^|[^\\])(')/g;
                    correctedPastedCode = clipboardData.getData("Text").replaceAll(regex, (match) => {
                        cursorOffset--;
                        return match[0]??"";
                    });
                }
                else{
                    const {slots: tempSlots, cursorOffset: tempcursorOffset} = parseCodeLiteral(clipboardData.getData("Text"));
                    const parser = new Parser();
                    correctedPastedCode = parser.getSlotStartsLengthsAndCodeForFrameLabel(tempSlots, 0).code;
                    cursorOffset = tempcursorOffset;
                }
                // part 2
                inputSpanField.textContent = inputSpanField.textContent.substring(0, selectionStart)
                        + correctedPastedCode
                        + inputSpanField.textContent.substring(selectionEnd);
                // part 3: the orignal cursor position is at the end of the copied string, and we add the offset that is generated while parsing the code
                // so that for example when we copied a non terminated code, the cursor will stay inside the non terminated bit.
                const newPos = selectionStart + clipboardData.getData("Text").length + cursorOffset;
                this.appStore.setSlotTextCursors({slotInfos: this.coreSlotInfo, cursorPos: newPos}, {slotInfos: this.coreSlotInfo, cursorPos: newPos});

                // part 4
                this.$emit("requestSlotsRefactoring", this.UIID);     
            }
        },

        deleteSlots(event: KeyboardEvent){            
            event.preventDefault();
            event.stopImmediatePropagation();
            this.appStore.ignoreKeyEvent = true;
               
            const focusSlotCursorInfos = this.appStore.focusSlotCursorInfos;
            const anchorSlotCursorInfos = this.appStore.anchorSlotCursorInfos;
            const isForwardDeletion = (event.key.toLowerCase() == "delete");
            const nextSlotInfos = getFlatNeighbourFieldSlotInfos(this.coreSlotInfo, true);
            const previousSlotInfos = getFlatNeighbourFieldSlotInfos(this.coreSlotInfo, false);
            const {selectionStart, selectionEnd} = getFocusedEditableSlotTextSelectionStartEnd(this.UIID);

            if(focusSlotCursorInfos && anchorSlotCursorInfos){
                const isSelectingMultiSlots = !areSlotCoreInfosEqual(focusSlotCursorInfos.slotInfos, anchorSlotCursorInfos.slotInfos);

                // Without selection, a slot will be removed when the text caret is at the end of a slot and there is no text selection
                // we delete slots only when there is an operator between the current slot, and the next flat (UI) slot.      
                if(!isSelectingMultiSlots && (selectionStart == selectionEnd) 
                    && ((isForwardDeletion && focusSlotCursorInfos.cursorPos == this.code.length && nextSlotInfos) || (!isForwardDeletion && focusSlotCursorInfos.cursorPos == 0 && previousSlotInfos))){
                    this.appStore.bypassEditableSlotBlurErrorCheck = true;
                    
                    const isDeletingFromString = (this.slotType == SlotType.string);
                    // if we are deleting from a string, we start from a reference cursor position or code length of 0 and only use offset to reposition the cursor
                    const backDeletionCharactersToRetainCount = (isDeletingFromString) ? 0 : this.code.length;
                    const referenceCursorPos = (isDeletingFromString) 
                        ? 0 
                        : focusSlotCursorInfos.cursorPos;
                    const {newSlotId, cursorPosOffset} = this.appStore.deleteSlots(isForwardDeletion, this.coreSlotInfo);
                    
                    // Restore the text cursor position (need to wait for reactive changes)
                    this.$nextTick(() => {
                        const newCurrentSlotInfoNoType = {...this.coreSlotInfo, slotId: newSlotId};
                        const newCurrentSlotType = evaluateSlotType(retrieveSlotFromSlotInfos(newCurrentSlotInfoNoType));
                        let newSlotInfos = {...newCurrentSlotInfoNoType, slotType: newCurrentSlotType};
                        const slotUIID = getLabelSlotUIID(newSlotInfos); 
                        const inputSpanField = document.getElementById(slotUIID) as HTMLSpanElement;
                        const newTextCursorPos = (isForwardDeletion) 
                            ? referenceCursorPos + cursorPosOffset 
                            : ((inputSpanField.textContent??"").length - cursorPosOffset - backDeletionCharactersToRetainCount); 
                        const newCurrentSlotInfoWithType = {...newCurrentSlotInfoNoType, slotType: newCurrentSlotType};
                        const slotCursorInfos: SlotCursorInfos = {slotInfos: newCurrentSlotInfoWithType, cursorPos: newTextCursorPos};
                        document.getElementById(getLabelSlotUIID(newCurrentSlotInfoWithType))?.dispatchEvent(new Event(CustomEventTypes.editableSlotGotCaret));
                        setDocumentSelection(slotCursorInfos, slotCursorInfos);
                        this.appStore.setSlotTextCursors(slotCursorInfos, slotCursorInfos);
                        this.appStore.bypassEditableSlotBlurErrorCheck = false;

                        // In any case, we check if the slots need to be refactorised (next tick required to account for the changed done when deleting brackets/strings)
                        this.$emit("requestSlotsRefactoring", slotUIID);
                    });                                
                }
                else{
                    // We are deleting some code, several cases can happen:
                    // there is a selection of text (case A) or slots (case B) (i.e. within one slot / across slots)
                    // simply remove a character within a slot (case C)
                    // We are deleting text within one slot: we only need to update the slot content and the text cursor position
                    const inputSpanField = document.getElementById(this.UIID) as HTMLSpanElement;
                    const inputSpanFieldContent = inputSpanField.textContent ?? "";
                    let newTextCursorPos = selectionStart;
                    if(selectionEnd != selectionStart || isSelectingMultiSlots){
                        // We are deleting a selection. We need to see if we are also deleting slots (case B) or just text within one slot (case A).
                        // It doesn't matter if we are using "del" or "backspace", the result is the same.
                        if(!isSelectingMultiSlots){
                            // Case A, simply delete the text selection within one slot
                            inputSpanField.textContent = inputSpanFieldContent.substring(0, selectionStart) + inputSpanFieldContent.substring(selectionEnd);
                            //The cursor position may change, so we update it in the store.
                            this.appStore.setSlotTextCursors({slotInfos: this.coreSlotInfo, cursorPos: selectionStart}, {slotInfos: this.coreSlotInfo, cursorPos: selectionStart});             
                        }
                        else{
                            // Case B: we are deleteing a selection spanning across several slots
                            const anchorOffset = anchorSlotCursorInfos.cursorPos;
                            const {newSlotId} = this.appStore.deleteSlots(isForwardDeletion, this.coreSlotInfo);                    
                            // Restore the text cursor position (need to wait for reactive changes)
                            this.$nextTick(() => {
                                const newCurrentSlotInfoNoType = {...this.coreSlotInfo, slotId: newSlotId};
                                const newCurrentSlotType = evaluateSlotType(retrieveSlotFromSlotInfos(newCurrentSlotInfoNoType));
                                //let newSlotInfos = {...newCurrentSlotInfoNoType, slotType: newCurrentSlotType};
                                //const slotUIID = getLabelSlotUIID(newSlotInfos); 
                                const newCurrentSlotInfoWithType = {...newCurrentSlotInfoNoType, slotType: newCurrentSlotType};
                                const slotCursorInfos: SlotCursorInfos = {slotInfos: newCurrentSlotInfoWithType, cursorPos: anchorOffset};
                                document.getElementById(getLabelSlotUIID(newCurrentSlotInfoWithType))?.dispatchEvent(new Event(CustomEventTypes.editableSlotGotCaret));
                                setDocumentSelection(slotCursorInfos, slotCursorInfos);
                                this.appStore.setSlotTextCursors(slotCursorInfos, slotCursorInfos);
                            });
                        }
                    }
                    else if(!((isForwardDeletion && focusSlotCursorInfos?.cursorPos == this.code.length) || (!isForwardDeletion && focusSlotCursorInfos?.cursorPos == 0))){
                        const deletionOffset = (isForwardDeletion) ? 0 : -1;
                        newTextCursorPos += deletionOffset;
                        inputSpanField.textContent = inputSpanFieldContent.substring(0, newTextCursorPos) + inputSpanFieldContent.substring(newTextCursorPos + 1);  
                        // The cursor position changes, so we updated it in the store. 
                        this.appStore.setSlotTextCursors({slotInfos: this.coreSlotInfo, cursorPos: newTextCursorPos}, {slotInfos: this.coreSlotInfo, cursorPos: newTextCursorPos});                                 
                    }
                    else{
                        // Do nothing if there is no actual change
                        return;
                    }

                    // In any case, we check if the slots need to be refactorised (next tick required to account for the changed done when deleting brackets/strings)
                    this.$nextTick(() => this.$emit("requestSlotsRefactoring", this.UIID));
                }
            }            
        },

        onDeleteKeyDown(event: KeyboardEvent){
            // Be careful: the event is triggered both by backspace & delete keys ! So we need to make a clear distinction here
            if(event.key.toLowerCase() == "delete"){
                return this.deleteSlots(event);
            }           
        },

        onBackSpaceKeyDown(event: KeyboardEvent){
            // When the backspace key is hit we delete the container frame when:
            //  1) there is no text in the slot
            //  2) we are in the first slot of a frame (*first that appears in the UI*) 
            // To avoid unwanted deletion, we "force" a delay before removing the frame.
            this.stillBackSpaceDown = true; 
            if(this.isFrameEmpty){
                //if the user had already released the key up, no point waiting, we delete straight away
                if(this.canBackspaceDeleteFrame){
                    this.onLoseCaret();
                    this.appStore.deleteFrameFromSlot(this.frameId);
                }
                else{        
                    setTimeout(() => {
                        if(this.stillBackSpaceDown){
                            this.onLoseCaret();
                            this.appStore.deleteFrameFromSlot(this.frameId);
                        }
                    }, 600);
                }
                return;
            }
            else{
                // Delete a slot
                this.deleteSlots(event);
            }
        },

        onBackSpaceKeyUp(){
            this.canBackspaceDeleteFrame = this.isFrameEmpty;
            this.stillBackSpaceDown = false;
        },

        acItemClicked(item: string) {
            // Get the content of the <li> element through the child node to avoid getting nested text elements (like the version)
            const selectedItem = (document.getElementById(item) as HTMLLIElement)?.firstChild?.nodeValue?.trim()??"";
            if(selectedItem === undefined) {
                return;
            }
            // We set the code to what it was up to the point before the token, and we replace the token with the selected Item
            const inputField = document.getElementById(this.UIID) as HTMLInputElement;
            const currentTextCursorPos = inputField.selectionStart??0;
            // If the selected AC results is a method or a function we need to add parenthesis to the autocompleted text
            const typeOfSelected: string  = (this.$refs.AC as any).getTypeOfSelected(item);

            const isSelectedFunction =  (typeOfSelected.includes("function") || typeOfSelected.includes("method"));
            const newCode = this.getSlotContent().substr(0, currentTextCursorPos - this.tokenAC.length)
                + selectedItem 
                + ((isSelectedFunction)?"()":"")
                + this.getSlotContent().substr(currentTextCursorPos);
            
            // position the text cursor just after the AC selection - in the parenthesis for functions
            this.textCursorPos = currentTextCursorPos + selectedItem.length - this.tokenAC.length + ((isSelectedFunction)?1:0);
            
            this.setSlotContent(newCode);
            this.showAC = this.debugAC;
            this.acRequested = false;
        },
   
        isImportFrame(): boolean {
            return this.appStore.isImportFrame(this.frameId);
        },

        getACresultsFromBrython(): void {
            // run the Brython code -to get the AC results- by "clicking" the loadAC
            const loadAcContainer = document.getElementById("loadAC");
            loadAcContainer?.click();
        },
    },
});
</script>

<style lang="scss">
.labelSlot-container{
    position: relative;
}

.labelSlot-input {
    display: block; // to ensure that ctrl+arrow works fine in Chrome
    border-radius: 5px;
    border: 1px solid transparent;
    padding: 0px 0px;
    outline: none;
    cursor: text;
    white-space: pre;
    user-select: text;
    min-width: 3px;
}

.labelSlot-input:empty::before {
    content: attr(placeholder);
    font-style: italic;
    color: #757575;
}

.bold {
    font-weight: 600;
    color: black !important;
}

// Classes related to the different slot types (cf type.ts)
.string-slot {
    color: #006600 !important;
}

.number-slot {
    color: blue !important;
}

.bool-slot {
    color: purple !important; 
}

.operator-slot {
    color: #8a6706cc !important;
}
// end classes for slot type

.error-popover {
    // Nedded for the code to understand the formated errors which split multiple
    // errors with \n
    white-space: pre-line !important;
}

.ac {
    position: absolute;
    left: 0px;
    z-index: 10;
}
</style>
