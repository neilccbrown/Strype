<template>
  <div class="content-children">
    <Frame
      v-for="frame in frames"
      v-bind:key="frame.frameType+'-id:'+frame.id"
      v-bind:id="frame.id"
      v-bind:type="frame.frameType"
      v-bind:isJointFrame="false"
    />
  </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import store from ".././store/store";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
  name: "FrameBody",
  store,

  beforeCreate: function() {
    const components = this.$options.components;
    if (components != undefined)
      components.Frame = require("./Frame.vue").default;
  },

  props: {
    frameId: Number
  },

  computed: {
    frames: function() {
      return store.getters.getFramesForParentId(this.$props.frameId);
    }
  }
});
</script>

<style lang="scss">
.content-children {
  margin-left: 20px;
}
</style>