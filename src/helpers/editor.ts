import store from "@/store/store";
import { CaretPosition } from "@/types/types";

export const undoMaxSteps = 10;

export function getEditableSlotId(frameId: number, slotIndex: number): string  {
    return "input_frameId_" + frameId + "_slot_" + slotIndex;
}

export function getFrameContainerEltId(frameIndex: number): string {
    return "FrameContainer_" + frameIndex;
}

export function getEditorCodeFrameContainerEltId(): string {
    return getFrameContainerEltId(store.getters.getMainCodeFrameContainerId());
}

export function getCaretEltId(caretAssignedPosition: string, frameId: number): string{
    return "caret_"+caretAssignedPosition+"_"+frameId;
}

export function getEditorCodeFrameContainerBodyCaretEltId(): string{
    return getCaretEltId(CaretPosition.body, store.getters.getMainCodeFrameContainerId());
}

export function getEditorCommandsContainerEltId(): string {
    return "editorCommands";
}

export function getTutorialEltId(){
    return "tutorialComponent";
}

export function getEditorMenuEltId(){
    return "showHideMenu";
} 

export function getEditorSpecialButtonsContainerEltId() {
    return "editorSpecialButtonsContainer"
}

export function getMenuLeftPaneContainerId(){
    return "menu-bar";
}

export function getEditorMiddlePaneContainerId() {
    return "editorCodeDiv";
}

export function getCommandsRightPaneContainerId() {
    return "commandsContainerDiv";
}

export const fileImportSupportedFormats: string[] = ["wpy"];
