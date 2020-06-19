import Vue from 'vue'
import Vuex from 'vuex'
import { FramesDefinitions } from './../types/types';

Vue.use(Vuex)

export default new Vuex.Store({
    state: 
    {
        nextAvailableID : 1 as number,
        
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
        test : "test" as string
    },
    getters:
    {
        getLabelsByName : function(state, type: string)
        {
            return state.framesDefinitions.find(o => o.name === type);
        }
    },
    mutations: 
    {
        increaseID (state) 
        {
            state.nextAvailableID++;
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