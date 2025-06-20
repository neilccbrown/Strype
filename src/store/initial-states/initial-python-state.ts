import {CaretPosition, EditorFrameObjects, RootContainerFrameDefinition, ImportsContainerDefinition, DefsContainerDefinition, MainFramesContainerDefinition, getFrameDefType, AllFrameTypesIdentifier} from "@/types/types";

const initialPythonState: EditorFrameObjects = {
    0: {
        id: 0,
        frameType : RootContainerFrameDefinition,
        isDisabled: false,
        isSelected: false,
        isVisible: true,
        parentId: 0,
        childrenIds: [-1, -2, -3],
        jointParentId: 0,
        jointFrameIds: [],
        labelSlotsDict: { },
        caretVisibility: CaretPosition.none,
    },
    "-1": {
        id: -1,
        frameType : ImportsContainerDefinition,
        isDisabled: false,
        isSelected: false,
        isVisible: true,
        parentId: 0,
        childrenIds: [],
        jointParentId: 0,
        jointFrameIds: [],
        labelSlotsDict: {},
        isCollapsed: false,
        caretVisibility: CaretPosition.none,
    },
    "-2": {
        id: -2,
        frameType : DefsContainerDefinition,
        isDisabled: false,
        isSelected: false,
        isVisible: true,
        parentId: 0,
        childrenIds: [],
        jointParentId: 0,
        jointFrameIds: [],
        labelSlotsDict: { },
        isCollapsed: false,
        caretVisibility: CaretPosition.none,
    },
    "-3": {
        id: -3,
        frameType : MainFramesContainerDefinition,
        isDisabled: false,
        isSelected: false,
        isVisible: true,
        parentId: 0,
        childrenIds: [1,2],
        jointParentId: 0,
        jointFrameIds: [],
        labelSlotsDict: {},
        isCollapsed: false,
        caretVisibility: CaretPosition.body,
    },

    1: {
        frameType: getFrameDefType(AllFrameTypesIdentifier.varassign),
        id: 1,
        isDisabled: false,
        isSelected: false,
        isVisible: true,
        parentId: -3,
        childrenIds: [],
        jointParentId: 0,
        jointFrameIds: [],
        labelSlotsDict: {
            0: {slotStructures: {operators: [], fields: [{code: "myString"}]}},
            1: {slotStructures: {operators: [{code: ""}, {code: ""}], fields: [{code: ""}, {code: "Hello from Python!", quote: "\""}, {code: ""}]}}},
        caretVisibility: CaretPosition.none,
    },

    2: {
        frameType: getFrameDefType(AllFrameTypesIdentifier.funccall),
        id: 2,
        isDisabled: false,
        isSelected: false,
        isVisible: true,
        parentId: -3,
        childrenIds: [],
        jointParentId: 0,
        jointFrameIds: [],
        labelSlotsDict: {0: {slotStructures: {operators: [{code: ""}, {code: ""}], fields: [{code: "print"}, {openingBracketValue: "(", fields:[{code: "myString"}], operators: []}, {code: ""}]}}},
        caretVisibility: CaretPosition.none,
    },

};

export default initialPythonState;


