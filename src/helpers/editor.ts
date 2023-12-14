import i18n from "@/i18n";
import { useStore } from "@/store/store";
import { AddFrameCommandDef, AllFrameTypesIdentifier, areSlotCoreInfosEqual, BaseSlot, CaretPosition, FramesDefinitions, getFrameDefType, isSlotBracketType, isSlotQuoteType, Position, SlotCoreInfos, SlotCursorInfos, SlotsStructure, SlotType, StringSlot } from "@/types/types";
import Vue from "vue";
import { getAboveFrameCaretPosition, getAvailableNavigationPositions } from "./storeMethods";
import { strypeFileExtension } from "./common";
import {getContentForACPrefix} from "@/autocompletion/acManager";

export const undoMaxSteps = 200;
export const autoSaveFreqMins = 2; // The number of minutes between each autosave action.

export enum CustomEventTypes {
    editorAddFrameCommandsUpdated = "frameCommandsUpdated",
    frameContentEdited = "frameContentEdited",
    editableSlotGotCaret= "slotGotCaret",
    editableSlotLostCaret = "slotLostCaret",
    editorContentPastedInSlot = "contentPastedInSlot",
    addFunctionToEditorAutoSave = "addToAutoSaveFunction",
    removeFunctionToEditorAutoSave = "rmToAutoSaveFunction",
    requestEditorAutoSaveNow = "requestAutoSaveNow",
    saveStrypeProjectDoneForLoad = "saveProjDoneForLoad",
    noneStrypeFilePicked = "nonStrypeFilePicked",
    /* IFTRUE_isPurePython */
    pythonConsoleDisplayChanged = "pythonConsoleDisplayChanged",
    /* FITRUE_isPurePython */
}

export enum ContextMenuType {
    frame,
    caretPaste,
}

export function getFrameContainerUIID(frameId: number): string {
    return "FrameContainer_" + frameId;
}

export function getFrameBodyUIID(frameId: number): string {
    return "frameBodyId_" + frameId;
}

export function getFrameBodyRef(): string {
    return "frameBody";
}

export function getJointFramesRef(): string {
    return "jointFrames";
}

export function getFrameUIID(frameId: number): string{
    return "frame_id_" + frameId;
}

export function getFrameHeaderUIID(frameId: number): string{
    // Change parseFrameHeaderUIID and isElementUIIDFrameHeaderDiv if this changes
    return "frameHeader_" + frameId;
}

export function parseFrameHeaderUIID(frameHeaderUIID: string): number{
    // Cf. getFrameHeaderUIID for the ID template
    return parseInt(frameHeaderUIID.substring(frameHeaderUIID.indexOf("_") + 1));
}

export function isElementUIIDFrameHeader(frameHeaderUIID: string): boolean {
    return frameHeaderUIID.match(/^frameHeader_(-?\d+)$/) != null;
}

export function getAppSimpleMsgDlgId(): string {
    return "appSimpleMsgModalDlg";
}

export function getImportDiffVersionModalDlgId(): string {
    return "importDiffVersionModalDlg";
}

function retrieveFrameIDfromUIID(uiid: string): number {
    return parseInt(uiid.substring("frame_id_".length));
}

export function isIdAFrameId(id: string): boolean {
    return id.match(/^frame_id_\d+$/) !== null;
}

const labelSlotUIIDRegex = /^input_frame_(\d+)_label_(\d+)_slot_([0-7]{4})_(\d+(,\d+)*)$/;
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
    const regexMatch = (element as HTMLSpanElement).id.match("^input_frame_\\d+_label_\\d+_slot_000(\\d)_\\d+(,\\d+)*$");
    return regexMatch != null && parseInt(regexMatch[1]) < 8;
}

export function isLabelSlotEditable(type: SlotType): boolean {
    return !isSlotBracketType(type) && !isSlotQuoteType(type) && type != SlotType.operator;
}

export function getACLabelSlotUIID(slotCoreInfos: SlotCoreInfos): string {
    return getLabelSlotUIID(slotCoreInfos) + "_AutoCompletion";
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

// Helper method to retrieve the literal python code from a frame label structure UI
// frameLabelStruct: the HTML element representing the current frame label structure
// currentSlotUIID: the HTML id for the current editable slot we are in
// delimiters: optional object to indicate from and to which slots parsing the code, requires the slots UIID and stop is exclusive
export function getFrameLabelSlotLiteralCodeAndFocus(frameLabelStruct: HTMLElement, currentSlotUIID: string, delimiters?: {startSlotUIID: string, stopSlotUIID: string}): {uiLiteralCode: string, focusSpanPos: number, hasStringSlots: boolean}{
    let focusSpanPos = 0;
    let uiLiteralCode = "";
    let foundFocusSpan = false;
    let ignoreSpan = !!delimiters;
    let hasStringSlots = false;
    frameLabelStruct.querySelectorAll(".labelSlot-input").forEach((spanElement) => {    
        if(delimiters && (delimiters.startSlotUIID == spanElement.id || delimiters.stopSlotUIID == spanElement.id)){
            ignoreSpan = !ignoreSpan ;
        } 
        if(!ignoreSpan) {
            // The code is extracted from the span; if requested, we only transform the string quotes to have a clear context to refer to in the parser, regardless the content of the strings
            // (so for example, if in the string slot a used typed "test\" (without double quotes!), the parsing would not be disturbed by the non terminating escaping "\" at the end)
            if(isSlotQuoteType(parseLabelSlotUIID(spanElement.id).slotType)){
                hasStringSlots = true;
                switch(spanElement.textContent){
                case UIDoubleQuotesCharacters[0]:
                case UIDoubleQuotesCharacters[1]:
                    uiLiteralCode += STRING_DOUBLEQUOTE_PLACERHOLDER;
                    break;
                case UISingleQuotesCharacters[0]:
                case UISingleQuotesCharacters[1]:
                    uiLiteralCode += STRING_SINGLEQUOTE_PLACERHOLDER;
                    break;            
                }
            }
            else{
                // We use the content of the slot as is
                if((spanElement.textContent?.includes(STRING_DOUBLEQUOTE_PLACERHOLDER) || spanElement.textContent?.includes(STRING_SINGLEQUOTE_PLACERHOLDER)) as boolean){
                    hasStringSlots = true;
                }
                uiLiteralCode += (spanElement.textContent);
            }
        
            if(spanElement.id === currentSlotUIID){
                focusSpanPos += (useStore().focusSlotCursorInfos?.cursorPos??0);     
                foundFocusSpan = true;
            }
            else{
                // In most cases, we just increment the length by the span content length,
                // BUT there are 2 exceptions: textual operators require surrounding spaces to be inserted, and those spaces do not appear on the UI
                // therefore we need to account for them when dealing with such operators;
                // and if we parse the string quotes, we need to set the position value as if the quotes were still here (because they are in the UI)
                let spacesOffset = 0;
                const spanElementContentLength = (spanElement.textContent?.length??0);
                if((trimmedKeywordOperators.includes(spanElement.textContent??""))){
                    spacesOffset = 2;
                    // Reinsert the spaces in the literal code
                    uiLiteralCode = uiLiteralCode.substring(0, uiLiteralCode.length - spanElementContentLength) 
                    + " " + uiLiteralCode.substring(uiLiteralCode.length - spanElementContentLength) 
                    + " ";
                }
                let stringPlaceHoldersCursorOffset = 0; // The offset induced by the difference of length between the string quotes and their placeholder representation
                const stringPlaceholderMatcher = (spanElement.textContent as string).match(new RegExp("("+STRING_SINGLEQUOTE_PLACERHOLDER.replaceAll("$","\\$")+"|"+STRING_DOUBLEQUOTE_PLACERHOLDER.replaceAll("$","\\$")+")", "g"));
                if(stringPlaceholderMatcher != null){
                    // The difference is 1 character per found placeholders 
                    stringPlaceHoldersCursorOffset = stringPlaceholderMatcher.length * (STRING_DOUBLEQUOTE_PLACERHOLDER.length - 1);
                }

                if(!foundFocusSpan) {
                    focusSpanPos += (spanElementContentLength + spacesOffset - stringPlaceHoldersCursorOffset);
                }
            }
        }
    });    
    return {uiLiteralCode: uiLiteralCode, focusSpanPos: focusSpanPos, hasStringSlots: hasStringSlots};
}


// We want to know if the cursor position in a comment frame will still allow for moving that cursor up/down within the frame or need to be interpreted as an "exit" out the frame.
// A naive way of approaching this would be to check the line returns (\n) before/after the cursor, but this is not reliable because the text content associated with the span
// element will not necessarily be represented exactly in the same way on the browser (because of text wrapping) -- and there is no easy way to retrieve the text AS IT IS PRESENTED.
// However, we can check the bounds of the current selection to help us find where we are in the span, and therefore know if we're in the top/last VISUALLY SHOWING line of the text
// Based on https://www.bennadel.com/blog/4310-detecting-rendered-line-breaks-in-a-text-node-in-javascript.htm
export function checkCanReachAnotherCommentLine(isCommentFrame: boolean, isArrowUp: boolean, commentSpanElement: HTMLSpanElement): boolean{
    // If we're not in a comment, just don't check
    const currentDocSelection = document.getSelection();
    if(isCommentFrame && currentDocSelection){
        const commentSpanRect = commentSpanElement.getClientRects()[0];
        const commentSelectionRects = currentDocSelection.getRangeAt(0).getClientRects();
        // When there is nothing in the comment, the range may have no rectangles, then we clearly can return false
        if(commentSelectionRects[0]){
            const lineheight = commentSelectionRects[0].height;
            // The weird case when we are below an empty line
            const firstRect = (commentSelectionRects.length == 2 && currentDocSelection.getRangeAt(0).collapsed) ? commentSelectionRects[1] : commentSelectionRects[0];
            const isInFirstVisualLine = (firstRect.top - commentSpanRect.top) < lineheight;
            const isInLastVisualLine = (commentSpanRect.bottom - commentSelectionRects[commentSelectionRects.length - 1].bottom) < lineheight;
            return ((isArrowUp) ? !isInFirstVisualLine : !isInLastVisualLine);
        }
    }
    return false;
}

export function getFrameContextMenuUIID(frameUIID: string): string {
    return frameUIID + "_frameContextMenu";
}

export function getCodeEditorUIID(): string {
    return getFrameContainerUIID(useStore().getMainCodeFrameContainerId);
}

export function getCaretUIID(caretAssignedPosition: string, frameId: number): string {
    return "caret_"+caretAssignedPosition+"_"+frameId;
}

export function getCaretContainerRef(): string {
    return "caretContainer";
}

export function getCommandsContainerUIID(): string {
    return "editorCommands";
}

export function getEditorMenuUIID(): string {
    return "showHideMenu";
} 

export function getMenuLeftPaneUIID(): string {
    return "menu-bar";
}

export function getSaveAsProjectModalDlg():string {
    return "save-strype-project-modal-dlg";
}

export function getEditorMiddleUIID(): string {
    return "editorCodeDiv";
}

export function getCommandsRightPaneContainerId(): string {
    return "commandsContainerDiv";
}

export function setContextMenuEventPageXY(event: MouseEvent, positionForMenu?: Position): void {
    Object.defineProperty(event, "pageX", {
        value: (positionForMenu?.left != undefined) ? positionForMenu.left: (event.pageX - 60),
        writable: true,
    });

    Object.defineProperty(event, "pageY", {
        value: (positionForMenu?.top != undefined) ? positionForMenu.top : ((positionForMenu?.bottom != undefined) ? positionForMenu.bottom : event.pageY),
        writable: true,
    });

}

export function adjustContextMenuPosition(event: MouseEvent, contextMenu: HTMLElement, positionForMenu?: Position): void {
    // These situations can happen:
    // - we didn't provide any positioning request (case of click): we check the bottom of temporary (invisible) menu is in view
    //   if not, we slide the menu so that the bottom position is at the click
    // - we provided a positioning request (case of KB shortcut) AND we passed the "top" property in our position: keep as is
    // - we provided a positioning request (case of KB shortcut) AND we passed the "bottom" property in our position: 
    //   we slide the menu so that the actual height of the menu is deducted from the "bottom" property value 
    //   (so the bottom of the menu and the bottom of the target (last selected frame or context menu container) are aligned)
    if(positionForMenu){
        if(positionForMenu.bottom != undefined){
            const newMenuTopPosition = positionForMenu.bottom - contextMenu.getBoundingClientRect().height;
            contextMenu.style.top = newMenuTopPosition+"px";
        }
    }
    else if(event.pageY + contextMenu.getBoundingClientRect().height > (document.getElementById(getEditorMiddleUIID())?.getBoundingClientRect().height??0)){
        const newMenuTopPosition = event.pageY - contextMenu.getBoundingClientRect().height;
        contextMenu.style.top = newMenuTopPosition+"px";
    }
}

export function handleContextMenuKBInteraction(keyDownStr: string): void {
    // This helper method handles the keyboard interaction with the frames/caret context menu.
    // Vue-simple-context-menu only handles escape interaction, we need to work out the rest...
    // Note that the CSS styling for this menu is both using custom classes and overwriting exisitng classes of the component (cf Frame.vue)
    const contextMenuElement = document.querySelector(".vue-simple-context-menu--active");
    if(contextMenuElement){
        if(keyDownStr.toLowerCase() == "arrowdown" || keyDownStr.toLowerCase() == "arrowup"){
            // Navigating the menu, we change the selection via CSS
            const navDirection = (keyDownStr.toLowerCase() == "arrowup") ? -1 : 1;
            const menuItemElements = contextMenuElement.querySelectorAll(".vue-simple-context-menu__item:not(.vue-simple-context-menu__divider)");
            if(menuItemElements.length > 0){
                const menuItemsCount = menuItemElements.length;
                const currentSelectedMenuItemIndex = Array.from(menuItemElements).findIndex((menuItemEl) => menuItemEl.classList.contains("selectedContextMenuItem"));
                if(currentSelectedMenuItemIndex > -1){
                    // First we need to deselect the current selected item
                    Array.from(menuItemElements)[currentSelectedMenuItemIndex].classList.remove("selectedContextMenuItem");
                    // Then we can select another menu item, next in navigation order, or looping to the start/end of the menu if needed
                    const newSelectedMenuItemIndex = (((currentSelectedMenuItemIndex + navDirection) % menuItemsCount) + menuItemsCount) % menuItemsCount;
                    Array.from(menuItemElements)[newSelectedMenuItemIndex].classList.add("selectedContextMenuItem");                      
                }
                else{
                    // No menu item has been yet selected: we select either the first or last one depending on the direction
                    Array.from(menuItemElements)[(navDirection == -1) ? (menuItemsCount - 1) : 0].classList.add("selectedContextMenuItem");
                }
            }
        }
    }
}


export const fileImportSupportedFormats: string[] = [strypeFileExtension];

// Check if the code contains errors: precompiled errors & TigerPyton errors are all indicated in the editor
// by an error class on a frame header ("frameHearder_<frameId> + "error") or an editable slot ("labelSlot-input" + "errorSlot").
let errorHTMLElements: HTMLElement[]  | null = null;

export function checkEditorCodeErrors(): void{
    // Clear or construcct the current list first
    if(errorHTMLElements == null){
        errorHTMLElements = [];
    }
    else{
        (errorHTMLElements as HTMLElement[]).splice(0, (errorHTMLElements as HTMLElement[]).length);
    }

    // Then look up errors based on CSS
    const erroneousHTMLElements = [...document.getElementsByClassName("error"), ...document.getElementsByClassName("errorSlot")];
    if(erroneousHTMLElements.length > 0){
        for(const erroneousHTMLElement of erroneousHTMLElements) {
            if(erroneousHTMLElement.classList.contains("labelSlot-input") || erroneousHTMLElement.classList.contains("frame-header")){
                errorHTMLElements.push(erroneousHTMLElement as HTMLElement);
            }
        }
    }
}

export function getEditorCodeErrorsHTMLElements(): HTMLElement[] {
    if(errorHTMLElements == null){
        // If we never checked errors, we do it at this stage
        checkEditorCodeErrors();
    }

    return (errorHTMLElements as HTMLElement[]);
}

export function countEditorCodeErrors(): number {
    if(errorHTMLElements == null){
        // If we never checked errors, we do it at this stage
        checkEditorCodeErrors();
    }
    return (errorHTMLElements as HTMLElement[]).length;
}

export function hasEditorCodeErrors(): boolean {
    return countEditorCodeErrors() > 0;
}

export function hasPrecompiledCodeError(): boolean {
    return hasEditorCodeErrors() && !errorHTMLElements?.some((element) => isElementUIIDFrameHeader(element.id));                                                                    
}

// This methods checks for the relative positions of the current position (which can be a focused slot or a blue caret) towards the positions of the errors (slots or 1st slot an frame header)
// We return the "full" index (of the error list) if the current position is ON an error, otherwise "semi" indexes that will allow navigating the errors properly:
// for example if the current position is before the first error, the index is -0.5 so we can still go down and reach error indexed 0
export function getNearestErrorIndex(): number {
    if(errorHTMLElements == null){
        // If we never checked errors, we do it at this stage
        checkEditorCodeErrors();
    }
    
    const errorsElmtIds = (errorHTMLElements as HTMLElement[]).flatMap((elmt) => elmt.id);
    const isEditing = useStore().isEditing;

    // Get the slot currently being edited: we check first if that's one of the error so it would be a "real" index of the error array
    // if it's not, then we'll find in between which 2 errors we're in and use a "semi" index
    const currentFocusedElementId = (isEditing) 
        ? getLabelSlotUIID(useStore().focusSlotCursorInfos?.slotInfos as SlotCoreInfos) 
        : getCaretUIID(useStore().currentFrame.caretPosition, useStore().currentFrame.id);
    // Case 1: we are in a slot that is erroneous, or in a slot of an erroneous frame
    if(errorsElmtIds.includes(currentFocusedElementId) || (isEditing && errorsElmtIds.includes(getFrameHeaderUIID(useStore().focusSlotCursorInfos?.slotInfos.frameId as number)))){
        return errorsElmtIds.indexOf((errorsElmtIds.includes(currentFocusedElementId)) ? currentFocusedElementId : getFrameHeaderUIID(useStore().focusSlotCursorInfos?.slotInfos.frameId as number));
    }
    else{
        // Case 2: not in an error, we find out our relative position to the list of errors
        const allCaretPositions = getAvailableNavigationPositions();
        // Get all position indexes (we use one single array for simplication, the current slot or frame caret is put AT THE END of the array)
        const allPosIndexes:number[] = [];
        [...errorsElmtIds, currentFocusedElementId].forEach((elementId) => {
            const isElementEditableSlot = isElementEditableLabelSlotInput(document.getElementById(elementId));
            const isElementFrameHeader = isElementUIIDFrameHeader(elementId);
            // Look the position of a slot (an error or the currently focused slot, or the first slot of an erroneous frame)
            if(isElementEditableSlot || isElementFrameHeader){
                const slotInfos: SlotCoreInfos = (isElementEditableSlot) 
                    ? parseLabelSlotUIID(elementId)
                    : {frameId: parseFrameHeaderUIID(elementId), slotId: "0", labelSlotsIndex: 0, slotType: SlotType.code};
                allPosIndexes.push(allCaretPositions.findIndex((navPos) => navPos.isSlotNavigationPosition && navPos.frameId == slotInfos.frameId 
                && navPos.labelSlotsIndex == slotInfos.labelSlotsIndex && navPos.slotId == slotInfos.slotId 
                && navPos.slotType == slotInfos.slotType));
            }
            // Look for the position of the current focused blue caret (because if we have an element that is the caret it can only be the current blue caret, there is no errors on a blue caret...)
            else{
                allPosIndexes.push(allCaretPositions.findIndex((navPos) => !navPos.isSlotNavigationPosition && navPos.frameId == useStore().currentFrame.id && navPos.caretPosition == useStore().currentFrame.caretPosition));
            }
        });
        
        // If we are not editing, we add the position of the caret at the end of the array (since we would have skipped pushing a value as currentFocusedElementId would be empty)
        const currentFocusedPosIndex = allPosIndexes.pop() as number;
        if(currentFocusedPosIndex < allPosIndexes[0]){
            return -0.5;
        }
        else if (currentFocusedPosIndex > allPosIndexes[allPosIndexes.length - 1]){
            return allPosIndexes.length;
        }
        else{
            const nextErrorPosIndex = allPosIndexes.findIndex((posIndex) => posIndex > currentFocusedPosIndex) as number;
            return nextErrorPosIndex - 0.5;
        }            
    }
}

// Helper function to generate the frame commands on demand. 
// Calls will happen when the frames are created the first time, and whenever the language is changed
export function generateAllFrameCommandsDefs():void {
    allFrameCommandsDefs = {
        "i": [
            {
                type: getFrameDefType(AllFrameTypesIdentifier.if),
                description: "if",
                shortcuts: ["i"],
                tooltip:i18n.t("frame.if_detail") as string,
                index: 0,
            },
            {
                type: getFrameDefType(AllFrameTypesIdentifier.import),
                description: "import",
                shortcuts: ["i"],
                tooltip:i18n.t("frame.import_detail") as string,
                index:1,
            },
        ],
        "l": [{
            type: getFrameDefType(AllFrameTypesIdentifier.elif),
            description: "elif",
            tooltip:i18n.t("frame.elif_detail") as string,
            shortcuts: ["l"],
        }],
        "e": [{
            type: getFrameDefType(AllFrameTypesIdentifier.else),
            description: "else",
            tooltip:i18n.t("frame.else_detail") as string,
            shortcuts: ["e"],
        }],
        "f": [
            {
                type: getFrameDefType(AllFrameTypesIdentifier.for),
                description: "for",
                shortcuts: ["f"],
                tooltip:i18n.t("frame.for_detail") as string,
                index: 0,
            },
            {
                type: getFrameDefType(AllFrameTypesIdentifier.funcdef),
                description: i18n.t("frame.funcdef_desc") as string,
                shortcuts: ["f"],
                tooltip:i18n.t("frame.funcdef_detail") as string,
                index: 1,
            },
            {
                type: getFrameDefType(AllFrameTypesIdentifier.fromimport),
                description: "from...import",
                tooltip:i18n.t("frame.fromimport_detail") as string,
                shortcuts: ["f"],
                index:2,
            },
        ],
        "w": [{
            type: getFrameDefType(AllFrameTypesIdentifier.while),
            description: "while",
            tooltip:i18n.t("frame.while_detail") as string,
            shortcuts: ["w"],
        }],
        "b" : [{
            type: getFrameDefType(AllFrameTypesIdentifier.break),
            description: "break",
            tooltip:i18n.t("frame.break_detail") as string,
            shortcuts: ["b"],
        }],
        "u" : [{
            type: getFrameDefType(AllFrameTypesIdentifier.continue),
            description: "continue",
            tooltip:i18n.t("frame.continue_detail") as string,
            shortcuts: ["u"],
        }],
        "=": [{
            type: getFrameDefType(AllFrameTypesIdentifier.varassign),
            description: i18n.t("frame.varassign_desc") as string,
            tooltip:i18n.t("frame.varassign_detail") as string,
            shortcuts: ["="],
        }],
        " ": [{
            type: getFrameDefType(AllFrameTypesIdentifier.empty),
            description: i18n.t("frame.funccall_desc") as string,
            shortcuts: [" "],
            tooltip:i18n.t("frame.funccall_detail") as string,
            symbol: "⌴",//"␣"
        }],
        "enter": [{
            type: getFrameDefType(AllFrameTypesIdentifier.blank),
            description: i18n.t("frame.blank_desc") as string,
            shortcuts: ["\x13"],
            tooltip:i18n.t("frame.blank_detail") as string,
            symbol: "↵",
        }],
        "r": [{
            type: getFrameDefType(AllFrameTypesIdentifier.return),
            description: "return",
            tooltip:i18n.t("frame.return_detail") as string,
            shortcuts: ["r"],
        }],
        "c": [{
            type: getFrameDefType(AllFrameTypesIdentifier.comment),
            description: i18n.t("frame.comment_desc") as string,
            tooltip:i18n.t("frame.comment_detail") as string,
            shortcuts: ["c", "#"],
        }],
        "t": [{
            type: getFrameDefType(AllFrameTypesIdentifier.try),
            description: "try",
            tooltip:i18n.t("frame.try_detail") as string,
            shortcuts: ["t"],
        }],
        "a" : [{
            type: getFrameDefType(AllFrameTypesIdentifier.raise),
            description: "raise",
            tooltip:i18n.t("frame.raise_detail") as string,
            shortcuts: ["a"],
        }],
        "x": [{
            type: getFrameDefType(AllFrameTypesIdentifier.except),
            description: "except",
            tooltip:i18n.t("frame.except_detail") as string,
            shortcuts: ["x"],
        }],
        "n": [{
            type: getFrameDefType(AllFrameTypesIdentifier.finally),
            description: "finally",
            tooltip:i18n.t("frame.finally_detail") as string,
            shortcuts: ["n"],
        }],
        "h": [{
            type: getFrameDefType(AllFrameTypesIdentifier.with),
            description: "with",
            tooltip:i18n.t("frame.with_detail") as string,
            shortcuts: ["h"],
        }],
        "g": [{
            type: getFrameDefType(AllFrameTypesIdentifier.global),
            description: "global",
            tooltip: i18n.t("frame.global_detail") as string,
            shortcuts: ["g"],
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
    const shortcutCommands = Object.values(allFrameCommandsDefs as {[id: string]: AddFrameCommandDef[]}).flat().filter((command) => command.shortcuts[0] == shortcut);
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
export const operators = [".","+","-","/","*","%",":","//","**","&","|","~","^",">>","<<",
    "==","=","!=",">=","<=","<",">",","];
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
        const {slotInfos: anchorSlotInfos, cursorPos: anchorCursorPos} = anchorCursorInfos;
        const {slotInfos: focusSlotInfos, cursorPos: focusCursorPos} = focusCursorInfos;
        // Check if same frame first
        if(anchorSlotInfos.frameId == focusSlotInfos.frameId){
            // Check if same label index
            if(anchorSlotInfos.labelSlotsIndex == focusSlotInfos.labelSlotsIndex){
                // check if same slot ID (we don't need to worry about the operators, brackets or quotes)
                if(anchorSlotInfos.slotId == focusSlotInfos.slotId){
                    // Check the cursors difference
                    return anchorCursorPos - focusCursorPos;
                }
                
                // Not in the same slot, we check the slots in relation to each other and their level in the hierarchy:
                // we compare the ancestor indexes of each slots until a difference in found, starting from the root.
                const anchorSlotIdIndexes = anchorCursorInfos.slotInfos.slotId.split(",");
                const focusSlotIdIndexes = focusCursorInfos.slotInfos.slotId.split(",");
                const minAncestorLevels = Math.min(anchorSlotIdIndexes.length + 1, focusSlotIdIndexes.length + 1);
                let ancestorLevelIndex = 0;
                let foundDiff = false;
                while(!foundDiff && ancestorLevelIndex < minAncestorLevels){
                    if(anchorSlotIdIndexes[ancestorLevelIndex] != focusSlotIdIndexes[ancestorLevelIndex]){
                        foundDiff = true;
                        return (parseInt(anchorSlotIdIndexes[ancestorLevelIndex]) - parseInt(focusSlotIdIndexes[ancestorLevelIndex]));
                    }
                    ancestorLevelIndex++;
                }
                if(!foundDiff){
                    // If we reach this bit, then it means we have one of the IDs totally contained at the start of the other (e.g. "1,2" and "1,2,3")
                    // So the slot that has the longest ID is by definition after the one with the shortest
                    return anchorSlotIdIndexes.length - focusSlotIdIndexes.length;
                }
            }

            // Not the same label index, we return the indexes difference
            return (anchorSlotInfos.labelSlotsIndex - focusSlotInfos.labelSlotsIndex);
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

// Given a slot refered by slotID, this method looks up what is the slot index of the given slot's ancestor 
// at the level indicated by sameLevelThanSlotParentId. See example below. 
// The given slot is expected to be in a deeper level than the reference ancester.
export const getSameLevelAncestorIndex = (slotId: string, sameLevelThanSlotParentId: string): number => {
    // Example: the given slot ID is "0,6,2,3,7", and sameLevelThanSlotParentId is "4,1,8"
    // As sameLevelThanSlotParentId has 3 levels, the ancestor is at position 2, what we need to return is 6 because it is at the second position in the ID of the given slot.
    const ancestorLevels = sameLevelThanSlotParentId.split(",").length;
    return parseInt(slotId.split(",")[ancestorLevels -1]);
};

const FIELD_PLACERHOLDER = "$strype_field_placeholder$";
// The placeholders for the string quotes when strings are extracted FROM THE EDITOR SLOTS,
// both placeholders need to have THE SAME LENGHT so sustitution operations are done with more ease
export const STRING_SINGLEQUOTE_PLACERHOLDER = "$strype_StrSgQuote_placeholder$";
export const STRING_DOUBLEQUOTE_PLACERHOLDER = "$strype_StrDbQuote_placeholder$";
export const parseCodeLiteral = (codeLiteral: string, flags?: {isInsideString?: boolean, cursorPos?: number, skipStringEscape?: boolean, frameType?: string,}): {slots: SlotsStructure, cursorOffset: number} => {
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
    if(flags && flags.isInsideString){
        const escapedQuote = "\\" + codeLiteral.charAt(0);
        codeLiteral = codeLiteral.substring(1, codeLiteral.length - 1).replaceAll(escapedQuote, (match) => match.charAt(1));
    }

    // First we look for string literals, as their content should not generate "subslot":
    // We simply use an equivalent size placeholder so it wont interfere the parsing later.
    // Note that the regex expression will look for either a well-formed a string literal or a non terminated string literal (for example: "test)
    // and when non terminated string literal is found, we complete the quotes manually (it will necessarily be at the end of the code literal)
    // When we use the quotes placeholder, we arrange the blanked strings so that their size "include" the placeholders and still match with the codeLiteral length.
    // For example, if the code in the UI was <print("hello")>, the code literal in this method is:
    //                             <print($strype_StrDbQuote_placeholder$hello$strype_StrDbQuote_placeholder$)>
    // so we blank it like this --> print("                                                                 ")
    // in that way, everything is of the same length and we keep work character indexes properly. We only need to care about the real quotes when we create the string slots.   
    const quotesPlaceholdersRegex = "(" + STRING_SINGLEQUOTE_PLACERHOLDER.replaceAll("$","\\$") + "|" + STRING_DOUBLEQUOTE_PLACERHOLDER.replaceAll("$","\\$") + ")";
    const strRegEx = (flags?.skipStringEscape) ? new RegExp(quotesPlaceholdersRegex+"((?!\\1).)*\\1","g") : /(['"])(?:(?!(?:\\|\1)).|\\.)*\1?/g;
    let missingClosingQuote = "";
    const blankedStringCodeLiteral = codeLiteral.replace(strRegEx, (match) => {
        if(flags?.skipStringEscape){
            const codeStrQuotes = (match.startsWith(STRING_SINGLEQUOTE_PLACERHOLDER)) ? "'" : "\"";
            // The length of the blanked string is twice the length of the placeholers minus 2 (for the quotes) plus the inner content length (the actual string value)
            // in other words, the match length minus 2 (that accounts the quotes)
            return codeStrQuotes + " ".repeat(match.length - 2) + codeStrQuotes;
        }
        else {
            if(!match.endsWith(match[0]) || (match.endsWith("\\" + match[0]) && getNumPrecedingBackslashes(match, match.length - 1) % 2 == 1)){
                missingClosingQuote = match[0];
            }
            return match[0] + " ".repeat(match.length - ((missingClosingQuote.length == 1) ? 1 : 2)) + match[0];
        }
        
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
        const {slots: structBeforeBracket, cursorOffset: beforeBracketCursorOffset} = parseCodeLiteral(beforeBracketCode, {isInsideString:false, cursorPos: flags?.cursorPos, skipStringEscape: flags?.skipStringEscape});
        cursorOffset += beforeBracketCursorOffset;
        const {slots: structOfBracket, cursorOffset: bracketCursorOffset} = parseCodeLiteral(innerBracketCode, {isInsideString: false, cursorPos: (flags?.cursorPos) ? flags.cursorPos - (firstOpenedBracketPos + 1) : undefined, skipStringEscape: flags?.skipStringEscape});
        if (openingBracketValue === "(") {
            // First scan and find all the comma-separated parameters that are a single field:
            let lastParamStart = -1;
            let curParam = 0;
            const singleFieldParams : Record<number, BaseSlot> = {};
            for (let i = 0; i < structOfBracket.fields.length; i++) {
                if (i == structOfBracket.operators.length || structOfBracket.operators[i].code === ",") {
                    if (i - lastParamStart == 1 && "code" in structOfBracket.fields[i] && !("quote" in structOfBracket.fields[i])) {
                        singleFieldParams[curParam] = structOfBracket.fields[i] as BaseSlot;
                    }
                    curParam += 1;
                    lastParamStart = i;
                }
            }
            (Object.entries(singleFieldParams) as unknown as [number, BaseSlot][]).forEach(([paramIndex, slot] : [number, BaseSlot]) => {
                const context = getContentForACPrefix(structBeforeBracket, true);
                console.log("Context is " + context + " for " + JSON.stringify(structBeforeBracket));
                slot.placeholderSource = {
                    token: (structBeforeBracket.fields.at(-1) as BaseSlot)?.code ?? "",
                    context: context,
                    paramIndex: paramIndex,
                    lastParam: paramIndex == curParam - 1,
                };
            });
        }
        const structOfBracketField = {...structOfBracket, openingBracketValue: openingBracketValue};
        cursorOffset += bracketCursorOffset;
        const {slots: structAfterBracket, cursorOffset: afterBracketCursorOffset} = parseCodeLiteral(afterBracketCode, {isInsideString: false, cursorPos: (flags && flags.cursorPos && afterBracketCode.startsWith(FIELD_PLACERHOLDER)) ? flags.cursorPos - (closingBracketPos + 1) + FIELD_PLACERHOLDER.length : undefined, skipStringEscape: flags?.skipStringEscape});
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
            const closingQuoteIndex = openingQuoteIndex + 1 + (blankedStringCodeLiteral.substring(openingQuoteIndex + 1).match(openingQuoteValue)?.index??blankedStringCodeLiteral.substring(openingQuoteIndex + 1).length);
            // Similar to brackets, we can now split the code by what is before the string, the string itself, and what is after
            // Note that if have known placeholders for the string quotes in the code, we need to take them into consideration at this stage
            const beforeStringCode = codeLiteral.substring(0, openingQuoteIndex);
            const quoteTokenLength = (flags?.skipStringEscape && codeLiteral.charAt(openingQuoteIndex) != openingQuoteValue) ? STRING_SINGLEQUOTE_PLACERHOLDER.length : 1;
            const parsingStringContentRes = getParsingStringContentAndFocusOffset(openingQuoteValue,codeLiteral.substring(openingQuoteIndex + quoteTokenLength, closingQuoteIndex - (quoteTokenLength - 1)));
            const stringContentCode = parsingStringContentRes.parsedContent;
            cursorOffset += parsingStringContentRes.cursorOffset;
            // same logic as brackets for subsequent code: cf. above
            let afterStringCode = codeLiteral.substring(closingQuoteIndex + 1);
            if(afterStringCode.length > 0){
                afterStringCode = FIELD_PLACERHOLDER + afterStringCode;
            }
            // When we construct the parts before and after the string, we need to internally set the cursor "fake" position, that is, the cursor offset by the bits we are evaluating
            const {slots: structBeforeString, cursorOffset: beforeStringCursortOffset} = parseCodeLiteral(beforeStringCode, {isInsideString: false, cursorPos: flags?.cursorPos, skipStringEscape: flags?.skipStringEscape});
            cursorOffset += beforeStringCursortOffset;
            const structOfString: StringSlot = {code: stringContentCode, quote: openingQuoteValue};
            const {slots: structAfterString, cursorOffset: afterStringCursorOffset} = parseCodeLiteral(afterStringCode, {isInsideString: false, cursorPos: (flags?.cursorPos??0) - closingQuoteIndex + (2*(quoteTokenLength -1)) + FIELD_PLACERHOLDER.length, skipStringEscape: flags?.skipStringEscape});
            cursorOffset += afterStringCursorOffset;
            if((structAfterString.fields[0] as BaseSlot).code.startsWith(FIELD_PLACERHOLDER)){
                (structAfterString.fields[0] as BaseSlot).code = (structAfterString.fields[0] as BaseSlot).code.substring(FIELD_PLACERHOLDER.length);
            }
            resStructSlot.fields.push(...structBeforeString.fields, structOfString, ...structAfterString.fields );
            resStructSlot.operators.push(...structBeforeString.operators, {code: ""}, {code: ""}, ...structAfterString.operators);
        }
        else{
            // 3 - break the code by operatorSlot
            const {slots: operatorSplitsStruct, cursorOffset: operatorCursorOffset} = getFirstOperatorPos(codeLiteral, blankedStringCodeLiteral, flags?.frameType??"", flags?.cursorPos);
            cursorOffset += operatorCursorOffset;
            resStructSlot.fields = operatorSplitsStruct.fields;
            resStructSlot.operators = operatorSplitsStruct.operators;
        }
    }

    return {slots: resStructSlot, cursorOffset: cursorOffset};
};

const getFirstOperatorPos = (codeLiteral: string, blankedStringCodeLiteral: string, frameType: string, cursorPos?:number): {slots: SlotsStructure, cursorOffset: number} => {
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
        // When we look for operators, there is one exception: we discard "*" (and "**" why not) when are in a from import frame, we will treat it as text.
        const isInFromImportFrame = (frameType == AllFrameTypesIdentifier.fromimport);
        const operatorPosList : OpFound[] = ((isInFromImportFrame) ? allOperators.filter((opDef) => !opDef.match.includes("*")) : allOperators).flatMap((operator : OpDef) => {
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

const getParsingStringContentAndFocusOffset = (quote: string, content: string): {parsedContent: string, cursorOffset: number} => {
    // This methods parsed the content of a string literal: it detects if there are some quotes placeholders within the content,
    // and replace them according to the string quote used to delimit this literal.
    // The situation of string quotes placeholders inside a string literal content can happen when the user has selected a string and wrap it with another type of quote:
    // the outer placeholders will be turned to the appropriate quotes, but the inner ones won't, so we do it here.
    // It also parses inner potential quotes.
    // Here is an example with all these cases happening
    // Initial string was : 
    //  "this is Strype's string"
    // User wrapped and we are at the stage of parsing the literal code, we have :
    //  ‘$strype_StrDbQuote_placeholder$this is Strype's string$strype_StrDbQuote_placeholder$’
    // We need to have:
    //  ‘"this is Strype\'s string"’
    const quotesPlaceholdersExp = "(" + STRING_SINGLEQUOTE_PLACERHOLDER.replaceAll("$","\\$") + "|" + STRING_DOUBLEQUOTE_PLACERHOLDER.replaceAll("$","\\$") + ")";
    let cursorOffset = 0;
    content = content.replaceAll(new RegExp(quotesPlaceholdersExp, "g"), (placeholder) => {
        return (placeholder == STRING_DOUBLEQUOTE_PLACERHOLDER) ? "\"" : "'";
    });
    
    // We look for UNESCAPTED quotes inside the string literal
    const unescaptedQuoteExp = "(?<!\\\\)(?:\\\\{2})*" + ((quote == "'") ? "'" : "\"");
    content = content.replaceAll(new RegExp(unescaptedQuoteExp,"g"), (unescQuote) => {
        cursorOffset++;
        return "\\" + unescQuote[unescQuote.length - 1];
    });

    return {parsedContent: content, cursorOffset: cursorOffset};
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
