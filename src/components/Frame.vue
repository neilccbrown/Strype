<template>
  <div :style="frameStyle" class="block">
    <FrameHeader
      v-if="frameLabel !== null"
      v-bind:frameId="id"
      v-bind:labels="frameLabel"
    />
    <FrameBody
       v-bind:frameId="id"
    />
    <Frame
        v-for="frame in jointframes"
        v-bind:key="frame.frameType+'-id:'+frame.id"
        v-bind:id="frame.id"
        v-bind:type="frame.frameType"
        v-bind:isJointFrame="true"       
    />
  </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import FrameHeader from "./FrameHeader.vue";
import store from ".././store/store";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
  name: "Frame",
  store,
  
  components: {
    FrameHeader,
  },

  beforeCreate: function() {
    const components = this.$options.components;
    if (components != undefined)
      components.FrameBody = require("./FrameBody.vue").default;
  },

  props: {
    id: Number, // Unique Indentifier for each Frame
    type: String, //Type of the Frame
    parent: Number, //ID of the parent
    isJointFrame: Boolean //Flag indicating this frame is a joint frame or not

    // NOTE that type declarations here start with a Capital Letter!!! (different to types.ts!)
  },

  data: function() {
    return {
      // `False` if a single line frame and `True` if a block
      compound: false,

      // The body can be one of the following two:
      // 1) An editable slot, if our `Frame` is a single-line statement (eg. method call, variable assignment)
      // 2) A `Frame` in order to hold more frames in it
      body: null
    };
  },

  computed: {
    // Frame label holds the initialisation object for the frame
    frameLabel: function() {
      return this.$store.getters.getLabelsByName(this.type);
    },
    jointframes: function() {
      return store.getters.getJointFramesForFrameId(this.$props.id);
    },
    frameStyle: function() {
      return (this.isJointFrame===true) 
      ? {} 
      : {
          "border-left" : "6px solid " + this.$store.getters.getColourByName(this.type) +" !important",
          "background-color": this.$store.getters.getColourByName(this.type) + "33 !important",
          "padding-left": "2px"
      };
    }
  }
});
</script>

<style lang="scss">
.block 
{
    color: #000 !important;
    margin-top: 7px;
}

</style>
