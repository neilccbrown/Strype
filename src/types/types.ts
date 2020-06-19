// Type Definitions

/**
 *  NOTE that all types start with a lower-case as this is the way TS works.
 */


export interface FrameObject
{
    frameType : string,
    id : number
}


// This is an array with all the frame Definitions objects.
// Note that the slot variable of each objects tells if the
// Label needs an editable slot as well attached to it.
export interface FramesDefinitions
{
    // [x: string]: any;
    name : string,
    labels : [{ label : string , slot : boolean}]
}
