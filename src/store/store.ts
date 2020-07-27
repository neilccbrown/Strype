import Vue from "vue";
import Vuex from "vuex";
import { FrameObject, ErrorSlotPayload } from "@/types/types";
import initialState from "@/store/initial-state";

Vue.use(Vuex);

export default new Vuex.Store({
    state: {
        nextAvailableId: 16 as number,

        currentFrameID: 0,

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
        addFrameObject(state, fobj: FrameObject) {
            // Add the new frame to the list
            // "Vue.set" is used as Vue cannot catch the change by doing : state.frameObjects[fobj.id] = fobj
            Vue.set(
                state.frameObjects,
                fobj.id,
                fobj
            );

            // Add the frame id to its parent's childrenIds list
            Vue.set(
                state.frameObjects[fobj.parentId].childrenIds,
                state.frameObjects[fobj.parentId].childrenIds.length,
                fobj.id
            );

            if (fobj.jointParentId > 0) {
                state.frameObjects[fobj.jointParentId]?.jointFrameIds.push(
                    fobj.id
                );
            }
            state.nextAvailableId++;
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
            } else if (eventType === "moved") {
                // First delete the frameId from the children list and then add it again in the new position
                state.frameObjects[data.eventParentId].childrenIds.splice(
                    data.event[eventType].oldIndex,
                    1
                );
                state.frameObjects[data.eventParentId].childrenIds.splice(
                    data.event[eventType].newIndex,
                    0,
                    data.event[eventType].element.id
                );
            } else if (eventType === "removed") {
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
        updateCurrentFrameID(state, id: number) {
            state.currentFrameID = id;
        },
        toggleEditFlag(state) {
            state.isEditing = !state.isEditing;
        },
    },
    actions: {},
    modules: {},
});
