<template>
  <div id="app">
      <div class="left">
        <form v-on:submit.prevent="addNewFrame">
            <label for="new-frame">What Frame to add?</label>
                <input v-model="newFrameType" id="new-frame" placeholder="E.g. if, for, while" />
            <select name="" v-model="currentParentId">
                <option v-for="n in 21" :value="n-1"  v-bind:key="'parentID'+ (n-1)">in parent id {{n-1}}</option>
            </select> 
            <button>Add</button>
        </form>
        <form v-on:submit.prevent="testFrameInitialisation">
            <button>Initialise State</button>
        </form>
        

        <Draggable v-model="frames" group="a" draggable=".frame" @start="drag=true" @end="drag=false">
            <Frame
                v-for="frame in frames"
                v-bind:key="frame.frameType+'-id:'+frame.id"
                v-bind:id="frame.id"
                v-bind:type="frame.frameType"
                v-bind:isJointFrame="false"
                v-bind:caretVisibility="frame.caretVisibility"
                class="frame"
            />
        </Draggable>
    </div>
    <div class="right">
        <textarea v-model="mymodel"></textarea>
    </div>
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
      newFrameType: "",
      currentParentId: 0
    };
  },

  computed: {
    frames: 
    {
        // gets the frames objects which are in the root 
        get: function() 
        {
            return store.getters.getFramesForParentId(this.$props.currentParentId);
        },
        // setter the frames objects in store
        set: function(value) 
        {
            store.commit("updateFramesOrder", {value: value, parentID: 0});
        }
    },

    //this helps for debugging purposes --> printing the state in the screen
    mymodel: 
    {
        get() {
            return JSON.stringify( store.getters.getFrameObjects() , null , '\t' )
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
        caretVisibility: false
      });
    },
    
    testFrameInitialisation: function() {
        store.commit("stateInitialisation", [{"frameType":"if","id":1,"parentId":0,"childrenIds":[4,5,7],"jointParentId":-1,"jointFrameIds":[],"caretVisibility":false},{"frameType":"if","id":2,"parentId":0,"childrenIds":[],"jointParentId":-1,"jointFrameIds":[],"caretVisibility":false},{"frameType":"if","id":3,"parentId":0,"childrenIds":[],"jointParentId":-1,"jointFrameIds":[],"caretVisibility":false},{"frameType":"for","id":4,"parentId":1,"childrenIds":[],"jointParentId":-1,"jointFrameIds":[],"caretVisibility":false},{"frameType":"for","id":5,"parentId":1,"childrenIds":[],"jointParentId":-1,"jointFrameIds":[],"caretVisibility":false},{"frameType":"for","id":6,"parentId":0,"childrenIds":[],"jointParentId":-1,"jointFrameIds":[],"caretVisibility":false},{"frameType":"funcdef","id":7,"parentId":1,"childrenIds":[],"jointParentId":-1,"jointFrameIds":[],"caretVisibility":false}]);
    }
  }
});
</script>

<style lang="scss">
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin-top: 60px;
  display: flex;
}

#app form {
  text-align: center;
}

.left
{
    width: 50%;
}

.right
{
    width: 50%;
}
</style>
