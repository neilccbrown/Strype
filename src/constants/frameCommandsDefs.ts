import { FrameCommandDef, Definitions } from "@/types/types";


const frameCommandsDefs: {[id: string]: FrameCommandDef} = {
    "i": {
        type: Definitions.IfDefinition,
        description: "if",
        shortcut: "i",
    },
    "l": {
        type: Definitions.ElifDefinition,
        description: "elif",
        shortcut: "l",
    },
    "e": {
        type: Definitions.ElseDefinition,
        description: "else",
        shortcut: "e",
    },
    "f": {
        type: Definitions.ForDefinition,
        description: "for",
        shortcut: "f",
    },
    "w": {
        type: Definitions.WhileDefinition,
        description: "while",
        shortcut: "w",
    },
    "=": {
        type: Definitions.VarAssignDefinition,
        description: "variable assignment",
        shortcut: "=",
    },
    " ": {
        type: Definitions.EmptyDefinition,
        description: "empty statement",
        shortcut: " ",
        symbol: "⌴",//"␣"
    },
    "r": {
        type: Definitions.ReturnDefinition,
        description: "return",
        shortcut: "r",
    },
    "d": {
        type: Definitions.FuncDefDefinition,
        description: "function definition",
        shortcut: "d",
    },
    "c": {
        type: Definitions.CommentDefinition,
        description: "comment",
        shortcut: "c",
    },
    "t": {
        type: Definitions.TryDefinition,
        description: "try",
        shortcut: "t",
    },
    "x": {
        type: Definitions.ExceptDefinition,
        description: "except",
        shortcut: "x",
    },
    "n": {
        type: Definitions.FinallyDefinition,
        description: "finally",
        shortcut: "n",
    },
    "m": {
        type: Definitions.ImportDefinition,
        description: "import",
        shortcut: "m",
    },
    "o": {
        type: Definitions.FromImportDefinition,
        description: "from ... import",
        shortcut: "o",
    },
    "h": {
        type: Definitions.WithDefinition,
        description: "with",
        shortcut: "h",
    },
};

export default {
    FrameCommandsDefs: frameCommandsDefs,
}
