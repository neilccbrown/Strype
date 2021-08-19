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

// .slide-fade-enter-active {
//   transition: all .3s ease; //animation: bounce-in .5s;
// }
// .slide-fade-leave-active {
//   transition: all .8s cubic-bezier(1.0, 0.5, 0.8, 1.0);
// }
// .slide-fade-enter, .slide-fade-leave-to
// /* .slide-fade-leave-active below version 2.1.8 */ {
//   transform: translateX(10px);
//   opacity: 0;
// }
// @keyframes bounce-in {
//   0% {
//     transform: scale(0);
//   }
//   50% {
//     transform: scale(1.5);
//   }
//   100% {
//     transform: scale(1);
//   }
// }
// .section-leave-active, .section-enter-active {
//   transition: 0.5s;
// }
// .section-enter {
//   transform: translateY(100%) !important;
// }
// .section-leave-to {
//   transform: translateY(-100%);
// }

.section-enter-active, .section-leave-active {
  transition: opacity .3s ease;
}
.section-enter, .section-leave-to
/* .section-fade-leave-active below version 2.1.8 */ {
  opacity: 0;
}
</style>
