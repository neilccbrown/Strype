import Vue from "vue";
import Vuex from "vuex";
import { FrameObject, CurrentFrame, CaretPosition, MessageDefinition, MessageDefinitions, FramesDefinitions, EditableFocusPayload, Definitions, AllFrameTypesIdentifier, ToggleFrameLabelCommandDef, ObjectPropertyDiff, EditableSlotPayload, MessageDefinedActions } from "@/types/types";
import addFrameCommandsDefs from "@/constants/addFrameCommandsDefs";
import initialState from "@/store/initial-state";
import {getEditableSlotId, undoMaxSteps} from "@/helpers/editor";
import {getObjectPropertiesDiffferences} from "@/helpers/common";

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

    //Now we can delete the frame from the list of frameObjects
    Vue.delete(
        listOfFrames,
        frameId
    );
};

const getParent = (listOfFrames: Record<number, FrameObject>, currentFrame: FrameObject) => {
    let parentId = 0;
    if(currentFrame.id !== 0){
        parentId = (currentFrame.jointParentId > 0) ? listOfFrames[currentFrame.jointParentId].parentId : currentFrame.parentId;
    }
    return parentId;
};

const childrenListWithJointFrames = (listOfFrames: Record<number, FrameObject>, currentFrameId: number, caretPosition: CaretPosition, direction: string) => {
    const currentFrame = listOfFrames[currentFrameId];
            
    // Create the list of children + joints with which the caret will work with
    let childrenAndJointFramesIds = [] as number[];
    const parentId = getParent(listOfFrames,currentFrame);

    childrenAndJointFramesIds = [...listOfFrames[parentId].childrenIds];    
    
    // Joint frames are added to a temp list and caret works with this list instead.
    if (currentFrame.jointFrameIds.length > 0 || currentFrame.jointParentId > 0) {

        const jointParentId = (currentFrame.jointParentId > 0) ? currentFrame.jointParentId : currentFrame.id;
        const indexOfJointParent = childrenAndJointFramesIds.indexOf(jointParentId);

        //the joint frames are added to the temporary list
        childrenAndJointFramesIds.splice(
            indexOfJointParent+1,
            0,
            ...listOfFrames[jointParentId].jointFrameIds
        );
    }
    
    if (direction === "up") {
        // when going up and, if the previous frame is part of a compound or another container we need to add it in the list
        const indexOfCurrentInParent = childrenAndJointFramesIds.indexOf(currentFrame.id);
        const previousId = childrenAndJointFramesIds[indexOfCurrentInParent - 1];

        // If the previous is simply my parent, there is not need to check whether he has JointChildren as even if he has
        // I am already above them (in his body). (if the prevID is undefined, that means I am the first child)
        if(previousId !== undefined && previousId !== currentFrame.parentId){

            //get the previous container's children if the current frame is a container (OR keep self it first container),
            //otherwise, get the previous frame's joint frames
            const previousSubLevelFrameIds = 
                (currentFrame.id < 0) ?
                    ((indexOfCurrentInParent > 0) ? 
                        listOfFrames[previousId].childrenIds : 
                        []
                    ) :
                    listOfFrames[previousId].jointFrameIds;
           
            //the last joint frames are added to the temporary list
            childrenAndJointFramesIds.splice(
                indexOfCurrentInParent,
                0,
                ...previousSubLevelFrameIds  
            );

        }
    }
    else {
        if(caretPosition === CaretPosition.body){
            // add its children to the list
            childrenAndJointFramesIds.splice(
                childrenAndJointFramesIds.indexOf(currentFrame.id)+1,
                0,
                ...currentFrame.childrenIds
            );
        }
    }
    
    return childrenAndJointFramesIds;
};

const countRecursiveChildren = function(listOfFrames: Record<number, FrameObject>, frameId: number, countLimit?: number): number {
    // This method counts all recursive children (i.e. children, grand children, ...) of a frame.
    // The countLimit is a threshold to reach where we can stop recursion. Therefore the number of children returned IS NOT guaranted
    // to be less than the limit: it just means we don't look at any more siblings/sub children if we reached this limit.
    // If this argument isn't passed in the method, all recursive children are counted until we reach the end of the tree.
    
    const currentChildrenIds = listOfFrames[frameId].childrenIds;
    const currentJointFramesIds = listOfFrames[frameId].jointFrameIds;
    
    let childrenCount = currentChildrenIds.length;
    if(countLimit === undefined || childrenCount < countLimit){
        //if there is no limit set, or if we haven't reached it, we look at the subchildren
        currentChildrenIds.forEach((childId: number) => childrenCount += countRecursiveChildren(
            listOfFrames, 
            childId, 
            countLimit
        ));
        //if there is no limit set, or if we haven't reached it, we look at the children of the joint frames
        if(countLimit === undefined || childrenCount < countLimit){
            //for the joint frame structure, if a joint frame has at least one child, we count is as its parent 
            //child to give it a count.
            currentJointFramesIds.forEach((jointFrameId: number) => {
                if(listOfFrames[jointFrameId].childrenIds.length > 0){
                    childrenCount++;
                }
                childrenCount += countRecursiveChildren(
                    listOfFrames, 
                    jointFrameId, 
                    countLimit
                );
            });
        }
    }

    return childrenCount;
}

export default new Vuex.Store({
    state: {

        frameObjects: initialState,

        nextAvailableId: Math.max.apply({},Object.keys(initialState).map(Number))+1 as number,

        currentFrame: { id: -3, caretPosition: CaretPosition.body } as CurrentFrame,

        currentInitCodeValue: "",

        isEditing: false,

        currentMessage: MessageDefinitions.NoMessage,

        preCompileErrors: [] as string[],

        diffToPreviousState: [] as ObjectPropertyDiff[][],

        diffToNextState: [] as ObjectPropertyDiff[][],
    },

    getters: {
        getFrameObjectFromId: (state) => (frameId: number) => {
            return state.frameObjects[frameId];
        },
        getFramesForParentId: (state) => (frameId: number) => {
            //Get the childrenIds of this frame and based on these return the children objects corresponding to them
            return state.frameObjects[frameId].childrenIds
                .map((a) => state.frameObjects[a])
                .filter((a) => a);
        },
        getContentForFrameSlot: (state) => (frameId: number, slotId: number) => {
            const retCode = state.frameObjects[frameId]?.contentDict[slotId].code;
            // return "" if it is undefined
            return retCode ?? "";
        },
        getInitContentForFrameSlot: (state) => () => {
            return state.currentInitCodeValue;
        },

        getJointFramesForFrameId: (state) => (frameId: number, group: string) => {
            const jointFrameIds = state.frameObjects[frameId].jointFrameIds;
            const jointFrames: FrameObject[] = [];
            jointFrameIds?.forEach((jointFrameId: number) => {
                const jointFrame = state.frameObjects[jointFrameId];
                if (jointFrame !== undefined) {
                    //this frame should have the same draggableGroup with the parent Joint frame for it to be Draggable)
                    if (group === "draggable" && jointFrame.frameType.draggableGroup === state.frameObjects[frameId].frameType.innerJointDraggableGroup) {
                        jointFrames.push(jointFrame);
                    }
                    //this frame should not have the same draggableGroup with the parent Joint frame for it to be Static (undraggable)
                    else if (group === "static" && jointFrame.frameType.draggableGroup !== state.frameObjects[frameId].frameType.innerJointDraggableGroup) {
                        jointFrames.push(jointFrame);
                    }
                    else if (group === "all") {
                        jointFrames.push(jointFrame);
                    }
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
        getCurrentFrameObject: (state) => () => {
            return state.frameObjects[state.currentFrame.id];
        },
        getDraggableGroupById: (state) => (frameId: number) => {
            return state.frameObjects[frameId].frameType.draggableGroup;
        },
        getDraggableJointGroupById: (state) => (frameId: number) => {
            const frame = state.frameObjects[frameId];
            return frame.frameType.innerJointDraggableGroup;
        },
        getIsEditing: (state) => () => {
            return state.isEditing;
        },
        getIsEditableFocused: (state) => (frameId: number, slotIndex: number) => {
            return state.frameObjects[frameId].contentDict[slotIndex].focused;
        },
        getCurrentFrameAddFrameCommands: (state) => () => {
            const currentFrame  = state.frameObjects[state.currentFrame.id];

            //forbidden frames are those of the current frame's type if caret is body, those of the parent/joint root otherwise
            let forbiddenTypes = (state.currentFrame.caretPosition === CaretPosition.body) ? 
                [...currentFrame.frameType.forbiddenChildrenTypes] :
                ((currentFrame.jointParentId > 0) ? [...state.frameObjects[currentFrame.jointParentId].frameType.forbiddenChildrenTypes] : [...state.frameObjects[currentFrame.parentId].frameType.forbiddenChildrenTypes]);
         
            //as there is no static rule for showing the "break" or "continue" statements,
            //we need to check if the current frame is within a "for" or a "while" loop.
            //if we are not into a nested for/while --> we add "break" and "continue" in the forbidden frames list
            let canShowLoopBreakers = false;
            let frameToCheckId = (state.currentFrame.caretPosition === CaretPosition.body) ? 
                currentFrame.id:
                ((currentFrame.jointParentId > 0) ? state.frameObjects[currentFrame.jointParentId].id : state.frameObjects[currentFrame.parentId].id) ;
            
            while(frameToCheckId > 0 && !canShowLoopBreakers){
                const frameToCheckType = state.frameObjects[frameToCheckId].frameType;
                canShowLoopBreakers = (frameToCheckType === Definitions.ForDefinition || frameToCheckType === Definitions.WhileDefinition);
                frameToCheckId = state.frameObjects[frameToCheckId].parentId;
            }

            if(!canShowLoopBreakers){
                //by default, "break" and "continue" are NOT forbidden to any frame which can host children frames,
                //so if we cannot show "break" and "continue" : we add them from the list of forbidden
                forbiddenTypes.splice(
                    0,
                    0,
                    ...[Definitions.BreakDefinition.type, Definitions.ContinueDefinition.type]
                );
            }
         
            //joint frames are retrieved only for the current frame or the joint frame root if the caret is below
            let jointTypes = (state.currentFrame.caretPosition === CaretPosition.below) ?
                [...currentFrame.frameType.jointFrameTypes] : 
                [];

            //update the list of joint frames depending on where we are in the joint frames structure to respect the rules
            if(jointTypes.length > 0){
                const rootJointFrame = (currentFrame.jointParentId > 0) ? state.frameObjects[currentFrame.jointParentId] : currentFrame;

                //Remove "finally" in joint frames allwed after "else" if we are in anything else than in a "try"
                if(rootJointFrame.frameType !== Definitions.TryDefinition && jointTypes.includes(Definitions.FinallyDefinition.type)){
                    jointTypes.splice(
                        jointTypes.indexOf(Definitions.FinallyDefinition.type),
                        1
                    );
                }

                //remove joint frames that can ony be included once if they already are in the current joint frames structure
                const uniqueJointFrameTypes = [Definitions.ElseDefinition, Definitions.FinallyDefinition];
                uniqueJointFrameTypes.forEach((frameDef) => {
                    if(jointTypes.includes(frameDef.type) &&
                        rootJointFrame.jointFrameIds.find((jointFrameId) => state.frameObjects[jointFrameId]?.frameType === frameDef) !== undefined){
                        jointTypes.splice(
                            jointTypes.indexOf(frameDef.type),
                            1
                        );
                    }
                });
                
                //ensure the intermediate following joint frames orders are respected: if > elseif > else and try > except > else > finally
                if(rootJointFrame.jointFrameIds.length > 0) {
                    const isCurrentFrameIntermediateJointFrame = (currentFrame.id === rootJointFrame.id 
                        || rootJointFrame.jointFrameIds.indexOf(currentFrame.id) < rootJointFrame.jointFrameIds.length -1);
                  
                    //Forbid every frame if we are in an intermediate joint, no frame should be added except allowed joint frames
                    if(isCurrentFrameIntermediateJointFrame ) {
                        forbiddenTypes = Object.values(AllFrameTypesIdentifier);
                    }
                  
                    //workout what types can be left for if and try joint frames structures.
                    if(rootJointFrame.frameType === Definitions.IfDefinition){  
                        //"if" joint frames --> only "elif" can be added after an intermediate joint frame                   
                        if(isCurrentFrameIntermediateJointFrame) {
                            jointTypes = jointTypes.filter((type) => type !== Definitions.ElseDefinition.type);
                        }
                    }
                    else if (rootJointFrame.frameType === Definitions.TryDefinition){
                        const hasFinally = (rootJointFrame.jointFrameIds.find((jointFrameId) => state.frameObjects[jointFrameId]?.frameType === Definitions.FinallyDefinition) !== undefined);
                        const hasElse = (rootJointFrame.jointFrameIds.find((jointFrameId) => state.frameObjects[jointFrameId]?.frameType === Definitions.ElseDefinition) !== undefined);
                        const hasExcept = (rootJointFrame.jointFrameIds.find((jointFrameId) => state.frameObjects[jointFrameId]?.frameType === Definitions.ExceptDefinition) !== undefined);

                        //"try" joint frames & "except" joint frames --> we make sure that "try" > "except" (n frames) > "else" and "finally" order is respected
                        if(currentFrame.frameType === Definitions.TryDefinition){
                            if(hasElse && !hasFinally){
                                jointTypes.splice(
                                    jointTypes.indexOf(Definitions.FinallyDefinition.type),
                                    1
                                );
                            }
                            if(hasExcept){
                                uniqueJointFrameTypes.forEach((frameType) => {
                                    if(jointTypes.includes(frameType.type)){
                                        jointTypes.splice(
                                            jointTypes.indexOf(frameType.type),
                                            1
                                        );
                                    }
                                });
                            }
                        }
                        else if( currentFrame.frameType === Definitions.ExceptDefinition){
                            //if this isn't the last expect in the joint frames structure, we need to know what is following it.
                            const indexOfCurrentFrameInJoints = (rootJointFrame.jointFrameIds.indexOf(currentFrame.id));
                            if(indexOfCurrentFrameInJoints < rootJointFrame.jointFrameIds.length -1){
                                //This "except" is not the last joint frame: we check if the following joint frame is "except"
                                //if so, we remove "finally" and "else" from the joint frame types (if still there) to be sure 
                                //none of these type frames can be added immediately after which could result in "...except > finally/else > except..."
                                if(state.frameObjects[rootJointFrame.jointFrameIds[indexOfCurrentFrameInJoints + 1]]?.frameType === Definitions.ExceptDefinition){
                                    uniqueJointFrameTypes.forEach((frameType) => {
                                        if(jointTypes.includes(frameType.type)){
                                            jointTypes.splice(
                                                jointTypes.indexOf(frameType.type),
                                                1
                                            );
                                        }
                                    }); 
                                }
                                //And if this "except" frame is followed by an "else" but no "finally" is present, we remove "finally"
                                //to avoid "... except > finally > else"
                                else if(hasElse && !hasFinally){
                                    jointTypes.splice(
                                        jointTypes.indexOf(Definitions.FinallyDefinition.type),
                                        1
                                    );                                   
                                }
                            }
                        }
                    }
                }

            }
            
            //remove the commands that are forbidden and not defined as joint frames
            const filteredCommands = { ...addFrameCommandsDefs.AddFrameCommandsDefs};
            for (const frameType in addFrameCommandsDefs.AddFrameCommandsDefs) {
                if(forbiddenTypes.includes(addFrameCommandsDefs.AddFrameCommandsDefs[frameType].type.type) 
                    && !jointTypes.includes(addFrameCommandsDefs.AddFrameCommandsDefs[frameType].type.type)){
                    Vue.delete(
                        filteredCommands,
                        frameType
                    );
                }
            }
            return filteredCommands;
        },
        getCurrentFrameToggleFrameLabelCommands: (state) => () => {
            const commands: ToggleFrameLabelCommandDef[] = [];
            state.frameObjects[state.currentFrame.id].frameType.labels.forEach((labelDef) => {
                const command = labelDef.toggleLabelCommand;
                if(command !== undefined){
                    commands.push(command);
                }
            });
            return commands;
        },
        getIsCurrentFrameLabelShown: (state) => (frameId: number, slotIndex: number) => {
            //for an optional label, the corresponding contentDict is always definined with a shown value
            if(state.frameObjects[frameId].frameType.labels[slotIndex]?.optionalLabel === true){
                return (state.frameObjects[frameId].contentDict[slotIndex].shownLabel);
            }

            //not optional label --> it's never hidden so we don't need to check any flag
            return true;
        },
        getAllowChildren: (state) => (frameId: number) => {
            return state.frameObjects[frameId].frameType.allowChildren;
        },

        getIsErroneousSlot: (state) => (frameId: number, slotIndex: number) => {
            return state.frameObjects[frameId].contentDict[slotIndex].error !== "";
        },

        getIsErroneousFrame: (state) => (frameId: number) => {
            return state.frameObjects[frameId].error !== "";
        },
        
        getErrorForSlot: (state) => (frameId: number, slotIndex: number) => {
            return state.frameObjects[frameId].contentDict[slotIndex].error;
        },

        getErrorForFrame: (state) => (frameId: number) => {
            return state.frameObjects[frameId].error;
        },

        getPreCompileErrors: (state) => () => {
            return state.preCompileErrors;
        },

        getPreCompileErrorExists: (state) => (id: string) => {
            return state.preCompileErrors.includes(id);
        },
        getIsMessageBannerOn: (state) => () => {
            return state.currentMessage !== MessageDefinitions.NoMessage;
        },
        getCurrentMessage: (state) => () => {
            return state.currentMessage;
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
                            state.frameObjects[state.frameObjects[payload.frameToDeleteId].jointParentId].jointFrameIds.indexOf(payload.frameToDeleteId),
                            1
                        );
                    }
                    //and finally, delete the frame
                    Vue.delete(
                        state.frameObjects,
                        payload.frameToDeleteId
                    );
                }
            }
        },

        updateFramesOrder(state, data) {
            const eventType = Object.keys(data.event)[0];

            //If we are moving a joint frame the list to be updated is it's parents jointFrameIds list.
            const listToUpdate = (data.event[eventType].element.jointParentId > 0 ) ?
                state.frameObjects[data.eventParentId].jointFrameIds : 
                state.frameObjects[data.eventParentId].childrenIds;

            if (eventType === "added") {
                // Add the id to the parent's childrenId list
                listToUpdate.splice(
                    data.event[eventType].newIndex,
                    0,
                    data.event[eventType].element.id
                );

                if(data.event[eventType].element.jointParentId == 0) {
                    // Set the new parentId to the the added frame
                    Vue.set(
                        state.frameObjects[data.event[eventType].element.id],
                        "parentId",
                        data.eventParentId
                    );
                }
                
            }
            else if (eventType === "moved") {
                // Delete the frameId from the children list 
                listToUpdate.splice(
                    data.event[eventType].oldIndex,
                    1
                );
                // Add it again in the new position
                listToUpdate.splice(
                    data.event[eventType].newIndex,
                    0,
                    data.event[eventType].element.id
                );
            }
            else if (eventType === "removed") {
                // Remove the id from the parent's childrenId list
                listToUpdate.splice(
                    data.event[eventType].oldIndex,
                    1
                );
            }
        },

        // It may be called more than once from the same place and thus requires the editing value
        setEditFlag(state, editing) {
            Vue.set(
                state,
                "isEditing", 
                editing
            );
        },

        setEditableFocus(state, payload: EditableFocusPayload) {
            Vue.set(
                state.frameObjects[payload.frameId].contentDict[payload.slotId],
                "focused",
                payload.focused
            );
        },

        changeCaretWithKeyboard(state, eventType: string) {

            let newId = state.currentFrame.id;
            let newPosition = state.currentFrame.caretPosition;

            //Turn off previous caret
            state.frameObjects[newId].caretVisibility = CaretPosition.none;

            const currentFrame = state.frameObjects[state.currentFrame.id];
            
            // Create the list of children + joints with which the caret will work with
            let childrenAndJointFramesIds = [] as number[];
            const parentId = getParent(state.frameObjects,currentFrame);

            if (eventType === "ArrowDown") {            
                
                childrenAndJointFramesIds = 
                childrenListWithJointFrames(
                    state.frameObjects, 
                    currentFrame.id,
                    state.currentFrame.caretPosition, 
                    "down"
                );

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

                childrenAndJointFramesIds = 
                childrenListWithJointFrames(
                    state.frameObjects, 
                    currentFrame.id, 
                    state.currentFrame.caretPosition,
                    "up"
                );

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

        setCurrentInitCodeValue(state, payload: {frameId: number; slotId: number}){
            state.currentInitCodeValue = state.frameObjects[payload.frameId].contentDict[payload.slotId].code;
        },

        setFrameEditableSlotContent(state, payload: EditableSlotPayload){
            Vue.set(
                state.frameObjects[payload.frameId].contentDict[payload.slotId],
                "code",
                payload.code
            )
        },

        setSlotErroneous(state, payload: {frameId: number; slotIndex: number; error: string}) {
            Vue.set(
                state.frameObjects[payload.frameId].contentDict[payload.slotIndex],
                "error",
                payload.error
            );
        },

        setFrameErroneous(state, payload: {frameId: number; error: string}){
            Vue.set(
                state.frameObjects[payload.frameId],
                "error",
                payload.error
            );
        },

        clearAllErrors(state) {
            Object.keys(state.frameObjects).forEach((id: any) => {
                if(state.frameObjects[id].error !==""){
                    Vue.set(
                        state.frameObjects[id],
                        "error",
                        ""
                    );
                }
                Object.keys(state.frameObjects[id].contentDict).forEach((slot: any) => {
                    Vue.set(
                        state.frameObjects[id].contentDict[slot],
                        "error",
                        ""
                    );
                });
            });  
        },

        addPreCompileErrors(state, id: string ) {
            //if it exists remove it else add it
            if(!state.preCompileErrors.includes(id)) {
                state.preCompileErrors.push(id);
            }
        },

        removePreCompileErrors(state, id: string ) {
            //if it exists remove it else add it
            if(state.preCompileErrors.includes(id)) {
                state.preCompileErrors.splice(state.preCompileErrors.indexOf(id),1);
            }
        },
        
        setMessageBanner(state, messageType: MessageDefinition) {
            Vue.set(
                state,
                "currentMessage",
                messageType
            );
        },

        saveStateChanges(state, payload: {previousState: object; mockCurrentCursorFocus?: EditableFocusPayload}) {
            let backupCurrentFrame = {} as CurrentFrame;
            let backupCurrentFocus = false;
            let backupCurrentFrameVisibility = CaretPosition.none;
            if(payload.mockCurrentCursorFocus !== undefined){
                //before saving the state, we "mock" a change of current state ID to a dummy
                //value so that a difference is raised --> if users change the cursor, before doing undo,
                //the cursor will correctly be at the right location. Same with focused.
                backupCurrentFrame = state.currentFrame;
                backupCurrentFocus = state.frameObjects[payload.mockCurrentCursorFocus.frameId].contentDict[payload.mockCurrentCursorFocus.slotId].focused;
                backupCurrentFrameVisibility = state.frameObjects[state.currentFrame.id].caretVisibility;
                state.frameObjects[payload.mockCurrentCursorFocus.frameId].contentDict[payload.mockCurrentCursorFocus.slotId].focused = false;
                state.currentFrame = {id: 0, caretPosition: CaretPosition.none};
                state.frameObjects[payload.mockCurrentCursorFocus.frameId].caretVisibility = CaretPosition.none;
            }
           

            state.diffToPreviousState.push(getObjectPropertiesDiffferences(state, payload.previousState));
            //don't exceed the maximum of undo steps allowed
            if(state.diffToPreviousState.length > undoMaxSteps) {
                state.diffToPreviousState.splice(
                    0,
                    1
                );
            }
            //we clear the diffToNextState content as we are now starting a new sequence of actions
            state.diffToNextState.splice(
                0,
                state.diffToNextState.length
            );

            if(payload.mockCurrentCursorFocus !== undefined){
                //revert the mock changes in the state
                state.frameObjects[payload.mockCurrentCursorFocus.frameId].contentDict[payload.mockCurrentCursorFocus.slotId].focused = backupCurrentFocus;
                state.currentFrame = backupCurrentFrame;
                state.frameObjects[backupCurrentFrame.id].caretVisibility = backupCurrentFrameVisibility;
            }
        },

        applyStateUndoRedoChanges(state, isUndo: boolean){
            //performing the change if there is any change recoreded in the state
            let changeList = [] as ObjectPropertyDiff[];
            if(isUndo) {
                changeList = state.diffToPreviousState.pop()??[];
            }
            else {
                changeList = state.diffToNextState.pop()??[];
            }

            const stateBeforeChanges = JSON.parse(JSON.stringify(state));
            if(changeList.length > 0){
                //if the value in the changes isn't "null" --> replaced/add, otherwise, delete.
                changeList.forEach((changeEntry: ObjectPropertyDiff) => {
                    //we reconstruct what in the state should be changed based on the difference path
                    const stateParts = changeEntry.propertyPathWithArrayFlag.split(".");
                    const property = stateParts[stateParts.length -1];
                    stateParts.pop();
                    let statePartToChange = state as {[id: string]: any};
                    stateParts.forEach((partWithArrayFlag) => {
                        //intermediate parts have a flag suffix indicating if the part is an array or not
                        const part = partWithArrayFlag.substring(0, partWithArrayFlag.lastIndexOf("_"));
                        const isArrayPart = partWithArrayFlag.substring(partWithArrayFlag.lastIndexOf("_") + 1) === "true";
                        //if a part doesn't exist, we create it with an empty object value
                        if(statePartToChange[part] === undefined){
                            Vue.set(
                                statePartToChange,
                                part,
                                (isArrayPart) ? [] : {}
                            );
                        }
                        statePartToChange = statePartToChange[part];
                    });
                    if(changeEntry.value != null){
                        Vue.set(
                            statePartToChange,
                            property,
                            changeEntry.value
                        );
                    }
                    else{
                        Vue.delete(
                            statePartToChange,
                            property
                        );
                    }
                })
             
                //keep the arrays of changes in sync with undo/redo sequences
                const stateDifferences = getObjectPropertiesDiffferences(state, stateBeforeChanges);
                if(isUndo){
                    state.diffToNextState.push(stateDifferences);
                }
                else{
                    state.diffToPreviousState.push(stateDifferences);        
                }
            }
        },
    },

    actions: {
        updateFramesOrder({ state, commit }, payload) {
            const stateBeforeChanges = JSON.parse(JSON.stringify(state));
            
            commit(
                "updateFramesOrder",
                payload
            );

            //save state changes
            commit(
                "saveStateChanges",
                {                   
                    previousState: stateBeforeChanges,
                }
            );
        },

        setFrameEditableSlotContent({state, commit}, payload: EditableSlotPayload) {
            //This action is called EVERY time a unitary change is made on the editable slot.
            //We save changes at the entire slot level: therefore, we need to remove the last
            //previous state to replace it with the difference between the state even before and now;            
            let stateBeforeChanges = {};
            if(!payload.isFirstChange){
                state.diffToPreviousState.pop();
                state.frameObjects[payload.frameId].contentDict[payload.slotId].code = payload.initCode;  
            }

            //save the previous state
            stateBeforeChanges = JSON.parse(JSON.stringify(state));

            commit(
                "setFrameEditableSlotContent",
                payload
            );

            //save state changes
            commit(
                "saveStateChanges",
                {
                    previousState: stateBeforeChanges,
                    mockCurrentCursorFocus: {
                        frameId: payload.frameId,
                        slotId: payload.slotId,
                        focused: true,
                    },
                }
            );
        },

        updateErrorsOnSlotValidation({state, commit, getters}, payload: EditableSlotPayload) {            
            commit(
                "setEditFlag",
                false
            );

            if(state.frameObjects[payload.frameId]){
                commit(
                    "setEditableFocus",
                    {
                        frameId: payload.frameId,
                        slotId: payload.slotId,
                        focused: false,
                    }
                );

                commit(
                    "setCurrentInitCodeValue",
                    {
                        frameId: payload.frameId,
                        slotId: payload.slotId,
                    }
                )

                const optionalSlot = state.frameObjects[payload.frameId].frameType.labels[payload.slotId].optionalSlot ?? true;
                const errorMessage = getters.getErrorForSlot(payload.frameId,payload.slotId);
                if(payload.code !== "") {
                    //if the user entered text on previously left blank slot, remove the error
                    if(!optionalSlot && errorMessage === "Input slot cannot be empty") {
                        commit(
                            "setSlotErroneous", 
                            {
                                frameId: payload.frameId, 
                                slotIndex: payload.slotId, 
                                error: "",
                            }
                        );
                        commit("removePreCompileErrors", getEditableSlotId(payload.frameId, payload.slotId));
                    }
                }
                else if(!optionalSlot){
                    commit(
                        "setSlotErroneous", 
                        {
                            frameId: payload.frameId, 
                            slotIndex: payload.slotId,  
                            error: "Input slot cannot be empty",
                        }
                    );
                    commit("addPreCompileErrors", getEditableSlotId(payload.frameId, payload.slotId));
                }
            }
        },

        setFocusEditableSlot({commit}, payload: {frameId: number; slotId: number; caretPosition: CaretPosition}){            
            commit(
                "setCurrentInitCodeValue",
                {
                    frameId: payload.frameId,
                    slotId: payload.slotId,
                }
            )
            
            commit(
                "setEditFlag",
                true
            );

            //First set the curretFrame to this frame
            commit(
                "setCurrentFrame",
                {
                    id: payload.frameId,
                    caretPosition: payload.caretPosition,
                }
            );
            //Then store which editable has the focus
            commit(
                "setEditableFocus",
                {
                    frameId: payload.frameId,
                    slotId: payload.slotId,
                    focused: true,
                }
            );   
        },

        undoRedo({ state, commit }, isUndo: boolean) {
            //check if the undo/redo list is empty BEFORE doing any action
            const isEmptyList = (isUndo) ? state.diffToPreviousState.length == 0 : state.diffToNextState.length == 0;
            
            if(isEmptyList){
                //no undo or redo can performed: inform the user on a temporary message
                commit(
                    "setMessageBanner",
                    (isUndo) ? MessageDefinitions.NoUndo : MessageDefinitions.NoRedo
                );

                //don't leave the message for ever
                setTimeout(()=>commit(
                    "setMessageBanner",
                    MessageDefinitions.NoMessage
                ), 2000);
            }
            else{
                //a undo/redo can be performed: do the action
                commit(
                    "applyStateUndoRedoChanges",
                    isUndo 
                );
            }
        },

        changeCaretPosition({ commit }, key) {
            commit(
                "changeCaretWithKeyboard",
                key
            );
        },

        addFrameWithCommand({ commit, state, getters, dispatch }, payload: FramesDefinitions) {
            const stateBeforeChanges = JSON.parse(JSON.stringify(state));

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
                contentDict:
                    //find each editable slot and create an empty & unfocused entry for it
                    //optional labels are not visible by default, not optional labels are visible by default
                    payload.labels.filter((el)=> el.slot).reduce(
                        (acc, cur, idx) => ({ 
                            ...acc, 
                            [idx]: {code: "", focused: false, error: "", shownLabel:(!cur?.optionalLabel ?? true)},
                        }),
                        {}
                    ),
                error: "",
            };

            commit(
                "addFrameObject",
                newFrame
            );
            
            //"move" the caret along
            dispatch(
                "leftRightKey",
                "ArrowRight"                
            ).then(
                () => 
                    //save state changes
                    commit(
                        "saveStateChanges",
                        {                 
                            previousState: stateBeforeChanges,
                        }
                    )
            );
        },

        deleteCurrentFrame({commit, state}, payload: string){
            const stateBeforeChanges = JSON.parse(JSON.stringify(state));
            
            //if delete is pressed
            //  case cursor is body: cursor stay here, the first child (if exits) is deleted (*)
            //  case cursor is below: cursor stay here, the next sibling (if exits) is deleted (*)
            //if backspace is pressed
            //  case current frame is Container --> do nothing, a container cannot be deleted
            //  case cursor is body: cursor needs to move one level up, and the current frame's children + all siblings replace its parent
            //  case cursor is below: cursor needs to move to bottom of previous sibling (or body of parent if first child) and the current frame (*) is deleted
            //(*) with all sub levels children

            let showDeleteMessage = false;

            const currentFrame = state.frameObjects[state.currentFrame.id];

            // Create the list of children + joints with which the caret will work with
            const parentId = getParent(state.frameObjects,currentFrame);

            const listOfSiblings = 
            childrenListWithJointFrames(
                state.frameObjects, 
                currentFrame.id, 
                state.currentFrame.caretPosition,
                "down"
            );

            const indexOfCurrentFrame = listOfSiblings.indexOf(currentFrame.id);
            let frameToDeleteId = 0;
            let deleteChildren = false;

            if(payload === "Delete"){
                if(indexOfCurrentFrame + 1 < listOfSiblings.length){
                    frameToDeleteId = listOfSiblings[indexOfCurrentFrame + 1];
                } 

            }
            else {
                if (currentFrame.id > 0) {
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
                    frameToDeleteId = currentFrame.id;
                }
            }

            //before actually deleting the frame(s), we check if the user should be notified of a large deletion
            if(countRecursiveChildren(
                state.frameObjects,
                frameToDeleteId,
                3
            ) >= 3){
                showDeleteMessage = true;
            }

            //Delete the frame if a frame to delete has been found
            if(frameToDeleteId > 0){
                commit(
                    "deleteFrame",
                    {key:payload,frameToDeleteId: frameToDeleteId,  deleteChildren: deleteChildren}
                );
            }  
            
            //save state changes
            commit(
                "saveStateChanges",
                {
                    previousState: stateBeforeChanges,
                }
            );

            //we show the message of large deletion after saving state changes as this is not to be notified.
            if(showDeleteMessage){
                commit(
                    "setMessageBanner",
                    MessageDefinitions.LargeDeletion
                );

                //don't leave the message for ever
                setTimeout(()=>commit(
                    "setMessageBanner",
                    MessageDefinitions.NoMessage
                ), 7000);
            }
        },

        toggleCaret({ commit }, newCurrent) {
            commit(
                "setCurrentFrame",
                newCurrent
            );
        },

        leftRightKey({commit, state} , key) {
            let editFlag = state.isEditing;
            
            if(editFlag) {
                const currentEditableSlots = Object.entries(state.frameObjects[state.currentFrame.id].contentDict).filter((slot) => slot[1].shownLabel);
                const posCurSlot = currentEditableSlots.findIndex((slot) => slot[1].focused);
                const change = (key === "ArrowRight") ? 1: -1;

                // if we won't exceed the editable slots
                if( posCurSlot + change >= 0 && posCurSlot + change <= currentEditableSlots.length - 1 ){
                    commit(
                        "setEditableFocus",
                        {
                            frameId: state.currentFrame.id,
                            slotId: currentEditableSlots[posCurSlot][0],
                            focused: false,
                        }
                    );
                    commit(
                        "setEditableFocus",
                        {
                            frameId: state.currentFrame.id,
                            slotId: currentEditableSlots[posCurSlot + change][0],
                            focused: true,
                        }
                    );
                }
                // Else we are at the edge and we need to change move caret
                else {

                    commit(
                        "setEditFlag",
                        false
                    );

                    // The caret is set to Body, so with a right click we just show it. With a left click, we move up
                    if(key === "ArrowLeft") {
                        commit(
                            "changeCaretWithKeyboard",
                            "ArrowUp"
                        );
                    }
                }
            }
            else { 
                const currentFrame = state.frameObjects[state.currentFrame.id];
                // By nextFrame we mean either the next or the previous frame, depending on the direction
                let nextFrame = 0;
                //  direction = up | down
                let directionDown = true;

                if(key === "ArrowRight") {
                    const parent = state.frameObjects[currentFrame.parentId];
                    //In the case we are in the body and there are no children OR caret bellow and last in parent, move the caret
                    if ((state.currentFrame.caretPosition === CaretPosition.body && !(currentFrame.childrenIds.length >0)) || (state.currentFrame.caretPosition === CaretPosition.below && parent.childrenIds.indexOf(currentFrame.id) === parent.childrenIds.length-1)) {
                        commit(
                            "changeCaretWithKeyboard",
                            "ArrowDown"
                        );
                        return;
                    }
                    else {
                        const framesIdList = 
                        childrenListWithJointFrames(
                            state.frameObjects,
                            currentFrame.id,
                            state.currentFrame.caretPosition,
                            "down"
                        );
                        // avoid getting an out of bound exception
                        nextFrame = (framesIdList.indexOf(currentFrame.id)+1 < framesIdList.length) ? framesIdList[framesIdList.indexOf(currentFrame.id)+1] : framesIdList[framesIdList.length - 1];   
                    }
                }
                else {
                    // If bellow a frame that does not allow children OR in the body, we check for this frame's slots
                    if((state.currentFrame.caretPosition === CaretPosition.below && !state.frameObjects[currentFrame.id].frameType.allowChildren) || state.currentFrame.caretPosition === CaretPosition.body)  {
                        nextFrame = currentFrame.id;
                    }
                    // in the case where you are bellow and you are simply going in it body
                    else if (state.currentFrame.caretPosition == CaretPosition.below) {
                        commit(
                            "changeCaretWithKeyboard",
                            "ArrowUp"
                        );
                        return;
                    }
                    else {
                        const framesIdList = 
                        childrenListWithJointFrames(
                            state.frameObjects,
                            currentFrame.id,
                            state.currentFrame.caretPosition,
                            "up"
                        );
                        // avoid getting an out of bound exception
                        nextFrame = (framesIdList.indexOf(currentFrame.id) > 0) ? framesIdList[framesIdList.indexOf(currentFrame.id)-1] : framesIdList[0];
                    }
                    directionDown = false;
                }

                //If there are editable slots, go in the first available slot
                const editableSlotsIndexes: number[] = [];
                Object.entries(state.frameObjects[nextFrame].contentDict).forEach((entry) => {
                    if(entry[1].shownLabel){
                        editableSlotsIndexes.push(parseInt(entry[0]));
                    }
                });

                if(editableSlotsIndexes.length > 0) {

                    editFlag = true;

                    commit(
                        "setEditableFocus",
                        {
                            frameId: state.frameObjects[nextFrame].id,
                            slotId: (directionDown)? editableSlotsIndexes[0] : editableSlotsIndexes[editableSlotsIndexes.length -1],
                            focused: true,
                        }
                    );
                }
                else {
                    //In the case of no editable slots, just move the caret
                    commit(
                        "changeCaretWithKeyboard",
                        (directionDown)? "ArrowDown" : "ArrowUp"
                    );
                }

                commit(
                    "setEditFlag",
                    editFlag
                );
            }
        },
        
        //Toggle the current frame label that matches the type specified in the payload.
        toggleFrameLabel({commit, state}, commandType: string) {
            const stateBeforeChanges = JSON.parse(JSON.stringify(state));

            //Get the FrameLabel (index) matching the type
            const frameLabeToTogglelIndex = state.frameObjects[state.currentFrame.id].frameType.labels.findIndex((frameLabel) => frameLabel?.toggleLabelCommand?.type === commandType);
            
            const changeShowLabelTo = !state.frameObjects[state.currentFrame.id].contentDict[frameLabeToTogglelIndex].shownLabel;
            //toggle the "shownLabel" property of in the contentDict for that label
            Vue.set(
                state.frameObjects[state.currentFrame.id].contentDict[frameLabeToTogglelIndex],
                "shownLabel",
                changeShowLabelTo
            );

            //update the precompiled errors based on the visibility of the label (if the label isn't shown, no error should be raised)
            const slotId = getEditableSlotId(state.currentFrame.id, frameLabeToTogglelIndex);
            if(changeShowLabelTo){
                //we show the label: add the slot in precompiled error if the slot is empty
                if(state.frameObjects[state.currentFrame.id].contentDict[frameLabeToTogglelIndex].code.trim().length == 0){
                    commit(
                        "addPreCompileErrors",
                        slotId
                    );
                }
            }
            else{
                //we hide the label: remove the slot in precompiled error
                commit(
                    "removePreCompileErrors",
                    slotId
                );
            }

            //save state changes
            commit(
                "saveStateChanges",
                {
                    previousState: stateBeforeChanges,
                }
            );
        },        
        
        setMessageBanner({commit}, message: MessageDefinition){
            switch (message) {    
            case MessageDefinitions.NoMessage:
                commit("setMessageBanner", MessageDefinitions.NoMessage);
                break;
            case MessageDefinitions.DownloadHex:
                commit("setMessageBanner", MessageDefinitions.DownloadHex);
                break;
            case MessageDefinitions.LargeDeletion:
                commit("setMessageBanner", MessageDefinitions.LargeDeletion);
                break;
            case MessageDefinitions.NoUndo:
                commit("setMessageBanner", MessageDefinitions.NoUndo);
                break;
            case MessageDefinitions.NoRedo:
                commit("setMessageBanner", MessageDefinitions.NoRedo);
                break;  
            default:
                break;
            }
        },
    },
    modules: {},
});

