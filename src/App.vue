<template>
  <div id="app">
    <form v-on:submit.prevent="addNewFrame">
      <label for="new-frame">What Frame to add?</label>
      <input v-model="newFrameType" id="new-frame" placeholder="E.g. if, for, while" />
      <button>Add</button>
    </form>

    <Draggable v-model="frames">
      <Frame
        v-for="frame in frames"
        v-bind:key="frame.frameType+'-id:'+frame.id"
        v-bind:id="frame.id"
        v-bind:type="frame.frameType"
        v-bind:parent="0"
      />
    </Draggable>
  </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import Frame from "./components/Frame.vue";
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
    Draggable
  },

  data: function() {
    return {
      newFrameType: ""
    };
  },

  computed: {
    frames: {
      // getter of the frames objects in store
      get: function() {
        return store.state.framesObjects;
      },
      // setter the frames objects in store
      set: function(value) {
        store.commit("updateFramesOrder", value);
      }
    }
  },

  methods: {
    //add the new frame and increase the ID by 1
    addNewFrame: function() {
      store.commit("addFrameObject", {
        frameType: this.$data.newFrameType,
        id: store.state.nextAvailableID
      });
    }
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
