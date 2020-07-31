import Vue from "vue";
import Vuex from "vuex";
import { FrameObject, ErrorSlotPayload, CurrentFrame, CaretPosition, FramesDefinitions } from "@/types/types";
import initialState from "@/store/initial-state";

Vue.use(Vuex);

export default new Vuex.Store({
    state: {
        nextAvailableId: 16 as number,

        currentFrame: { id: 0, caretPosition: CaretPosition.body } as CurrentFrame,

        currentContainerFrameId: 0,

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
        getIsJointFrame: (state) => (parentId: number, frameType: FramesDefinitions) => {
            //this getter checks if a frame type identified by "frameType" is listed as a joint frame (e.g. "else" for "if")
            const parentType = state.frameObjects[parentId]?.frameType;
            if (parentType !== undefined) {
                return parentType.jointFrameTypes.includes(frameType.type);
            }
            return false;
        },
        getFrameObjects: (state) => () => {
            return Object.values(state.frameObjects);
        },
        getCurrentFrameObject: (state) => () => {
            return state.frameObjects[state.currentFrame.id];
        },
        getCurrentContainerFrame: (state) => () => {
            const currentFrame = state.frameObjects[state.currentFrame.id];

            if (state.currentFrame.caretPosition === CaretPosition.below && currentFrame.id > 0) {
                //calculate index in parent
                const isJointFrame = (currentFrame.jointParentId > -1);
                return state.frameObjects[(isJointFrame) ? currentFrame.jointParentId : currentFrame.parentId];
            }

            return currentFrame;
        },
    },

    mutations: {

        addFrameObject(state, newFrame: FrameObject) {
 
            let indexToAdd = 0;
            const isAddingJointFrame = (newFrame.jointParentId > -1);
            let parentToAdd = state.currentFrame.id;

            if(isAddingJointFrame) {
                parentToAdd = newFrame.jointParentId;
                newFrame.parentId = -1;
            }
            else if(state.currentFrame.caretPosition === CaretPosition.below) {
                parentToAdd = state.frameObjects[state.currentFrame.id].parentId;
                newFrame.parentId = parentToAdd;
            }

            const listToUpdate = (isAddingJointFrame) ? state.frameObjects[parentToAdd].jointFrameIds : state.frameObjects[parentToAdd].childrenIds;
            // Adding a joint frame

            if (state.currentFrame.caretPosition === CaretPosition.below) {
                //calculate index in parent list
                indexToAdd = listToUpdate.indexOf(state.currentFrame.id) + 1;
            }

            // Add the frame id to its parent's childrenIds list
            listToUpdate.splice(
                indexToAdd,
                0,
                newFrame.id
            );


            // Add the new frame to the list
            // "Vue.set" is used as Vue cannot catch the change by doing : state.frameObjects[fobj.id] = fobj
            Vue.set(
                state.frameObjects,
                newFrame.id,
                newFrame
            );
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
                    state.frameObjects[data.event[eventType].element.id],
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



            const currentFrame = state.frameObjects[state.currentFrame.id];
            
            // Create the list of children + joints with which the caret will work with
            let childrenAndJointFramesIds = [] as number[];
            let parentId = 0;
            let jointFramesFlag = false;
            
            if(currentFrame.id !== 0){

                parentId = (currentFrame.jointParentId > -1) ? state.frameObjects[currentFrame.jointParentId].parentId : currentFrame.parentId;
            }
            childrenAndJointFramesIds = [...state.frameObjects[parentId].childrenIds];

            // Joint frames are added to a temp list and caret works with this list instead.
            if (currentFrame.jointFrameIds.length > 0 || currentFrame.jointParentId > -1) {

                const jointParentId = (currentFrame.jointParentId > -1) ? currentFrame.jointParentId : currentFrame.id;
                const indexOfJointParent = childrenAndJointFramesIds.indexOf(jointParentId);

                //the joint frames are added to the temporary list
                childrenAndJointFramesIds.splice(
                    indexOfJointParent+1,
                    0,
                    ...state.frameObjects[jointParentId].jointFrameIds
                );

                jointFramesFlag = true;
            }



            if (eventType === "ArrowDown") {
                if(state.currentFrame.caretPosition === CaretPosition.body) {
                    //if the currentFrame has children
                    if(currentFrame.childrenIds.length > 0) {

                        // The first child becomes the current frame
                        newId = currentFrame.childrenIds[0];

                        // If the child allows children go to its body, else to its bottom
                        newPosition = (state.frameObjects[newId].frameType?.allowChildren) ? CaretPosition.body : CaretPosition.below;
                    }
                    //if the currentFrame has NO children go below it
                    else {
                        newPosition = CaretPosition.below;
                    }
                }
                else {
                    // const currentFrameParentId = currentFrame.parentId;
                    // const currentFrameParent  = state.frameObjects[currentFrameParentId];
                    // const currentFrameIndexInParent = currentFrameParent.childrenIds.indexOf(state.currentFrame.id);
                    const currentFrameIndex = childrenAndJointFramesIds.indexOf(state.currentFrame.id);

                    // If not in the end of the list
                    if( currentFrameIndex + 1 < childrenAndJointFramesIds.length) {

                        // The next child becomes the current frame
                        newId = childrenAndJointFramesIds[currentFrameIndex + 1];

                        // If the new current frame allows children go to its body, else to its bottom
                        newPosition = (state.frameObjects[newId].frameType?.allowChildren)? CaretPosition.body : CaretPosition.below;
                    }
                    else {
                        newId = (parentId !== 0)? parentId : currentFrame.id;

                        newPosition = CaretPosition.below;
                    }
                }
            }
            else if (eventType === "ArrowUp") {

                // only when going up and, if the previous frame is part of a compound we need to add it in the list
                if(!jointFramesFlag) {
                    const indexOfCurrentInParent = childrenAndJointFramesIds.indexOf(currentFrame.id);
                    const previousId = childrenAndJointFramesIds[indexOfCurrentInParent - 1];
                    const previousJointFrameIds = state.frameObjects[previousId].jointFrameIds;

                    //  If the previous has joint frames
                    if(previousJointFrameIds.length > 0) {
                        //the last joint frames are added to the temporary list
                        childrenAndJointFramesIds.splice(
                            indexOfCurrentInParent,
                            0,
                            ...state.frameObjects[previousId].jointFrameIds
                        );
                    }
                }

                // If ((not allow children && I am below) || I am in body) ==> I go out of the frame
                if ( (!currentFrame.frameType?.allowChildren && state.currentFrame.caretPosition === CaretPosition.below) || state.currentFrame.caretPosition === CaretPosition.body){
                    
                    // const currentFrameParentId = currentFrame.parentId;
                    // const currentFrameParent  = state.frameObjects[currentFrameParentId];
                    // const currentFrameIndexInParent = currentFrameParent.childrenIds.indexOf(state.currentFrame.id);
                    const currentFrameIndex = childrenAndJointFramesIds.indexOf(state.currentFrame.id);

                    // If the current is not on the top of its parent's children
                    if (currentFrameIndex > 0) {
                        // Goto parent's previous child below
                        newId = childrenAndJointFramesIds[currentFrameIndex - 1];

                        newPosition = CaretPosition.below;
                    }
                    else {
                        newId = (parentId !== 0)? parentId : currentFrame.id;

                        newPosition = CaretPosition.body;
                    }
                }
                else { // That only validates for (Allow children && position == below) ==> I go in the frame
                    
                    const currentFrameChildrenLength = currentFrame.childrenIds.length;
                    //if the currentFrame has children
                    if (currentFrameChildrenLength > 0) {
                        
                        // Current's last child becomes the current frame
                        newId = currentFrame.childrenIds[currentFrameChildrenLength-1];

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

        changeCaretPosition({ commit, state }, payload) {
            commit(
                "changeCaretWithKeyboard",
                payload
            );
            const cfo = this.getters.getCurrentContainerFrame();
            state.currentContainerFrameId = cfo.id;

        },

        addFrameWithCommand({ commit, state, getters }, payload: FramesDefinitions) {
            //Prepare the newFrame object based on the frameType
            const isJointFrame = getters.getIsJointFrame(
                state.currentContainerFrameId,
                payload
            );

            const newFrame = {
                frameType: payload,
                id: state.nextAvailableId++,
                parentId: isJointFrame ? -1 : state.currentFrame.id,
                childrenIds: [],
                jointParentId: isJointFrame
                    ? state.currentContainerFrameId
                    : -1,
                jointFrameIds: [],
                contentDict: {},
            };

            commit(
                "addFrameObject",
                newFrame
            );
        },

        toggleCaret({ commit }, newCurrent) {
            commit(
                "setCurrentFrame",
                newCurrent
            );
        },

    },
    modules: {},
});
