<template>
    <div class="container">
        <div>
            <button v-on:click="flash">Connect Serial</button>
            <button v-on:click="downloadHex">Download Hex</button>
            <button v-on:click="downloadPython">Download Python</button>
        </div>
        <hr />
        <div class="frameCommands">
            <FrameCommand
                v-for="frameCommand in frameCommands"
                v-bind:key="frameCommand.type.type"
                v-bind:type="frameCommand.type.type"
                v-bind:shortcut="
                    frameCommand.symbol !== undefined
                        ? frameCommand.symbol
                        : frameCommand.shortcut
                "
                v-bind:description="frameCommand.description"
            />
        </div>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import store from "@/store/store";
import FrameCommand from "@/components/FrameCommand.vue";
import frameCommandsDefs from "@/constants/frameCommandsDefs";
import { flashData } from "@/helpers/webUSB";
import { downloadHex, downloadPython } from "@/helpers/download";
import { FrameCommandDef, CaretPosition, FrameObject, AllFrameTypesIdentifier, ElseDefinition, IfDefinition } from "@/types/types";

export default Vue.extend({
    name: "Commands",
    store,

    components: {
        FrameCommand,
    },

    computed: {
        frameCommands(): Record<string, FrameCommandDef> {
            const currentFrame  = store.getters.getCurrentFrameObject() as FrameObject;

            //forbidden frames are those of the current frame's type if caret is body, those of the parent/joint root otherwise
            let forbiddenTypes = (store.state.currentFrame.caretPosition === CaretPosition.body) ? 
                currentFrame.frameType.forbiddenChildrenTypes :
                ((currentFrame.jointParentId > 0) ? store.state.frameObjects[currentFrame.jointParentId].frameType.forbiddenChildrenTypes : store.state.frameObjects[currentFrame.parentId].frameType.forbiddenChildrenTypes) ;
         
         
            //joint frames are retrieved only for the current frame or the joint frame root if the caret is below
            //and we validate "else" if there is not already an else in the joint frame root or elif following in a if joint structure
            let joinedTypes = (store.state.currentFrame.caretPosition === CaretPosition.below) ?
                [...currentFrame.frameType.jointFrameTypes] : 
                [];
                
            if(joinedTypes.length > 0){
                const rootJointFrame = (currentFrame.jointParentId > 0) ? store.state.frameObjects[currentFrame.jointParentId] : currentFrame
                if(rootJointFrame.jointFrameIds.filter((jointFrameId) => store.state.frameObjects[jointFrameId].frameType === ElseDefinition).length > 0){
                    joinedTypes = joinedTypes.filter((type) => type !== ElseDefinition.type);
                }
                //specific case of else in an if statement: do not add before an elif (= cant add else if not in last position in joint frames)
                if(rootJointFrame.frameType === IfDefinition
                    &&  rootJointFrame.jointFrameIds.indexOf(currentFrame.id) < rootJointFrame.jointFrameIds.length - 1) {
                    joinedTypes = joinedTypes.filter((type) => type !== ElseDefinition.type);
                    //and forbid every frame (we are in an intermediate joint, no frame should be added except Elif)
                    forbiddenTypes = Object.values(AllFrameTypesIdentifier);
                }
            }
            
            //remove the commands that are forbidden and not defined as joint frames
            const filteredCommands = { ...frameCommandsDefs.FrameCommandsDefs};
            for (const frameType in frameCommandsDefs.FrameCommandsDefs) {
                if(forbiddenTypes.includes(frameCommandsDefs.FrameCommandsDefs[frameType].type.type) 
                    && !joinedTypes.includes(frameCommandsDefs.FrameCommandsDefs[frameType].type.type)){
                    delete filteredCommands[frameType];
                }
            }
            return filteredCommands;
        },
    },

    created() {
        window.addEventListener(
            "keyup",
            this.onKeyUp
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
            downloadPython();
        },
        onKeyUp(event: KeyboardEvent) {
            if (
                event.key === "ArrowDown" || event.key=="ArrowUp"
            ) {
                store.dispatch(
                    "changeCaretPosition",
                    event.key
                );

            }
            else if (store.state.isEditing === false) {
                switch(event.key){
                case "Delete" :
                case "Backspace":
                    //delete a frame
                    store.dispatch(
                        "deleteCurrentFrame",
                        event.key
                    );
                    break;
                default:
                    //add the frame in the editor if allowed otherwise, do nothing
                    if(this.frameCommands[event.key] !== undefined){
                        store.dispatch(
                            "addFrameWithCommand",
                            this.frameCommands[event.key].type                
                        );
                    }
               
                }                
            }
        },
    },
});
</script>

<style lang="scss">
.container {
    border-left: #383b40 1px solid;
    color: rgb(37, 35, 35);
    background-color: lightblue;
    width: 300px;
}
</style>
