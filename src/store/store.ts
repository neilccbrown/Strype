import Vue from "vue";
import Vuex from "vuex";
import { FrameObject, ErrorSlotPayload, CurrentFrame, CaretPosition, FramesDefinitions } from "@/types/types";
import frameCommandsDefs from "@/constants/frameCommandsDefs";
// import initialState from "@/store/initial-state";
import initialState from "@/store/test";

Vue.use(Vuex);

export default new Vuex.Store({
    state: {
        nextAvailableId: 16 as number,

        currentFrame: {id: 0, caretPosition: CaretPosition.body} as CurrentFrame,

        isEditing: false,

        frameObjects: initialState,
    },
    getters: {
        getFramesForParentId: (state) => (id: number) => {
            //Get the childrenIds of this frame and based on these return the children objects corresponding to them
            return state.frameObjects[id].childrenIds
                .map((a) => state.frameObjects[a])
                .filter((a) => a);
        },
        getContentForFrameSlot: (state) => (frameId: number, slotId: number) => {
            const retCode = state.frameObjects[frameId]?.contentDict[slotId];
            return retCode !== undefined ? retCode : "";
        },
        getJointFramesForFrameId: (state) => (id: number) => {
            const jointFrameIds = state.frameObjects[id]?.jointFrameIds;
            const jointFrames: FrameObject[] = [];
            jointFrameIds?.forEach((jointFrameId: number) => {
                const jointFrame = state.frameObjects[jointFrameId];
                if (jointFrame !== undefined) {
                    jointFrames.push(jointFrame);
                }
            });
            return jointFrames;
        },
        getIsJointFrame: (state) => (parentId: number, frameType: string) => {
            //this getter checks if a frame type identified by "frameType" is listed as a joint frame (e.g. "else" for "if")
            const parentType = state.frameObjects[parentId]?.frameType;
            if (parentType !== undefined) {
                return parentType.jointFrameTypes.includes(frameType);
            }
            return false;
        },
        getFrameObjects: (state) => () => {
            return Object.values(state.frameObjects);
        },

    },

    mutations: {

        addFrameObject(state, newFrame: FrameObject) {
            let indexToAdd = 0;
            let parentToAdd = state.currentFrame.id;
            if(state.currentFrame.caretPosition === CaretPosition.below) {
                //calculate index in parent
                parentToAdd = state.frameObjects[state.currentFrame.id].parentId;
                const currentFrameParent  = state.frameObjects[parentToAdd];
                indexToAdd = currentFrameParent.childrenIds.indexOf(state.currentFrame.id) + 1;
            }

            // Add the new frame to the list
            // "Vue.set" is used as Vue cannot catch the change by doing : state.frameObjects[fobj.id] = fobj
            Vue.set(
                state.frameObjects,
                newFrame.id,
                newFrame
            );

            // Add the frame id to its parent's childrenIds list
            state.frameObjects[parentToAdd].childrenIds.splice(
                indexToAdd,
                0,
                newFrame.id
            );

            if (newFrame.jointParentId > 0) {
                state.frameObjects[newFrame.jointParentId]?.jointFrameIds.push(
                    newFrame.id
                );
            }


        },

        updateFramesOrder(state, data) {
            const eventType = Object.keys(data.event)[0];

            if (eventType === "added") {
                // Add the id to the parent's childrenId list
                state.frameObjects[data.eventParentId].childrenIds.splice(
                    data.event[eventType].newIndex,
                    0,
                    data.event[eventType].element.id
                );
                // Set the new parentId to the the added frame
                Vue.set(
                    state.frameObjects[ data.event[eventType].element.id],
                    "parentId",
                    data.eventParentId
                );
            }
            else if (eventType === "moved") {
                // Delete the frameId from the children list
                state.frameObjects[data.eventParentId].childrenIds.splice(
                    data.event[eventType].oldIndex,
                    1
                );
                // Add it again in the new position
                state.frameObjects[data.eventParentId].childrenIds.splice(
                    data.event[eventType].newIndex,
                    0,
                    data.event[eventType].element.id
                );
            }
            else if (eventType === "removed") {
                // Remove the id from the parent's childrenId list
                state.frameObjects[data.eventParentId].childrenIds.splice(
                    data.event[eventType].oldIndex,
                    1
                );
            }
        },

        setFrameEditorSlot(state, payload: ErrorSlotPayload) {
            const contentDict = state.frameObjects[payload.frameId]?.contentDict;
            if (contentDict !== undefined) {
                contentDict[payload.slotId] = payload.code;
            }
        },

        toggleEditFlag(state) {
            state.isEditing = !state.isEditing;
        },

        changeCaretWithKeyboard(state, eventType: string) {

            let newId = state.currentFrame.id;
            let newPosition = state.currentFrame.caretPosition;

            //Turn off previous caret
            state.frameObjects[newId].caretVisibility = CaretPosition.none;

            if (eventType === "ArrowDown") {
                if(state.currentFrame.caretPosition === CaretPosition.body) {
                    //if the currentFrame has children
                    if(state.frameObjects[state.currentFrame.id].childrenIds.length > 0) {

                        // The first child becomes the current frame
                        newId = state.frameObjects[state.currentFrame.id].childrenIds[0];

                        // If the child allows children go to its body, else to its bottom
                        newPosition = (state.frameObjects[newId].frameType?.allowChildren) ? CaretPosition.body : CaretPosition.below;
                    }
                    //if the currentFrame has NO children go below it
                    else {
                        newPosition = CaretPosition.below;
                    }
                }
                else {
                    const currentFrameParentId = state.frameObjects[state.currentFrame.id].parentId;
                    const currentFrameParent  = state.frameObjects[currentFrameParentId];
                    const currentFrameIndexInParent = currentFrameParent.childrenIds.indexOf(state.currentFrame.id);

                    // If not in the end of parent's children list
                    if( currentFrameIndexInParent + 1 < currentFrameParent.childrenIds.length) {

                        // The next child becomes the current frame
                        newId = currentFrameParent.childrenIds[currentFrameIndexInParent + 1];

                        // If the new current frame allows children go to its body, else to its bottom
                        newPosition = (state.frameObjects[newId].frameType?.allowChildren)? CaretPosition.body : CaretPosition.below;
                    }
                    else {
                        newId = (currentFrameParentId !== 0)? currentFrameParentId : 0;

                        newPosition = CaretPosition.below;
                    }
                }
            }
            else if (eventType === "ArrowUp") {
                // If ((not allow children && I am below) || I am in body) ==> I go out of the frame
                if ( (!state.frameObjects[state.currentFrame.id].frameType?.allowChildren && state.currentFrame.caretPosition === CaretPosition.below) || state.currentFrame.caretPosition === CaretPosition.body){

                    const currentFrameParentId = state.frameObjects[state.currentFrame.id].parentId;
                    const currentFrameParent  = state.frameObjects[currentFrameParentId];
                    const currentFrameIndexInParent = currentFrameParent.childrenIds.indexOf(state.currentFrame.id);

                    // If the current is not on the top of its parent's children
                    if (currentFrameIndexInParent > 0) {
                        // Goto parent's previous child below
                        newId = currentFrameParent.childrenIds[currentFrameIndexInParent - 1];

                        newPosition = CaretPosition.below;
                    }
                    else {
                        newId = (currentFrameParentId !== 0) ? currentFrameParentId : 0;

                        newPosition = CaretPosition.body;
                    }
                }
                else { // That only validates for (Allow children && position == below) ==> I go in the frame

                    const currentFrameChildrenLength = state.frameObjects[state.currentFrame.id].childrenIds.length;
                    //if the currentFrame has children
                    if (currentFrameChildrenLength > 0) {

                        // Current's last child becomes the current frame
                        newId = state.frameObjects[state.currentFrame.id].childrenIds[currentFrameChildrenLength-1];

                        newPosition = CaretPosition.below;
                    }
                    else {
                        newPosition = CaretPosition.body;
                    }

                }
            }

            Vue.set(
                state.currentFrame,
                "id",
                newId
            );

            Vue.set(
                state.currentFrame,
                "caretPosition",
                newPosition
            );

            Vue.set(
                state.frameObjects[newId],
                "caretVisibility",
                newPosition
            );

        },

        setCurrentFrame(state, newCurrentFrame: CurrentFrame) {

            Vue.set(
                state.frameObjects[state.currentFrame.id],
                "caretVisibility",
                CaretPosition.none
            );
            Vue.set(
                state.currentFrame,
                "id",
                newCurrentFrame.id
            );

            Vue.set(
                state.currentFrame,
                "caretPosition",
                newCurrentFrame.caretPosition
            );

            Vue.set(
                state.frameObjects[newCurrentFrame.id],
                "caretVisibility",
                newCurrentFrame.caretPosition
            );
        },
    },

    actions: {
        updateFramesOrder({ commit }, payload) {
            commit(
                "updateFramesOrder",
                payload
            );
        },

        changeCaretPosition({commit}, payload) {
            commit(
                "changeCaretWithKeyboard",
                payload
            );
        },

        addFrameWithCommand({commit, state, getters}, payload) {
            //Prepare the newFrame object based on the frameType
            const isJointFrame = getters.getIsJointFrame(
                state.currentFrame.id,
                payload
            );

            const newFrame = {
                frameType: payload,
                id: state.nextAvailableId++,
                parentId: isJointFrame ? -1 : state.currentFrame.id,
                childrenIds: [],
                jointParentId: isJointFrame
                    ? state.currentFrame.id
                    : -1,
                jointFrameIds: [],
                contentDict: {},
            };

            commit(
                "addFrameObject",
                newFrame
            );
        },

        toggleCaret({commit}, newCurrent) {
            commit(
                "setCurrentFrame",
                newCurrent
            );
        },

    },
    modules: {},
});
