// Type Definitions

/**
 *  NOTE that all types start with a lower-case as this is the way TS works.
 */

export interface FrameObject {
    frameType: FramesDefinitions;
    id: number;
    parentId: number; //this is the ID of a parent frame (example: the if frame of a inner while frame). Value can be 0 (root), 1+ (in a level), -1 for a joint frame
    childrenIds: number[]; //this contains the IDs of the children frames
    jointParentId: number; //this is the ID of the first sibling of a joint frame (example: the if frame of a elif frame under that if), value can be -1 if none, 1+ otherwise
    jointFrameIds: number[]; //this contains the IDs of the joint frames
    caretVisibility: CaretPosition;
    contentDict: { [id: number]: string }; //this contains the label input slots data listed as a key value pairs array (key = index of the slot)
}

export interface FrameLabel {
    label: string;
    slot: boolean;
}

// There are three groups of draggable frames.
// You can drag from the main code to the body of a method and vice-versa, 
// but you cannot drag from/to imports or drag method signatures
export enum DraggableGroupTypes {
    imports = "imports",
    code = "code",
    functionSignatures = "functionSignatures",
    ifCompound = "ifCompound",
    tryCompound = "tryCompound",
    none = "none",
}

export enum CaretPosition {
    body = "caretBody",
    below = "caretBelow",
    none = "none",
}

export interface CurrentFrame {
    id: number;
    caretPosition: CaretPosition;
}

export interface EditorFrameObjects {
    [id: number]: FrameObject;
}

// This is an array with all the frame Definitions objects.
// Note that the slot variable of each objects tells if the
// Label needs an editable slot as well attached to it.

export interface ErrorSlotPayload {
    frameId: number;
    slotId: number;
    code: string;
}
export interface FrameCommandDef {
    type: FramesDefinitions;
    description: string;
    shortcut: string;
    symbol?: string;
}

// This is an array with all the frame Definitions objects.
// Note that the slot variable of each objects tells if the
// Label needs an editable slot as well attached to it.
export interface FramesDefinitions {
    type: string;
    labels: FrameLabel[];
    allowChildren: boolean;
    forbiddenChildrenTypes: string[];
    jointFrameTypes: string[];
    colour: string;
    draggableGroup: DraggableGroupTypes;
    innerJointDraggableGroup: DraggableGroupTypes;
}

// Identifiers of the containers
export const ContainerTypesIdentifiers = {
    root: "root",
    importsContainer: "importsContainer",
    funcDefsContainer: "funcDefsContainer",
    framesMainContainer: "mainContainer",
}

const CommmentFrameTypesIdentifier = {
    comment: "comment",
}
// Identifiers of the frame types
const ImportFrameTypesIdentifiers = {
    import: "import",
    fromimport: "fromimport",
}
const FuncDefIdentifiers = {
    funcdef: "funcdef",
}

export const JointFrameIdentifiers = {
    elif: "elif",
    else: "else",
    except: "except",
    finally: "finally",
}

const StandardFrameTypesIdentifiers = {
    ...CommmentFrameTypesIdentifier,
    empty: "",
    if: "if",
    for: "for",
    while: "while",
    try: "try",
    with: "with",
    return: "return",
    varassign: "varassign",
    ...JointFrameIdentifiers,
}

export const AllFrameTypesIdentifier = {
    ...ImportFrameTypesIdentifiers,
    ...FuncDefIdentifiers,
    ...StandardFrameTypesIdentifiers,
}

export const DefaultFramesDefinition: FramesDefinitions = {
    type: StandardFrameTypesIdentifiers.empty,
    labels: [],
    allowChildren: false,
    forbiddenChildrenTypes: [],
    jointFrameTypes: [],
    colour: "",
    draggableGroup: DraggableGroupTypes.none,
    innerJointDraggableGroup: DraggableGroupTypes.none,
};

export const BlockDefinition: FramesDefinitions = {
    ...DefaultFramesDefinition,
    allowChildren: true,
    forbiddenChildrenTypes: Object.values(ImportFrameTypesIdentifiers)
        .concat(Object.values(FuncDefIdentifiers))
        .concat([StandardFrameTypesIdentifiers.else, StandardFrameTypesIdentifiers.elif, StandardFrameTypesIdentifiers.except, StandardFrameTypesIdentifiers.finally]),
    draggableGroup: DraggableGroupTypes.code,
};

export const StatementDefinition: FramesDefinitions = {
    ...DefaultFramesDefinition,
    forbiddenChildrenTypes: Object.values(AllFrameTypesIdentifier),
    draggableGroup: DraggableGroupTypes.code,
};

// Container frames
export const RootContainerFrameDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: ContainerTypesIdentifiers.root,
    draggableGroup: DraggableGroupTypes.none,
}

export const ImportsContainerDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: ContainerTypesIdentifiers.importsContainer,
    labels: [
        { label: "Imports:", slot: false },
    ],
    forbiddenChildrenTypes: Object.values(AllFrameTypesIdentifier)
        .filter((frameTypeDef: string) => !Object.values(ImportFrameTypesIdentifiers).includes(frameTypeDef) && frameTypeDef !== CommmentFrameTypesIdentifier.comment),
    colour: "#FFFFF",
    draggableGroup: DraggableGroupTypes.imports,

}

export const FuncDefContainerDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: ContainerTypesIdentifiers.funcDefsContainer,
    labels: [
        { label: "Function Definitions:", slot: false },
    ],
    forbiddenChildrenTypes: Object.values(AllFrameTypesIdentifier)
        .filter((frameTypeDef: string) => !Object.values(FuncDefIdentifiers).includes(frameTypeDef) && frameTypeDef !== CommmentFrameTypesIdentifier.comment),
    colour: "#FFFFF",
    draggableGroup: DraggableGroupTypes.functionSignatures,

}

export const MainFramesContainerDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: ContainerTypesIdentifiers.funcDefsContainer,
    labels: [
        { label: "Your code:", slot: false },
    ],
    forbiddenChildrenTypes: BlockDefinition.forbiddenChildrenTypes.concat(Object.values(AllFrameTypesIdentifier)
        .filter((frameTypeDef: string) => !Object.values(StandardFrameTypesIdentifiers).includes(frameTypeDef))),
    colour: "#FFFFF",
}

// Blocks
export const IfDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.if,
    labels: [
        { label: "if", slot: true },
        { label: ":", slot: false },
    ],
    jointFrameTypes: [StandardFrameTypesIdentifiers.elif, StandardFrameTypesIdentifiers.else],
    colour: "#EA9C72",
    innerJointDraggableGroup: DraggableGroupTypes.ifCompound,
};

export const ElifDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.elif,
    labels: [
        { label: "elif", slot: true },
        { label: ":", slot: false },
    ],
    draggableGroup: DraggableGroupTypes.ifCompound,
    jointFrameTypes: [StandardFrameTypesIdentifiers.elif, StandardFrameTypesIdentifiers.else],
};

export const ElseDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.else,
    labels: [{ label: "else:", slot: false }],
    draggableGroup: DraggableGroupTypes.none,
    jointFrameTypes: [StandardFrameTypesIdentifiers.finally],
};

export const ForDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.for,
    labels: [
        { label: "for", slot: true },
        { label: "in", slot: true },
        { label: ":", slot: false },
    ],
    jointFrameTypes:[StandardFrameTypesIdentifiers.else],
    colour: "#EA72C0",
};

export const WhileDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.while,
    labels: [
        { label: "while", slot: true },
        { label: ":", slot: false },
    ],
    colour: "#9C72EA",
};

export const TryDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.try,
    labels: [{ label: "try:", slot: false }],
    jointFrameTypes: [StandardFrameTypesIdentifiers.except, StandardFrameTypesIdentifiers.else, StandardFrameTypesIdentifiers.finally],
    colour: "#EA0000",
    innerJointDraggableGroup: DraggableGroupTypes.tryCompound,
};

export const ExceptDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.except,
    labels: [
        { label: "except", slot: true },
        { label: ":", slot: false },
    ],
    jointFrameTypes: [StandardFrameTypesIdentifiers.except, StandardFrameTypesIdentifiers.else, StandardFrameTypesIdentifiers.finally],
    colour: "",
    draggableGroup: DraggableGroupTypes.tryCompound,
};

export const FinallyDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.finally,
    labels: [
        { label: "finally:", slot: false },
    ],
    colour: "",
    draggableGroup: DraggableGroupTypes.none,
};

export const FuncDefDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: FuncDefIdentifiers.funcdef,
    labels: [
        { label: "def:", slot: true },
        { label: "(", slot: true },
        { label: ")", slot: false },
    ],
    colour: "#0C3DED",
    draggableGroup: DraggableGroupTypes.functionSignatures,
};

export const WithDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.with,
    labels: [
        { label: "with", slot: true },
        { label: "as", slot: true },
        { label: ":", slot: false },
    ],
    colour: "#0C3DED",
};

// Statements
export const EmptyDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: StandardFrameTypesIdentifiers.empty,
    labels: [{ label: "", slot: true }],
    colour: "#220983",
};

export const ReturnDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: StandardFrameTypesIdentifiers.return,
    labels: [{ label: "return", slot: true }],
    colour: "#EFF779",
};

export const VarAssignDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: StandardFrameTypesIdentifiers.varassign,
    labels: [
        { label: "var", slot: true },
        { label: "=", slot: true },
    ],
    colour: "#72EAC0",
};

export const ImportDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: ImportFrameTypesIdentifiers.import,
    labels: [{ label: "import", slot: true }],
    colour: "#FFFFFF",
    draggableGroup: DraggableGroupTypes.imports,
};

export const FromImportDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: ImportFrameTypesIdentifiers.fromimport,
    labels: [
        { label: "from", slot: true },
        { label: "import", slot: true },
    ],
    colour: "#FFFFFF",
    draggableGroup: DraggableGroupTypes.imports,
};

export const CommentDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: StandardFrameTypesIdentifiers.comment,
    labels: [{ label: "Comment:", slot: true }],
    colour: "#AAAAAA",
};

export const FrameContainersDefinitions = {
    RootContainerFrameDefinition,
    ImportsContainerDefinition,
    FuncDefContainerDefinition,
    MainFramesContainerDefinition,
}

export const Definitions = {
    IfDefinition,
    ElifDefinition,
    ElseDefinition,
    ForDefinition,
    WhileDefinition,
    TryDefinition,
    ExceptDefinition,
    FinallyDefinition,
    FuncDefDefinition,
    WithDefinition,
    EmptyDefinition,
    ReturnDefinition,
    VarAssignDefinition,
    ImportDefinition,
    FromImportDefinition,
    CommentDefinition,
};
