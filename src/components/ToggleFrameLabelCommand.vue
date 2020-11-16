<template>
    <div class="framelabel-cmd-container" v-on:mousedown.prevent="onMouseDown">
        <div 
            class="next-to-eachother"
            v-for="(modifierKey, index) in modifierKeyShortcuts" 
            :key="type + index"
        >
            <button class="framelabel-cmd-modifbtn">{{ modifierKey }}</button>
            <span class="framelabel-cmd-separatorspan">{{ "+"}}</span>
        </div>
        <button class="framelabel-cmd-btn">{{ keyShortcut }}</button>
        <span>{{ description }}</span>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import store from "@/store/store";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "ToggleFrameLabelCommand",
    store,

    props: {
        type: String, //Type of the command
        modifierKeyShortcuts: Array, //the modifier keys for the command
        keyShortcut: String, //the keyboard shortcut of the command (optionaly combined to a modifier key) 
        description: String, //the description of the toggle action
    },
    
    computed: {
        symbol(): string {
            return  (this.$props.modifierKeyShortcut !== undefined) 
                ? this.$props.modifierKeyShortcut + " + " + this.$props.keyShortcut
                : this.$props.keyShortcut;
        },
    },

    methods: {
        onMouseDown(): void {
            //toggle the frame label 
            //note: we use mousedown event instead of click 
            //to be sure it is called before blur is triggered on editable slots
            store.dispatch(
                "toggleFrameLabel",
                this.$props.type
            );
        },
    },
});
</script>

<style lang="scss">
.framelabel-cmd-container {
    margin: 5px;
    cursor: pointer;
}

.framelabel-cmd-btn, .framelabel-cmd-modifbtn {
    margin-right: 5px;
    cursor: pointer;
    width: 24px;
    background-color: #efefef;
    border-radius: 4px;
    border: 1px solid #d0d0d0;
}

.framelabel-cmd-modifbtn {
    width: 48px;
}

.framelabel-cmd-separatorspan {
    margin-right: 5px;
}
</style>