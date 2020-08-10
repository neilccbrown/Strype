import Vue from "vue";
import Vuex from "vuex";
import { FrameObject, ErrorSlotPayload, CurrentFrame, CaretPosition, FramesDefinitions } from "@/types/types";
import initialState from "@/store/initial-state";

Vue.use(Vuex);

const removeFrameInFrameList = (listOfFrames: Record<number, FrameObject>, frameId: number) => {
    // When removing a frame in the list, we remove all its sub levels,
    // then update its parent and then delete the frame itself

    const frameObject = listOfFrames[frameId];

    //we need a copy of the childrenIds are we are modifying them in the foreach
    const childrenIds = [...frameObject.childrenIds];
    childrenIds.forEach((childId: number) => removeFrameInFrameList(
        listOfFrames,
        childId
    ));
    //we need a copy of the jointFrameIds are we are modifying them in the foreach
    const jointFramesIds = [...frameObject.jointFrameIds];
    jointFramesIds.forEach((jointFrameId: number) => removeFrameInFrameList(
        listOfFrames,
        jointFrameId
    ));
    const deleteAJointFrame = (frameObject.jointParentId > 0); 
    const listToUpdate = (deleteAJointFrame) ? listOfFrames[frameObject.jointParentId].jointFrameIds : listOfFrames[frameObject.parentId].childrenIds;
    listToUpdate.splice(
        listToUpdate.indexOf(frameId),
        1
    );
    delete listOfFrames[frameId];
}

export default new Vuex.Store({
    state: {
        nextAvailableId: 16 as number,

        currentFrame: { id: -1, caretPosition: CaretPosition.body } as CurrentFrame,

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
        getDraggableGroupById: (state) => (id: number) => {
            return state.frameObjects[id].frameType.draggableGroup;
        },
    },

    mutations: {

        addFrameObject(state, newFrame: FrameObject) {
 
            let indexToAdd = 0;
            const isAddingJointFrame = (newFrame.jointParentId > 0);
            const parentToAdd = (isAddingJointFrame) ? newFrame.jointParentId : newFrame.parentId;

            const listToUpdate = (isAddingJointFrame) ? state.frameObjects[parentToAdd].jointFrameIds : state.frameObjects[parentToAdd].childrenIds;
            
            // Adding a joint frame
            if (state.currentFrame.caretPosition === CaretPosition.below) {
                //calculate index in parent list
                const childToCheck = (state.frameObjects[state.currentFrame.id].jointParentId > 0 && newFrame.jointParentId == 0) ?
                    state.frameObjects[state.currentFrame.id].jointParentId :
                    state.currentFrame.id;
                indexToAdd = listToUpdate.indexOf(childToCheck) + 1;
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

        deleteFrame(state, payload: {key: string; frameToDeleteId: number; deleteChildren?: boolean}) {
            //if delete is pressed
            //  case cursor is body: cursor stay here, the first child (if exits) is deleted (*)
            //  case cursor is below: cursor stay here, the next sibling (if exits) is deleted (*)
            //if backspace is pressed
            //  case current frame is Container --> do nothing, a container cannot be deleted
            //  case cursor is body: cursor needs to move one level up, and the current frame's children + all siblings replace its parent
            //  case cursor is below: cursor needs to move to bottom of previous sibling (or body of parent if first child) and the current frame (*) is deleted
            //(*) with all sub levels children
            
            if(payload.key=== "Delete"){
                //delete the frame and all children
                removeFrameInFrameList(
                    state.frameObjects,
                    payload.frameToDeleteId
                );
            }
            else{
                //delete the frame entirely with sub levels
                if(payload.deleteChildren === true){
                    removeFrameInFrameList(
                        state.frameObjects,
                        payload.frameToDeleteId
                    );
                }
                else{
                    //we "replace" the frame to delete by its content in its parent's location
                    //note: the content is its children and the children of its potential joint frames
                    const frameToDelete = state.frameObjects[payload.frameToDeleteId];
                    const isFrameToDeleteJointFrame = (frameToDelete.jointParentId > 0);
                    const isFrameToDeleteRootJointFrame = (frameToDelete.jointParentId === 0 && frameToDelete.frameType.jointFrameTypes.length > 0);
                    let parentIdOfFrameToDelete = frameToDelete.parentId; 
                    //if the current frame is a joint frame, we find the "parent": the root of the structure if it's the first joint, the joint before otherwise
                    if (isFrameToDeleteJointFrame) {
                        const indexOfJointFrame = state.frameObjects[frameToDelete.jointParentId].jointFrameIds.indexOf(payload.frameToDeleteId);
                        parentIdOfFrameToDelete = (indexOfJointFrame > 0) ?
                            state.frameObjects[frameToDelete.jointParentId].jointFrameIds[indexOfJointFrame - 1] :
                            state.frameObjects[payload.frameToDeleteId].jointParentId     
                    }

                    const listOfChildrenToMove = state.frameObjects[payload.frameToDeleteId].childrenIds
                    //if the frame to remove is the root of a joint frames structure, we include all the joint frames' children in the list of children to remove
                    if(isFrameToDeleteRootJointFrame){
                        state.frameObjects[payload.frameToDeleteId]
                            .jointFrameIds
                            .forEach((jointFrameId) => listOfChildrenToMove.push(...state.frameObjects[jointFrameId].childrenIds));
                    }

                    //update the new parent Id of all the children to their new parent
                    listOfChildrenToMove.forEach((childId) => state.frameObjects[childId].parentId = parentIdOfFrameToDelete);
                    //replace the frame to delete by the children in the parent frame or append them at the end (for joint frames)
                    const parentChildrenIds = state.frameObjects[parentIdOfFrameToDelete].childrenIds;
                    const indexOfFrameToReplace = (isFrameToDeleteJointFrame) ? parentChildrenIds.length : parentChildrenIds.lastIndexOf(payload.frameToDeleteId);
                    parentChildrenIds.splice(
                        indexOfFrameToReplace,
                        (isFrameToDeleteJointFrame) ? 0 : 1,
                        ...listOfChildrenToMove
                    );
                    //if the frame to delete is a joint frame, we remove it from its parent
                    if(isFrameToDeleteJointFrame){
                        state.frameObjects[state.frameObjects[payload.frameToDeleteId].jointParentId].jointFrameIds.splice(
                            state.frameObjects[parentIdOfFrameToDelete].jointFrameIds.indexOf(payload.frameToDeleteId),
                            1
                        );
                    }
                    //and finally, delete the frame
                    delete state.frameObjects[payload.frameToDeleteId] 
                }
            }
        },

        updateFramesOrder(state, data) {
            const eventType = data.event.keys[0];

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

                parentId = (currentFrame.jointParentId > 0) ? state.frameObjects[currentFrame.jointParentId].parentId : currentFrame.parentId;
            }
            childrenAndJointFramesIds = [...state.frameObjects[parentId].childrenIds];

            // Joint frames are added to a temp list and caret works with this list instead.
            if (currentFrame.jointFrameIds.length > 0 || currentFrame.jointParentId > 0) {

                const jointParentId = (currentFrame.jointParentId > 0) ? currentFrame.jointParentId : currentFrame.id;
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
                        newPosition = (state.frameObjects[newId].frameType.allowChildren) ? CaretPosition.body : CaretPosition.below;
                    }
                    //if the currentFrame has NO children go below it, except if it is a container --> next container
                    else {
                        if(currentFrame.id < 0){
                            if(childrenAndJointFramesIds.indexOf(currentFrame.id) + 1 < childrenAndJointFramesIds.length){
                                newId = childrenAndJointFramesIds[childrenAndJointFramesIds.indexOf(currentFrame.id) + 1];
                                newPosition = CaretPosition.body;
                            }
                            //else we stay where we are.
                        }
                        else{
                            newPosition = CaretPosition.below;
                        }                        
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
                        newPosition = (state.frameObjects[newId].frameType.allowChildren)? CaretPosition.body : CaretPosition.below;
                    }
                    // If that's the content of a container, go to the next container if possible (body)
                    else if(currentFrame.parentId < 0){
                        const containers = state.frameObjects[0].childrenIds;
                        const indexOfCurrentContainer = containers.indexOf(currentFrame.parentId);
                        if(indexOfCurrentContainer + 1 < containers.length) {
                            newId = containers[indexOfCurrentContainer + 1];
                            newPosition = CaretPosition.body;
                        }
                    }
                    else {
                        newId = (parentId > 0)? parentId : currentFrame.id;

                        newPosition = CaretPosition.below;
                    }
                }
            }
            else if (eventType === "ArrowUp") {

                // only when going up and, if the previous frame is part of a compound or another container we need to add it in the list
                if(!jointFramesFlag) {
                 
                    const indexOfCurrentInParent = childrenAndJointFramesIds.indexOf(currentFrame.id);
                    const previousId = childrenAndJointFramesIds[indexOfCurrentInParent - 1];

                    // If the previous is simply my parent, there is not need to check whether he has JointChildren as even if he has
                    // I am already above them (in his body). (if the prevID is undefined, that means I am the first child)
                    if(previousId !== undefined && previousId !== currentFrame.parentId){

                        //get the previous container's children if the current frame is a container (OR keep self it first container),
                        //otherwise, get the previous frame's joint frames
                        const previousSubLevelFrameIds = (currentFrame.id < 0) ?
                            ((indexOfCurrentInParent !== 0) ? state.frameObjects[previousId].childrenIds : currentFrame.childrenIds) :
                            state.frameObjects[previousId].jointFrameIds;

                        //  If the previous has joint frames
                        if(previousSubLevelFrameIds.length > 0) {
                            //the last joint frames are added to the temporary list
                            childrenAndJointFramesIds.splice(
                                indexOfCurrentInParent,
                                0,
                                ...previousSubLevelFrameIds  
                            );
                        }
                    }                 
                }

                // If ((not allow children && I am below) || I am in body) ==> I go out of the frame
                if ( (!currentFrame.frameType.allowChildren && state.currentFrame.caretPosition === CaretPosition.below) || state.currentFrame.caretPosition === CaretPosition.body){
                    // const currentFrameParentId = currentFrame.parentId;
                    // const currentFrameParent  = state.frameObjects[currentFrameParentId];
                    // const currentFrameIndexInParent = currentFrameParent.childrenIds.indexOf(state.currentFrame.id);
                    const currentFrameIndex = childrenAndJointFramesIds.indexOf(state.currentFrame.id);
                  
                    // If the current is not on the top of its parent's children
                    if (currentFrameIndex > 0) {
                        // Goto parent's previous child below
                        newId = childrenAndJointFramesIds[currentFrameIndex - 1];

                        //the caret position is below except for Containers where it is always body
                        newPosition = (newId < 0) ? CaretPosition.body : CaretPosition.below;
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

        changeCaretPosition({ commit }, payload) {
            commit(
                "changeCaretWithKeyboard",
                payload
            );
        },

        addFrameWithCommand({ commit, state, getters }, payload: FramesDefinitions) {
            //Prepare the newFrame object based on the frameType
            const isJointFrame = getters.getIsJointFrame(
                (state.frameObjects[state.currentFrame.id].jointParentId > 0) ?
                    state.frameObjects[state.currentFrame.id].jointParentId :
                    state.currentFrame.id,
                payload
            );
            
            let parentId = (isJointFrame) ? 0 : state.currentFrame.id;
            //if the cursor is below a frame, we actually add to the current's frame parent)
            if(parentId > 0 && state.currentFrame.caretPosition === CaretPosition.below) {
                const currentFrame = state.frameObjects[state.currentFrame.id];
                const parentOfCurrent = (currentFrame.jointParentId > 0) ?
                    state.frameObjects[state.frameObjects[currentFrame.jointParentId].parentId] :
                    state.frameObjects[currentFrame.parentId];
                parentId = parentOfCurrent.id;
            }

            const newFrame = {
                frameType: payload,
                id: state.nextAvailableId++,
                parentId: isJointFrame ? 0 : parentId, 
                childrenIds: [],
                jointParentId: isJointFrame
                    ? (state.frameObjects[state.currentFrame.id].jointParentId > 0) ? state.frameObjects[state.currentFrame.id].jointParentId : state.currentFrame.id
                    : 0,
                jointFrameIds: [],
                contentDict: {},
            };

            commit(
                "addFrameObject",
                newFrame
            );
        },

        deleteCurrentFrame({commit, state}, payload: string){
            //if delete is pressed
            //  case cursor is body: cursor stay here, the first child (if exits) is deleted (*)
            //  case cursor is below: cursor stay here, the next sibling (if exits) is deleted (*)
            //if backspace is pressed
            //  case current frame is Container --> do nothing, a container cannot be deleted
            //  case cursor is body: cursor needs to move one level up, and the current frame's children + all siblings replace its parent
            //  case cursor is below: cursor needs to move to bottom of previous sibling (or body of parent if first child) and the current frame (*) is deleted
            //(*) with all sub levels children

            const currentFrame = state.frameObjects[state.currentFrame.id];
            const parentId = (currentFrame.jointParentId > 0) ? currentFrame.jointParentId : currentFrame.parentId;
            //use a copy of the siblings (because we may need to alter the list)
            const listOfSiblings = (currentFrame.jointParentId > 0) ? [...state.frameObjects[parentId].jointFrameIds] : [...state.frameObjects[parentId].childrenIds];
            //if the current frame is the root of a joint frame, we need to add its joint frames as immediate siblings
            if(currentFrame.parentId !== 0 && currentFrame.frameType.jointFrameTypes.length > 0){
                const jointFrames = currentFrame.jointFrameIds;
                listOfSiblings.splice(
                    listOfSiblings.indexOf(currentFrame.id) + 1,
                    0,
                    ...jointFrames
                );
            }
            //if the current frame is part of a joint frames structure (not the root), we had the next sibling of its joint frame root
            else if(currentFrame.jointParentId > 0){
                const listOfJointRootSiblings = state.frameObjects[state.frameObjects[parentId].parentId].childrenIds;
                const indexOfJointRootInParent = listOfJointRootSiblings.indexOf(parentId);
                if(indexOfJointRootInParent + 1 < listOfJointRootSiblings.length){
                    listOfSiblings.push(listOfJointRootSiblings[indexOfJointRootInParent + 1]);
                }
            }

            const indexOfCurrentFrame = listOfSiblings.indexOf(currentFrame.id) ;

            if(payload === "Delete"){
                //retrieve the frame to delete 
                if(state.currentFrame.caretPosition === CaretPosition.body){
                    if(currentFrame.childrenIds.length > 0){
                        commit(
                            "deleteFrame",
                            {key:payload,frameToDeleteId: currentFrame.childrenIds[0]}
                        );
                    }
                }
                else{
                    if(indexOfCurrentFrame + 1 < listOfSiblings.length){
                        commit(
                            "deleteFrame",
                            {key:payload,frameToDeleteId: listOfSiblings[indexOfCurrentFrame + 1]}
                        );
                    }
                   
                }
            }
            else if (currentFrame.id > 0) {
                let deleteChildren = false;
                if(state.currentFrame.caretPosition === CaretPosition.body ){
                    //just move the cursor one level up
                    commit(
                        "changeCaretWithKeyboard",
                        "ArrowUp"
                    );
                }
                else{
                    //move the cursor up to the previous sibling bottom if available, otherwise body of parent
                    const newId = (indexOfCurrentFrame - 1 >= 0) ? listOfSiblings[indexOfCurrentFrame - 1] : parentId;
                    const newPosition = (indexOfCurrentFrame - 1 >= 0 || currentFrame.jointParentId > 0) ? CaretPosition.below : CaretPosition.body;
                    commit(
                        "setCurrentFrame",
                        {id:newId, caretPosition: newPosition}
                    );
                    deleteChildren = true;
                }
                commit(
                    "deleteFrame",
                    {key:payload,frameToDeleteId: currentFrame.id,  deleteChildren: deleteChildren}
                );

            }
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
