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
