import { ToggleFrameLabelCommandDef } from "@/types/types";

//Commands for toggling the frame labels
export enum KeyModifier {
    ctrl = "ctrl",
    alt = "alt",
    shift = "shift",
}

export const toggleFrameLabelsDefs: {[type: string]: ToggleFrameLabelCommandDef} = {
    importFrom: {
        type: "importFrom",
        modifierKeyShortcuts: [KeyModifier.ctrl, KeyModifier.shift],
        keyShortcut: "f",
        displayCommandText: "toggle from",
    },
    importAs: {
        type: "importAs",
        modifierKeyShortcuts: [KeyModifier.ctrl, KeyModifier.shift],
        keyShortcut: "a",
        displayCommandText: "toggle as",
    },
};

