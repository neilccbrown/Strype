import store from "@/store/store";

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

export function getEditorCommandsContainerEltId(): string {
    return "editorCommands";
}
export const fileImportSupportedFormats: string[] = ["wpy"];
