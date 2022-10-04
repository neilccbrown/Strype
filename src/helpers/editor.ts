import i18n from "@/i18n";
import { useStore } from "@/store/store";
import { AddFrameCommandDef, AllFrameTypesIdentifier, CaretPosition, FramesDefinitions, getFrameDefType } from "@/types/types";
import Vue from "vue";
import { getAboveFrameCaretPosition } from "./storeMethods";

export const undoMaxSteps = 50;

export enum CustomEventTypes {
    editorAddFrameCommandsUpdated = "frameCommandsUpdated",
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

function retrieveFrameIDfromUIID(uiid: string): number {
    return parseInt(uiid.substring("frame_id_".length));
}

export function isIdAFrameId(id: string): boolean {
    return id.match(/^frame_id_\d+$/) !== null;
}

export function getEditableSlotUIID(frameId: number, slotIndex: number): string  {
    //if a change is done in this method, also update isElementEditableSlotInput()
    return "input_frameId_" + frameId + "_slot_" + slotIndex;
}

export function isElementEditableSlotInput(element: EventTarget | null): boolean{
    if(!(element instanceof HTMLInputElement)){
        return false;
    }

    return (((element as HTMLInputElement).id.match("^input_frameId_\\d+_slot_\\d+$")?.length)??0) > 0;
}

export function getFrameContextMenuUIID(frameUIID: string): string{
    return frameUIID + "frameContextMenu";
}

export function getCodeEditorUIID(): string {
    return getFrameContainerUIID(useStore().getMainCodeFrameContainerId);
}

export function getCaretUIID(caretAssignedPosition: string, frameId: number): string{
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
// or an editable slot ("editableslot-input" + "error").
export function hasEditorCodeErrors(): boolean {
    const erroneousHTMLElements = document.getElementsByClassName("error");
    if(erroneousHTMLElements.length > 0){
        let hasErrors = false;
        for(const erroneousHTMLElement of erroneousHTMLElements) {
            hasErrors = hasErrors || erroneousHTMLElement.className.includes("frameDiv") 
                || erroneousHTMLElement.className.includes("frame-body-container") 
                || erroneousHTMLElement.className.includes("editableslot-input");
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
        const newCaretPosition = (isDragChangingOrder) ? getAboveFrameCaretPosition(topFrameId) : {id: useStore().currentFrame.id, caretPosition: useStore().currentFrame.caretPosition};
        
        // Set the caret properly in the store which will update the editor UI
        useStore().toggleCaret({id:newCaretPosition.id, caretPosition: newCaretPosition.caretPosition as CaretPosition});

        // reset the flag informing if frames have changed order
        isDragChangingOrder = false;
    });
}
