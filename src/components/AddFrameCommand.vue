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
                {
                    frame: addCommandsDefs[this.shortcut][this.index].type,
                    availablePositions: this.getAvailableNavigationPositions(),
                }
            );
        },

        // Instead of calculating the available caret positions through the store (where the frameObjects object is hard to use for this)
        // We get the available caret positions through the DOM, where they are all present.
        getAvailableNavigationPositions() {
            // We start by getting from the DOM all the available caret and editable slot positions
            const allCaretDOMpositions = document.getElementsByClassName("navigationPosition");
            // We create a list that hold objects of {id,caretPosition?,slotNumber?) for each available navigation positions
            return Object.values(allCaretDOMpositions).map((e)=> {
                return {
                    id: (parseInt(e.id.replace("caret_","").replace("caretBelow_","").replace("caretBody_",""))
                    ||
                    parseInt(e.id.replace("input_frameId_","").replace("_slot"+/_*-*\d+/g,"").replace("caretBody_",""))), 
                    caretPosition: (e.id.startsWith("caret")) && e.id.replace("caret_","").replace(/_*-*\d/g,""),
                    slotNumber: (e.id.startsWith("input")) && parseInt(e.id.replace("input_frameId_","").replace(/\d+/,"").replace("_slot_","")),
                }
            })
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
