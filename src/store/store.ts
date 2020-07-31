import Vue from "vue";
import Vuex, { Store } from "vuex";
import { FrameObject, ErrorSlotPayload, CurrentFrame, CaretPosition, FramesDefinitions } from "@/types/types";
import initialState from "@/store/initial-state";

Vue.use(Vuex);

export default new Vuex.Store({
    state: {
        nextAvailableId: 16 as number,

        currentFrame: {id: 0, caretPosition: CaretPosition.body} as CurrentFrame,

        currentContainerFrameId:0,

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
          
            if(state.currentFrame.caretPosition === CaretPosition.below && currentFrame.id > 0) {
                //calculate index in parent
                const isJointFrame = (currentFrame.jointParentId > -1);
                return state.frameObjects[(isJointFrame) ? currentFrame.jointParentId : currentFrame.parentId];
            }
          
            return currentFrame;
        },
    },
    
    mutations: {

        addFrameObject(state, newFrame: FrameObject) {
            console.log("In Adding new frame")
            console.log(newFrame)

            let indexToAdd = 0;
            const isAddingJointFrame =  (newFrame.jointParentId > -1);
            const parentToAdd = (isAddingJointFrame) ? newFrame.jointParentId : newFrame.parentId;
            const listToUpdate = (isAddingJointFrame) ? state.frameObjects[parentToAdd].jointFrameIds : state.frameObjects[parentToAdd].childrenIds;
            // Adding a joint frame
        
            if(state.currentFrame.caretPosition === CaretPosition.below) {
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

            const currentFrame = state.frameObjects[state.currentFrame.id];
            
            if (eventType === "ArrowDown") {
                console.log("pressed down")
                console.log(`current Frame id = ${state.currentFrame.id} / container id = ${state.currentContainerFrameId}`)

                //In order to include joint frames in the traversing, we work with a copy of the children
                //and add the joint frames of the container to that copy
                let childrenAndJointFramesIds = [...state.frameObjects[state.currentContainerFrameId].childrenIds]
                console.log("current children:")
                console.log(currentFrame.childrenIds)
                if(state.currentContainerFrameId > -1){
                    childrenAndJointFramesIds = childrenAndJointFramesIds.concat(state.frameObjects[state.currentContainerFrameId].jointFrameIds)
                    console.log("with added joint frames:")
                    console.log(childrenAndJointFramesIds)
                }

                if(state.currentFrame.caretPosition === CaretPosition.body) {
                    console.log("down at body")
                    //if the currentFrame has children / joint frames
                    if(childrenAndJointFramesIds.length > 0) {

                        // The first child / joint frame becomes the current frame
                        newId = childrenAndJointFramesIds[0];
                
                        // If the child / joint frame allows children go to its body, else to its bottom
                        newPosition = (state.frameObjects[newId].frameType.allowChildren) ? CaretPosition.body : CaretPosition.below;
                    }
                    //if the currentFrame has NO children go below it
                    else {
                        newPosition = CaretPosition.below;
                    }
                }
                else {
                    console.log("down at bottom")
                    
                    const currentFrameParentId = state.frameObjects[state.currentFrame.id].parentId;
                    const currentFrameIndexInParent = childrenAndJointFramesIds.indexOf(state.currentFrame.id);

                    // If not in the end of parent's children list
                    if( currentFrameIndexInParent + 1 < childrenAndJointFramesIds.length) {

                        // The next child becomes the current frame
                        newId = childrenAndJointFramesIds[currentFrameIndexInParent + 1];

                        // If the new current frame allows children go to its body, else to its bottom
                        newPosition = (state.frameObjects[newId].frameType.allowChildren)? CaretPosition.body : CaretPosition.below;
                    }
                    else {
                        newId = (currentFrame.jointParentId > -1) ? currentFrame.jointParentId : currentFrameParentId;

                        newPosition = CaretPosition.below;
                    }
                }
            }
            else if (eventType === "ArrowUp") {
                console.log("arrowUp")
                
                // If ((not allow children && I am below) || I am in body) ==> I go out of the frame
                if ( (!state.frameObjects[state.currentFrame.id].frameType.allowChildren && state.currentFrame.caretPosition === CaretPosition.below) || state.currentFrame.caretPosition === CaretPosition.body){
                    console.log("going out of the frame")
                    let childrenAndJointFrameList = undefined;
                    const isParentAJointFrame =  (currentFrame.jointParentId > -1 )
                    console.log("isParentAJointFrame = " + isParentAJointFrame)
                    if(isParentAJointFrame){
                        childrenAndJointFrameList = state.frameObjects[currentFrame.jointParentId].jointFrameIds;
                        const indexOfParentFrame = childrenAndJointFrameList.indexOf(currentFrame.jointParentId);
                        childrenAndJointFrameList.splice(
                            indexOfParentFrame,
                            0,
                            state.currentFrame.id
                        );
                    }
                    else{
                        childrenAndJointFrameList = state.frameObjects[currentFrame.parentId].childrenIds;
                    }
                    const currentFrameIndexInParent = childrenAndJointFrameList.indexOf(state.currentFrame.id);
                    
                    
                    // If the current is not on the top of its parent's children
                    if (currentFrameIndexInParent > 0) {
                        // Goto parent's previous child below
                        newId = childrenAndJointFrameList[currentFrameIndexInParent - 1];

                        newPosition = CaretPosition.below;
                    }
                    else{
                        newId = currentFrame.parentId;

                        newPosition = CaretPosition.body;
                    }
                }
                else { // That only validates for (Allow children && position == below) ==> I go in the frame
                    console.log("going in the frame")
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

        changeCaretPosition({commit, state}, payload) {
            commit(
                "changeCaretWithKeyboard", 
                payload
            );
            console.log(`Current Frame id = ${state.currentFrame.id} type = ${state.frameObjects[state.currentFrame.id].frameType.type} caret = ${state.currentFrame.caretPosition}`)
            const cfo = this.getters.getCurrentContainerFrame();
            state.currentContainerFrameId = cfo.id;
            console.log(`Current container Frame id = ${ state.currentContainerFrameId} type = ${state.frameObjects[cfo.id].frameType.type} caret = ${cfo.caretVisibility}`)
        
        },

        addFrameWithCommand({commit, state, getters}, payload: FramesDefinitions) {               
            //Prepare the newFrame object based on the frameType
            console.log("in addframewithcommand, currentcontainer = " + state.currentContainerFrameId)
            const isJointFrame = getters.getIsJointFrame(
                state.currentContainerFrameId, 
                payload
            );
            console.log("jointframe? " + isJointFrame)
            
            const newFrame = {
                frameType: payload,
                id: state.nextAvailableId++,
                parentId: isJointFrame ? -1 : state.currentFrame.id,
                childrenIds: [],
                jointParentId: isJointFrame
                    ?  state.currentContainerFrameId
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
