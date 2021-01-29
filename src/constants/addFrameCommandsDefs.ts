import { AddFrameCommandDef, Definitions } from "@/types/types";

//Commands for Frame insertion, one command can match more than 1 frame ONLY when there is a TOTAL distinct context between the two
export const addCommandsDefs: {[id: string]: AddFrameCommandDef[]} = {
    "i": [
        {
            type: Definitions.IfDefinition,
            description: "if",
            shortcut: "i",
            index: 0,
        },
        {
            type: Definitions.ImportDefinition,
            description: "import",
            shortcut: "i",
            index:1,
        },
    ],
    "l": [{
        type: Definitions.ElifDefinition,
        description: "elif",
        shortcut: "l",
    }],
    "e": [{
        type: Definitions.ElseDefinition,
        description: "else",
        shortcut: "e",
    }],
    "f": [
        {
            type: Definitions.ForDefinition,
            description: "for",
            shortcut: "f",
            index: 0,
        },
        {
            type: Definitions.FuncDefDefinition,
            description: "function definition",
            shortcut: "f",
            index: 1,
        },
    ],
    "w": [{
        type: Definitions.WhileDefinition,
        description: "while",
        shortcut: "w",
    }],
    "b" : [{
        type: Definitions.BreakDefinition,
        description: "break",
        shortcut: "b",
    }],
    "u" : [{
        type: Definitions.ContinueDefinition,
        description: "continue",
        shortcut: "u",
    }],
    "=": [{
        type: Definitions.VarAssignDefinition,
        description: "variable assignment",
        shortcut: "=",
    }],
    " ": [{
        type: Definitions.EmptyDefinition,
        description: "method call",
        shortcut: " ",
        symbol: "⌴",//"␣"
    }],
    "r": [{
        type: Definitions.ReturnDefinition,
        description: "return",
        shortcut: "r",
    }],
    "c": [{
        type: Definitions.CommentDefinition,
        description: "comment",
        shortcut: "c",
    }],
    "t": [{
        type: Definitions.TryDefinition,
        description: "try",
        shortcut: "t",
    }],
    "a" : [{
        type: Definitions.RaiseDefinition,
        description: "raise",
        shortcut: "a",
    }],
    "x": [{
        type: Definitions.ExceptDefinition,
        description: "except",
        shortcut: "x",
    }],
    "n": [{
        type: Definitions.FinallyDefinition,
        description: "finally",
        shortcut: "n",
    }],
    "h": [{
        type: Definitions.WithDefinition,
        description: "with",
        shortcut: "h",
    }],
};