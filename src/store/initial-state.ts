import { EditorFrameObjects, CaretPosition, RootContainerFrameDefinition, ImportsContainerDefinition, FuncDefContainerDefinition, MainFramesContainerDefinition, CommentDefinition, TryDefinition } from "@/types/types";

const initialState: EditorFrameObjects = {
    0: {
        id: 0,
        frameType : RootContainerFrameDefinition,
        parentId: 0,
        childrenIds: [-1, -2, -3],
        jointParentId: 0,
        jointFrameIds: [],
        contentDict: { },
        caretVisibility: CaretPosition.none,
    },
    "-1": {
        id: -1,
        frameType : ImportsContainerDefinition,
        parentId: 0,
        childrenIds: [],
        jointParentId: 0,
        jointFrameIds: [],
        contentDict: {},
        caretVisibility: CaretPosition.body,
    },
    "-2": {
        id: -2,
        frameType : FuncDefContainerDefinition,
        parentId: 0,
        childrenIds: [],
        jointParentId: 0,
        jointFrameIds: [],
        contentDict: { 0: "This is a comment" },
        caretVisibility: CaretPosition.none,
    },
    "-3": {
        id: -3,
        frameType : MainFramesContainerDefinition,
        parentId: 0,
        childrenIds: [1,2],
        jointParentId: 0,
        jointFrameIds: [],
        contentDict: {},
        caretVisibility: CaretPosition.none,
    },
    1: {
        frameType: CommentDefinition,
        id: 1,
        parentId: -3,
        childrenIds: [],
        jointParentId: 0,
        jointFrameIds: [],
        contentDict: { 0: "Testing Try frame (try)." },
        caretVisibility: CaretPosition.none,
    },
    2: {
        frameType: TryDefinition,
        id: 2,
        parentId: -3,
        childrenIds: [],
        jointParentId: 0,
        jointFrameIds: [],
        contentDict: {},
        caretVisibility: CaretPosition.none,
    },

};

export default initialState;
