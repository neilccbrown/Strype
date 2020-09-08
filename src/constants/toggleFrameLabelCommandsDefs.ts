import { ToggleFrameLabelCommandDef } from "@/types/types";

export enum KeyModifier {
    ctrl = "ctrl",
    alt = "alt",
    shift = "shift",
}

//Commands for toggling the frame labels
const toggleFrameLabelsDefs: {[type: string]: ToggleFrameLabelCommandDef} = {
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

export default {
    ToggleFrameLabelCommandDefs: toggleFrameLabelsDefs,
}