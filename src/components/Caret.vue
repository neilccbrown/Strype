<template>
    <div class="caret"></div>
</template>

<script lang="ts">
//////////////////////
import Vue from "vue";

//////////////////////
/**
 * Caret is used as a vertical cursor for browsing
 * throughout the code's frames and showing where
 * a frame will be droped when dragged.
 */

export default Vue.extend({
    name: "Caret",

});
</script>

<style lang="scss">
.caret {
    margin-top: 3px;
    width: 120px;
    background-color: #3467FE;
    border-radius: 6px;
    height: 6px;
}
</style>
