// Type Definitions

/**
 *  NOTE that all types start with a lower-case as this is the way TS works.
 */

export interface FrameObject {
    frameType?: FramesDefinitions;
    id: number;
    parentId: number; //this is the ID of a parent frame (example: the if frame of a inner while frame). Value can be 0 (root), 1+ (in a level), -1 for a joint frame
    childrenIds: number[]; //this contains the IDs of the children frames
    jointParentId: number; //this is the ID of the first sibling of a joint frame (example: the if frame of a elseif frame under that if), value can be -1 if none, 1+ otherwise
    jointFrameIds: number[]; //this contains the IDs of the joint frames
    caretVisibility: boolean;
    contentDict: { [id: number]: string }; //this contains the label input slots data listed as a key value pairs array (key = index of the slot)
}

export interface FrameLabel {
    label: string;
    slot: boolean;
}

// This is an array with all the frame Definitions objects.
// Note that the slot variable of each objects tells if the
// Label needs an editable slot as well attached to it.

export interface ErrorSlotPayload {
    frameId: number;
    slotId: number;
    code: string;
}
export interface FrameCommand {
    type: FramesDefinitions;
    description: string;
    shortcut: string;
    symbol?: string;
}
export interface FramesDefinitions {
    type: string;
    labels: FrameLabel[];
    allowChildren: boolean;
    jointFrameTypes: string[];
    colour: string;
}

export const DefaultFramesDefinition: FramesDefinitions = {
    type: "",
    labels: [],
    allowChildren: false,
    jointFrameTypes: [],
    colour: "",
};

export const BlockDefinition: FramesDefinitions = {
    ...DefaultFramesDefinition,
    allowChildren: true,
};

export const StatementDefinition: FramesDefinitions = {
    ...DefaultFramesDefinition,
};

// Blocks
export const IfDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: "if",
    labels: [
        { label: "if", slot: true },
        { label: ":", slot: false },
    ],
    jointFrameTypes: ["elseif", "else"],
    colour: "#EA9C72",
};

export const ElseIfDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: "elseif",
    labels: [
        { label: "elseif", slot: true },
        { label: ":", slot: false },
    ],
};

export const ElseDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: "else",
    labels: [{ label: "else:", slot: false }],
};

export const ForDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: "for",
    labels: [
        { label: "for", slot: true },
        { label: "in", slot: true },
        { label: ":", slot: false },
    ],
    colour: "#EA72C0",
};

export const WhileDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: "while",
    labels: [
        { label: "while", slot: true },
        { label: ":", slot: false },
    ],
    colour: "#9C72EA",
};

export const TryDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: "try",
    labels: [{ label: "try:", slot: true }],
    jointFrameTypes: ["except", "else", "finally"],
    colour: "#EA0000",
};

export const ExceptDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: "except",
    labels: [
        { label: "except", slot: true },
        { label: ":", slot: false },
    ],
    colour: "",
};

export const FinallyDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: "finally",
    labels: [
        { label: "finally", slot: true },
        { label: ":", slot: false },
    ],
    colour: "",
};

export const FuncDefDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: "funcdef",
    labels: [
        { label: "def:", slot: true },
        { label: "(", slot: true },
        { label: ")", slot: false },
    ],
    colour: "#0C3DED",
};

export const WithDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: "with",
    labels: [
        { label: "with", slot: true },
        { label: "as", slot: true },
        { label: ":", slot: false },
    ],
    colour: "#0C3DED",
};

// Statements
export const ReturnDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: "return",
    labels: [{ label: "return", slot: true }],
    colour: "#EFF779",
};

export const VarAssignDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: "varassign",
    labels: [
        { label: "var", slot: true },
        { label: "=", slot: true },
    ],
    colour: "#72EAC0",
};

export const ImportDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: "import",
    labels: [{ label: "import", slot: true }],
    colour: "#FFFFFF",
};

export const FromImportDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: "fromimport",
    labels: [
        { label: "from", slot: true },
        { label: "import", slot: true },
    ],
    colour: "#FFFFFF",
};

export const CommentDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: "comment",
    labels: [{ label: "Comment:", slot: true }],
    colour: "#AAAAAA",
};

export const Definitions = {
    IfDefinition,
    ElseIfDefinition,
    ElseDefinition,
    ForDefinition,
    WhileDefinition,
    TryDefinition,
    ExceptDefinition,
    FinallyDefinition,
    FuncDefDefinition,
    WithDefinition,
    ReturnDefinition,
    VarAssignDefinition,
    ImportDefinition,
    FromImportDefinition,
    CommentDefinition,
};
