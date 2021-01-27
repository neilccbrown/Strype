<template>
    <div class="frame-cmd-container" @click="onClick">
        <button class="frame-cmd-btn">{{ symbol }}</button>
        <span>{{ description }}</span>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import store from "@/store/store";
import addFrameCommandsDefs from "@/constants/addFrameCommandsDefs";
import { AddFrameCommandDef } from "@/types/types";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "AddFrameCommand",
    store,

    props: {
        type: String, //Type of the Frame Command
        shortcut: String, //the keyboard shortcut to add the frame 
        symbol: String, //the displayed shortcut in the UI, it can be a symbolic representation
        description: String, //the description of the frame
        index: Number, //the index of frame type when a shortcut matches more than 1 context-distinct frames (-1 otherwise)
    },

    methods: {
        onClick(): void {
            //add the frame in the editor
            const typeToAdd = ("splice" in (addFrameCommandsDefs.AddFrameCommandsDefs[this.shortcut])) 
                ? (addFrameCommandsDefs.AddFrameCommandsDefs[this.shortcut] as AddFrameCommandDef[])[this.index].type
                : (addFrameCommandsDefs.AddFrameCommandsDefs[this.shortcut] as AddFrameCommandDef).type
            store.dispatch(
                "addFrameWithCommand",
                typeToAdd
            );
        },
    },
});
</script>

<style lang="scss">
.frame-cmd-container {
    margin: 5px;
    cursor: pointer;
}

.frame-cmd-btn {
    margin-right: 5px;
    cursor: pointer;
    width: 24px;
    background-color: #fefefe;
    border-radius: 4px;
    border: 1px solid #d0d0d0;
}
</style>
