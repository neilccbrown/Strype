<template>
    <div :class="{invisible: isInvisible}"></div>
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
        isInvisible: Boolean,
    },
});
</script>

<style lang="scss">
.caret {
    width: 120px;
    background-color: #3467FE;
    border-radius: 6px;
    height: 6px;
}

.caret-drop {
    background-color: #BB33FF !important;
    width: 120px;
    border-radius: 6px;
    height: 6px;
}

.invisible {
    background-color: transparent !important;
    height: 0px;
}
</style>
