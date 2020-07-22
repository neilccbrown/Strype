import Vue from 'vue';
import Vuex, { Store } from 'vuex';
import { FramesDefinitions, FrameObject , ErrorSlotPayload} from './../types/types';

Vue.use(Vuex)

export default new Vuex.Store({
    state:
    {
        nextAvailableId: 1 as number,

        currentFrameID: 0,

        isEditing: false,

        framesDefinitions:
            [
                {
                    name: "if",
                    labels: [{ label: 'if', slot: true }, { label: ' :', slot: false }],
                    allowChildren: true,
                    jointFrameTypes: ["elseif", "else"],
                    colour: "#EA9C72"
                },
                {
                    name: "elseif",
                    labels: [{ label: 'elseif', slot: true }, { label: ' :', slot: false }],
                    allowChildren: true,
                    jointFrameTypes: [],
                    colour: ""
                },
                {
                    name: "else",
                    labels: [{ label: 'else :', slot: false }],
                    allowChildren: true,
                    jointFrameTypes: [],
                    colour: ""
                },
                {
                    name: "for",
                    labels: [{ label: 'for', slot: true }, { label: 'in', slot: true }, { label: ' :', slot: false }],
                    allowChildren: true,
                    jointFrameTypes: ["else"],
                    colour: "#EA72C0"
                },
                {
                    name: "while",
                    labels: [{ label: 'while', slot: true }, { label: ' :', slot: false }],
                    allowChildren: true,
                    jointFrameTypes: [],
                    colour: "#9C72EA"
                },
                {
                    name: "return",
                    labels: [{ label: 'return', slot: true }],
                    allowChildren: false,
                    jointFrameTypes: [],
                    colour: "#eff779"
                },
                {
                    name: "statement",
                    labels: [{label:'', slot: true}],
                    allowChildren: false,
                    jointFrameTypes: [],
                    colour: "#72C0EA"
                },
                {
                    name: "varassign",
                    labels: [{ label: 'let', slot: true },{ label: '=', slot: false },{ label: '', slot: true }],
                    allowChildren: false,
                    colour: "#72EAC0"
                },
                {
                    name: "import",
                    labels: [{ label: 'import', slot: true }],
                    allowChildren: false,
                    jointFrameTypes: [],
                    colour: "#FFFFFF"
                },
                {
                    name: "fromimport",
                    labels: [{ label: 'from', slot: true },{ label: 'import', slot: true }],
                    allowChildren: false,
                    jointFrameTypes: [],
                    colour: "#FFFFFF"
                },
                {
                    name: "try",
                    labels: [{ label: 'try:', slot: false }],
                    allowChildren: true,
                    jointFrameTypes: ["except", "else", "finally"],
                    colour: "#EA0000"
                },
                {
                    name: "except",
                    labels: [{ label: 'except:', slot: true }],
                    allowChildren: true,
                    jointFrameTypes: [],
                    colour: ""
                },
                {
                    name: "finally",
                    labels: [{ label: 'finally:', slot: false }],
                    allowChildren: true,
                    jointFrameTypes: [],
                    colour: ""
                },
                {
                    name: "funcdef",
                    labels: [{ label: 'def:', slot: true },{ label: '(', slot: true },{ label: ')', slot: false }],
                    allowChildren: true,
                    jointFrameTypes: [],
                    colour: "#0c3ded"
                },
                {
                    name: "comment",
                    labels: [{ label: 'Comment:', slot: true }],
                    allowChildren: false,
                    jointFrameTypes: [],
                    colour: "#AAAAAA"
                },
                {
                    name: "with",
                    labels: [{ label: 'with', slot: true }, { label: 'as', slot: true }, { label: ':', slot: false}],
                    allowChildren: true,
                    jointFrameTypes: [],
                    colour: "#f5a70c"
                }
            ] as FramesDefinitions[],
        
        frameObjects : {} as {[id: number]: FrameObject}
    },
    getters:
    {
        getFramesForParentId: (state) => (id: number) => {
            //Get the childrenIds of this frame and based on these return the children objects corresponding to them    
            return state.frameObjects[id].childrenIds.map(a => state.frameObjects[a]).filter(a => a)
        },
        getContentForFrameSlot: (state) => (frameId: number, slotId: number) => {
            const retCode = state.frameObjects[frameId]?.contentDict[slotId]
            return (retCode !== undefined) ? retCode : "";
        },
        getJointFramesForFrameId: (state) => (id: number) => {
            const jointFrameIds = state.frameObjects[id]?.jointFrameIds;
            const jointFrames: FrameObject[] = [];
            jointFrameIds?.forEach((jointFrameId: number) => {
                const jointFrame = state.frameObjects[jointFrameId];
                if(jointFrame !== undefined)
                    jointFrames.push(jointFrame);
            });
            return jointFrames;
        },
        getIsJointFrame: (state) => (parentId: number, frameType: string) => {
            //this getter checks if a frame type identified by "frameType" is listed as a joint frame (e.g. "else" for "if")
            const parentType = state.frameObjects[parentId]?.frameType;
            if(parentType !== undefined) {
                return state.framesDefinitions.find(fd => fd.name === parentType)?.jointFrameTypes.includes(frameType);
            }
            return false;
        },
        getLabelsByName: (state) => (type: string) => {
            const frameDef = state.framesDefinitions.find(o => o.name === type);
            if (frameDef)
                return frameDef.labels;
            else
                return [];
        },
        getAllowChildrenByName: (state) => (type: string) => {
            const frameDef = state.framesDefinitions.find(o => o.name === type);
            if (frameDef)
                return frameDef.allowChildren;
            else
                return false;
        },
        getColourByName: (state) => (type: string) => {
            const frameDef = state.framesDefinitions.find(o => o.name === type);
            if (frameDef)
                return frameDef.colour;
            else
                return "#000";
        },

        getFrameObjects: (state) => () => {
            return Object.values(state.frameObjects);
        }
    },
    mutations:
    {
        addFrameObject(state, fobj: FrameObject) 
        {

            // Add the new frame to the list
            // "Vue.set" is used as Vue cannot catch the change by doing : state.frameObjects[fobj.id] = fobj
            Vue.set(state.frameObjects, fobj.id, fobj);
            
            // Add the frame id to its parent's childrenIds list
            Vue.set(state.frameObjects[fobj.parentId].childrenIds, state.frameObjects[fobj.parentId].childrenIds.length, fobj.id);
            
            if (fobj.jointParentId > 0){
                state.frameObjects[fobj.jointParentId]?.jointFrameIds.push(fobj.id);
            }
            state.nextAvailableId++;
            
        },
        
        updateFramesOrder(state, data) 
        {
            const eventType = Object.keys(data.event)[0];
        
            if(eventType === "added")
            {
                // Add the id to the parent's childrenId list
                state.frameObjects[data.eventParentId].childrenIds.splice(data.event[eventType].newIndex,0,data.event[eventType].element.id);
            }
            else if (eventType === "moved") 
            {
                // First delete the frameId from the children list and then add it again in the new position                
                state.frameObjects[data.eventParentId].childrenIds.splice(data.event[eventType].oldIndex,1);
                state.frameObjects[data.eventParentId].childrenIds.splice(data.event[eventType].newIndex,0,data.event[eventType].element.id);
            } 
            else if (eventType === "removed") 
            {
                // Remove the id from the parent's childrenId list
                state.frameObjects[data.eventParentId].childrenIds.splice(data.event[eventType].oldIndex,1);
            }

        },

        setFrameEditorSlot(state, payload: ErrorSlotPayload) {
            const contentDict = state.frameObjects[payload.frameId]?.contentDict;
            if(contentDict !== undefined) 
                contentDict[payload.slotId] = payload.code
        },
        updateCurrentFrameID(state, id: number) {
            state.currentFrameID = id;
        },
        toggleEditFlag(state) {
            state.isEditing = !state.isEditing;
        }
    },
    actions:
    {

    },
    modules:
    {

    }
})

 

