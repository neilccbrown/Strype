import { FrameObject, CaretPosition, EditorFrameObjects } from "@/types/types";
import Vue from "vue";

export const removeFrameInFrameList = (listOfFrames: Record<number, FrameObject>, frameId: number) => {
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

export const getParent = (listOfFrames: Record<number, FrameObject>, currentFrame: FrameObject) => {
    let parentId = 0;
    if(currentFrame.id !== 0){
        parentId = (currentFrame.jointParentId > 0) ? listOfFrames[currentFrame.jointParentId].parentId : currentFrame.parentId;
    }
    return parentId;
};

export const childrenListWithJointFrames = (listOfFrames: Record<number, FrameObject>, currentFrameId: number, caretPosition: CaretPosition, direction: string) => {
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

export const countRecursiveChildren = function(listOfFrames: Record<number, FrameObject>, frameId: number, countLimit?: number): number {
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

    //Look at the subchildren first and then at the joint frames
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

    //Look at the subchildren first and then at the joint frames
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
