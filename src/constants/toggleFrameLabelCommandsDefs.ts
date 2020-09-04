import { ToggleFrameLabelCommandDef } from "@/types/types";

//Commands for toggling the frame labels
const toggleFrameLabelsDefs: {[type: string]: ToggleFrameLabelCommandDef} = {
    importFrom: {
        type: "importFrom",
        modifierKeyShortcuts: ["ctrl", "shift"],
        keyShortcut: "f",
        displayCommandText: "toggle from",
    },
    importAs: {
        type: "importAs",
        modifierKeyShortcuts: ["ctrl", "shift"],
        keyShortcut: "a",
        displayCommandText: "toggle as",
    },
};

export default {
    ToggleFrameLabelCommand: toggleFrameLabelsDefs,
}