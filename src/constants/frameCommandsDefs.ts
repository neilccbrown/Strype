import { FrameCommand } from './../types/types';


const frameCommandsDefs: {[id: string]: FrameCommand} = {
    "i": {
        type: "if",
        description: "if",
        shortcut: "i"
    },
    "l": {
        type: "elseif",
        description: "elseif",
        shortcut: "l"
    },
    "e": {
        type: "else",
        description: "else",
        shortcut: "e"
    },
    "f": {
        type: "for",
        description: "for",
        shortcut: "f"
    },
    "w": {
        type: "while",
        description: "while",
        shortcut: "w"
    },
    "=": {
        type: "varassign",
        description: "variable assignment",
        shortcut: "="
    },
    " ": {
        type: "statement",
        description: "empty statement",
        shortcut: " ",
        symbol: "⌴"//"␣"
    },
    "r": {
        type: "return",
        description: "return",
        shortcut: "r"
    },
    "d": {
        type: "funcdef",
        description: "function definition",
        shortcut: "d"
    },
    "c": {
        type: "comment",
        description: "comment",
        shortcut: "c"
    },
    "t": {
        type: "try",
        description: "try",
        shortcut: "t"
    },
    "x": {
        type: "except",
        description: "except",
        shortcut: "x"
    },
    "n": {
        type: "finally",
        description: "finally",
        shortcut: "n"
    },
    "m": {
        type: "import",
        description: "import",
        shortcut: "m"
    },
    "o": {
        type: "fromimport",
        description: "from ... import",
        shortcut: "o"
    },
    "h": {
        type: "with",
        description: "with",
        shortcut: "h"
    }
};

export default {
    FrameCommandsDefs: frameCommandsDefs
}
