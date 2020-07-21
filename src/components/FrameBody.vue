<template>
    <Draggable v-model="frames" group="a" draggable=".frame" >
        <Frame
            v-for="frame in frames"
            v-bind:key="frame.frameType+'-id:'+frame.id"
            v-bind:id="frame.id"
            v-bind:type="frame.frameType"
            v-bind:isJointFrame="false"
            class="frame content-children"
        />
    </Draggable>
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
            // The selected frame's id  ==>  event.target.__vue__._props.frameId
            // new parent's id   ==>  this.frameId
            store.commit("updateFramesOrder", {value: value, selectedFrameId: event.target.__vue__._props.frameId,  newParentId: this.$props.frameId});
            //store.commit("updateFramesOrder", {});
        }
    }
  },

  methods:
  {
      setChosenFrame: function()
      {
            // console.log(this.$props.frameId);       
            // console.log(event);
      }
  }

});
</script>

<style lang="scss">
.content-children {
  margin-left: 20px;
  
}
</style>