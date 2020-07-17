<template>
  <div class="content-children">
    <Draggable v-model="frames" group="a" draggable=".frame" @start="drag=true" @end="drag=false">
        <Frame
            v-for="frame in frames"
            v-bind:key="frame.frameType+'-id:'+frame.id"
            v-bind:id="frame.id"
            v-bind:type="frame.frameType"
            v-bind:isJointFrame="false"
            class="frame"
        />
    </Draggable>
  </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import store from ".././store/store";
import Frame from "./Frame.vue";
import Draggable from "vuedraggable";


//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
  name: "FrameBody",
  store,

  components: {
    Frame,
    Draggable
  },
  

  beforeCreate: function() {
    const components = this.$options.components;
    if (components != undefined)
      components.Frame = require("./Frame.vue").default;
  },

  props: {
    frameId: Number
  },

  computed: 
  {
    frames:
    {
        // gets the frames objects which are nested in here (i.e. have this frameID as parent)
        get: function() 
        {
            return store.getters.getFramesForParentId(this.$props.frameId);
        },
        // setter the frames objects in store
        set: function(value) 
        {
            store.commit("updateFramesOrder", {value: value, parentID: this.$props.frameId});
        }
    }
  }

});
</script>

<style lang="scss">
.content-children {
  margin-left: 20px;
  
}
</style>