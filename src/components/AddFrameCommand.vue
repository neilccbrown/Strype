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
import {addCommandsDefs} from "@/constants/addFrameCommandsDefs";

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
        index: Number, //when more than 1 frame is assigned to a shortcut, the index tells which frame definition should be used
    },

    methods: {
        onClick(): void {
            //add the frame in the editor
            store.dispatch(
                "addFrameWithCommand",
                addCommandsDefs[this.shortcut][this.index].type
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

.section-enter-active, .section-leave-active {
  transition: opacity .2s ease;
}
.section-enter, .section-leave-to
{
  opacity: 0;
}
</style>
