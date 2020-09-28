<template>
    <div 
        class="caret"
        v-bind:class="{blured: isBlurred}"></div>
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

    props: {
        isBlurred: Boolean,
    },

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

.blured {
    background-color: #3467fe8a !important;
}
</style>
