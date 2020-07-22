<template>
  <div class="frame-cmd-container">
    <button class="frame-cmd-btn">{{shortcut}}</button>
    <span value="description">{{description}}</span>
  </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
  name: "FrameCommand",

  props: {
    type: String, //Type of the Frame Command
    shortcut: String, //the keyboard shortcut to add the frame (displayed in the UI, it can be a symbolic representation)
    description: String //the description of the frame
  }
});
</script>

<style lang="scss">
.frame-cmd-container {
  margin:5px;
}

.frame-cmd-btn {
  margin-right:5px;
  width: 24px;
  background-color: #efefef;
  border-radius: 4px;
  border: 1px solid #d0d0d0;
}
</style>
