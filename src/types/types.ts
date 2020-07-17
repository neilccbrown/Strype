// Type Definitions

/**
 *  NOTE that all types start with a lower-case as this is the way TS works.
 */


export interface FrameObject
{
    frameType : string,
    id : number,
    content: string[], //this contains the label input slots data
    parentId : number, //this is the ID of a parent frame (example: the if frame of a inner while frame). Value can be 0 (root), 1+ (in a level), -1 for a joint frame
    childrenIds: number[], //this contains the IDs of the children frames
    jointParentId: number, //this is the ID of the first sibling of a joint frame (example: the if frame of a elseif frame under that if), value can be -1 if none, 1+ otherwise 
    jointFrameIds: number [], //this contains the IDs of the joint frames
    contentDict: {[id: number]: string }, //this contains the label input slots data listed as a key value pairs array (key = index of the slot)                
}

export interface FrameLabel{
    label: string,
    slot: boolean,
}

// This is an array with all the frame Definitions objects.
// Note that the slot variable of each objects tells if the
// Label needs an editable slot as well attached to it.
export interface FramesDefinitions
{
    // [x: string]: any;
    name : string,
    labels : FrameLabel[],
    allowChildren: boolean,
    jointFrameTypes: string[],
    colour: string,
}

export interface ErrorSlotPayload
{
    frameId: number,
    slotId: number,
    code: string,
}
export interface FrameCommand
{
    type: string,
    description: string,
    shortcut: string,
}
