<template>
    <div class="commands">
        <div>
            <button v-on:click="flash">Connect Serial</button>
            <button v-on:click="downloadHex">Download Hex</button>
            <button v-on:click="downloadPython">Download Python</button>
        </div>
        <hr />
        <div class="frameCommands">
            <AddFrameCommand
                v-for="addFrameCommand in addFrameCommands"
                v-bind:key="addFrameCommand.type.type"
                v-bind:type="addFrameCommand.type.type"
                v-bind:shortcut="addFrameCommand.shortcut"
                v-bind:symbol="
                    addFrameCommand.symbol !== undefined
                        ? addFrameCommand.symbol
                        : addFrameCommand.shortcut
                "
                v-bind:description="addFrameCommand.description"
            />
        </div>
        <hr />
        <div class="toggleFrameLabelCommands">
            <ToggleFrameLabelCommand
                v-for="toggleFrameLabelCommand in toggleFrameLabelCommands"
                v-bind:key="toggleFrameLabelCommand.type"
                v-bind:type="toggleFrameLabelCommand.type"
                v-bind:modifierKeyShortcuts="toggleFrameLabelCommand.modifierKeyShortcuts"
                v-bind:keyShortcut="toggleFrameLabelCommand.keyShortcut"
                v-bind:description="toggleFrameLabelCommand.displayCommandText"
            />
        </div>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import store from "@/store/store";
import AddFrameCommand from "@/components/AddFrameCommand.vue";
import ToggleFrameLabelCommand from "@/components/ToggleFrameLabelCommand.vue";
import { flashData } from "@/helpers/webUSB";
import { downloadHex, downloadPython } from "@/helpers/download";
import { AddFrameCommandDef,ToggleFrameLabelCommandDef } from "@/types/types";
import {KeyModifier} from "@/constants/toggleFrameLabelCommandsDefs"

export default Vue.extend({
    name: "Commands",
    store,

    components: {
        AddFrameCommand,
        ToggleFrameLabelCommand,
    },

    computed: {
        addFrameCommands(): Record<string, AddFrameCommandDef> {
            //We retrieve the add frame commands associated with the current frame
            return store.getters.getCurrentFrameAddFrameCommands();
        },

        toggleFrameLabelCommands(): ToggleFrameLabelCommandDef[] {
            //We retrieve the toggle frame label commands associated with the current frame (if editable slots are focused (i.e. editing))
            if(store.getters.getIsEditing()){
                return store.getters.getCurrentFrameToggleFrameLabelCommands();
            }
            
            return [];
        },
    },

    created() {
        window.addEventListener(
            "keyup",
            //lambda is has the advantage over a `function` that it preserves `this`. not used in this instance, just mentioning for future reference.
            (event: KeyboardEvent) => {
                if ( event.key === "ArrowDown" || event.key === "ArrowUp" ) {
                    //first we remove the focus of the current active element (to avoid editable slots to keep it)
                    (document.activeElement as HTMLElement).blur();
                    store.dispatch(
                        "changeCaretPosition",
                        event.key
                    );
                }            
                else {
                    const isEditing = store.getters.getIsEditing();
                    if(isEditing){
                        //find if there is a toggle frame label command triggered --> if not, do nothing special
                        const toggleFrameCmdType = 
                                    this.toggleFrameLabelCommands.find((toggleCmd) => {
                                        let isModifierOn = true;
                                        toggleCmd.modifierKeyShortcuts.forEach((modifer) => {
                                            switch(modifer){
                                            case KeyModifier.ctrl:
                                                isModifierOn = isModifierOn && event.ctrlKey;
                                                break;
                                            case KeyModifier.shift:
                                                isModifierOn = isModifierOn && event.shiftKey;
                                                break;
                                            case KeyModifier.alt:
                                                isModifierOn = isModifierOn && event.altKey;
                                                break;
                                            }
                                        });
                                        //if the modifiers are on, and the shortcut key is the right one, return true
                                        return isModifierOn && toggleCmd.keyShortcut === event.key.toLowerCase();
                                    })?.type
                                    ?? "";
                        //if there is match with a toggle command, we run it (otherwise, do nothing)
                        if(toggleFrameCmdType !== "") {
                            store.dispatch(
                                "toggleFrameLabel",
                                toggleFrameCmdType
                            );
                        }
                    }
                    //cases when there is no editing:
                    else{
                        if (( event.key === "ArrowLeft" || event.key === "ArrowRight")) { 
                            store.dispatch(
                                "leftRightKey",
                                event.key
                            );
                        }
                        else if(event.key == "Delete" || event.key == "Backspace"){
                        //delete a frame
                            store.dispatch(
                                "deleteCurrentFrame",
                                event.key
                            );
                        }
                        //add the frame in the editor if allowed
                        else if(this.addFrameCommands[event.key.toLowerCase()] !== undefined){
                            store.dispatch(
                                "addFrameWithCommand",
                                this.addFrameCommands[event.key.toLowerCase()].type                
                            );
                            store.dispatch(
                                "leftRightKey",
                                "ArrowRight"                
                            );
                        }
                    }
                }
            }                
        );
    },

    methods: {
        flash() {
            if (navigator.usb) {
                flashData();
            }
            else {
                alert("This browser does not support webUSB connections. Please use a browser such as Google Chrome.");
            }
        },
        downloadHex() {
            downloadHex();
        },
        downloadPython() {
            if(store.getters.getPreCompileErrors().length>0) {
                alert("Please fix existing errors first.");
            }
            else {
                downloadPython();
            }
        },
    },
});
</script>

<style lang="scss">
.commands {
    border-left: #383b40 1px solid;
    color: rgb(37, 35, 35);
    background-color: lightblue;
    // width: 300px;

}
</style>
