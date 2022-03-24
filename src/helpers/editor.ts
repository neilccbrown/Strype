import store from "@/store/store";
import { CaretPosition } from "@/types/types";

export const undoMaxSteps = 50;

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
    return frameUIID + "frameContextMenu"
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

export function getCommandsContainerUIID(): string {
    return "editorCommands";
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
        return hasErrors
    }
    return false; 
}
