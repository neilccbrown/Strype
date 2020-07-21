import Vue from 'vue'
import Vuex, { Store } from 'vuex'
import { FramesDefinitions, FrameObject } from './../types/types';

Vue.use(Vuex)

export default new Vuex.Store({
    state:
    {
        nextAvailableId: 1 as number,

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
        
        frameObjects : {}
    },
    getters:
    {
        getFramesForParentId: (state) => (id: number) => {
            console.log(Object.values(state.frameObjects).filter(f => f.parentId === id));
            return Object.values(state.frameObjects).filter(f => f.parentId === id);
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
            state.frameObjects[fobj.id] = fobj;
            if (fobj.parentId > 0)
            {
                state.frameObjects[fobj.parentId]?.childrenIds.push(fobj.id);
            }
            else if (fobj.jointParentId > 0){
                state.frameObjects[fobj.jointParentId]?.jointFrameIds.push(fobj.id);
            }
            state.nextAvailableId++;
            
        },
        
       // Data holds the new state and the parentId of the frame where the change was made
       // It is called two times! one form the list the frame was moved to
       // and one from the list that the frame was dragged from (IFF the drag parent and the drop parent frames are not the same parent)
       updateFramesOrder(state, data) 
       {
            const oldParentId = state.frameObjects[data.selectedFrameId].parentId;

            // If old == new parent then we are moving within the same parent
            if (oldParentId !== data.newParentId)
            {
                // Remove the moved frame from the old parent. No parent object exists for PId:0
                if (oldParentId>0)
                {
                    const oldParent = state.frameObjects[oldParentId];
                    oldParent.childrenIds = oldParent.childrenIds.filter(item => item !== data.selectedFrameId);
                }
                // Change the PId of the moved frame
                state.frameObjects[data.selectedFrameId].parentId = data.newParentId;
            }

            // Add the moved frame to the new parent's list with the correct order
            // In the case where the new parent is the root PId=0 no need to update children list
            if(data.newParentId !==0)
            {
                const newParent = state.frameObjects[data.newParentId];
                newParent.childrenIds = Array.from(data.value.map(item => item.id).values());
            }
            else
            {
                // Get all the 
                state.frameObjects = data.value;
            }


            

            // console.log("value");
            // console.log(data.value);
            // console.log("newParentId");
            // console.log(data.newParentId);

        
        }
    },
    actions:
    {

    },
    modules:
    {

    }
})

 

