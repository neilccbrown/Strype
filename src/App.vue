<template>
  <div id="app">
    
    <form v-on:submit.prevent="addNewFrame">
        <label for="new-frame">What Frame to add? </label>
        <input
            v-model="newFrameType"
            id="new-frame"
            placeholder="E.g. if, for, while"
        >
        <button>Add</button>
    </form>

    <draggable v-model="frames" v-for="frame in frames" v-bind:key="frame.frameType+'-id:'+frame.id">
        <Frame v-bind:id="frame.id" v-bind:type="frame.frameType" v-bind:parent="0"/>
    </draggable>
    

  </div>
</template>

<script lang="ts">

//////////////////////
//      Imports     //
//////////////////////
import Vue from 'vue';
import Frame from './components/Frame.vue';
import { BootstrapVue, IconsPlugin } from 'bootstrap-vue';
import store from './store/store';
import draggable from 'vuedraggable';
import { FrameObject } from './types/types';


//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: 'App',
    store,

    components: 
    {
        Frame,
        draggable
    },

    data: function()
    {
        return{
            newFrameType : "",
            // The array with all the frames in our app.
            // Currently every item is an object of: {frameType , id}
            frames : [] as FrameObject[]
        }

        
    },

    methods: 
    {
        //add the new frame and increase the ID by 1
        addNewFrame: function () 
        {
            this.frames.push({frameType: this.newFrameType,id: store.state.nextAvailableID})
            store.commit('increaseID')
        },
    }

});
</script>

<style lang="scss">
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
