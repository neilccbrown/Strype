import toggleFrameLabelsDefs, {KeyModifier} from "@/constants/toggleFrameLabelCommandsDefs"; 

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
    contentDict: { [index: number]: {code: string ; focused: boolean ; error: string; shownLabel: boolean}}; //this contains the label input slots data listed as a key value pairs array (key = index of the slot)
    error?: string;
}

export interface ToggleFrameLabelCommandDef {
    type: string;
    modifierKeyShortcuts: KeyModifier[];
    keyShortcut: string;
    displayCommandText: string;
}

export interface FrameLabel {
    label: string;
    optionalLabel?: boolean;
    toggleLabelCommand?: ToggleFrameLabelCommandDef;
    slot: boolean;
    defaultText: string;
    optionalSlot?: boolean;
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

export interface LineAndSlotPositions {
    [line: number]: {frameId: number ; slotStarts: number[]};
}

// This is an array with all the frame Definitions objects.
// Note that the slot variable of each objects tells if the
// Label needs an editable slot as well attached to it.

export interface ErrorSlotPayload {
    frameId: number;
    slotId: number;
    code: string;
}
export interface EditableFocusPayload {
    frameId: number;
    slotId: number;
    focused: boolean;
}
export interface AddFrameCommandDef {
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

const CommentFrameTypesIdentifier = {
    comment: "comment",
}
// Identifiers of the frame types
const ImportFrameTypesIdentifiers = {
    import: "import",
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
    ...CommentFrameTypesIdentifier,
    empty: "",
    if: "if",
    for: "for",
    while: "while",
    break: "break",
    continue: "continue",
    try: "try",
    raise: "raise",
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
        { label: "Imports:", slot: false, defaultText: ""},
    ],
    forbiddenChildrenTypes: Object.values(AllFrameTypesIdentifier)
        .filter((frameTypeDef: string) => !Object.values(ImportFrameTypesIdentifiers).includes(frameTypeDef) && frameTypeDef !== CommentFrameTypesIdentifier.comment),
    colour: "#FFFFF",
    draggableGroup: DraggableGroupTypes.imports,
}

export const FuncDefContainerDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: ContainerTypesIdentifiers.funcDefsContainer,
    labels: [
        { label: "Function Definitions:", slot: false, defaultText: ""},
    ],
    forbiddenChildrenTypes: Object.values(AllFrameTypesIdentifier)
        .filter((frameTypeDef: string) => !Object.values(FuncDefIdentifiers).includes(frameTypeDef) && frameTypeDef !== CommentFrameTypesIdentifier.comment),
    colour: "#FFFFF",
    draggableGroup: DraggableGroupTypes.functionSignatures,

}

export const MainFramesContainerDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: ContainerTypesIdentifiers.funcDefsContainer,
    labels: [
        { label: "Your code:", slot: false, defaultText: ""},
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
        { label: "if (", slot: true, defaultText: "condition" , optionalSlot: false},
        { label: ") :", slot: false, defaultText: ""},
    ],
    jointFrameTypes: [StandardFrameTypesIdentifiers.elif, StandardFrameTypesIdentifiers.else],
    colour: "#EA9C72",
    innerJointDraggableGroup: DraggableGroupTypes.ifCompound,
};

export const ElifDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.elif,
    labels: [
        { label: "elif (", slot: true, defaultText: "condition", optionalSlot: false},
        { label: ") :", slot: false, defaultText: ""},
    ],
    draggableGroup: DraggableGroupTypes.ifCompound,
    jointFrameTypes: [StandardFrameTypesIdentifiers.elif, StandardFrameTypesIdentifiers.else],
};

export const ElseDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.else,
    labels: [{ label: "else:", slot: false, defaultText: ""}],
    draggableGroup: DraggableGroupTypes.none,
    jointFrameTypes: [StandardFrameTypesIdentifiers.finally],
};

export const ForDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.for,
    labels: [
        { label: "for ", slot: true, defaultText: "identifier", optionalSlot: false},
        { label: " in ", slot: true, defaultText: "list", optionalSlot: false},
        { label: " :", slot: false, defaultText: ""},
    ],
    jointFrameTypes:[StandardFrameTypesIdentifiers.else],
    colour: "#EA72C0",
};

export const WhileDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.while,
    labels: [
        { label: "while (", slot: true, defaultText: "condition", optionalSlot: false},
        { label: ") :", slot: false, defaultText: ""},
    ],
    colour: "#9C72EA",
};

export const TryDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.try,
    labels: [{ label: "try:", slot: false, defaultText: ""}],
    jointFrameTypes: [StandardFrameTypesIdentifiers.except, StandardFrameTypesIdentifiers.else, StandardFrameTypesIdentifiers.finally],
    colour: "#EA0000",
    innerJointDraggableGroup: DraggableGroupTypes.tryCompound,
};

export const ExceptDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.except,
    labels: [
        { label: "except ", slot: true, defaultText: "exception", optionalSlot: true},
        { label: ":", slot: false, defaultText: ""},
    ],
    jointFrameTypes: [StandardFrameTypesIdentifiers.except, StandardFrameTypesIdentifiers.else, StandardFrameTypesIdentifiers.finally],
    colour: "",
    draggableGroup: DraggableGroupTypes.tryCompound,
};

export const FinallyDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.finally,
    labels: [
        { label: "finally:", slot: false, defaultText: ""},
    ],
    colour: "",
    draggableGroup: DraggableGroupTypes.none,
};

export const FuncDefDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: FuncDefIdentifiers.funcdef,
    labels: [
        { label: "def ", slot: true, defaultText: "name", optionalSlot: false},
        { label: "(", slot: true, defaultText: "arguments", optionalSlot: true},
        { label: "):", slot: false, defaultText: ""},
    ],
    colour: "#0C3DED",
    draggableGroup: DraggableGroupTypes.functionSignatures,
};

export const WithDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.with,
    labels: [
        { label: "with ", slot: true, defaultText: "expression", optionalSlot: false},
        { label: " as ", slot: true, defaultText: "identifier", optionalSlot: false},
        { label: " :", slot: false, defaultText: ""},
    ],
    colour: "#0C3DED",
};

// Statements
export const EmptyDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: StandardFrameTypesIdentifiers.empty,
    labels: [{ label: "", slot: true, defaultText: "method call", optionalSlot: true}],
    colour: "#220983",
};

export const ReturnDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: StandardFrameTypesIdentifiers.return,
    labels: [{ label: "return ", slot: true, defaultText: "expression", optionalSlot: true}],
    colour: "#EFF779",
};

export const VarAssignDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: StandardFrameTypesIdentifiers.varassign,
    labels: [
        { label: "", slot: true, defaultText: "identifier", optionalSlot: false},
        { label: " = ", slot: true, defaultText: "value", optionalSlot: false},
    ],
    colour: "#72EAC0",
};

export const BreakDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: StandardFrameTypesIdentifiers.break,
    labels: [
        { label: "break", slot: false, defaultText: "" },
    ],
    colour: "#25eaf5",
};

export const ContinueDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: StandardFrameTypesIdentifiers.continue,
    labels: [
        { label: "continue", slot: false, defaultText: "" },
    ],
    colour: "#1f784a",
};

export const RaiseDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: StandardFrameTypesIdentifiers.raise,
    labels: [
        { label: "raise", slot: true, defaultText: "exception", optionalSlot: true },
    ],
    colour: "#a337c4",
};

export const ImportDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: ImportFrameTypesIdentifiers.import,
    labels: [
        { label: "from ", slot: true, defaultText: "module", optionalLabel: true, toggleLabelCommand:toggleFrameLabelsDefs.ToggleFrameLabelCommandDefs.importFrom, optionalSlot: false},
        { label: "import ", slot: true, defaultText: "function/class", optionalSlot: false},
        { label: "as ", slot: true, defaultText: "module", optionalLabel: true, toggleLabelCommand:toggleFrameLabelsDefs.ToggleFrameLabelCommandDefs.importAs, optionalSlot: false},
    ],    
    colour: "#FFFFFF",
    draggableGroup: DraggableGroupTypes.imports,
};

export const CommentDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: StandardFrameTypesIdentifiers.comment,
    labels: [{ label: "# ", slot: true, defaultText: "your comment", optionalSlot: true}],
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
    BreakDefinition,
    ContinueDefinition,
    RaiseDefinition,
    TryDefinition,
    ExceptDefinition,
    FinallyDefinition,
    FuncDefDefinition,
    WithDefinition,
    EmptyDefinition,
    ReturnDefinition,
    VarAssignDefinition,
    ImportDefinition,
    CommentDefinition,
};

/**
 *  Types for the messages banner
 **/

export interface MessageButton {
    label: string;
    action: VoidFunction | string;
}

export const MessageDefinedActions = {
    closeBanner: "close",
    undo: "undo",
}

export interface MessageDefinition {
    type: string;
    message: string;
    buttons: MessageButton[];
}

const MessageTypeIdentifiers = {
    noMessage: "none",
    largeDeletion: "largeDeletion",
}

//empty message
const NoMessage: MessageDefinition = {
    type: MessageTypeIdentifiers.noMessage,
    message: "",
    buttons: [],
};

//message for large deletation (undo)
const LargeDeletionMessageDefinition: MessageDefinition = {
    type: MessageTypeIdentifiers.largeDeletion,
    message: "messageBannerMessage.deleteLargeCode",
    buttons:[{label: "buttonLabel.undo", action:MessageDefinedActions.undo}],
};

// THIS IS FOR TEST ONLY --> DELETE LATER
// it's an example of a message with yes/no button, 
// and a function action (yes) and a named action (no)
const TestYesNoMessageDefinition: MessageDefinition = {
    type: MessageTypeIdentifiers.largeDeletion,
    message: "messageBannerMessage.yesnoTest",
    buttons:[{label: "buttonLabel.yes", action:(() => alert("OUI !"))}, {label: "buttonLabel.no", action:MessageDefinedActions.closeBanner}],
};


export const MessageDefinitions = {
    NoMessage,
    LargeDeletionMessageDefinition,
    //TO REMOVE LATER
    TestYesNoMessageDefinition,
};