export const undoMaxSteps = 10;

export function getEditableSlotId(frameId: number, slotIndex: number): string  {
    return "input_frameId_" + frameId + "_slot_" + slotIndex;
}

export const fileImportSupportedFormats: string[] = ["wpy"];
