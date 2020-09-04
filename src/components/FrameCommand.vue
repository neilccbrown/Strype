<template>
    <div class="frame-cmd-container" v-on:click="onClick">
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
import frameCommandsDefs from "@/constants/frameCommandsDefs";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "FrameCommand",
    store,

    props: {
        type: String, //Type of the Frame Command
        shortcut: String, //the keyboard shortcut to add the frame 
        symbol: String, //the displayed shortcut in the UI, it can be a symbolic representation
        description: String, //the description of the frame
    },

    methods: {
        onClick(): void {
            //add the frame in the editor
            store.dispatch(
                "addFrameWithCommand",
                frameCommandsDefs.FrameCommandsDefs[this.shortcut].type
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
    background-color: #efefef;
    border-radius: 4px;
    border: 1px solid #d0d0d0;
}
</style>
