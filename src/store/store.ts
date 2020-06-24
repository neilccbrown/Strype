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
                    labels: [{ label: 'if', slot: true }, { label: ' :', slot: false }]
                },
                {
                    name: "for",
                    labels: [{ label: 'for', slot: true }, { label: 'in', slot: true }, { label: ' :', slot: false }]
                },
                {
                    name: "while",
                    labels: [{ label: 'while', slot: true }, { label: ' :', slot: false }]
                },
                {
                    name: "return",
                    labels: [{ label: 'return', slot: true }]
                }
            ] as FramesDefinitions[],
        
        framesObjects : [] as FrameObject[]

    },
    getters:
    {
        getLabelsByName: (state) => (type: string) => {
            const frameDef = state.framesDefinitions.find(o => o.name === type);
            if (frameDef)
                return frameDef.labels;
            else
                return [];
        }
    },
    mutations:
    {
        addFrameObject(state, fobj: FrameObject) {
            state.framesObjects.push(fobj);
            state.nextAvailableID++;
        },
        updateFramesOrder(state, value) {
            state.framesObjects = value;
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
//      JUND YARD       //
/////////////////////////

     // getLabelsByName: (state) => (type:string) => 
        // {
        //     return state.frames.find(o => o.name == type);
        // }
        // getLabelsByName(state) {
        //     return (type:string) => state.frames.find(o => o.name === type);
        //     }