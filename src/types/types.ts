import i18n from "@/i18n";
import Compiler from "@/compiler/compiler";

// Type Definitions

/**
 *  NOTE that all types start with a lower-case as this is the way TS works.
 */

export interface FrameSlotContent{
    code: string;
    focused: boolean;
    error: string;
    shownLabel: boolean;
}

export interface FrameObject {
    frameType: FramesDefinitions;
    id: number;
    isDisabled: boolean;
    isSelected: boolean;
    isVisible: boolean;
    isCollapsed?: boolean;
    parentId: number; //this is the ID of a parent frame (example: the if frame of a inner while frame). Value can be 0 (root), 1+ (in a level), -1 for a joint frame
    childrenIds: number[]; //this contains the IDs of the children frames
    jointParentId: number; //this is the ID of the first sibling of a joint frame (example: the if frame of a elif frame under that if), value can be -1 if none, 1+ otherwise
    jointFrameIds: number[]; //this contains the IDs of the joint frames
    caretVisibility: CaretPosition;
    contentDict: { [index: number]: FrameSlotContent}; //this contains the label input slots data listed as a key value pairs array (key = index of the slot)
    multiDragPosition: string;

}

export interface FrameLabel {
    label: string;
    optionalLabel?: boolean;
    slot: boolean;
    defaultText: string;
    optionalSlot?: boolean;
    acceptAC?: boolean;
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
    both = "both",
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
    [line: number]: {frameId: number ; slotStarts: number[]; slotLengths: number[]};
}

// This is an array with all the frame Definitions objects.
// Note that the slot variable of each objects tells if the
// Label needs an editable slot as well attached to it.

export interface EditableSlotPayload {
    frameId: number;
    slotId: number;
    code: string;
    initCode: string;
    isFirstChange: boolean;
}
export interface EditableFocusPayload {
    frameId: number;
    slotId: number;
    focused: boolean;
}

export enum CodeStyle{
    none = "",
    string = "string-token",
    number = "number-token",
    bool = "bool-token",
    empty = "empty-token",
}
export interface StyledCodePart {
    code: string,
    style: CodeStyle, 
}

export interface StyledCodeSplits {
    start: number,
    end: number,
    style: CodeStyle,
}

export interface NavigationPosition {
    id: number;
    // Both the following can be boolean, as if one has a value, the other one has false (e.g. caretPosition = below AND slotNumber = false)
    caretPosition?: string|false;
    slotNumber?: number|false;
}
export interface AddFrameCommandDef {
    type: FramesDefinitions;
    description: string; // The label that shown next to the key shortcut button
    shortcut: string; // The keyboard key shortcut to be used to add a frame (eg "i" for an if frame)
    symbol?: string; // The symbol to show in the key shortcut button when the key it's not easily reprenstable (e.g. "⌴" for space)
    tooltip: string; // If needed, the tooltip content that explains the role of a frame - localised
    index?: number; // the index of frame type when a shortcut matches more than 1 context-distinct frames
}

// This is an array with all the frame Definitions objects.
// Note that the slot variable of each objects tells if the
// Label needs an editable slot as well attached to it.
export interface FramesDefinitions {
    type: string;
    labels: FrameLabel[];
    allowChildren: boolean;
    allowJointChildren: boolean;
    forbiddenChildrenTypes: string[];
    isJointFrame: boolean;
    jointFrameTypes: string[];
    colour: string;
    isCollapsed?: boolean;
    draggableGroup: DraggableGroupTypes;
    innerJointDraggableGroup: DraggableGroupTypes;
    isImportFrame: boolean;
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
    fromimport: "from-import",
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
    allowJointChildren: false,
    forbiddenChildrenTypes: [],
    isJointFrame: false,
    jointFrameTypes: [],
    colour: "",
    draggableGroup: DraggableGroupTypes.none,
    innerJointDraggableGroup: DraggableGroupTypes.none,
    isImportFrame: false,
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
        { label: (i18n.t("appMessage.importsContainer") as string), slot: false, defaultText: ""},
    ],
    isCollapsed: false,
    forbiddenChildrenTypes: Object.values(AllFrameTypesIdentifier)
        .filter((frameTypeDef: string) => !Object.values(ImportFrameTypesIdentifiers).includes(frameTypeDef) && frameTypeDef !== CommentFrameTypesIdentifier.comment),
    colour: "#BBC6B6",
    draggableGroup: DraggableGroupTypes.imports,
}

export const FuncDefContainerDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: ContainerTypesIdentifiers.funcDefsContainer,
    labels: [
        { label: (i18n.t("appMessage.funcDefsContainer") as string), slot: false, defaultText: ""},
    ],
    isCollapsed: false,
    forbiddenChildrenTypes: Object.values(AllFrameTypesIdentifier)
        .filter((frameTypeDef: string) => !Object.values(FuncDefIdentifiers).includes(frameTypeDef) && frameTypeDef !== CommentFrameTypesIdentifier.comment),
    colour: "#BBC6B6",
    draggableGroup: DraggableGroupTypes.functionSignatures,

}

export const MainFramesContainerDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: ContainerTypesIdentifiers.framesMainContainer,
    labels: [
        { label: (i18n.t("appMessage.mainContainer") as string), slot: false, defaultText: ""},
    ],
    isCollapsed: false,
    forbiddenChildrenTypes: BlockDefinition.forbiddenChildrenTypes.concat(Object.values(AllFrameTypesIdentifier)
        .filter((frameTypeDef: string) => !Object.values(StandardFrameTypesIdentifiers).includes(frameTypeDef))),
    colour: "#BBC6B6",
}

// Blocks
export const IfDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.if,
    labels: [
        { label: "if (", slot: true, defaultText: "condition" , optionalSlot: false},
        { label: ") :", slot: false, defaultText: ""},
    ],
    allowJointChildren: true,
    jointFrameTypes: [StandardFrameTypesIdentifiers.elif, StandardFrameTypesIdentifiers.else],
    colour: "#E0DFE4",
    innerJointDraggableGroup: DraggableGroupTypes.ifCompound,
    forbiddenChildrenTypes: Object.values(ImportFrameTypesIdentifiers)
        .concat(Object.values(FuncDefIdentifiers))
        .concat([ StandardFrameTypesIdentifiers.except, StandardFrameTypesIdentifiers.finally]),
};

export const ElifDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.elif,
    labels: [
        { label: "elif (", slot: true, defaultText: "condition", optionalSlot: false},
        { label: ") :", slot: false, defaultText: ""},
    ],
    draggableGroup: DraggableGroupTypes.ifCompound,
    isJointFrame: true,
    jointFrameTypes: [StandardFrameTypesIdentifiers.elif, StandardFrameTypesIdentifiers.else],
};

export const ElseDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.else,
    labels: [{ label: "else :", slot: false, defaultText: ""}],
    draggableGroup: DraggableGroupTypes.ifCompound,
    isJointFrame: true,
    jointFrameTypes: [StandardFrameTypesIdentifiers.finally],
};

export const ForDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.for,
    labels: [
        { label: "for ", slot: true, defaultText: "identifier", optionalSlot: false, acceptAC: false},
        { label: " in ", slot: true, defaultText: "list", optionalSlot: false},
        { label: " :", slot: false, defaultText: ""},
    ],
    allowJointChildren: true,
    jointFrameTypes:[StandardFrameTypesIdentifiers.else],
    colour: "#E4D6CE",
};

export const WhileDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.while,
    labels: [
        { label: "while (", slot: true, defaultText: "condition", optionalSlot: false},
        { label: ") :", slot: false, defaultText: ""},
    ],
    colour: "#E4D5D5",
};

export const TryDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.try,
    labels: [{ label: "try :", slot: false, defaultText: ""}],
    allowJointChildren: true,
    jointFrameTypes: [StandardFrameTypesIdentifiers.except, StandardFrameTypesIdentifiers.else, StandardFrameTypesIdentifiers.finally],
    colour: "#C7D9DC",
    innerJointDraggableGroup: DraggableGroupTypes.tryCompound,
};

export const ExceptDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.except,
    labels: [
        { label: "except ", slot: true, defaultText: "exception", optionalSlot: true},
        { label: " :", slot: false, defaultText: ""},
    ],
    jointFrameTypes: [StandardFrameTypesIdentifiers.except, StandardFrameTypesIdentifiers.else, StandardFrameTypesIdentifiers.finally],
    colour: "",
    isJointFrame: true,
    draggableGroup: DraggableGroupTypes.tryCompound,
};

export const FinallyDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: StandardFrameTypesIdentifiers.finally,
    labels: [
        { label: "finally :", slot: false, defaultText: ""},
    ],
    colour: "",
    isJointFrame: true,
    draggableGroup: DraggableGroupTypes.none,
};

export const FuncDefDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: FuncDefIdentifiers.funcdef,
    labels: [
        { label: "def ", slot: true, defaultText: "name", optionalSlot: false, acceptAC: false},
        { label: "(", slot: true, defaultText: "parameters", optionalSlot: true, acceptAC: false},
        { label: ") :", slot: false, defaultText: ""},
    ],
    colour: "#ECECC8",
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
    colour: "#ede8f2",
};

// Statements
export const EmptyDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: StandardFrameTypesIdentifiers.empty,
    labels: [{ label: "", slot: true, defaultText: "function call", optionalSlot: true}],
    colour: "#F6F2E9",
};

export const ReturnDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: StandardFrameTypesIdentifiers.return,
    labels: [{ label: "return ", slot: true, defaultText: "expression", optionalSlot: true}],
    colour: "#F6F2E9",
};

export const VarAssignDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: StandardFrameTypesIdentifiers.varassign,
    labels: [
        { label: "", slot: true, defaultText: "identifier", optionalSlot: false, acceptAC: false},
        { label: " &#x21D0; ", slot: true, defaultText: "value", optionalSlot: false},
    ],
    colour: "#F6F2E9",
};

export const BreakDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: StandardFrameTypesIdentifiers.break,
    labels: [
        { label: "break", slot: false, defaultText: "" },
    ],
    colour: "#F6F2E9",
};

export const ContinueDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: StandardFrameTypesIdentifiers.continue,
    labels: [
        { label: "continue", slot: false, defaultText: "" },
    ],
    colour: "#F6F2E9",
};

export const RaiseDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: StandardFrameTypesIdentifiers.raise,
    labels: [
        { label: "raise", slot: true, defaultText: "exception", optionalSlot: true },
    ],
    colour: "#F6F2E9",
};

export const ImportDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: ImportFrameTypesIdentifiers.import,
    labels: [
        { label: "import ", slot: true, defaultText: "function/class", optionalSlot: false},
        // The as slot to be used in a future version, as it seems that Brython does not understand the shortcut the as is creating
        // and thus not giving us back any AC results on the shortcut
        //{ label: "as ", slot: true, optionalLabel: true, defaultText: "shortcut", optionalSlot: true, acceptAC: false},
    ],    
    colour: "#CBD4C8",
    draggableGroup: DraggableGroupTypes.imports,
    isImportFrame: true,
};

export const FromImportDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: ImportFrameTypesIdentifiers.fromimport,
    labels: [
        { label: "from ", slot: true, defaultText: "module", optionalSlot: false},
        { label: "import ", slot: true, defaultText: "function/class", optionalSlot: false},
        // The as slot to be used in a future version, as it seems that Brython does not understand the shortcut the as is creating
        // and thus not giving us back any AC results on the shortcut
        //{ label: "as ", slot: true, optionalLabel: true, defaultText: "shortcut", optionalSlot: true, acceptAC: false},
    ],    
    colour: "#CBD4C8",
    draggableGroup: DraggableGroupTypes.imports,
    isImportFrame: true,
};

export const CommentDefinition: FramesDefinitions = {
    ...StatementDefinition,
    type: StandardFrameTypesIdentifiers.comment,
    labels: [{ label: "# ", slot: true, defaultText: "your comment", optionalSlot: true, acceptAC: false}],
    colour: "#F6F2E9",
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
    FromImportDefinition,
    CommentDefinition,
};

export const LoopFrames = {
    ForDefinition,
    WhileDefinition,
};

export const EmptyFrameObject: FrameObject = {
    frameType: DefaultFramesDefinition,
    id: -101, //default non-meaningful value - this will be overriden when frames are created
    isDisabled: false,
    isSelected: false,
    isVisible: true,
    parentId: -101, //default non-meaningful value - this will be overriden when frames are created
    childrenIds: [], //this contains the IDs of the children frames
    jointParentId: -101, //default non-meaningful value - this will be overriden when frames are created
    jointFrameIds: [], //this contains the IDs of the joint frames
    caretVisibility: CaretPosition.none,
    contentDict: { },
    multiDragPosition: "",
}

/**
 *  Types for the messages banner
 **/

export interface MessageButton {
    label: string;
    action: VoidFunction | string;
}

export interface FormattedMessageArgKeyValuePlaceholder {
    key: string;
    placeholderName: string;
}

export const FormattedMessageArgKeyValuePlaceholders: {[id: string]: FormattedMessageArgKeyValuePlaceholder} = {
    error: {key:"errorMsg", placeholderName : "{error_placeholder}"},
    list: {key:"list", placeholderName : "{list_placeholder}"},
}

export interface FormattedMessage {
    path: string;
    args: { [id: string]: string};
}

export const DefaultFormattedMessage: FormattedMessage = {
    path: "",
    args: {},
}

export const MessageDefinedActions = {
    closeBanner: "close",
    undo: "undo",
}

export enum imagePaths {
    empty = "",
    transferHexFile = "transferHexFile.svg",
}

export interface MessageDefinition {
    type: string;
    message: string | FormattedMessage;
    buttons: MessageButton[];
    path: imagePaths;
}

export const MessageTypes = {
    noMessage: "none",
    largeDeletion: "largeDeletion",
    imageDisplay: "imageDisplay",
    uploadSuccessMicrobit:"uploadSuccessMicrobit",
    noUndo: "noUndo",
    noRedo: "noRedo",
    uploadEditorFileError: "uploadEditorFileError",
    uploadEditorFileNotSupported: "uploadEditorFileNotSupported",
    uploadEditorFileSucces: "uploadEditorFileSuccess",
    forbiddenFrameMove: "forbiddenFrameMove",
    functionFrameCantDelete: "functionFrameCantDelete",
    pythonInputWarning: "pythonInputWarning",
}

//empty message
const NoMessage: MessageDefinition = {
    type: MessageTypes.noMessage,
    message: "",
    buttons: [],
    path: imagePaths.empty,
};

//message for large deletation (undo)
const LargeDeletion: MessageDefinition = {
    type: MessageTypes.largeDeletion,
    message: "messageBannerMessage.deleteLargeCode",
    buttons:[{label: "buttonLabel.undo", action:MessageDefinedActions.undo}],
    path: imagePaths.empty,
};

//download hex message
const DownloadHex: MessageDefinition = {
    type: MessageTypes.imageDisplay,
    message: "",
    buttons: [],
    path: imagePaths.transferHexFile,
};

//message for upload code success in microbit progress
const UploadSuccessMicrobit: MessageDefinition = {
    type: MessageTypes.uploadSuccessMicrobit,
    message: "messageBannerMessage.uploadSuccessMicrobit",
    buttons:[],
    path: imagePaths.empty,

};

//message for upload code failure in microbit progress
const UploadFailureMicrobit: MessageDefinition = {
    type: MessageTypes.uploadSuccessMicrobit,
    message: {
        path: "messageBannerMessage.uploadFailureMicrobit",
        args: {
            [FormattedMessageArgKeyValuePlaceholders.error.key]: FormattedMessageArgKeyValuePlaceholders.error.placeholderName,
        },
    },
    buttons:[],
    path: imagePaths.empty,
};

//messages to inform the user there is no undo/redo to perfom
const NoUndo: MessageDefinition = {
    type: MessageTypes.noUndo,
    message: "messageBannerMessage.noUndo",
    buttons:[],
    path: imagePaths.empty,
};

const NoRedo: MessageDefinition = {
    type: MessageTypes.noRedo,
    message: "messageBannerMessage.noRedo",
    buttons:[],
    path: imagePaths.empty,
};

const UploadEditorFileError: MessageDefinition = {
    type: MessageTypes.uploadEditorFileError,
    message: {
        path: "messageBannerMessage.uploadEditorFileError",
        args: {
            [FormattedMessageArgKeyValuePlaceholders.error.key]: FormattedMessageArgKeyValuePlaceholders.error.placeholderName,
        },
    },
    buttons:[{label: "buttonLabel.ok", action:MessageDefinedActions.closeBanner}],
    path: imagePaths.empty,
};

const UploadEditorFileNotSupported: MessageDefinition = {
    type: MessageTypes.uploadEditorFileNotSupported,
    message: {
        path: "messageBannerMessage.uploadEditorFileNotSupported",
        args: {
            [FormattedMessageArgKeyValuePlaceholders.list.key]: FormattedMessageArgKeyValuePlaceholders.list.placeholderName,
        },
    },
    buttons:[{label: "buttonLabel.ok", action:MessageDefinedActions.closeBanner}],
    path: imagePaths.empty,
};

const UploadEditorFileSuccess: MessageDefinition = {
    type: MessageTypes.noRedo,
    message: "messageBannerMessage.uploadEditorFileSuccess",
    buttons:[],
    path: imagePaths.empty,
};

const ForbiddenFrameMove: MessageDefinition = {
    type: MessageTypes.forbiddenFrameMove,
    message: "messageBannerMessage.forbiddenFrameMove",
    buttons: [],
    path: imagePaths.empty,
}

const FunctionFrameCantDelete: MessageDefinition = {
    type: MessageTypes.functionFrameCantDelete,
    message: "messageBannerMessage.functionFrameCantDelete",
    buttons: [],
    path: imagePaths.empty,
}

const PythonInputWarning: MessageDefinition = {
    type: MessageTypes.pythonInputWarning,
    message: "messageBannerMessage.pythonInputWarning",
    buttons: [],
    path: imagePaths.empty,
}

export const MessageDefinitions = {
    NoMessage,
    LargeDeletion,
    UploadSuccessMicrobit,
    UploadFailureMicrobit,
    DownloadHex,
    NoUndo,
    NoRedo,
    UploadEditorFileError,
    UploadEditorFileNotSupported,
    UploadEditorFileSuccess,
    ForbiddenFrameMove,
    FunctionFrameCantDelete,
    PythonInputWarning,
};

//WebUSB listener
export interface WebUSBListener {
    //Callback functions called on the listener by the webUSB.ts file
    onUploadProgressHandler: {(percent: number): void};
    onUploadSuccessHandler: VoidFunction;
    onUploadFailureHandler: {(errorMsg: string): void};
}

//Object difference
export interface ObjectPropertyDiff {
    //The property path is formatted as "level1_<bool>.level2_<bool>. ... .levelN" 
    //where <bool> is a boolean flag value indicating if the corresponding level is for an array or not.
    propertyPathWithArrayFlag: string;
    //value is set to "null" to notify a deletion.
    value: any;
}

//Event at application level that requests the application "freeze"
export interface AppEvent {
    requestAttention: boolean;
    message?: string;
}

//Object that holds information on changes to perform on a frame's property
export interface ChangeFramePropInfos {
    //indicated whether the propery should be changed
    changeDisableProp: boolean;
    //indicates what value the property should be changed to (one flag per type)
    newBoolPropVal?: boolean;
    newNumberPropVal?: number;
    newStringPropVal?: string;
}

//Autocompletion
export interface LanguageDef {
    builtin: ElementDef[];
    libraries: ElementDef[];
    userDefinitions: ElementDef[];
}

export interface AliasesPath {
    //return a hash of alias name / path in modules definitions
    [alias: string]: string;
     //light = module_moduleA.module_moduleB.moduleC.methodA
}
export interface ElementDef {
    name: string;
    kind: "module" | "class" | "method" | "variable" | "constructor" | "keyword";
    elements?: ElementDef[];
    argsNum?: number;
    argsName?: string[];
    argsOptional?: boolean[];
    type?: string; //return type for methods, type of obj for variables
    needNS?: boolean; // this flag indicates if a module name needs to be used within the code (ex for "import microbit", users need to write "microbit.xxxx" in code)
    hide?: boolean; //if this flag is true for a class, the class name cannot appear in AC, but its methods/variables can.
    super?: string[]; //for classes, the super classes' paths of that class.
    target?: string; //for objects that are referred without namespace: gets the full path
}

export interface LibraryPath {
    name: string;
    aliasFor: string;
}

export interface CursorPosition {
    top: number;
    left: number;
    height: number;
}

export const DefaultCursorPosition: CursorPosition = {
    top: 0,
    left: 0,
    height: 0,
};

export interface EditableSlotReachInfos {
    isKeyboard: boolean;
    direction: -1 | 1;
}

export interface StateObject {
    debugging: boolean;
    initialState: EditorFrameObjects;
    showKeystroke: boolean;
    nextAvailableId: number;
}

export interface StateObjects {
    [id: string]: StateObject;
}

export enum StrypePlatform {
    standard = "std",
    microbit = "mb",
}

export interface UserDefinedElement {
    name: string;
    isFunction: boolean;
}
export interface IndexedAcResult {
    index: number; 
    acResult: string; 
    documentation: string; 
    type: string;
    version: number;
}

export interface AcResultType {
    acResult: string; 
    documentation: string; 
    type: string;
    version: number;
}
export interface IndexedAcResultWithModule {
    [module: string]: IndexedAcResult[];
}
export interface AcResultsWithModule {
    [module: string]: AcResultType[];
}
export interface VoidFunction {
    (): void;
}

//Representation of an item of the (microbit) API using a coded identifier with its potential children
export interface APICodedItem {
    name: string, //a UUID coded name that represent a single item of the API description (** do not use "." in the coded names, it messes i18n **)
    codePortion: string, //the code portion that will builds an example use in the editor (code builder)
    extraCodePortion?: string, //the optional full code portion to be shown in extra doc -- this code portion isn't used in the code builder
    version?: number, //the version of the API for this element (for instance 2 for microbit v2) if not provided, 1 is assumed
    children?: APICodedItem[];
}

//Representation of an item of the (microbit) API textual description based on a coded indentifier
export interface APIItemTextualDescription {
    name: string; //a UUID coded name that represent a single item of the API description
    label: string; //the textual value of the item
    doc: string; //the documentation for this item (short and always visible)
    extradoc: string; //the rest of the documentation for this item (visible on demand);
    codePortion: string, //the code portion that will builds an example use in the editor (code builder)
    extraCodePortion: string, //the full code portion to be shown in extra doc (or empty string if none) -- this code portion isn't used in the code builder
    version: number, //the version of the API for this element (for instance 2 for microbit v2)
    level: number; //the level of the item in the API hierarchy
    isFinal: boolean; //indicates if that is a termination item
    immediateParentName: string; //the name of the immediate parent of this item - empty string if level 1
}

//Object containing the different elements produced when parsing the code, to be used by parsing callers
export interface ParserElements {
    parsedOutput : string, //the python code generated by the parser
    hasErrors: boolean, //indicates the the code contains errors (precompiled & TigerPython errors)
    compiler: Compiler, //the compiler associated with this parser, that allow access to more complex objects generated after parsing code (i.e. blob, hex...)
}

// utility types
export interface CodeMatchIterable {
    hasMatches: boolean,
    iteratorMatches?: IterableIterator<RegExpMatchArray>
}