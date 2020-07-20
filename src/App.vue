<template>
  <div id="app">
    <div id="temp-container">
    <form v-on:submit.prevent="addNewFrame">
      <label for="new-frame">What Frame to add?</label>
      <input v-model="newFrameType" id="new-frame" placeholder="E.g. if, for, while" v-on:blur="toggleEdition" v-on:focus="toggleEdition"/>
      <select name="" v-model="currentParentId">
        <option v-for="n in 21" :value="n-1"  v-bind:key="'parentID'+ (n-1)">in parent id {{n-1}}</option>
      </select> 
      <button>Add</button>
    </form>
    <Draggable v-model="frames">
      <Frame
        v-for="frame in frames"
        v-bind:key="frame.frameType+'-id:'+frame.id"
        v-bind:id="frame.id"
        v-bind:type="frame.frameType"
        v-bind:isJointFrame="false"
      />
    </Draggable>
    </div>
    <Commands />
  </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import Frame from "./components/Frame.vue";
import Commands from "./components/Commands.vue"
import store from "./store/store";
import Draggable from "vuedraggable";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
  name: "App",
  store,

  components: {
    Frame,
    Draggable,
    Commands
  },

  data: function() {
    return {
      newFrameType: "",
      currentParentId: 0
    };
  },

  computed: {
    frames: {
      // getter of the frames objects in store
      get: function() {
     
        return store.getters.getFramesForParentId(0);
      },
      // setter the frames objects in store
      set: function(value) {
        store.commit("updateFramesOrder", value);
      }
    }
  },

  methods: {
    //add the new frame
    addNewFrame: function() {
      const isJointFrame = store.getters.getIsJointFrame(this.$data.currentParentId, this.$data.newFrameType);
      store.commit("addFrameObject", {
        frameType: this.$data.newFrameType,
        id: store.state.nextAvailableID,
        parentId: (isJointFrame) ? -1 : this.$data.currentParentId,
        childrenIds: [],
        jointParentId: (isJointFrame) ? this.$data.currentParentId : -1,
        jointFrameIds: [],
        contentDict:{}
      });
    },
    toggleEdition : function(){
      store.commit('toggleEditFlag');
    }   
  }
});
</script>

<style lang="scss">
body{
  margin: 0px;
}
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  display:flex;  
  box-sizing: border-box;
  height: 100%;
  min-height: 100vh;
}

#app form {
  text-align: center;
}

#temp-container {
  margin-top: 60px;
  flex-grow: 1;
}
</style>
