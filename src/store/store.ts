import Vue from 'vue'
import Vuex from 'vuex'
import { FramesDefinitions, FrameObject } from './../types/types';

Vue.use(Vuex)

export default new Vuex.Store({
    state:
    {
        nextAvailableID: 1 as number,

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
                    jointFrameTypes: [],
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
                    labels: [{ label: 'var', slot: true },{ label: '=', slot: false },{ label: '', slot: true }],
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
                    labels: [{ label: 'except:', slot: false }],
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
                }
            ] as FramesDefinitions[],
        
        framesObjects : [] as FrameObject[]
    },
    getters:
    {
        getFramesForParentId: (state) => (id: number) => {
            return state.framesObjects.filter(f => f.parentId === id);
        },
        getJointFramesForFrameId: (state) => (id: number) => {
            const jointFrameIds = state.framesObjects.find(f => f.id === id)?.jointFrameIds;
            const jointFrames: FrameObject[] = [];
            jointFrameIds?.forEach((jointFrameId: number) => {
                const jointFrame = state.framesObjects.find(f => f.id === jointFrameId);
                if(jointFrame !== undefined)
                    jointFrames.push(jointFrame);
            });
            return jointFrames;
        },
        getIsJointFrame: (state) => (parentId: number, frameType: string) => {
            //this getter checks if a frame type identified by "frameType" is listed as a joint frame (e.g. "else" for "if")
            const parentType = state.framesObjects.find(f => f.id === parentId)?.frameType;
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
            return state.framesObjects;
        }
    },
    mutations:
    {
        addFrameObject(state, fobj: FrameObject) 
        {
            state.framesObjects.push(fobj);
            if (fobj.parentId > 0)
            {
                state.framesObjects.find(f => f.id===fobj.parentId)?.childrenIds.push(fobj.id);
            }
            else if (fobj.jointParentId > 0){
                state.framesObjects.find(f => f.id===fobj.jointParentId)?.jointFrameIds.push(fobj.id);
            }
            state.nextAvailableID++;
            
        },
        updateFramesOrder(state, value) {
            state.framesObjects = value;
        },

        stateInitialisation(state, initialState: FrameObject[])
        {
            state.framesObjects = initialState;
        }
    },
    actions:
    {

    },
    modules:
    {

    }
})

 







//////////////////////////
//      JUNK YARD       //
/////////////////////////

     // getLabelsByName: (state) => (type:string) => 
        // {
        //     return state.frames.find(o => o.name == type);
        // }
        // getLabelsByName(state) {
        //     return (type:string) => state.frames.find(o => o.name === type);
        //     }



        // state.framesObjects.push(fobj);
        //     if (fobj.parentId > 0)
        //     {
        //         state.framesObjects.find(f => f.id===fobj.parentId)?.childrenIds.push(fobj.id);
        //     }
        //     else if (fobj.jointParentId > 0){
        //         state.framesObjects.find(f => f.id===fobj.jointParentId)?.jointFrameIds.push(fobj.id);
        //     }
        //     state.nextAvailableID++;

        // Adding frame in the root (without parent)
            // if(fobj.parentId === 0) 
            // {
            //     state.framesObjects.push(fobj);
            // }
            // // Adding the frame as a child
            // if (fobj.parentId > 0)
            // {

            //     state.framesObjects.find(f => f.id===fobj.parentId)?.childrenIds.push(fobj.id);
            // }
            // else if (fobj.jointParentId > 0){
            //     state.framesObjects.find(f => f.id===fobj.jointParentId)?.jointFrameIds.push(fobj.id);
            // }
            // state.nextAvailableID++;