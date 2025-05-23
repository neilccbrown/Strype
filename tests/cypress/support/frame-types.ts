// Bit annoying that this must be copied, but it's a pain to try to share the original:

const i18n = { t: ((x : string) => x)};

export enum AllowedSlotContent {
    ONLY_NAMES,
    ONLY_NAMES_OR_STAR,
    TERMINAL_EXPRESSION
}

export interface FrameLabel {
    label: string;
    hidableLabelSlots?: boolean; // default false, true indicate that this label and associated slots can be hidden (ex: "as" in import frame)
    showLabel?: boolean; // default true, indicates if the label is showned (ex method call frame has no label text)
    showSlots?: boolean; // default true, false indicates that the label has no slot to be associated with it (for example label ":" in "if <xxx> :")
    defaultText: string;
    optionalSlot?: boolean; //default false (indicate that this label does not require at least 1 slot value)
    acceptAC?: boolean; //default true
    allowedSlotContent?: AllowedSlotContent; // default TERMINAL_EXPRESSION; what the slot accepts
}

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
    isImportFrame: boolean;
    // Optional default children or joint frames (we use frame rather than definitions as we may want to have child or joint frame with content!)
    // BE SURE TO SET THE SLOT STRUCTURE AS EXPECTED BY THE FRAME DEFINITION (example: for a if, there should be 1 slot defined, even if empty)
    //defaultChildrenTypes?: FrameObject[];
    //defaultJointTypes?: FrameObject[];
}

// Identifiers of the containers
export const ContainerTypesIdentifiers = {
    root: "root",
    importsContainer: "importsContainer",
    funcDefsContainer: "funcDefsContainer",
    framesMainContainer: "mainContainer",
};

export const CommentFrameTypesIdentifier = {
    comment: "comment",
};
// Identifiers of the frame types
export const ImportFrameTypesIdentifiers = {
    import: "import",
    fromimport: "from-import",
    library: "library",
};

export const FuncDefIdentifiers = {
    funcdef: "funcdef",
};

export const JointFrameIdentifiers = {
    elif: "elif",
    else: "else",
    except: "except",
    finally: "finally",
};

export const StandardFrameTypesIdentifiers = {
    ...CommentFrameTypesIdentifier,
    funccall: "funccall",
    blank: "blank",
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
    global: "global",
    ...JointFrameIdentifiers,
};

export const AllFrameTypesIdentifier = {
    ...ImportFrameTypesIdentifiers,
    ...FuncDefIdentifiers,
    ...StandardFrameTypesIdentifiers,
};

export const DefaultFramesDefinition: FramesDefinitions = {
    type: StandardFrameTypesIdentifiers.funccall,
    labels: [],
    allowChildren: false,
    allowJointChildren: false,
    forbiddenChildrenTypes: [],
    isJointFrame: false,
    jointFrameTypes: [],
    colour: "",
    isImportFrame: false,
};

export const BlockDefinition: FramesDefinitions = {
    ...DefaultFramesDefinition,
    allowChildren: true,
    forbiddenChildrenTypes: Object.values(ImportFrameTypesIdentifiers)
        .concat(Object.values(FuncDefIdentifiers))
        .concat([StandardFrameTypesIdentifiers.else, StandardFrameTypesIdentifiers.elif, StandardFrameTypesIdentifiers.except, StandardFrameTypesIdentifiers.finally]),
};

export const StatementDefinition: FramesDefinitions = {
    ...DefaultFramesDefinition,
    forbiddenChildrenTypes: Object.values(AllFrameTypesIdentifier),
};

// Container frames
export const RootContainerFrameDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: ContainerTypesIdentifiers.root,
};

export const ImportsContainerDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: ContainerTypesIdentifiers.importsContainer,
    labels: [
        { label: (i18n.t("appMessage.importsContainer") as string), showSlots: false, defaultText: ""},
    ],
    isCollapsed: false,
    forbiddenChildrenTypes: Object.values(AllFrameTypesIdentifier)
        .filter((frameTypeDef: string) => !Object.values(ImportFrameTypesIdentifiers).includes(frameTypeDef) && frameTypeDef !== CommentFrameTypesIdentifier.comment),
    colour: "#BBC6B6",
};

export const FuncDefContainerDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: ContainerTypesIdentifiers.funcDefsContainer,
    labels: [
        { label: (i18n.t("appMessage.funcDefsContainer") as string), showSlots: false, defaultText: ""},
    ],
    isCollapsed: false,
    forbiddenChildrenTypes: Object.values(AllFrameTypesIdentifier)
        .filter((frameTypeDef: string) => !Object.values(FuncDefIdentifiers).includes(frameTypeDef) && frameTypeDef !== CommentFrameTypesIdentifier.comment),
    colour: "#BBC6B6",
};

export const MainFramesContainerDefinition: FramesDefinitions = {
    ...BlockDefinition,
    type: ContainerTypesIdentifiers.framesMainContainer,
    labels: [
        { label: (i18n.t("appMessage.mainContainer") as string), showSlots: false, defaultText: ""},
    ],
    isCollapsed: false,
    forbiddenChildrenTypes: BlockDefinition.forbiddenChildrenTypes.concat(Object.values(AllFrameTypesIdentifier)
        .filter((frameTypeDef: string) => !Object.values(StandardFrameTypesIdentifiers).includes(frameTypeDef))),
    colour: "#BBC6B6",
};


export const FrameContainersDefinitions = {
    RootContainerFrameDefinition,
    ImportsContainerDefinition,
    FuncDefContainerDefinition,
    MainFramesContainerDefinition,
};

let Definitions = {};

// Entry point for generating the frame definition types -- only doing so to allow dynamic localisation bits...
export function generateAllFrameDefinitionTypes(): void{
    /*1) prepare all the frame definition types */
    // Statements
    const FuncCallDefinition: FramesDefinitions = {
        ...StatementDefinition,
        type: StandardFrameTypesIdentifiers.funccall,
        labels: [{ label: "", defaultText: i18n.t("frame.defaultText.funcCall") as string, showLabel: false}],
    };

    const BlankDefinition: FramesDefinitions = {
        ...StatementDefinition,
        type: StandardFrameTypesIdentifiers.blank,
        labels: [],
    };

    const ReturnDefinition: FramesDefinitions = {
        ...StatementDefinition,
        type: StandardFrameTypesIdentifiers.return,
        labels: [{ label: "return ", defaultText: i18n.t("frame.defaultText.expression") as string, optionalSlot: true}],
    };

    const GlobalDefinition: FramesDefinitions = {
        ...StatementDefinition,
        type: StandardFrameTypesIdentifiers.global,
        labels: [{ label: "global ", defaultText: i18n.t("frame.defaultText.variable") as string, allowedSlotContent: AllowedSlotContent.ONLY_NAMES}],
    };

    const VarAssignDefinition: FramesDefinitions = {
        ...StatementDefinition,
        type: StandardFrameTypesIdentifiers.varassign,
        labels: [
            { label: "", defaultText: i18n.t("frame.defaultText.identifier") as string},
            { label: " &#x21D0; ", defaultText: i18n.t("frame.defaultText.value") as string},
        ],
    };

    const BreakDefinition: FramesDefinitions = {
        ...StatementDefinition,
        type: StandardFrameTypesIdentifiers.break,
        labels: [
            { label: "break", showSlots: false, defaultText: "" },
        ],
    };

    const ContinueDefinition: FramesDefinitions = {
        ...StatementDefinition,
        type: StandardFrameTypesIdentifiers.continue,
        labels: [
            { label: "continue", showSlots: false, defaultText: "" },
        ],
    };

    const RaiseDefinition: FramesDefinitions = {
        ...StatementDefinition,
        type: StandardFrameTypesIdentifiers.raise,
        labels: [
            { label: "raise ", defaultText: i18n.t("frame.defaultText.exception") as string, optionalSlot: true },
        ],
    };

    const ImportDefinition: FramesDefinitions = {
        ...StatementDefinition,
        type: ImportFrameTypesIdentifiers.import,
        labels: [
            { label: "import ", defaultText: i18n.t("frame.defaultText.modulePart") as string, allowedSlotContent: AllowedSlotContent.ONLY_NAMES },
            // The as slot to be used in a future version, as it seems that Brython does not understand the shortcut the as is creating
            // and thus not giving us back any AC results on the shortcut
            //{ label: "as ", hidableLabelSlots: true, defaultText: "shortcut", acceptAC: false},
        ],
        isImportFrame: true,
    };

    const FromImportDefinition: FramesDefinitions = {
        ...StatementDefinition,
        type: ImportFrameTypesIdentifiers.fromimport,
        labels: [
            { label: "from ", defaultText: i18n.t("frame.defaultText.module") as string, allowedSlotContent: AllowedSlotContent.ONLY_NAMES },
            { label: "import ", defaultText: i18n.t("frame.defaultText.modulePart") as string, allowedSlotContent: AllowedSlotContent.ONLY_NAMES_OR_STAR },
            // The as slot to be used in a future version, as it seems that Brython does not understand the shortcut the as is creating
            // and thus not giving us back any AC results on the shortcut
            //{ label: "as ", hidableLabelSlots: true, defaultText: "shortcut", acceptAC: false},
        ],
        isImportFrame: true,
    };

    const LibraryDefinition: FramesDefinitions = {
        ...StatementDefinition,
        type: ImportFrameTypesIdentifiers.library,
        labels: [
            { label: "library ", defaultText: i18n.t("frame.defaultText.libraryAddress") as string, acceptAC: false},
        ],
    };

    const CommentDefinition: FramesDefinitions = {
        ...StatementDefinition,
        type: StandardFrameTypesIdentifiers.comment,
        labels: [{ label: "# ", defaultText: i18n.t("frame.defaultText.comment") as string, optionalSlot: true, acceptAC: false}],
    };

    // Blocks
    const IfDefinition: FramesDefinitions = {
        ...BlockDefinition,
        type: StandardFrameTypesIdentifiers.if,
        labels: [
            { label: "if ", defaultText: i18n.t("frame.defaultText.condition") as string},
            { label: " :", showSlots: false, defaultText: ""},
        ],
        allowJointChildren: true,
        jointFrameTypes: [StandardFrameTypesIdentifiers.elif, StandardFrameTypesIdentifiers.else],
        colour: "#E0DFE4",
        forbiddenChildrenTypes: Object.values(ImportFrameTypesIdentifiers)
            .concat(Object.values(FuncDefIdentifiers))
            .concat([ StandardFrameTypesIdentifiers.except, StandardFrameTypesIdentifiers.finally]),
    };

    const ElifDefinition: FramesDefinitions = {
        ...BlockDefinition,
        type: StandardFrameTypesIdentifiers.elif,
        labels: [
            { label: "elif ", defaultText: i18n.t("frame.defaultText.condition") as string},
            { label: " :", showSlots: false, defaultText: ""},
        ],
        isJointFrame: true,
        jointFrameTypes: [StandardFrameTypesIdentifiers.elif, StandardFrameTypesIdentifiers.else],
    };

    const ElseDefinition: FramesDefinitions = {
        ...BlockDefinition,
        type: StandardFrameTypesIdentifiers.else,
        labels: [{ label: "else :", showSlots: false, defaultText: ""}],
        isJointFrame: true,
        jointFrameTypes: [StandardFrameTypesIdentifiers.finally],
    };

    const ForDefinition: FramesDefinitions = {
        ...BlockDefinition,
        type: StandardFrameTypesIdentifiers.for,
        labels: [
            { label: "for ", defaultText: i18n.t("frame.defaultText.identifier") as string, acceptAC: false},
            { label: " in ", defaultText: i18n.t("frame.defaultText.list") as string},
            { label: " :", showSlots: false, defaultText: ""},
        ],
        allowJointChildren: true,
        jointFrameTypes:[StandardFrameTypesIdentifiers.else],
        colour: "#E4D6CE",
    };

    const WhileDefinition: FramesDefinitions = {
        ...BlockDefinition,
        type: StandardFrameTypesIdentifiers.while,
        labels: [
            { label: "while ", defaultText: i18n.t("frame.defaultText.condition") as string},
            { label: " :", showSlots: false, defaultText: ""},
        ],
        colour: "#E4D5D5",
    };

    const ExceptDefinition: FramesDefinitions = {
        ...BlockDefinition,
        type: StandardFrameTypesIdentifiers.except,
        labels: [
            { label: "except ", defaultText: i18n.t("frame.defaultText.exception") as string, optionalSlot: true, allowedSlotContent: AllowedSlotContent.ONLY_NAMES},
            { label: " :", showSlots: false, defaultText: ""},
        ],
        jointFrameTypes: [StandardFrameTypesIdentifiers.except, StandardFrameTypesIdentifiers.else, StandardFrameTypesIdentifiers.finally],
        colour: "",
        isJointFrame: true,
    };

    const FinallyDefinition: FramesDefinitions = {
        ...BlockDefinition,
        type: StandardFrameTypesIdentifiers.finally,
        labels: [
            { label: "finally :", showSlots: false, defaultText: ""},
        ],
        colour: "",
        isJointFrame: true,
    };

    const TryDefinition: FramesDefinitions = {
        ...BlockDefinition,
        type: StandardFrameTypesIdentifiers.try,
        labels: [{ label: "try :", showSlots: false, defaultText: ""}],
        allowJointChildren: true,
        jointFrameTypes: [StandardFrameTypesIdentifiers.except, StandardFrameTypesIdentifiers.else, StandardFrameTypesIdentifiers.finally],
        //defaultJointTypes: [{...EmptyFrameObject, frameType: ExceptDefinition, labelSlotsDict: {0: {slotStructures:{fields:[{code:""}], operators: []}}}}],
        colour: "#C7D9DC",
    };

    const FuncDefDefinition: FramesDefinitions = {
        ...BlockDefinition,
        type: FuncDefIdentifiers.funcdef,
        labels: [
            { label: "def ", defaultText: i18n.t("frame.defaultText.name") as string, acceptAC: false, allowedSlotContent: AllowedSlotContent.ONLY_NAMES },
            { label: "(", defaultText: i18n.t("frame.defaultText.parameters") as string, optionalSlot: true, acceptAC: false, allowedSlotContent: AllowedSlotContent.ONLY_NAMES },
            { label: ") :", showSlots: false, defaultText: ""},
        ],
        colour: "#ECECC8",
    };

    const WithDefinition: FramesDefinitions = {
        ...BlockDefinition,
        type: StandardFrameTypesIdentifiers.with,
        labels: [
            { label: "with ", defaultText: i18n.t("frame.defaultText.expression") as string},
            { label: " as ", defaultText: i18n.t("frame.defaultText.identifier") as string, allowedSlotContent: AllowedSlotContent.ONLY_NAMES },
            { label: " :", showSlots: false, defaultText: ""},
        ],
        colour: "#ede8f2",
    };

    /*2) update the Defintions variable holding all the definitions */
    Definitions = {
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
        FuncCallDefinition,
        BlankDefinition,
        ReturnDefinition,
        VarAssignDefinition,
        ImportDefinition,
        FromImportDefinition,
        LibraryDefinition,
        CommentDefinition,
        GlobalDefinition,
        // also add the frame containers as we might need to retrieve them too
        ...FrameContainersDefinitions,
    };
}

// Methods to access the dynamic frame definition types
export function getFrameDefType(key: string): FramesDefinitions{
    if(Object.values(Definitions).length == 0){
        generateAllFrameDefinitionTypes();
    }

    return Object.values(Definitions).find((frameDefinition) => ((frameDefinition as FramesDefinitions).type === key)) as FramesDefinitions;
}


export const allFrameCommandsDefs = {
    " ": [{
        type: getFrameDefType(AllFrameTypesIdentifier.funccall),
        description: i18n.t("frame.funccall_desc") as string,
        shortcuts: [" "],
        symbol: i18n.t("buttonLabel.spaceBar") as string,
    }],
    "=": [{
        type: getFrameDefType(AllFrameTypesIdentifier.varassign),
        description: i18n.t("frame.varassign_desc") as string,
        shortcuts: ["="],
    }],
    "g": [{
        type: getFrameDefType(AllFrameTypesIdentifier.global),
        description: "global",
        shortcuts: ["g"],
    }],
    "i": [
        {
            type: getFrameDefType(AllFrameTypesIdentifier.if),
            description: "if",
            shortcuts: ["i"],
            index: 0,
        },
        {
            type: getFrameDefType(AllFrameTypesIdentifier.import),
            description: "import",
            shortcuts: ["i"],
            index:1,
        },
    ],
    "l": [{
        type: getFrameDefType(AllFrameTypesIdentifier.elif),
        description: "elif",
        shortcuts: ["l"],
        index: 0,
    }, {
        type: getFrameDefType(AllFrameTypesIdentifier.library),
        description: "library",
        shortcuts: ["l"],
        index: 1,
    }],
    "e": [{
        type: getFrameDefType(AllFrameTypesIdentifier.else),
        description: "else",
        shortcuts: ["e"],
    }],
    "f": [
        {
            type: getFrameDefType(AllFrameTypesIdentifier.for),
            description: "for",
            shortcuts: ["f"],
            index: 0,
        },
        {
            type: getFrameDefType(AllFrameTypesIdentifier.funcdef),
            description: i18n.t("frame.funcdef_desc") as string,
            shortcuts: ["f"],
            index: 1,
        },
        {
            type: getFrameDefType(AllFrameTypesIdentifier.fromimport),
            description: "from...import",
            shortcuts: ["f"],
            index:2,
        },
    ],
    "w": [{
        type: getFrameDefType(AllFrameTypesIdentifier.while),
        description: "while",
        shortcuts: ["w"],
    }],
    "r": [{
        type: getFrameDefType(AllFrameTypesIdentifier.return),
        description: "return",
        shortcuts: ["r"],
    }],
    "b" : [{
        type: getFrameDefType(AllFrameTypesIdentifier.break),
        description: "break",
        shortcuts: ["b"],
    }],
    "u" : [{
        type: getFrameDefType(AllFrameTypesIdentifier.continue),
        description: "continue",
        shortcuts: ["u"],
    }],
    "#": [{
        type: getFrameDefType(AllFrameTypesIdentifier.comment),
        description: i18n.t("frame.comment_desc") as string,
        shortcuts: ["#"],
    }],
    "enter": [{
        type: getFrameDefType(AllFrameTypesIdentifier.blank),
        description: i18n.t("frame.blank_desc") as string,
        shortcuts: ["\x13"],
        symbol: "enter",
        isSVGIconSymbol: true,
    }],
    "t": [{
        type: getFrameDefType(AllFrameTypesIdentifier.try),
        description: "try",
        shortcuts: ["t"],
    }],
    "x": [{
        type: getFrameDefType(AllFrameTypesIdentifier.except),
        description: "except",
        shortcuts: ["x"],
    }],
    "n": [{
        type: getFrameDefType(AllFrameTypesIdentifier.finally),
        description: "finally",
        shortcuts: ["n"],
    }],
    "a" : [{
        type: getFrameDefType(AllFrameTypesIdentifier.raise),
        description: "raise",
        shortcuts: ["a"],
    }],
    "h": [{
        type: getFrameDefType(AllFrameTypesIdentifier.with),
        description: "with",
        shortcuts: ["h"],
    }],
};
