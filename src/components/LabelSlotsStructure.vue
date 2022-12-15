<template>
    <div class="next-to-eachother" :id="labelSlotsStructDivId">
        <div 
            v-for="(slotItem, slotIndex) in subSlots" 
            :key="frameId + '_'  + labelIndex + '_' + slotIndex"
            class="next-to-eachother"
        >
            <!-- Note: the default text is only used here to handle presentation but it will never show as such in subslots -->
            <LabelSlot
                :labelSlotsIndex="labelIndex"
                :slotId="slotItem.id"
                :slotType="slotItem.type"
                :isDisabled="isDisabled"
                :default-text="(subSlots.length == 1) ? defaultText : ''"
                :code="getSlotCode(slotItem)"
                :frameId="frameId"
                :isEditableSlot="isEditableSlot(slotItem.type)"
                :isEmphasised="isSlotEmphasised(slotItem)"
                @requestSlotsRefactoring="checkSlotRefactoring"
            />
        </div> 
    </div>
</template>

<script lang="ts">
import { AllFrameTypesIdentifier, areSlotCoreInfosEqual, FlatSlotBase, getFrameDefType, isSlotBracketType, isSlotQuoteType, LabelSlotsContent, SlotCoreInfos, SlotCursorInfos, SlotsStructure, SlotType } from "@/types/types";
import Vue from "vue";
import { useStore } from "@/store/store";
import { mapStores } from "pinia";
import LabelSlot from "@/components/LabelSlot.vue";
import { getFrameLabelSlotsStructureUIID, getLabelSlotUIID, getSelectionCursorsComparisonValue, getUIQuote, isElementEditableLabelSlotInput, isLabelSlotEditable, parseCodeLiteral, parseLabelSlotUIID, setTextCursorPositionOfHTMLElement, trimmedKeywordOperators, UIDoubleQuotesCharacters, UISingleQuotesCharacters } from "@/helpers/editor";
import { getSlotIdFromParentIdAndIndexSplit, getSlotParentIdAndIndexSplit, retrieveSlotFromSlotInfos } from "@/helpers/storeMethods";

export default Vue.extend({
    name: "LabelSlotsStructure.vue",

    components:{
        LabelSlot,
    },

    props: {
        frameId: Number,
        labelIndex: Number,
        defaultText: String,
        isDisabled: Boolean,
    },

    data: function() {
        return {
            ignoreBracketEmphasisCheck: false, // cf. isSlotEmphasised()
        };
    },

    created(){
        // Register this component on the root, to allow external calls for refactoring the slots
        this.$root.$refs[this.labelSlotsStructDivId] = this;
    },

    computed:{
        ...mapStores(useStore),

        labelSlotsStructDivId(): string {
            return getFrameLabelSlotsStructureUIID(this.frameId, this.labelIndex);
        },

        subSlots(): FlatSlotBase[] {
            return this.appStore.getFlatSlotBases(this.frameId, this.labelIndex);  
        },   
        
        focusSlotCursorInfos(): SlotCursorInfos | undefined {
            return this.appStore.focusSlotCursorInfos;
        },
    },

    watch: {
        // Whenever the focus changes, we update the flag to check the bracket emphasis
        focusSlotCursorInfos() {
            this.ignoreBracketEmphasisCheck = false;
        },
    },

    methods:{
        isEditableSlot(slotType: SlotType): boolean {
            return isLabelSlotEditable(slotType);
        },

        getSlotCode(slot: FlatSlotBase): string {
            if(isSlotQuoteType(slot.type)){
                // We show quotes in the UI as textual opening or closing quotes
                return getUIQuote(slot.code, slot.type == SlotType.openingQuote);
            }
            return slot.code;
        },

        isSlotEmphasised(slot: FlatSlotBase): boolean{
            // In this method, if the flag to check a bracket emphasis (ignoreBracketEmphasisCheck) isn't set,
            // we check if the current slot bracket should be emphasised, and if so, emphasise its bracket counterpart.
            // The flag ignoreBracketEmphasisCheck is used to avoid cancelling the couterpart emphasise once set up.            
            const isEditing = this.appStore.isEditing;
            if(isEditing && isSlotBracketType(slot.type) && this.focusSlotCursorInfos && this.appStore.anchorSlotCursorInfos){            
                if(!this.ignoreBracketEmphasisCheck){
                    
                    // The slot for the bracket is emphasised if the text cursor is near it (preceding or following) or its counterpart.
                    const currentSlotCoreInfos: SlotCoreInfos= {frameId: this.frameId, labelSlotsIndex: this.labelIndex, slotId: slot.id, slotType: slot.type};
                    const isOpeningBracket = (slot.type == SlotType.openingBracket);
                    const parentIdSlotIndexSplit = getSlotParentIdAndIndexSplit(slot.id);
                    const previousSlotId = isOpeningBracket 
                        ? getSlotIdFromParentIdAndIndexSplit(parentIdSlotIndexSplit.parentId, parentIdSlotIndexSplit.slotIndex - 1)
                        : slot.id + "," + ((retrieveSlotFromSlotInfos(currentSlotCoreInfos) as SlotsStructure).fields.length - 1);
                    const nextSlotId = isOpeningBracket 
                        ? slot.id + "," + 0
                        : getSlotIdFromParentIdAndIndexSplit(parentIdSlotIndexSplit.parentId, parentIdSlotIndexSplit.slotIndex + 1);
                
                    const focusSlotInfos = this.focusSlotCursorInfos.slotInfos;
                    const focusSlotCursorPos = this.focusSlotCursorInfos.cursorPos;
                    const focusInputSpan = document.getElementById(getLabelSlotUIID(focusSlotInfos)) as HTMLSpanElement;
                    // That's not just to keep TS happy: the focus span could here be null, when a change of slot type happens
                    if(focusInputSpan){
                        const focusInputSpanContent = focusInputSpan.textContent??"";
                        const focusCursorInPrevious = areSlotCoreInfosEqual({...currentSlotCoreInfos, slotId: previousSlotId, slotType: SlotType.code}, focusSlotInfos);
                        const focusCursorInNext = areSlotCoreInfosEqual({...currentSlotCoreInfos, slotId: nextSlotId, slotType: SlotType.code}, focusSlotInfos);
                        const selectionCursorsComparisonValue = getSelectionCursorsComparisonValue()??0;
                        let needEmphasis = false;

                        // Check the current bracket
                        if((focusCursorInPrevious && selectionCursorsComparisonValue <= 0) 
                            || (focusCursorInNext && selectionCursorsComparisonValue >= 0)){
                            needEmphasis = focusCursorInPrevious 
                                ? focusInputSpanContent.substring(focusSlotCursorPos).trim().length == 0 
                                : focusSlotCursorPos == 0; // a slot cannot start with spaces               
                        }
                        slot.isEmphasised = needEmphasis;
                        
                        // Then if this bracket can have emphasis we flag the counterpart
                        if(needEmphasis){
                            const counterpartType = (isOpeningBracket) ? SlotType.closingBracket : SlotType.openingBracket;
                            const counterpartSlot = this.subSlots.find((flatSlot) => flatSlot.id == slot.id && flatSlot.type == counterpartType);
                            if(counterpartSlot){
                                counterpartSlot.isEmphasised = true;
                            }
                            this.ignoreBracketEmphasisCheck = true;
                        }
                    }
                }
                return slot.isEmphasised??false;
            }

            // If we are not editing or the slot we checked is not a bracket, there is no emphasis
            return false;
        },

        checkSlotRefactoring(slotUIID: string) {
            // When edition on a slot occurs, we need to check if the slots for this label need refactorisation (for example, adding operators, brackets etc will generate split slots).
            // We first retrieve the literal code if the frame label via the DOM (because we do not yet update the state) and parse it the code to slots
            const labelDiv = document.getElementById(this.labelSlotsStructDivId);
            if(labelDiv){ // keep TS happy
                // As we will need to reposition the cursor, we keep a reference to the "absolute" position in this label's slots,
                // so we find that out while getting through all the slots to get the literal code.
                let focusCursorAbsPos = 0;
                let uiLiteralCode = "";
                let foundFocusSpan = false;
                labelDiv.querySelectorAll(".labelSlot-input").forEach((spanElement) => {
                    // The code is extracted from the span; we only transform the string quotes as they are styled for the UI, we need to restore them to their code-style equivalent.
                    if(isSlotQuoteType(parseLabelSlotUIID(spanElement.id).slotType)){
                        switch(spanElement.textContent){
                        case UIDoubleQuotesCharacters[0]:
                        case UIDoubleQuotesCharacters[1]:
                            uiLiteralCode += "\"";
                            break;
                        case UISingleQuotesCharacters[0]:
                        case UISingleQuotesCharacters[1]:
                            uiLiteralCode += "'";
                            break;            
                        }
                    }
                    else{
                        uiLiteralCode += spanElement.textContent;
                    }
                    
                    if(spanElement.id === slotUIID){
                        focusCursorAbsPos += (this.appStore.focusSlotCursorInfos?.cursorPos??0);                        
                        foundFocusSpan = true;
                    }
                    else if(!foundFocusSpan){
                        // In most cases, we just increment the length by the span content length,
                        // BUT there is one exception: textual operators require surrounding spaces to be inserted, and those spaces do not appear on the UI
                        // therefore we need to account for them when dealing with such operator
                        let spacesOffset = 0;
                        const spanElementContentLength = (spanElement.textContent?.length??0);
                        if((trimmedKeywordOperators.includes(spanElement.textContent??""))){
                            spacesOffset = 2;
                            // Reinsert the spaces in the literal code
                            uiLiteralCode = uiLiteralCode.substring(0, focusCursorAbsPos) 
                                + " " + uiLiteralCode.substring(focusCursorAbsPos, focusCursorAbsPos + (spanElement.textContent?.length??0)) 
                                + " " + uiLiteralCode.substring(focusCursorAbsPos + (spanElement.textContent?.length??0));
                        }
                        focusCursorAbsPos += (spanElementContentLength + spacesOffset);
                    }
                });    
                const parsedCodeRes = parseCodeLiteral(uiLiteralCode, false, focusCursorAbsPos);
                this.appStore.frameObjects[this.frameId].labelSlotsDict[this.labelIndex].slotStructures = parsedCodeRes.slots;
                this.$forceUpdate();
                this.$nextTick(() => {
                    let newUICodeLiteralLength = 0;
                    let foundPos = false;
                    let setInsideNextSlot = false; // The case when the cursor follow a non editable slot (i.e. operator, bracket, quote)
                    // Reposition the cursor now
                    labelDiv.querySelectorAll(".labelSlot-input").forEach((spanElement) => {
                        if(!foundPos){
                            const spanContentLength = (spanElement.textContent?.length??0);
                            if(setInsideNextSlot || (focusCursorAbsPos <= (newUICodeLiteralLength + spanContentLength) && focusCursorAbsPos >= newUICodeLiteralLength)){
                                if(!setInsideNextSlot && !isElementEditableLabelSlotInput(spanElement)){
                                    setInsideNextSlot = true;
                                }
                                else{
                                    (spanElement as HTMLSpanElement).focus();
                                    const pos = (setInsideNextSlot) ? 0 : focusCursorAbsPos - newUICodeLiteralLength;
                                    setTextCursorPositionOfHTMLElement(spanElement as HTMLSpanElement, pos);
                                    const cursorInfos = {slotInfos: parseLabelSlotUIID(spanElement.id), cursorPos: pos};
                                    this.appStore.setSlotTextCursors(cursorInfos, cursorInfos);
                                    foundPos = true;
                                }                            
                            }
                            else{
                                // In most cases, we just increment the length by the span content length,
                                // BUT there is one exception: textual operators require surrounding spaces to be inserted, and those spaces do not appear on the UI
                                // therefore we need to account for them when dealing with such operator
                                const spacesOffset = (trimmedKeywordOperators.includes(spanElement.textContent??"")) 
                                    ? 2
                                    : 0;
                                newUICodeLiteralLength += (spanContentLength + spacesOffset);
                            }
                        }
                    });
                    
                    // We also check here if the changes trigger the conversion of an empty frame to a varassign frame (i.e. an empty frame contains a variable assignment)
                    if(this.appStore.frameObjects[this.frameId].frameType.type == AllFrameTypesIdentifier.empty && uiLiteralCode.match(/^([^+\-*/%^!=<>&|\s()]*)(\s*)=(([^=].*)|$)/) != null){
                        Vue.set(this.appStore.frameObjects[this.frameId],"frameType", getFrameDefType(AllFrameTypesIdentifier.varassign));
                        const newContent: { [index: number]: LabelSlotsContent} = {
                            // LHS can only be a single field slot
                            0: {
                                slotStructures:{
                                    fields: [{code: uiLiteralCode.substring(0, uiLiteralCode.indexOf("="))}],
                                    operators: []},
                            },
                            //RHS are the other fields and operators
                            1: {
                                slotStructures:{
                                    fields: parsedCodeRes.slots.fields.slice(1),
                                    operators: parsedCodeRes.slots.operators.slice(1),
                                },
                            }, 
                        };
                        this.appStore.frameObjects[this.frameId].labelSlotsDict = newContent;
                    }
                });

            }
        },
    },
});
</script>
