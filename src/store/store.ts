import Vue from "vue";
import Vuex from "vuex";
CCimport { FrameObject, ErrorSlotPayload, CurrentFrame, Position, FramesDefinitions } from "@/types/types";
import initialState from "@/store/initial-state";
import frameCommandsDefs from "@/constants/frameCommandsDefs";

Vue.use(Vuex);

export default new Vuex.Store({
    state: {
        nextAvailableId: 16 as number,

        currentFrame: {id: 0, caretPosition: Position.body} as CurrentFrame,

        isEditing: false,

        frameObjects: initialState,
    },
    getters: {
        getFramesForParentId: state => (id: number) => {
            //Get the childrenIds of this frame and based on these return the children objects corresponding to them
            return state.frameObjects[id].childrenIds
                .map(a => state.frameObjects[a])
                .filter(a => a);
        },
        getContentForFrameSlot: state => (frameId: number, slotId: number) => {
            const retCode = state.frameObjects[frameId]?.contentDict[slotId];
            return retCode !== undefined ? retCode : "";
        },
        getJointFramesForFrameId: state => (id: number) => {
            const jointFrameIds = state.frameObjects[id]?.jointFrameIds;
            const jointFrames: FrameObject[] = [];
            jointFrameIds?.forEach((jointFrameId: number) => {
                const jointFrame = state.frameObjects[jointFrameId];
                if (jointFrame !== undefined) jointFrames.push(jointFrame);
            });
            return jointFrames;
        },
        getIsJointFrame: state => (parentId: number, frameType: string) => {
            //this getter checks if a frame type identified by "frameType" is listed as a joint frame (e.g. "else" for "if")
            const parentType = state.frameObjects[parentId]?.frameType;
            // if(parentType !== undefined) {
            //     return state.framesDefinitions.find(fd => fd.name === parentType)?.jointFrameTypes.includes(frameType);
            // }
            if (parentType !== undefined) {
                return parentType.jointFrameTypes.includes(frameType);
            }
            return false;
        },
        getFrameObjects: state => () => {
            return Object.values(state.frameObjects);
        },
    
    },
    
    mutations: {

        addFrameObject(state, newFrame: FrameObject) {
            let indexToAdd = 0;
            let parentToAdd = state.currentFrame.id;
            if(state.currentFrame.caretPosition === Position.below) {
                //calculate index in parent
                parentToAdd = state.frameObjects[state.currentFrame.id].parentId;
                const currentFrameParent  = state.frameObjects[parentToAdd];
                indexToAdd = currentFrameParent.childrenIds.indexOf(state.currentFrame.id) + 1;
            }

            // Add the new frame to the list
            // "Vue.set" is used as Vue cannot catch the change by doing : state.frameObjects[fobj.id] = fobj
            Vue.set(state.frameObjects, newFrame.id, newFrame);
            
            // Add the frame id to its parent's childrenIds list
            state.frameObjects[parentToAdd].childrenIds.splice(indexToAdd,0,newFrame.id);

            // Add the new frame to the list
            // "Vue.set" is used as Vue cannot catch the change by doing : state.frameObjects[fobj.id] = fobj
            // Vue.set(state.frameObjects, fobj.id, fobj);

            // // Add the frame id to its parent's childrenIds list
            // Vue.set(
            //     state.frameObjects[fobj.parentId].childrenIds,
            //     state.frameObjects[fobj.parentId].childrenIds.length,
            //     fobj.id
            // );

            // if (fobj.jointParentId > 0) {
            //     state.frameObjects[fobj.jointParentId]?.jointFrameIds.push(
            //         fobj.id
            //     );
            // }
            // state.nextAvailableId++;
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
            const contentDict =
                state.frameObjects[payload.frameId]?.contentDict;
            if (contentDict !== undefined)
                contentDict[payload.slotId] = payload.code;
        },

        toggleEditFlag(state) {
            state.isEditing = !state.isEditing;
        },

        changeCaretWithKeyboard(state, eventType: string) {

            let newId = state.currentFrame.id;
            let newPosition = state.currentFrame.caretPosition;

            //Turn off previous caret
            state.frameObjects[newId].caretBelow = false;
            state.frameObjects[newId].caretBody = false;

            if (eventType === "ArrowDown") {
                if(state.currentFrame.caretPosition === Position.body) {
                    //if the currentFrame has children
                    if(state.frameObjects[state.currentFrame.id].childrenIds.length > 0) {

                        // The first child becomes the current frame
                        newId = state.frameObjects[state.currentFrame.id].childrenIds[0];

                        // If the child allows children go to its body, else to its bottom
                        newPosition = (state.frameObjects[newId].frameType?.allowChildren)? Position.body : Position.below;

                    }
                    //if the currentFrame has NO children go bellow it
                    else {
                        newPosition = Position.below;
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
                        newPosition = (state.frameObjects[newId].frameType?.allowChildren)? Position.body : Position.below;

                    }
                    else {
                        newId = (currentFrameParentId !== 0)? currentFrameParentId : 0;

                        newPosition = Position.below;
                    }
                }
            }
            else if (eventType === "ArrowUp") {
                // If ((not allow children && I am bellow) || I am in body) ==> I go out of the frame
                if ( (!state.frameObjects[state.currentFrame.id].frameType?.allowChildren && state.currentFrame.caretPosition === Position.below) || state.currentFrame.caretPosition === Position.body){
                    
                    const currentFrameParentId = state.frameObjects[state.currentFrame.id].parentId;
                    const currentFrameParent  = state.frameObjects[currentFrameParentId];
                    const currentFrameIndexInParent = currentFrameParent.childrenIds.indexOf(state.currentFrame.id);
                    
                    // If the current is not on the top of its parent's children
                    if (currentFrameIndexInParent > 0) {
                        // Goto parent's previous child below
                        newId = currentFrameParent.childrenIds[currentFrameIndexInParent - 1];

                        newPosition = Position.below;
                    }
                    else {
                        newId = (currentFrameParentId !== 0)? currentFrameParentId : 0;
                        newPosition = Position.body;
                    }
                }
                else { // That only validates for (Allow children && position == bellow) ==> I go in the frame
                    
                    const currentFrameChildrenLength = state.frameObjects[state.currentFrame.id].childrenIds.length;
                    //if the currentFrame has children
                    if (currentFrameChildrenLength > 0) {
                        
                        // Current's last child becomes the current frame
                        newId = state.frameObjects[state.currentFrame.id].childrenIds[currentFrameChildrenLength-1];

                        newPosition = Position.below;
                    }
                    else {
                        newPosition = Position.body;
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
                (newPosition === Position.body)? "caretBody" : "caretBelow",
                true
            );

        }

    },

    actions: {
        updateFramesOrder({ commit }, payload) {
            commit("updateFramesOrder", payload);
        },

        changeCaretPosition({commit}, payload) {
            commit("changeCaretWithKeyboard", payload);
        },

        addFrameWithCommand({commit, state, getters}, payload) {
            //Prepare the newFrame object based on the frameType
            const isJointFrame = getters.getIsJointFrame(state.currentFrame.id, payload);
            
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

            commit("addFrameObject",newFrame);
        }
    },
    modules: {},
});
