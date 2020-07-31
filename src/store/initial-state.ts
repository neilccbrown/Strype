import { FrameObject, CaretPosition, RootFrameDefinition, IfDefinition, ElseDefinition, ForDefinition } from "@/types/types";

const initialState: { [id: number]: FrameObject } = {
    0: {
        id: 0,
        frameType : RootFrameDefinition,
        parentId: -1,
        childrenIds: [1, 3],
        jointParentId: -1,
        jointFrameIds: [],
        contentDict: {},
        caretVisibility: CaretPosition.body,
    },
    1: {
        id: 1,
        frameType : IfDefinition,
        parentId: 0,
        childrenIds: [],
        jointParentId: -1,
        jointFrameIds: [2],
        contentDict: {},
        caretVisibility: CaretPosition.none,
    },
    2: {
        id: 2,
        frameType : ElseDefinition,
        parentId: -1,
        childrenIds: [],
        jointParentId: 1,
        jointFrameIds: [],
        contentDict: {},
        caretVisibility: CaretPosition.none,
    },
    3: {
        id: 3,
        frameType : ForDefinition,
        parentId: 0,
        childrenIds: [],
        jointParentId: -1,
        jointFrameIds: [],
        contentDict: {},
        caretVisibility: CaretPosition.none,
    },
};

export default initialState;
