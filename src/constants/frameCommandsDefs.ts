import { FrameCommand } from './../types/types';


const frameCommandsDefs: {[id: string]: FrameCommand} = {
    "i": {
        type: "if",
        description: "if condition",
        shortcut: "i"
    },
    "f": {
        type: "for",
        description: "for loop",
        shortcut: "f"
    },
    "r": {
        type: "return",
        description: "return statement",
        shortcut: "r"
    }   
};

export default {
    FrameCommandsDefs: frameCommandsDefs
}
