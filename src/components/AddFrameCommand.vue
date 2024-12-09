<template>
    <div :class="{'frame-cmd-container': true, disabled: isPythonExecuting}" @click="onClick">
        <button :class="{'frame-cmd-btn': true, 'frame-cmd-btn-large': isLargerShorcutSymbol}" :disabled=isPythonExecuting>{{ symbol }}</button>
        <span>{{ description }}</span>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import { useStore } from "@/store/store";
import { mapStores } from "pinia";
import { findAddCommandFrameType } from "@/helpers/editor";
import { PythonExecRunningState } from "@/types/types";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "AddFrameCommand",

    props: {
        type: String, //Type of the Frame Command
        shortcut: String, //the keyboard shortcut to add the frame 
        symbol: String, //the displayed shortcut in the UI, it can be a symbolic representation
        description: String, //the description of the frame
        index: Number, //when more than 1 frame is assigned to a shortcut, the index tells which frame definition should be used
    },

    computed: {
        ...mapStores(useStore),

        isLargerShorcutSymbol() {
            return this.symbol.length > 1;
        },

        isPythonExecuting(): boolean {
            return (useStore().pythonExecRunningState ?? PythonExecRunningState.NotRunning) != PythonExecRunningState.NotRunning;
        },
    },

    methods: {
        onClick(): void {
            //add the frame in the editor if the panel is not disabled
            if(!this.isPythonExecuting) {
                const addFrameCommandType = findAddCommandFrameType(this.shortcut, this.index);
                if(addFrameCommandType != null){
                    this.appStore.addFrameWithCommand(addFrameCommandType);
                }
            }
        },
    },
});
</script>

<style lang="scss">
.frame-cmd-container {
    margin: 2px 5px;
    cursor: pointer;
}

.frame-cmd-container.disabled {
    cursor: default;
    color: rgb(180, 180, 180);
}


.frame-cmd-btn {
    margin-right: 5px;
    cursor: pointer;
    width: 24px;
    background-color: #fefefe;
    border-radius: 4px;
    border: 1px solid #d0d0d0;
}

.frame-cmd-btn-large {
    width: auto;
    font-stretch: 50% !important;
    font-family: 'Inconsolata', sans-serif !important;
}

.frame-cmd-btn:disabled {
    cursor: default;
}
</style>
