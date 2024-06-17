<template>
    <div :class="{invisible: isInvisible, disabled: isPythonExecuting}"></div>
</template>

<script lang="ts">
//////////////////////
import Vue from "vue";
import { useStore } from "@/store/store";
import { mapStores } from "pinia";
import { PythonExecRunningState } from "@/types/types";
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

    computed:{
        ...mapStores(useStore),

        isPythonExecuting(): boolean {
            return (this.appStore.pythonExecRunningState ?? PythonExecRunningState.NotRunning) != PythonExecRunningState.NotRunning;
        },
    },
});
</script>

<style lang="scss">
.caret {
    width: $caret-width;
    background-color: #3467FE;
    border-radius: 6px;
    height: $caret-height;
}

.caret.disabled {
    background-color: #b8bac0;
}

.caret-drop {
    background-color: #BB33FF !important;
    width: $caret-width;
    border-radius: 6px;
    height: $caret-height;
}

.invisible {
    background-color: transparent !important;
    height: 0px;
}
</style>
