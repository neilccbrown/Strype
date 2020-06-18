import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
    state: 
    {
        id : 1,
        frames: 
        [
            { 
                name : "if",
                labels : [{label :'if' , slot : true} , {label :' :' , slot : false}]
            },
            { 
                name : "for",
                labels : [{label :'for' , slot : true} , {label :'in' , slot : true}, {label :' :' , slot : false}]
            },
            { 
                name : "while",
                labels : [{label :'while' , slot : true} , {label :' :' , slot : false}]
            },
            { 
                name : "return",
                labels : [{label :'return' , slot : true}]
            }

        ],
        test : "test"
    },
    getters:
    {
        getLabelsByName : function(state, type: string)
        {
            return state.frames.find(o => o.name === type);
        }
        // getLabelsByName: (state) => (type:string) => 
        // {
        //     return state.frames.find(o => o.name == type);
        // }
        // getLabelsByName(state) {
        //     return (type:string) => state.frames.find(o => o.name === type);
        //     }
    },
    mutations: 
    {
        increaseID (state) 
        {
            state.id++
        }
    },
    actions: 
    {
    
    },
    modules: 
    {
    
    }
})
