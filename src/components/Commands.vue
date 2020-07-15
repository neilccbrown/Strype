<template>
  <div class="container">
    <div class="temp-div">
        <span>temp div here --> components for Python/microbit</span>
    </div>
    <FrameCommands currentFrameID=
  </div>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({
  name: "Commands",

  props:{
      currentFrameID: Number
  }
});
</script>

<style lang="scss">
.container {
  border-left: #383b40 1px solid;
  color: rgb(37, 35, 35);
  background-color: lightblue;
  width:300px;
}

.temp-div {
     border-bottom: #383b40 1px solid;
}
</style>