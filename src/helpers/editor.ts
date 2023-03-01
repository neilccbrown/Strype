import i18n from "@/i18n";
import { useStore } from "@/store/store";
import { AddFrameCommandDef, AllFrameTypesIdentifier, areSlotCoreInfosEqual, BaseSlot, CaretPosition, FramesDefinitions, getFrameDefType, isSlotBracketType, isSlotQuoteType, SlotCoreInfos, SlotCursorInfos, SlotsStructure, SlotType, StringSlot } from "@/types/types";
import Vue from "vue";
import { getAboveFrameCaretPosition, getSlotParentIdAndIndexSplit } from "./storeMethods";

export const undoMaxSteps = 50;

export enum CustomEventTypes {
    editorAddFrameCommandsUpdated = "frameCommandsUpdated",
    frameContentEdited = "frameContentEdited",
    editableSlotGotCaret= "slotGotCaret",
    editableSlotLostCaret = "slotLostCaret",
    /* IFTRUE_isPurePython */
    pythonConsoleDisplayChanged = "pythonConsoleDisplayChanged",
    /* FITRUE_isPurePython */
}

export function getFrameContainerUIID(frameId: number): string {
    return "FrameContainer_" + frameId;
}

export function getFrameBodyUIID(frameId: number): string {
    return "frameBodyId_" + frameId;
}

export function getFrameUIID(frameId: number): string{
    return "frame_id_" + frameId;
}

export function getFrameHeaderUIID(frameId: number): string{
    return "frameHeader_" + frameId;
}

function retrieveFrameIDfromUIID(uiid: string): number {
    return parseInt(uiid.substring("frame_id_".length));
}

export function isIdAFrameId(id: string): boolean {
    return id.match(/^frame_id_\d+$/) !== null;
}

const labelSlotUIIDRegex = /^input_frame_(\d+)_label_(\d+)_slot_([0-7]{4})_(\d+(,\d)*)$/;
export function getLabelSlotUIID(slotCoreInfos: SlotCoreInfos): string {
    // If a change is done in this method, also update isElementLabelSlotInput() and parseLabelSlotUIID()
    // For explanation about the slotID format, see generateFlatSlotBases() in storeMethods.ts
    // note: slotype is an enum value, which is rendered as an octal 4 digits value (eg "0010")
    const intermediateFormattedType = "000" + slotCoreInfos.slotType.toString(8);
    const formattedTypeValue = intermediateFormattedType.substring(intermediateFormattedType.length - 4, intermediateFormattedType.length);
    return "input_frame_" + slotCoreInfos.frameId + "_label_" + slotCoreInfos.labelSlotsIndex + "_slot_" + formattedTypeValue + "_" + slotCoreInfos.slotId;
}


export function parseLabelSlotUIID(uiid: string): SlotCoreInfos {
    // Cf. getLabelSlotUIID() for the format
    const res: SlotCoreInfos = {frameId: -100, labelSlotsIndex: -1, slotId: "", slotType: SlotType.code };
    const uiidMatch = uiid.match(labelSlotUIIDRegex);
    if(uiidMatch){
        res.frameId = parseInt(uiidMatch[1]);
        res.labelSlotsIndex = parseInt(uiidMatch[2]);
        res.slotId = uiidMatch[4];
        res.slotType = parseInt(uiidMatch[3], 8);
    }
    return res;
}

export function isElementLabelSlotInput(element: EventTarget | null): boolean{
    if(!(element instanceof HTMLSpanElement)){
        return false;
    }
    // Cf. getLabelSlotUIID() for the format
    return (element as HTMLSpanElement).id.match(labelSlotUIIDRegex) != null;
}

export function isElementEditableLabelSlotInput(element: EventTarget | null): boolean{
    if(!(element instanceof HTMLSpanElement)){
        return false;
    }
    // Cf. getLabelSlotUIID() for the format
    const regexMatch = (element as HTMLSpanElement).id.match("^input_frame_\\d+_label_\\d+_slot_000(\\d)_\\d(,\\d)*$");
    return regexMatch != null && parseInt(regexMatch[1]) < 8;
}

export function isLabelSlotEditable(type: SlotType): boolean {
    return !isSlotBracketType(type) && !isSlotQuoteType(type) && type != SlotType.operator;
}

export function getTextStartCursorPositionOfHTMLElement(htmlElement: HTMLSpanElement): number {
    // For (editable) spans, it is not straight forward to retrieve the text cursor position, we do it via the selection API
    // if the text in the element is selected, we show the start of the selection.
    let caretPos = 0;
    const sel = document.getSelection();
    if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        if (range.commonAncestorContainer.parentNode == htmlElement) {
            caretPos = range.startOffset;
        }
    }
    return caretPos;
}

export function getTextEndCursorPositionOfHTMLElement(htmlElement: HTMLSpanElement): number {
    // For (editable) spans, it is not straight forward to retrieve the text cursor position, we do it via the selection API
    // if the text in the element is selected, we show the end of the selection.
    let caretPos = 0;
    const sel = document.getSelection();
    if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        if (range.commonAncestorContainer.parentNode == htmlElement) {
            caretPos = range.endOffset;
        }
    }
    
    return caretPos;
}

export function getFocusedEditableSlotTextSelectionStartEnd(labelSlotUIID: string): {selectionStart: number, selectionEnd: number} {
    // A helper function to get the selection relative to a *focused* slot: if the selection spans across several slots, we get the right boudary values for the given slot
    const focusCursorInfos = useStore().focusSlotCursorInfos;
    const anchorCursorInfos = useStore().anchorSlotCursorInfos;
    if(anchorCursorInfos != null && focusCursorInfos != null ){
        if(areSlotCoreInfosEqual(anchorCursorInfos.slotInfos, focusCursorInfos.slotInfos)){
            // The selection is within a slot, so we just return the positions
            return {selectionStart: Math.min(focusCursorInfos.cursorPos, anchorCursorInfos.cursorPos), selectionEnd: Math.max(focusCursorInfos.cursorPos, anchorCursorInfos.cursorPos)};
        }
        else{
            // The selection spans across slots (but we cannot be across frames): we check whether this slot is part of the selection,
            // we only need to check where is the anchor cursor: before or after the focus cursor
            const cursorComp = getSelectionCursorsComparisonValue() as number;
            if(cursorComp < 0){
                // the anchor is somewhere before the focus cursor: the selection start is 0 for this slot
                return {selectionStart: 0, selectionEnd: focusCursorInfos.cursorPos};
            }
            else{
                // the anchor is somewhere after the focus cursor: the selection end is at the end of the slot
                return {selectionStart: focusCursorInfos.cursorPos, selectionEnd: (document.getElementById(labelSlotUIID) as HTMLSpanElement).textContent?.length??0};
            }
        }
    }

    // If no selection we return negative values
    return {selectionStart: -1, selectionEnd: -1};
}

export function setDocumentSelection(anchorCursorInfos: SlotCursorInfos, focusCursorInfos: SlotCursorInfos): void{
    const anchorElement = document.getElementById(getLabelSlotUIID(anchorCursorInfos.slotInfos));
    const focusElement = document.getElementById(getLabelSlotUIID(focusCursorInfos.slotInfos));
    if(anchorElement && focusElement){
        // Before doing the selection, we make sure that we can use the given slot cursor infos:
        // when a slot is empty, the span element doesn't have a firstChild attribute. In this case,
        // the node for the selection that we use is the span itself relative its parent.
        // (a span isn't directly contained in the contenteditable div )
        const anchorNode = ((anchorElement.textContent??"").length > 0)
            ? anchorElement.firstChild as Node
            : anchorElement.parentElement as Node;

        const anchorOffset = ((anchorElement.textContent??"").length > 0) 
            ? anchorCursorInfos.cursorPos
            : Object.values(anchorNode.childNodes).findIndex((node: any) => node.id === anchorElement.id);

        const focusNode = ((focusElement.textContent??"").length > 0)
            ? focusElement.firstChild as Node
            : focusElement.parentElement as Node;
            
        const focusOffset = ((focusElement.textContent??"").length > 0) 
            ? focusCursorInfos.cursorPos
            : Object.values(focusNode.childNodes).findIndex((node: any) => node.id === focusElement.id);

        document.getSelection()?.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
    }    
}

export function getFrameLabelSlotsStructureUIID(frameId: number, labelIndex: number): string{
    return "labelSlotsStruct" + frameId + "_"  + labelIndex;
}

export function getFrameContextMenuUIID(frameUIID: string): string {
    return frameUIID + "frameContextMenu";
}

export function getCodeEditorUIID(): string {
    return getFrameContainerUIID(useStore().getMainCodeFrameContainerId);
}

export function getCaretUIID(caretAssignedPosition: string, frameId: number): string {
    return "caret_"+caretAssignedPosition+"_"+frameId;
}

export function getCommandsContainerUIID(): string {
    return "editorCommands";
}

export function getEditorMenuUIID(): string {
    return "showHideMenu";
} 

export function getEditorButtonsContainerUIID(): string {
    return "editorButtonsContainer";
}

export function getMenuLeftPaneUIID(): string {
    return "menu-bar";
}

export function getEditorMiddleUIID(): string {
    return "editorCodeDiv";
}

export function getCommandsRightPaneContainerId(): string {
    return "commandsContainerDiv";
}

export function getAcSpanId(slotId: string): string {
    return slotId + "_ResultsSpan";
}

export function getReshowResultsId(slotId: string): string {
    return slotId + "_ReshowResults";
}

export function getDocumentationSpanId(slotId: string): string {
    return slotId + "_DocumentationSpan";
}

export function getTypesSpanId(slotId: string): string {
    return slotId + "_TypesSpan";
}

export function getAcContextPathId(slotId: string): string{
    return slotId+"_AcContextPathSpan";
}

export const fileImportSupportedFormats: string[] = ["spy"];

// Check if the code contains errors: precompiled errors & TigerPyton errors are all indicated in the editor
// by an error class on a frame ("frameDiv" + "error"), a frame body ("frame-body-container" + "error") 
// or an editable slot ("labelSlot-input" + "error").
export function hasEditorCodeErrors(): boolean {
    const erroneousHTMLElements = document.getElementsByClassName("error");
    if(erroneousHTMLElements.length > 0){
        let hasErrors = false;
        for(const erroneousHTMLElement of erroneousHTMLElements) {
            hasErrors = hasErrors || erroneousHTMLElement.className.includes("frameDiv") 
                || erroneousHTMLElement.className.includes("frame-body-container") 
                || erroneousHTMLElement.className.includes("labelSlot-input");
        }
        return hasErrors;
    }
    return false; 
}

// Helper function to generate the frame commands on demand. 
// Calls will happen when the frames are created the first time, and whenever the language is changed
export function generateAllFrameCommandsDefs():void {
    allFrameCommandsDefs = {
        "i": [
            {
                type: getFrameDefType(AllFrameTypesIdentifier.if),
                description: "if",
                shortcut: "i",
                tooltip:i18n.t("frame.if_detail") as string,
                index: 0,
            },
            {
                type: getFrameDefType(AllFrameTypesIdentifier.import),
                description: "import",
                shortcut: "i",
                tooltip:i18n.t("frame.import_detail") as string,
                index:1,
            },
        ],
        "l": [{
            type: getFrameDefType(AllFrameTypesIdentifier.elif),
            description: "elif",
            tooltip:i18n.t("frame.elif_detail") as string,
            shortcut: "l",
        }],
        "e": [{
            type: getFrameDefType(AllFrameTypesIdentifier.else),
            description: "else",
            tooltip:i18n.t("frame.else_detail") as string,
            shortcut: "e",
        }],
        "f": [
            {
                type: getFrameDefType(AllFrameTypesIdentifier.for),
                description: "for",
                shortcut: "f",
                tooltip:i18n.t("frame.for_detail") as string,
                index: 0,
            },
            {
                type: getFrameDefType(AllFrameTypesIdentifier.funcdef),
                description: i18n.t("frame.funcdef_desc") as string,
                shortcut: "f",
                tooltip:i18n.t("frame.funcdef_detail") as string,
                index: 1,
            },
            {
                type: getFrameDefType(AllFrameTypesIdentifier.fromimport),
                description: "from...import",
                tooltip:i18n.t("frame.fromimport_detail") as string,
                shortcut: "f",
                index:2,
            },
        ],
        "w": [{
            type: getFrameDefType(AllFrameTypesIdentifier.while),
            description: "while",
            tooltip:i18n.t("frame.while_detail") as string,
            shortcut: "w",
        }],
        "b" : [{
            type: getFrameDefType(AllFrameTypesIdentifier.break),
            description: "break",
            tooltip:i18n.t("frame.break_detail") as string,
            shortcut: "b",
        }],
        "u" : [{
            type: getFrameDefType(AllFrameTypesIdentifier.continue),
            description: "continue",
            tooltip:i18n.t("frame.continue_detail") as string,
            shortcut: "u",
        }],
        "=": [{
            type: getFrameDefType(AllFrameTypesIdentifier.varassign),
            description: i18n.t("frame.varassign_desc") as string,
            tooltip:i18n.t("frame.varassign_detail") as string,
            shortcut: "=",
        }],
        " ": [{
            type: getFrameDefType(AllFrameTypesIdentifier.empty),
            description: i18n.t("frame.funccall_desc") as string,
            shortcut: " ",
            tooltip:i18n.t("frame.funccall_detail") as string,
            symbol: "⌴",//"␣"
        }],
        "r": [{
            type: getFrameDefType(AllFrameTypesIdentifier.return),
            description: "return",
            tooltip:i18n.t("frame.return_detail") as string,
            shortcut: "r",
        }],
        "c": [{
            type: getFrameDefType(AllFrameTypesIdentifier.comment),
            description: i18n.t("frame.comment_desc") as string,
            tooltip:i18n.t("frame.comment_detail") as string,
            shortcut: "c",
        }],
        "t": [{
            type: getFrameDefType(AllFrameTypesIdentifier.try),
            description: "try",
            tooltip:i18n.t("frame.try_detail") as string,
            shortcut: "t",
        }],
        "a" : [{
            type: getFrameDefType(AllFrameTypesIdentifier.raise),
            description: "raise",
            tooltip:i18n.t("frame.raise_detail") as string,
            shortcut: "a",
        }],
        "x": [{
            type: getFrameDefType(AllFrameTypesIdentifier.except),
            description: "except",
            tooltip:i18n.t("frame.except_detail") as string,
            shortcut: "x",
        }],
        "n": [{
            type: getFrameDefType(AllFrameTypesIdentifier.finally),
            description: "finally",
            tooltip:i18n.t("frame.finally_detail") as string,
            shortcut: "n",
        }],
        "h": [{
            type: getFrameDefType(AllFrameTypesIdentifier.with),
            description: "with",
            tooltip:i18n.t("frame.with_detail") as string,
            shortcut: "h",
        }],
        "g": [{
            type: getFrameDefType(AllFrameTypesIdentifier.global),
            description: "global",
            tooltip: i18n.t("frame.global_detail") as string,
            shortcut: "g",
        }],
    };

    // We need to "tell" the Vue component that hosts the frame commands (Commands.vue) to refresh as there is no reactivity
    // between the frame definitions here and the component's computed property.
    // We can do it via a custom event Commands.vue will be listening to.
    document.dispatchEvent(new Event(CustomEventTypes.editorAddFrameCommandsUpdated));
}

//Commands for Frame insertion, one command can match more than 1 frame ONLY when there is a TOTAL distinct context between the two
let allFrameCommandsDefs: {[id: string]: AddFrameCommandDef[]} | undefined = undefined;

export function getAddCommandsDefs(): {[id: string]: AddFrameCommandDef[]} { 
    if(allFrameCommandsDefs === undefined){
        generateAllFrameCommandsDefs();
    }
    return allFrameCommandsDefs as {[id: string]: AddFrameCommandDef[]};
}

export function findAddCommandFrameType(shortcut: string, index?: number): FramesDefinitions | null { 
    if(allFrameCommandsDefs === undefined){
        generateAllFrameCommandsDefs();
    }
    const shortcutCommands = Object.values(allFrameCommandsDefs as {[id: string]: AddFrameCommandDef[]}).flat().filter((command) => command.shortcut === shortcut);
    if(shortcutCommands.length > 0) {
        if(index) {
            if(index < shortcutCommands.length) {
                const shortcutCommandIndexed = shortcutCommands.find((command) => command?.index == index);
                if(shortcutCommandIndexed){
                    return shortcutCommandIndexed.type;
                }
            }
        }
        else{
            return shortcutCommands[0].type;
        }
    }

    // If we are here, it means the call to this method has been misused...
    return null;
}

/**
 * Used for easing handling events for drag & drop of frames
 **/
let currentDraggedSingleFrameId = 0;
export function getDraggedSingleFrameId(): number {
    return currentDraggedSingleFrameId;
}

// This flag informs if a drag resulted in a change in the frames order
// (i.e. a drop occured somewhere else, or as if the action had been "cancelled")
// We need to know that to show the caret as it was if the frames order didn't change
let isDragChangingOrder = false; 
export function setIsDraggedChangingOrder(changedOrder: boolean): void{
    isDragChangingOrder = changedOrder;
}

export function handleDraggingCursor(showDraggingCursor: boolean, isTargetGroupAllowed: boolean):void {
    // This function assign the cursor we want to be shown while dragging.
    // It is set to the html element as mentioned here https://github.com/SortableJS/Sortable/issues/246
    // We use a "shadow" draggable root element at the editor's level so we can handle the cursor when
    // the dragging is getting outside the code's draggable zones (e.g. frame body). The drawback of that
    // is that we show a cursor suggesting we can drop somewhere even if the draggable zone isn't able to
    // receive the frame(s). However, the purple cursor and snapped frame at destination will still not be
    // be shown if the frame(s) cannot be dropped. That's the best compromise if we cant to override the 
    // default browser's drag&drop cursors.
    const htmlElementClassList = document.getElementsByTagName("html")[0].classList;
    if(!showDraggingCursor){
        htmlElementClassList.remove("dragging-frame-allowed");
        htmlElementClassList.remove("dragging-frame-not-allowed");
    }
    else if(isTargetGroupAllowed&& !htmlElementClassList.contains("dragging-frame-allowed")){
        htmlElementClassList.add("dragging-frame-allowed");
        htmlElementClassList.remove("dragging-frame-not-allowed");
    }
    else if(!isTargetGroupAllowed && !htmlElementClassList.contains("dragging-frame-not-allowed")){
        htmlElementClassList.remove("dragging-frame-allowed");
        htmlElementClassList.add("dragging-frame-not-allowed");
    }
}

export function notifyDragStarted(frameId?: number):void {
    // If the argument "frameId" is set, the drag and drop is done on a single frame
    // so we set currentDraggedSingleFrameId
    if(frameId){
        currentDraggedSingleFrameId = frameId;
    }

    //Update the handling of the cursor during drag and drop
    handleDraggingCursor(true, true);

    // Update the store about dragging started
    useStore().isDraggingFrame = true;
} 
export function notifyDragEnded(draggedHTMLElement: HTMLElement):void {
    // Regardless we moved 1 or several frames at once, we reset currentDraggedSingleFrameId
    currentDraggedSingleFrameId = 0;

    // Retrieve the id of the frame dragged or of the top frame from the frames dragged.
    // We find it by retrieving the first frame div id of dragged HTML object given as argument of this function
    const subHTMLElementIdsMatches = draggedHTMLElement.innerHTML.matchAll(/ id="([^"]*)"/g);
    let topFrameId = 0, foundFrameID = false;
    if(subHTMLElementIdsMatches != null){    
        [...subHTMLElementIdsMatches].forEach((matchBit) => {
            if(!foundFrameID && isIdAFrameId(matchBit[1])){
                topFrameId = retrieveFrameIDfromUIID(matchBit[1]);
                foundFrameID = true;
            }
        });
    }

    //Update the handling of the cursor during drag and drop
    handleDraggingCursor(false, false);
    
    // Update the store about dragging ended 
    useStore().isDraggingFrame = false;

    // If the frames order has changed because of the drag & drop, position the blue caret where *visually* the fake caret was positionned.
    // If the frames order hasn't changed, we restore the current frame caret saved in the store.
    // NOTE: at this stage, the UI hasn't yet updated the frame order -- so we do this caret selection at the next Vue tick
    Vue.nextTick(() => {
        const newCaretPosition = (isDragChangingOrder) ? getAboveFrameCaretPosition(topFrameId) : {frameId: useStore().currentFrame.id, caretPosition: useStore().currentFrame.caretPosition};
        
        // Set the caret properly in the store which will update the editor UI
        useStore().toggleCaret({id:newCaretPosition.frameId, caretPosition: newCaretPosition.caretPosition as CaretPosition});

        // reset the flag informing if frames have changed order
        isDragChangingOrder = false;
    });
}

/**
 * Operator and brackets related content
 */
// For Strype, we ignore the following double/triple operators += -= /= *= %= //= **= &= |= ^= >>= <<= 
export const operators = [".","+","-","/","*","%","//","**","&","|","~","^",">>","<<",
    "==","=","!=",">=","<=","<",">"];
// Note that for those textual operator keywords, we only have space surrounding the single words: double words don't need
// as they will always come from a combination of writing one word then the other (the first will be added as operator)
// Important that the longer operators come before the shorter ones with the same prefix:
export const keywordOperatorsWithSurroundSpaces = [" and ", " in ", " is not ", " is ", " or ", " not in ", " not "];
export const trimmedKeywordOperators = keywordOperatorsWithSurroundSpaces.map((spacedOp) => spacedOp.trim());


// We construct the list of all operator with a specific order: first the spaced keyword operators, 
// then the double symbolic operators and lastly the unitary symbolic operators. We put double operators
// first so that they are found first in the search for operators.
interface OpDef {
    match: string; // The match to search for
    keywordOperator : boolean; // Whether the operator is a keyword operator
}
interface OpFound extends OpDef {
    pos: number; // The position of the match (0 = first character in string)
    length: number; // The length of the match in characters within the string
}

const allOperators: OpDef[] = [
    ...keywordOperatorsWithSurroundSpaces.map((opSpace) => {
        return {match: opSpace, keywordOperator: true} as OpDef;
    }),
    ...operators.sort((op1, op2) => (op2.length - op1.length)).map((o) => {
        return {match: o, keywordOperator: false} as OpDef;
    }),
];
    

// Brackets: order inside each array is important, keep matching opening and closing tokens
export const openBracketCharacters = ["(","{","["];
export const closeBracketCharacters = [")","}","]"];
export const getMatchingBracket = (bracketValue: string, isOpening: boolean): string => {
    const srcArray = (isOpening) ? openBracketCharacters : closeBracketCharacters;
    const targetArray = (isOpening) ? closeBracketCharacters : openBracketCharacters;
    const indexOfBracket = srcArray.indexOf(bracketValue);
    // Return the matching bracket or "" if we didn't find it (which should not happen, but just for safety...)
    if(indexOfBracket > -1){
        return targetArray[indexOfBracket];
    }
    return "";
};

// String quotes: Python allows both double and single quotes. We also keep an ordered list of "graphical" matching quotes
// Note: we ignore triple quotes for Python in Strype.
export const stringSingleQuoteChar = "'";
export const stringDoubleQuoteChar = "\"";
export const stringQuoteCharacters = [stringSingleQuoteChar, stringDoubleQuoteChar];
export const UIDoubleQuotesCharacters = ["\u201C", "\u201D"];
export const UISingleQuotesCharacters = ["\u2018", "\u2019"];
export const getUIQuote = (quoteValue: string, isOpening: boolean): string => {
    const UIArray = (quoteValue == stringSingleQuoteChar) ? UISingleQuotesCharacters : UIDoubleQuotesCharacters;
    // Return the matching UI quote
    return UIArray[(isOpening) ? 0 : 1];
};

export const getStringAllowedRawQuote = (stringQuote: string): string => {
    const indexOfStringQuote = stringQuoteCharacters.indexOf(stringQuote);
    // Return the quote symbol that do not need escape inside the string o "" if we didn't find it (which should not happen, but just for safety...)
    if(indexOfStringQuote > -1){
        return stringQuoteCharacters[(indexOfStringQuote + 1) % 2];
    }
    return "";
};

/* End operator and brackets related content*/

/**
 * Slot cursors infos related content
 * Note: the anchor and focus cursor infos, and associated mutator method, 
 * are held in the store to ease the reactivity. 
 */
export function getSelectionCursorsComparisonValue(): number | undefined {
    // Accesory method to check the relative position of the anchor and the focus cursors.
    // It returns usual comparison values: 0 for equality, <0 if anchor precedes focus and >0 otherwise.
    // Anchor and Focus cursors are supposed to be non null.
    // Note: we don't check if frames/labels are different since selection cannot be accross those levels
    const anchorCursorInfos = useStore().anchorSlotCursorInfos;
    const focusCursorInfos = useStore().focusSlotCursorInfos;
    
    if(anchorCursorInfos && focusCursorInfos){
        // Check if same frame first
        if(anchorCursorInfos.slotInfos.frameId == focusCursorInfos.slotInfos.frameId){
            // Check if same label index
            if(anchorCursorInfos.slotInfos.labelSlotsIndex == focusCursorInfos.slotInfos.labelSlotsIndex){
                // check if same slot ID (we don't need to worry about the operators, brackets or quotes)
                if(anchorCursorInfos.slotInfos.slotId == focusCursorInfos.slotInfos.slotId){
                    // Check the cursors difference
                    return anchorCursorInfos.cursorPos - focusCursorInfos.cursorPos;
                }
                
                // Not the same slot ID, we return the ID comparison because the last "token" of the ID is the slot index
                const anchorSlotIndex = getSlotParentIdAndIndexSplit(anchorCursorInfos.slotInfos.slotId).slotIndex;
                const focusSlotIndex = getSlotParentIdAndIndexSplit(focusCursorInfos.slotInfos.slotId).slotIndex;
                return anchorSlotIndex - focusSlotIndex;
            }

            // Not the same label index, we return the indexes difference
            return (anchorCursorInfos.slotInfos.labelSlotsIndex - focusCursorInfos.slotInfos.labelSlotsIndex);
        }

        // Not same frame, return the frame POSITION difference, we can't use ID as they are not indexes
        // We make it "easy" by checking the top position in the browser: frames can't be on a same level...
        const anchorElement = document.getElementById(getLabelSlotUIID(anchorCursorInfos.slotInfos)) as HTMLSpanElement;
        const focusElement = document.getElementById(getLabelSlotUIID(focusCursorInfos.slotInfos)) as HTMLSpanElement;
        return (anchorElement.clientTop - focusElement.clientTop);
    }
    
    // The method expects the anchor and focus cursors to be valid.
    return undefined; 
}

const FIELD_PLACERHOLDER = "$strype_field_placeholder$";
export const parseCodeLiteral = (codeLiteral: string, isInsideString?: boolean, cursorPos?: number): {slots: SlotsStructure, cursorOffset: number} => {
    // This method parse a code literal to generate the equivalent slot structure.
    // For example, if the code is <"hi" + "hello"> it will generate the following slot (simmplified)
    //  {fields: {"", s1, "", "", s2, ""}, operators: ["", "", "+", "", ""] }}
    //  where s1 = {fields: ["hi"], operator: [], quote: "\""} and s2 = {fields: ["hello"], operator: [], quote: "\""}
    // We use this method when we parse the content of a string literal to generate code (i.e. deletion of a string's quotes)
    // or when we need to regenerate some code
    // Returned value: an object including the slots and the text cursor offset as we may delete/add some elements in the code literal
    const resStructSlot: SlotsStructure = {fields: [], operators:[]};
    let cursorOffset = 0;       

    // If flag for checking escaped strings as string is set, we replace them
    // (this is for example when de-stringify a string content)
    if(isInsideString){
        const escapedQuote = "\\" + codeLiteral.charAt(0);
        // /(?<!\\)\\["']/g, (match) => match.charAt(1));
        codeLiteral = codeLiteral.substring(1, codeLiteral.length - 1).replaceAll(escapedQuote, (match) => match.charAt(1));
    }

    // First we look for string literals, as their content should not generate "subslot":
    // We simply use an equivalent size placeholder so it wont interfere the parsing later.
    // Note that the regex expression will look for either a well-formed a string literal or a non terminated string literal (for example: "test)
    // and when non terminated string literal is found, we complete the quotes manually (it will necessarily be at the end of the code literal)
    const strRegEx = /(['"])(?:(?!(?:\\|\1)).|\\.)*\1?/g;
    let missingClosingQuote = "";
    const blankedStringCodeLiteral = codeLiteral.replace(strRegEx, (match) => {
        if(!match.endsWith(match[0]) || (match.endsWith("\\" + match[0]) && getNumPrecedingBackslashes(match, match.length - 1) % 2 == 1)){
            missingClosingQuote = match[0];
        }
        return match[0] + " ".repeat(match.length - ((missingClosingQuote.length == 1) ? 1 : 2)) + match[0];
    });
    if(missingClosingQuote.length == 1){
        // The blanking above would have already terminate the string quote in blankedStringCodeLiteral if needed,
        // we need to update the original codeLiteral too
        codeLiteral += missingClosingQuote;
    }     

    // 1- Look for a bracket structure
    // Look up what opening bracket we have by getting the indexes of all the possible opening brackets
    const openBracketPosList = openBracketCharacters.flatMap((openBracket) => blankedStringCodeLiteral.indexOf(openBracket));
    // ... and then starting off from the first of this brackets if we found one (index > -1)
    let firstOpenedBracketPos = -1;
    openBracketPosList.forEach((pos) => {
        if(pos > -1 && (pos < firstOpenedBracketPos || firstOpenedBracketPos == -1)){
            firstOpenedBracketPos = pos;
        }
    });
    const hasBracket = (firstOpenedBracketPos > -1);
    if(hasBracket) {
        const firstOpenedBracketIndexInList = openBracketPosList.indexOf(firstOpenedBracketPos);
        const openingBracketValue = openBracketCharacters[firstOpenedBracketIndexInList];
        const closingBracketValue = closeBracketCharacters[firstOpenedBracketIndexInList];
        // Now we look for where the bracket closes -- the last closing bracket matching the opening one
        let startLookingOtherOpeningBracketsPos = firstOpenedBracketPos + 1;
        let innerOpeningBracketCount = 1; // because we first decrement when finding a closing bracket
        let closingBracketPos = -1;
        // Look for inner brackets, iteration is NOT made on "closingBracketPos" so we can keep the latest value
        do {
            closingBracketPos = blankedStringCodeLiteral.indexOf(closingBracketValue, startLookingOtherOpeningBracketsPos);
            const nextOpen = blankedStringCodeLiteral.indexOf(openingBracketValue, startLookingOtherOpeningBracketsPos);
            if (closingBracketPos > -1) {
                if (nextOpen > -1 && nextOpen < closingBracketPos) {
                    innerOpeningBracketCount ++;
                    startLookingOtherOpeningBracketsPos = nextOpen + 1;
                }
                else {
                    innerOpeningBracketCount--;
                    startLookingOtherOpeningBracketsPos = closingBracketPos + 1;
                }
            }            
        }
        while (innerOpeningBracketCount != 0 && closingBracketPos != -1);
       
        
        // Now that we have found the bracket boudary (if we didn't find a closing bracket match, we "manually" close after the whole content following opening bracket)
        // we can make a structure and parse the split code content as 
        //  - before the bracket
        //  - inside the bracket (so, we DO NOT include the bracket themselves)
        //  - after the bracket
        const beforeBracketCode = codeLiteral.substring(0, firstOpenedBracketPos);
        const innerBracketCode = codeLiteral.substring(firstOpenedBracketPos + 1, (closingBracketPos > -1) ? closingBracketPos : codeLiteral.length);
        // As a bracket structure is a field, following bits may depends on it. For example, for "(1+2)-3", the brackets is the LHS of the - following it,
        // so if we fed the parser only "-3", it would see it as an unitary sign and not an operator.
        // So for the parser to "see" the bracket part we will use a placeholder token that will be removed when aggrating the slots. 
        let afterBracketCode = (closingBracketPos > -1) ? codeLiteral.substring(closingBracketPos + 1) : "";
        if(afterBracketCode.length > 0){
            afterBracketCode = FIELD_PLACERHOLDER + afterBracketCode;
        }
        const {slots: structBeforeBracket, cursorOffset: beforeBracketCursorOffset} = parseCodeLiteral(beforeBracketCode, false, cursorPos);
        cursorOffset += beforeBracketCursorOffset;
        const {slots: structOfBracket, cursorOffset: bracketCursorOffset} = parseCodeLiteral(innerBracketCode, false, cursorPos ? cursorPos - (firstOpenedBracketPos + 1) : undefined);
        const structOfBracketField = {...structOfBracket, openingBracketValue: openingBracketValue};
        cursorOffset += bracketCursorOffset;
        const {slots: structAfterBracket, cursorOffset: afterBracketCursorOffset} = parseCodeLiteral(afterBracketCode, false, cursorPos && afterBracketCode.startsWith(FIELD_PLACERHOLDER) ? cursorPos - (closingBracketPos + 1) + FIELD_PLACERHOLDER.length : undefined);
        cursorOffset += afterBracketCursorOffset;
        // Remove the bracket field placeholder from structAfterBracket: we trim the placeholder value from the start of the first field of the structure.
        // (the conditional test may be overdoing it, but at least we are sure we won't get fooled by the user code...)
        if((structAfterBracket.fields[0] as BaseSlot).code.startsWith(FIELD_PLACERHOLDER)){
            (structAfterBracket.fields[0] as BaseSlot).code = (structAfterBracket.fields[0] as BaseSlot).code.substring(FIELD_PLACERHOLDER.length);
        }
        resStructSlot.fields.push(...structBeforeBracket.fields, structOfBracketField, ...structAfterBracket.fields);
        resStructSlot.operators.push(...structBeforeBracket.operators, {code: ""}, {code: ""}, ...structAfterBracket.operators);
    } 
    else{
        // 2 - lookup for strings: we assume the code literal contains escaped quotes:
        const quotesMatchPattern = "[" + stringQuoteCharacters.join("") + "]";
        if(blankedStringCodeLiteral.match(quotesMatchPattern) != null){
            // Retrieve the start and end of the quotes (if no ending quote is found, we consider the termination is at the end of the code literal)
            const openingQuoteIndex = blankedStringCodeLiteral.match(quotesMatchPattern)?.index??0;
            const openingQuoteValue =  blankedStringCodeLiteral[openingQuoteIndex];
            const closingQuoteIndex = openingQuoteIndex + 1 + (blankedStringCodeLiteral.substring(openingQuoteIndex + 1).match(openingQuoteValue)?.index??blankedStringCodeLiteral.length);
            // Similar to brackets, we can now split the code by what is before the string, the string itself, and what is after
            const beforeStringCode = codeLiteral.substring(0, openingQuoteIndex);
            const stringContentCode = codeLiteral.substring(openingQuoteIndex + 1, closingQuoteIndex);
            // same logic as brackets for subsequent code: cf. above
            let afterStringCode = codeLiteral.substring(closingQuoteIndex + 1);
            if(afterStringCode.length > 0){
                afterStringCode = FIELD_PLACERHOLDER + afterStringCode;
            }
            const {slots: structBeforeString, cursorOffset: beforeStringCursortOffset} = parseCodeLiteral(beforeStringCode);
            cursorOffset += beforeStringCursortOffset;
            const structOfString: StringSlot = {code: stringContentCode, quote: openingQuoteValue};
            const {slots: structAfterString, cursorOffset: afterStringCursorOffset}  = parseCodeLiteral(afterStringCode);
            cursorOffset += afterStringCursorOffset;
            if((structAfterString.fields[0] as BaseSlot).code.startsWith(FIELD_PLACERHOLDER)){
                (structAfterString.fields[0] as BaseSlot).code = (structAfterString.fields[0] as BaseSlot).code.substring(FIELD_PLACERHOLDER.length);
            }
            resStructSlot.fields.push(...structBeforeString.fields, structOfString, ...structAfterString.fields );
            resStructSlot.operators.push(...structBeforeString.operators, {code: ""}, {code: ""}, ...structAfterString.operators);
        }
        else{
            // 3 - break the code by operatorSlot
            const {slots: operatorSplitsStruct, cursorOffset: operatorCursorOffset} = getFirstOperatorPos(codeLiteral, blankedStringCodeLiteral, cursorPos);
            cursorOffset += operatorCursorOffset;
            resStructSlot.fields = operatorSplitsStruct.fields;
            resStructSlot.operators = operatorSplitsStruct.operators;
        }
    }

    return {slots: resStructSlot, cursorOffset: cursorOffset};
};

const getFirstOperatorPos = (codeLiteral: string, blankedStringCodeLiteral: string, cursorPos?:number): {slots: SlotsStructure, cursorOffset: number} => {
    let cursorOffset = 0;

    // Before checking the operators, we need "blank" the exception we do not consider operators:
    // number sign and a decimal separator - which we replace in the blanked code by "0"
    const blankReplacer = (paramIndex: number, tokens: string[], ...params: any): string => {
        // Helper function to replace a portion of a match, from the paramater indexed in paramIndex.
        // Returns the replacement. For details about the arguments:
        // cf https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#specifying_a_function_as_the_replacement
        // we do not expect any groups here
        const innerSignIndex = Math.max(...tokens.flatMap((token) => params[paramIndex].indexOf(token)));
        const innerMatchIndex = params[0].indexOf(params[paramIndex]);
        const indexOfSign =  params.at(-2) + innerMatchIndex + innerSignIndex;
        return params.at(-1).substring(params.at(-2), indexOfSign) + "0" + params.at(-1).substring(indexOfSign + 1, params.at(-2) + (params[0] as string).length);
    };

    blankedStringCodeLiteral = blankedStringCodeLiteral
        // Replacing exponential sign operator first (ex "-.25e-5" --> replace "-" after "e")
        .replaceAll(/(^\s*|[+\-*/%<>&|^=!]\s*)((\d+(\.\d*)?|\.\d+)[eE][-+]\d+j?)($|(\s*[ +\-*/%<>&|^=!]))/g,
            (...params) => blankReplacer(2, ["+", "-"], ...params))
        // Replacing a preceding sign operator
        .replaceAll(/(^\s*|[+\-*/%<>&|^=!]\s*)([+-]((0b[01]+)|(0x[0-9A-Fa-f]+)|((\d+(\.\d*)?|\.\d+)([eE]\d+)?j?)))(?=$|(\s*[ +\-*/%<>&|^=!]))/g,
            (...params) => blankReplacer(2, ["+", "-"], ...params))
        // Replacing the decimal separator
        .replaceAll(/(^\s*|[+\-*/%<>&|^=!]\s*)(((\d+(\.\d*)|\.\d+)([eE][0]?\d+)?j?))($|(\s*[ +\-*/%<>&|^=!]))/g,
            (...params) => blankReplacer(3, ["."], ...params));

    const resStructSlot: SlotsStructure = {fields: [], operators:[]};
    let hasOperator = true;
    let lookOffset = 0;
    // "u" flag is necessary for unicode escapes
    const cannotPrecedeKeywordOps = /^(\p{Lu}|\p{Ll}|\p{Lt}|\p{Lm}|\p{Lo}|\p{Nl}|\p{Mn}|\p{Mc}|\p{Nd}|\p{Pc}|_)$/u;
    while(hasOperator){
        const operatorPosList : OpFound[] = allOperators.flatMap((operator : OpDef) => {
            if (operator.keywordOperator) {
                // "g" flag is necessary to make it obey the lastIndex item as a place to start:
                const regex = new RegExp(operator.match.trim().replaceAll(" ", "\\s+") + " ", "g");
                regex.lastIndex = lookOffset;
                let result = regex.exec(blankedStringCodeLiteral);
                while (result != null) {
                    // Only a valid result if preceded by non-text character:
                    if ((result.index == 0 || !cannotPrecedeKeywordOps.exec(blankedStringCodeLiteral.substring(result.index - 1, result.index)))) {
                        return {...operator, pos: result.index, length: result[0].length} as OpFound;
                    }
                    // Otherwise search again:
                    result = regex.exec(blankedStringCodeLiteral);
                }
                return {...operator, pos: -1, length: 0} as OpFound;
            }
            else {
                return {...operator, pos: blankedStringCodeLiteral.indexOf(operator.match, lookOffset), length: operator.match.length} as OpFound;
            }
        });
        hasOperator = operatorPosList.some((operatorPos) => operatorPos.pos > -1);
        if(hasOperator){
            // Look for the first operator of the string inside the list
            let firstOperator : OpFound | null = null;
            for (const op of operatorPosList) {
                if(op.pos > -1 && (firstOperator == null || op.pos < firstOperator.pos)){
                    firstOperator = op;
                }
            }

            // Will always be true or else we wouldn't be in the outer if:
            if (firstOperator) {
                // Get the LHS as field and this operator as operator in the resulting structure
                // We perform a last step before returning the code unit: remove any remaining "dead" closing bracket
                let lhsCode = codeLiteral.substring(lookOffset, firstOperator.pos);
                closeBracketCharacters.forEach((closingBracket) => {
                    lhsCode = lhsCode.replaceAll(closingBracket, () => {
                        cursorOffset += -1;
                        return "";
                    });
                });
                const fieldContent = codeLiteral.substring(lookOffset, firstOperator.pos);
                if (cursorPos && cursorPos >= lookOffset && cursorPos < firstOperator.pos) {
                    resStructSlot.fields.push({code: fieldContent.substring(0, cursorPos - lookOffset) + fieldContent.substring(cursorPos - lookOffset).trimEnd()});
                }
                else {
                    resStructSlot.fields.push({code: fieldContent.trim()});
                    // Update the cursor position as the LHS may have been trimmed
                    // (only the cursor is passed the position)
                    if((cursorPos??0)>firstOperator.pos) {
                        cursorOffset += (fieldContent.trim().length - fieldContent.length);
                    }
                }
                resStructSlot.operators.push({code: firstOperator.match.trim()});
                // If there was some spaces between the operator and the RHS, they will be removed so we need to account for them
                // (only the cursor is passed the position)
                if((cursorPos??0)>firstOperator.pos) {
                    const operatorTrimmedStart = firstOperator.match.trimStart();
                    cursorOffset += (operatorTrimmedStart.trim().length - operatorTrimmedStart.length);
                }
                lookOffset = firstOperator.pos + firstOperator.length;
            }
        }
    }
    // As we always have at least 1 field, and operators contained between fields, we need to add the trimming field 
    // (and we also need to remove "dead" closing brackets)
    let code = codeLiteral.substring(lookOffset).trimStart();
    closeBracketCharacters.forEach((closingBracket) => {
        code = code.replaceAll(closingBracket, () => {
            cursorOffset += -1;
            return "";
        });
    });
    resStructSlot.fields.push({code: code});
    return {slots: resStructSlot, cursorOffset: cursorOffset};
};

/**
 * Gets the number of backslashes that directly precede cursorPos without any other character intervening
 */
export function getNumPrecedingBackslashes(content: string, cursorPos : number) : number {
    let count = 0;
    while (cursorPos > 0) {
        cursorPos -= 1;
        if (content.at(cursorPos) == "\\") {
            count += 1;
        }
        else {
            break;
        }
    }
    return count;
}
