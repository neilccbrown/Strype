import { FrameObject, CaretPosition, EditorFrameObjects, ChangeFramePropInfos, CurrentFrame, NavigationPosition, StrypePlatform, Definitions, FrameContainersDefinitions, VarAssignDefinition, FrameSlotContent } from "@/types/types";
import Vue from "vue";
import { useStore } from "@/store/store"
import i18n from "@/i18n"
import { getSHA1HashForObject } from "@/helpers/common";
import { getEditableSlotUIID } from "./editor";
import Parser from "@/parser/parser";

export const removeFrameInFrameList = (listOfFrames: EditorFrameObjects, frameId: number) => {
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

// Returns the parentId of the frame or if it is a joint frame returns the parentId of the JointParent.
export const getParent = (listOfFrames: EditorFrameObjects, currentFrame: FrameObject) => {
    let parentId = 0;
    if(currentFrame.id !== 0){
        parentId = (currentFrame.jointParentId > 0) ? listOfFrames[currentFrame.jointParentId].parentId : currentFrame.parentId;
    }
    return parentId;
};

// Checks if it is a joint Frame or not and returns JointParent OR Parent respectively
export const getParentOrJointParent = (listOfFrames: EditorFrameObjects, frameId: number)  => {
    const isJointFrame = listOfFrames[frameId].frameType.isJointFrame;
    return (isJointFrame)? 
        listOfFrames[frameId].jointParentId:
        listOfFrames[frameId].parentId;
};

const isLastInParent = (listOfFrames: EditorFrameObjects, frameId: number) => {
    const frame = listOfFrames[frameId];
    const parent = listOfFrames[getParentOrJointParent(listOfFrames,frameId)];

    const siblingList = (frame.jointParentId>0)? parent.jointFrameIds : parent.childrenIds;

    return (siblingList.indexOf(frameId) === siblingList.length-1);
};

//Returns a list with all the previous frames (of the same level) and next frames (including first level children) used for navigating the caret
export const childrenListWithJointFrames = (listOfFrames: EditorFrameObjects, currentFrameId: number, caretPosition: CaretPosition, direction: string) => {
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

export const countRecursiveChildren = function(listOfFrames: EditorFrameObjects, frameId: number, countLimit?: number): number {
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

export const cloneFrameAndChildren = function(listOfFrames: EditorFrameObjects, currentFrameId: number, parentId: number,  nextAvailableId: { id: number}, framesToReturn: EditorFrameObjects): void {
    // This method recursively clones a frame and all its children.
    // `nextAvailableId` is used to store the id that each cloned frame will take. It is an Object in order to
    // enable Pass-By-Reference whenever it is increased.
    
    // first copy the current frame
    // You can also use Lodash's "_.cloneDeep" in case JSON.parse(JSON.stringify()) has a problem on Mac
    const frame: FrameObject = JSON.parse(JSON.stringify(listOfFrames[currentFrameId])) as FrameObject;

    frame.id = nextAvailableId.id;
    frame.caretVisibility = CaretPosition.none;

    // Change the parent as well to the frame who called this instance of the method.
    if (frame.parentId !== 0) {
        frame.parentId = parentId;
    }
    else {
        frame.jointParentId  = parentId;
    }
    
    // Add the new frame to the list
    framesToReturn[frame.id] = frame;

    //Look at the subChildren first and then at the joint frames
    frame.childrenIds.forEach((childId: number, index: number) => {
        frame.childrenIds[index] = ++nextAvailableId.id;
        cloneFrameAndChildren(
            listOfFrames, 
            childId,
            frame.id,
            nextAvailableId, 
            framesToReturn
        );
    });

    //Look at the subChildren first and then at the joint frames
    frame.jointFrameIds.forEach((childId: number, index: number) => {
        frame.jointFrameIds[index] = ++nextAvailableId.id;
        cloneFrameAndChildren(
            listOfFrames, 
            childId,
            frame.id,
            nextAvailableId,
            framesToReturn
        );
    });
    
}

//Search all children/joint frames ids for a specific frame
export const getAllChildrenAndJointFramesIds = function(listOfFrames: EditorFrameObjects, frameId: number): number[]  {
    const childrenJointsIdsList = [] as number[];

    //get the children frames ids
    listOfFrames[frameId].childrenIds.forEach((childId: number) => {
        childrenJointsIdsList.push(childId);
        childrenJointsIdsList.push(...getAllChildrenAndJointFramesIds(listOfFrames, childId));
    });

    //get the joint frames ids
    listOfFrames[frameId].jointFrameIds.forEach((jointId: number) => {
        childrenJointsIdsList.push(jointId);
        childrenJointsIdsList.push(...getAllChildrenAndJointFramesIds(listOfFrames, jointId));
    });

    return childrenJointsIdsList;
}

export const checkStateDataIntegrity = function(obj: {[id: string]: any}): boolean {
    //check the checksum and version properties are present and checksum is as expected, if not, the document doesn't have integrity
    if(obj["checksum"] === undefined || obj["version"] === undefined){
        return false;
    }
    else{
        //take the checkpoints out the object to check the checksum
        const foundChecksum = obj["checksum"];
        delete obj["checksum"];
        const foundVersion = obj["version"]
        delete obj["version"];
        let foundPlatform = undefined
        if(obj["platform"]){
            foundPlatform = obj["platform"];
            delete obj["platform"];
        }
        //get the checksum from the object
        const expectedChecksum = getSHA1HashForObject(obj);
        //add the read version and platform as they are needed later
        obj["version"] = foundVersion;
        obj["platform"] = foundPlatform ?? StrypePlatform.standard;
        //and return if the checksum was right
        return foundChecksum === expectedChecksum;        
    }
}

export const restoreSavedStateFrameTypes = function(state:{[id: string]: any}): boolean {
    if(state["frameObjects"] == undefined){
        return false;
    }
    
    let success = true;
    const frameIds: string[] = Object.keys(state["frameObjects"]);
    const allFramesTypes = {...Definitions, ...FrameContainersDefinitions};
    // We iterate through all the given frame type names to find the matching object. If at one iteration we cannot find the corresponding object
    // (a case where we make a mistake in the code and change the frame type name recklessly !) then we don't need to continue iterating the given
    // state frame names. The forEach() methohd won't allow us to break, so we use every() which retunrs false if the loop shall be broken.
    frameIds.every((frameId) => {
        const frameTypeValue = (state["frameObjects"][frameId].frameType);
        if(typeof frameTypeValue === "string") {
            // The frame type in the state was saved by the type name (string): we get the equivalent frame type object
            // in the unlikely event we can't find the object we stop the restoration and notify failure
            const correspondingFrameObj = Object.values(allFramesTypes).find((frameTypeDef) => frameTypeDef.type == frameTypeValue);
            if(correspondingFrameObj  !== undefined) {
                state["frameObjects"][frameId].frameType = correspondingFrameObj;
                return true;
            }
            success = false;
            return false;
        }
    });
    return success;
}

// Finds out what is the root frame Id of a "block" of disabled frames
export const getDisabledBlockRootFrameId = function(listOfFrames: EditorFrameObjects, frameId: number): number {
    const frameParentId = (listOfFrames[frameId].jointParentId > 0) ? listOfFrames[frameId].jointParentId : listOfFrames[frameId].parentId;
    if(listOfFrames[frameParentId].isDisabled){
        return getDisabledBlockRootFrameId(listOfFrames, frameParentId);
    }
    else{
        return frameId;
    }
}

export const checkDisabledStatusOfMovingFrame = function(listOfFrames: EditorFrameObjects, frameSrcId: number, destContainerFrameId: number): ChangeFramePropInfos {
    // Change the disable property to destination parent state if the source's parent and destination's parent are different
    const isSrcParentDisabled = (listOfFrames[frameSrcId].jointParentId > 0)
        ? listOfFrames[listOfFrames[frameSrcId].jointParentId].isDisabled
        : listOfFrames[listOfFrames[frameSrcId].parentId].isDisabled;

    const isDestParentDisabled = listOfFrames[destContainerFrameId].isDisabled;
    
    if(isSrcParentDisabled === isDestParentDisabled){
        // Nothing to change
        return {changeDisableProp: false, newBoolPropVal: false};
    }

    // The source need to be changed to the destination's parent 
    return {changeDisableProp: true, newBoolPropVal: isDestParentDisabled};
}

export const getLastSibling= function (listOfFrames: EditorFrameObjects, frameId: number): number {
    
    const isJointFrame = listOfFrames[frameId].frameType.isJointFrame;
    const parentId = (isJointFrame)? listOfFrames[frameId].jointParentId : listOfFrames[frameId].parentId;
    const parentsChildren = (isJointFrame)? listOfFrames[parentId].jointFrameIds : listOfFrames[parentId].childrenIds;

    return parentsChildren[parentsChildren.length-1];
    
};

export const getAllSiblings= function (listOfFrames: EditorFrameObjects, frameId: number): number[] {
    const isJointFrame = listOfFrames[frameId].frameType.isJointFrame;
    const parentId = (isJointFrame)? listOfFrames[frameId].jointParentId : listOfFrames[frameId].parentId;

    return (isJointFrame)? listOfFrames[parentId].jointFrameIds : listOfFrames[parentId].childrenIds;    
};

export const getNextSibling= function (listOfFrames: EditorFrameObjects, frameId: number): number {
    const isJointFrame = listOfFrames[frameId].frameType.isJointFrame;
    const parentId = (isJointFrame)? listOfFrames[frameId].jointParentId : listOfFrames[frameId].parentId;

    const list = (isJointFrame)? listOfFrames[parentId].jointFrameIds : listOfFrames[parentId].childrenIds;    

    return list[list.indexOf(frameId)+1]??-100;
};

export const getAllSiblingsAndJointParent= function (listOfFrames: EditorFrameObjects, frameId: number): number[] {
    const isJointFrame = listOfFrames[frameId].frameType.isJointFrame;
    const parentId = (isJointFrame)? listOfFrames[frameId].jointParentId : listOfFrames[frameId].parentId;

    return (isJointFrame)? [listOfFrames[frameId].jointParentId, ...listOfFrames[parentId].jointFrameIds] : listOfFrames[parentId].childrenIds;    
};

export const frameForSelection = (listOfFrames: EditorFrameObjects, currentFrame: CurrentFrame, direction: string, selectedFrames: number[]) => {
    
    // we first check the cases that are 100% sure there is nothing to do about them
    // i.e.  we are in the body and we are either moving up or there are no children.
    if( currentFrame.caretPosition === CaretPosition.body && (direction === "up" || listOfFrames[currentFrame.id].childrenIds.length === 0) ){
        return null;
    }

    const parentId = (currentFrame.caretPosition === CaretPosition.body)? 
        currentFrame.id : 
        getParentOrJointParent(listOfFrames, currentFrame.id);

    const parent = listOfFrames[parentId];
    const isCurrentJoint = listOfFrames[currentFrame.id].jointParentId > 0;

    // If there are no joint frames in the parent, even if we are talking about a frame that can have joint frames (i.e. a single if),
    // then the list is the same level children.
    // The complex occasion is the last jointFrame where we need to get the children of its parent's parent...
    // Even more complex is the occasion that the last jointFrame is already selected, hence we need to de-select it, hence return it.
    let actualCurrentFrameId = currentFrame.id;
    let sameLevelFrameIds = parent.childrenIds;
    if (isCurrentJoint && parent.jointFrameIds.length > 0) {
        if(isLastInParent(listOfFrames, currentFrame.id) && !selectedFrames.includes(currentFrame.id)) {
            sameLevelFrameIds = listOfFrames[parent.parentId].childrenIds;
            actualCurrentFrameId = parent.id;
        }
        else {
            sameLevelFrameIds = parent.jointFrameIds;
        }
    }
    // In the case that we are below a parent of joint frames the list is the joint children
    else if(currentFrame.caretPosition === CaretPosition.below && direction !== "up" && listOfFrames[currentFrame.id].jointFrameIds.length >0) {
        sameLevelFrameIds = listOfFrames[currentFrame.id].jointFrameIds;
    }

    const indexDelta = (direction === "up")? -1 : 1;

    // If the caret is in the body position the index is 0; 
    // Being below and going up it's just the index of the actualCurrentFrameId
    // Being below and going down we need to get the next
    // ((indexDelta+1)&&1) returns +1 only if we are going down (indexDelta==1)
    const indexOfCurrentInParent = (currentFrame.caretPosition === CaretPosition.body)? 0: sameLevelFrameIds.indexOf(actualCurrentFrameId)+Math.max(indexDelta, 0);

    // frameToBeSelected is the frame that will be selected AND can be different than the current frame (e.g. caret==below and direction down). 
    // We select a frame other than the current frame if we are moving down and we are not on position 0;
    // Only for caret==body or when going UP, we select this frame.
    const frameToBeSelected = sameLevelFrameIds[indexOfCurrentInParent];


    // If we are about to select non Joint frame and in the current selection there are Joint frames then we prevent it
    const hasJointChildren = selectedFrames.find((id) => listOfFrames[id].jointParentId > 0) ?? 0;
    if( hasJointChildren > 0 && listOfFrames[frameToBeSelected].jointParentId === 0) {
        return null;
    }

    // Create the list of children + joints with which the caret will work with
    const allSameLevelFramesAndJointIds = 
    childrenListWithJointFrames(
        listOfFrames, 
        frameToBeSelected,
        currentFrame.caretPosition, 
        direction
    );

    // If what we're trying to access doesn't exist return null
    if( frameToBeSelected !== undefined ) {
        let indexOfSelectedInWiderList = allSameLevelFramesAndJointIds.indexOf(frameToBeSelected);

        const numberOfJointChildrenOfSelected = listOfFrames[frameToBeSelected].jointFrameIds.length;

        if( numberOfJointChildrenOfSelected > 0 && direction === "down") {
            // indexDelta gives us the + or - for the direction of how many jointChildren we need to skip.
            indexOfSelectedInWiderList += (indexDelta * numberOfJointChildrenOfSelected);
        }
        else if (direction === "up") {
            indexOfSelectedInWiderList += indexDelta;
        }

        const indexOfNewCaret = 
            ((indexOfSelectedInWiderList === allSameLevelFramesAndJointIds.length-1)? 
                allSameLevelFramesAndJointIds.length-1 : 
                indexOfSelectedInWiderList );

        const newCurrentFrame = (indexOfNewCaret === -1)? 
            {id: parent.id , caretPosition: CaretPosition.body} :
            {id: allSameLevelFramesAndJointIds[indexOfNewCaret], caretPosition: CaretPosition.below};
        
        return {frameForSelection: frameToBeSelected, newCurrentFrame: newCurrentFrame};

    }
    else {
        return null;
    }
    
};


export const generateFrameMap = function(listOfFrames: EditorFrameObjects, frameMap: number[]): void {
    frameMap.splice(
        0,
        frameMap.length,
        ...[-1,...getAllChildrenAndJointFramesIds(listOfFrames,-1),-2,...getAllChildrenAndJointFramesIds(listOfFrames,-2),-3,...getAllChildrenAndJointFramesIds(listOfFrames,-3)]
    );
};



export const checkIfLastJointChild = function (listOfFrames: EditorFrameObjects, frameId: number): boolean {
    const parent: FrameObject = listOfFrames[listOfFrames[frameId].jointParentId];
    return [...parent.jointFrameIds].pop() === frameId;
};


export const checkIfFirstChild = function (listOfFrames: EditorFrameObjects, frameId: number): boolean {
    const parent: FrameObject = listOfFrames[listOfFrames[frameId].parentId||listOfFrames[frameId].jointParentId];
    return ([...parent.childrenIds].shift()??[...parent.jointFrameIds].shift()) === frameId;
};

// This method checks if there is a compound (parent+child) frame above the selected frame and returns the 
// the correct previous e.g. if(1): "2" elif(3): "4"  and we are after "4" and going up, we should end up below "3" and not "4"!
export const getPreviousIdForCaretBelow = function (listOfFrames: EditorFrameObjects, currentFrame: number): number {

    // selecting means selecting a same level frame 
    const siblings = getAllSiblings(listOfFrames,currentFrame);

    // if there is a previous sibling then get it, otherwise get the parent
    const previous = siblings[siblings.indexOf(currentFrame)-1]??listOfFrames[currentFrame].parentId;

    // in case the sibling has joint children, going up means going under it's last child
    return [...listOfFrames[previous].jointFrameIds].pop()??previous;
    
};

// This method returns a boolean value indicating whether the caret (current position) is contained
// within one of the frame types specified in "containerTypes"
export const isContainedInFrame = function (listOfFrames: EditorFrameObjects, currFrameId: number, caretPosition: CaretPosition, containerTypes: string[]): boolean {
    let isAncestorTypeFound = false;
    let frameToCheckId = (caretPosition === CaretPosition.body) ? 
        currFrameId:
        getParent(listOfFrames, listOfFrames[currFrameId]);
    
    while(frameToCheckId != 0 && !isAncestorTypeFound){
        isAncestorTypeFound = containerTypes.includes(listOfFrames[frameToCheckId].frameType.type);
        frameToCheckId = getParent(listOfFrames, listOfFrames[frameToCheckId]);
    }

    return isAncestorTypeFound;
};

// Instead of calculating the available caret positions through the store (where the frameObjects object is hard to use for this)
// We get the available caret positions through the DOM, where they are all present.
export const getAvailableNavigationPositions = function(): NavigationPosition[] {
    // We start by getting from the DOM all the available caret and editable slot positions
    const allCaretDOMpositions = document.getElementsByClassName("navigationPosition");
    // We create a list that hold objects of {id,caretPosition,slotNumber) for each available navigation positions
    // and discard the locations that correspond to the editable slots of disable frames
    return Object.values(allCaretDOMpositions).map((e)=> {
        return {
            id: (parseInt(e.id.replace("caret_","").replace("caretBelow_","").replace("caretBody_",""))
            ||
            parseInt(e.id.replace("input_frameId_","").replace("_slot"+/_*-*\d+/g,"").replace("caretBody_",""))), 
            caretPosition: (e.id.startsWith("caret"))? e.id.replace("caret_","").replace(/_*-*\d/g,"") : false,
            slotNumber: (e.id.startsWith("input"))? parseInt(e.id.replace("input_frameId_","").replace(/\d+/,"").replace("_slot_","")) : false,
        }
    }).filter((navigationPosition) => !(navigationPosition.caretPosition === false && useStore().frameObjects[navigationPosition.id].isDisabled)) as NavigationPosition[];
};

export const checkCodeErrors = (frameId: number, slotId: number, code: string): void => {
    // This method for checking errors is called when a frame slot has been edited (and lost focus), or during undo/redo changes. As we don't have a way to
    // find which errors are from TigerPython or precompiled errors, and that we wouldn't know what specific error to remove anyway,
    // we clear the errors completely for that frame/slot before we check the errors again for it.
    const currentErrorMessage = (slotId > -1) ? useStore().frameObjects[frameId].contentDict[slotId].error : undefined ;
    useStore().setSlotErroneous(
        {
            frameId: frameId, 
            slotIndex: slotId, 
            error: "",
        }
    );
    Vue.delete(useStore().frameObjects[frameId].contentDict[slotId],"errorTitle");

    /* IFTRUE_isPurePython */
    // One particular case: if the error is a runtime error, other editable slots of that frame will also show the error,
    // therefore, we invalidate the errors for all these other slots.
    Object.entries(useStore().frameObjects[frameId].contentDict).forEach((contentDictEntry) => {
        if(parseInt(contentDictEntry[0]) != slotId && contentDictEntry[1].errorTitle?.includes(i18n.t("console.runtimeErrorEditableSlotHeader") as string)) {
            useStore().setSlotErroneous(
                {
                    frameId: frameId, 
                    slotIndex: parseInt(contentDictEntry[0]), 
                    error: "",
                }
            );
            Vue.delete(useStore().frameObjects[frameId].contentDict[parseInt(contentDictEntry[0])],"errorTitle");
        }        
    });
    /* FITRUE_isPurePython */

    const frameObject = useStore().frameObjects[frameId];

    const optionalSlot = frameObject.frameType.labels[slotId].optionalSlot ?? true;
    const errorMessage = useStore().getErrorForSlot(frameId,slotId);
    if(code !== "") {
        //if the user entered text in a slot that was blank before the change, remove the error
        if(!optionalSlot && (errorMessage === i18n.t("errorMessage.emptyEditableSlot")
            || currentErrorMessage === i18n.t("errorMessage.emptyEditableSlot"))) {
            useStore().removePreCompileErrors(getEditableSlotUIID(frameId, slotId));                
        }
    }
    else if(!optionalSlot){
        useStore().setSlotErroneous( 
            {
                frameId: frameId, 
                slotIndex: slotId,  
                error: i18n.t("errorMessage.emptyEditableSlot") as string,
            }
        );
        useStore().addPreCompileErrors(getEditableSlotUIID(frameId, slotId));
    }
                
    // We check Python error (with TigerPython) for this portion of code only.
    // NOTE: at this stage, the TigerPython errors for this portion of code HAVE BEEN cleared on the SLOT only.
    // If we are on a joint element, we check the whole joint siblings from root to last joint, otherwise, the single current line suffice.
    const isJoinFrame = (frameObject.jointParentId > 0);
    //we need to find out what is the next frame to provide a stop value
    const availablePositions = getAvailableNavigationPositions();
    const listOfCaretPositions = availablePositions.filter(((e)=> e.slotNumber === false));
    const caretPosition = (frameObject.frameType.allowChildren) ? CaretPosition.body : CaretPosition.below;
    const currentCaretIndex = listOfCaretPositions.findIndex((e) => e.id===frameId && e.caretPosition === caretPosition);
    const nextCaretId =  (isJoinFrame) 
        ?  listOfCaretPositions[listOfCaretPositions.findIndex((e) => e.id===frameObject.jointParentId && e.caretPosition === CaretPosition.below) + 1]?.id??-100
        : (listOfCaretPositions[currentCaretIndex + ((caretPosition == CaretPosition.body && frameObject.childrenIds.length == 0) ? 2 : 1)]?.id??-100);
    const startFrameId = (isJoinFrame) ? frameObject.jointParentId : frameId;
    const parser = new Parser(true);
    const portionOutput = parser.parse(startFrameId, nextCaretId);
    parser.getErrorsFormatted(portionOutput);
};

export function transformFuncCallFrameToVarAssignFrame(frameId: number, code: string): void{
    // We transform the function call frame to a var assign frame by adapting the existing frame object representing a function call 
    const codeVarAssignRegexMatch = code.match(/([^+\-*/%^!=<>&|\s]*)(\s*)(=)([^=].*)/);
    if(codeVarAssignRegexMatch != null){
        // We should always end up here since we have already checked the code against the regex
        Vue.set(useStore().frameObjects[frameId],"frameType", VarAssignDefinition);
        const newContent: { [index: number]: FrameSlotContent} = {
            0: {
                code: codeVarAssignRegexMatch[1],
                error: "",
                focused: false,
                shownLabel: true,
            },
            1: {
                code: codeVarAssignRegexMatch[4],
                error: "",
                focused: false,
                shownLabel: true,
            } }
        Vue.set(useStore().frameObjects[frameId], "contentDict", newContent);
    }
}