import { FrameObject, CaretPosition, RootFrameDefinition } from "@/types/types";

const initialState: { [id: number]: FrameObject } = {
    0: {
        id: 0,
        frameType : RootFrameDefinition,
        parentId: -1,
        childrenIds: [],
        jointParentId: -1,
        jointFrameIds: [],
        contentDict: {},
        caretVisibility: CaretPosition.none,
    },
};

export default initialState;
