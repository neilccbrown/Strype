import store from "@/store/store";
import { CaretPosition } from "@/types/types";

export const undoMaxSteps = 10;

export function getEditableSlotUIID(frameId: number, slotIndex: number): string  {
    //note: changing that should be impacted on extractIdsFromEditableSlotUIID() below
    return "input_frameId_" + frameId + "_slot_" + slotIndex;
}

export function extractIdsFromEditableSlotUIID(editableSlotUIID: string): {frameId: number; slotIndex: number}{
    const shortenUIID = editableSlotUIID.replace("input_frameId_","");
    const idsArray = shortenUIID.split("_slot_");

    //some default value that wouldn't match an existing frame / valid slotIndex.
    let frameId = -10; 
    let slotIndex = -1; 
    
    // just making sure nothing got wrong...
    if(idsArray && idsArray.length === 2){
        if(!isNaN(parseInt(idsArray[0], 10)) && !isNaN(parseInt(idsArray[1], 10))){
            frameId = parseInt(idsArray[0], 10);
            slotIndex = parseInt(idsArray[1], 10);
        }
    }

    return {frameId: frameId, slotIndex: slotIndex};
}

export function getFrameContainerUIID(frameIndex: number): string {
    return "FrameContainer_" + frameIndex;
}

export function getCodeEditorUIID(): string {
    return getFrameContainerUIID(store.getters.getMainCodeFrameContainerId());
}

export function getCaretUIID(caretAssignedPosition: string, frameId: number): string{
    return "caret_"+caretAssignedPosition+"_"+frameId;
}

export function getTutorialCaretUIID(): string{
    return getCaretUIID(CaretPosition.body, store.getters.getMainCodeFrameContainerId());
}

export function getCommandsContainerUIID(): string {
    return "editorCommands";
}

export function getTutorialUIID(): string {
    return "tutorialComponent";
}

export function getEditorMenuUIID(): string {
    return "showHideMenu";
} 

export function getEditorButtonsContainerUIID(): string {
    return "editorButtonsContainer"
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

export const fileImportSupportedFormats: string[] = ["spy"];
