import store from "@/store/store";
import { CaretPosition } from "@/types/types";

export const undoMaxSteps = 10;

export function getEditableSlotUIID(frameId: number, slotIndex: number): string  {
    return "input_frameId_" + frameId + "_slot_" + slotIndex;
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

export function getTutorialUIID(){
    return "tutorialComponent";
}

export function getEditorMenuUIID(){
    return "showHideMenu";
} 

export function getEditorButtonsContainerUIID() {
    return "editorButtonsContainer"
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
