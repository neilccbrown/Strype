<template>
    <div class="commands">
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
                v-bind:shortcut="frameCommand.shortcut"
                v-bind:symbol="
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
import { FrameCommandDef, CaretPosition, FrameObject, AllFrameTypesIdentifier, ElseDefinition, IfDefinition, TryDefinition, FinallyDefinition, ExceptDefinition } from "@/types/types";

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
            let jointTypes = (store.state.currentFrame.caretPosition === CaretPosition.below) ?
                [...currentFrame.frameType.jointFrameTypes] : 
                [];

            //update the list of joint frames depending on where we are in the joint frames structure to respect the rules
            if(jointTypes.length > 0){
                const rootJointFrame = (currentFrame.jointParentId > 0) ? store.state.frameObjects[currentFrame.jointParentId] : currentFrame;

                //Remove "finally" in joint frames allwed after "else" if we are in anything else than in a "try"
                if(rootJointFrame.frameType !== TryDefinition && jointTypes.includes(FinallyDefinition.type)){
                    jointTypes.splice(
                        jointTypes.indexOf(FinallyDefinition.type),
                        1
                    );
                }

                //remove joint frames that can ony be included once if they already are in the current joint frames structure
                const uniqueJointFrameTypes = [ElseDefinition, FinallyDefinition];
                uniqueJointFrameTypes.forEach((frameDef) => {
                    if(jointTypes.includes(frameDef.type) &&
                        rootJointFrame.jointFrameIds.find((jointFrameId) => store.state.frameObjects[jointFrameId]?.frameType === frameDef) !== undefined){
                        jointTypes.splice(
                            jointTypes.indexOf(frameDef.type),
                            1
                        );
                    }
                });
                
                //ensure the intermediate following joint frames orders are respected: if > elseif > else and try > except > else > finally
                if(rootJointFrame.jointFrameIds.length > 0) {
                    const isCurrentFrameIntermediateJointFrame = (currentFrame.id === rootJointFrame.id 
                        || rootJointFrame.jointFrameIds.indexOf(currentFrame.id) < rootJointFrame.jointFrameIds.length -1);
                  
                    //Forbid every frame if we are in an intermediate joint, no frame should be added except allowed joint frames
                    if(isCurrentFrameIntermediateJointFrame ) {
                        forbiddenTypes = Object.values(AllFrameTypesIdentifier);
                    }
                  
                    //workout what types can be left for if and try joint frames structures.
                    if(rootJointFrame.frameType === IfDefinition){  
                        //"if" joint frames --> only "elif" can be added after an intermediate joint frame                   
                        if(isCurrentFrameIntermediateJointFrame) {
                            jointTypes = jointTypes.filter((type) => type !== ElseDefinition.type);
                        }
                    }
                    else if (rootJointFrame.frameType === TryDefinition){
                        const hasFinally = (rootJointFrame.jointFrameIds.find((jointFrameId) => store.state.frameObjects[jointFrameId]?.frameType === FinallyDefinition) !== undefined);
                        const hasElse = (rootJointFrame.jointFrameIds.find((jointFrameId) => store.state.frameObjects[jointFrameId]?.frameType === ElseDefinition) !== undefined);
                        const hasExcept = (rootJointFrame.jointFrameIds.find((jointFrameId) => store.state.frameObjects[jointFrameId]?.frameType === ExceptDefinition) !== undefined);

                        //"try" joint frames & "except" joint frames --> we make sure that "try" > "except" (n frames) > "else" and "finally" order is respected
                        if(currentFrame.frameType === TryDefinition){
                            if(hasElse && !hasFinally){
                                jointTypes.splice(
                                    jointTypes.indexOf(FinallyDefinition.type),
                                    1
                                );
                            }
                            if(hasExcept){
                                uniqueJointFrameTypes.forEach((frameType) => {
                                    if(jointTypes.includes(frameType.type)){
                                        jointTypes.splice(
                                            jointTypes.indexOf(frameType.type),
                                            1
                                        );
                                    }
                                });
                            }
                        }
                        else if( currentFrame.frameType === ExceptDefinition){
                            //if this isn't the last expect in the joint frames structure, we need to know what is following it.
                            const indexOfCurrentFrameInJoints = (rootJointFrame.jointFrameIds.indexOf(currentFrame.id));
                            if(indexOfCurrentFrameInJoints < rootJointFrame.jointFrameIds.length -1){
                                //This "except" is not the last joint frame: we check if the following joint frame is "except"
                                //if so, we remove "finally" and "else" from the joint frame types (if still there) to be sure 
                                //none of these type frames can be added immediately after which could result in "...except > finally/else > except..."
                                if(store.state.frameObjects[rootJointFrame.jointFrameIds[indexOfCurrentFrameInJoints + 1]]?.frameType === ExceptDefinition){
                                    uniqueJointFrameTypes.forEach((frameType) => {
                                        if(jointTypes.includes(frameType.type)){
                                            jointTypes.splice(
                                                jointTypes.indexOf(frameType.type),
                                                1
                                            );
                                        }
                                    }); 
                                }
                                //And if this "except" frame is followed by an "else" but no "finally" is present, we remove "finally"
                                //to avoid "... except > finally > else"
                                else if(hasElse && !hasFinally){
                                    jointTypes.splice(
                                        jointTypes.indexOf(FinallyDefinition.type),
                                        1
                                    );                                   
                                }
                            }
                        }
                    }
                }

            }
            
            //remove the commands that are forbidden and not defined as joint frames
            const filteredCommands = { ...frameCommandsDefs.FrameCommandsDefs};
            for (const frameType in frameCommandsDefs.FrameCommandsDefs) {
                if(forbiddenTypes.includes(frameCommandsDefs.FrameCommandsDefs[frameType].type.type) 
                    && !jointTypes.includes(frameCommandsDefs.FrameCommandsDefs[frameType].type.type)){
                    Vue.delete(
                        filteredCommands,
                        frameType
                    );
                }
            }
            return filteredCommands;
        },
    },

    created() {
        window.addEventListener(
            "keyup",
            //Labda is used instead of `function` here as it preserves `this`
            (event: KeyboardEvent) => {
                if ( event.key === "ArrowDown" || event.key === "ArrowUp" ) {
                    //first we remove the focus of the current active element (to avoid editable slots to keep it)
                    (document.activeElement as HTMLElement).blur();
                    store.dispatch(
                        "changeCaretPosition",
                        event.key
                    );
                }
                else if (!store.state.isEditing && ( event.key === "ArrowLeft" || event.key === "ArrowRight")) { 
                    store.dispatch(
                        "leftRightKey",
                        event.key
                    );
                }
                else {
                    this.onKeyUp(event);
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
        onKeyUp(event: KeyboardEvent) {
            if (store.state.isEditing === false) {
                if(event.key == "Delete" || event.key == "Backspace"){
                    //delete a frame
                    store.dispatch(
                        "deleteCurrentFrame",
                        event.key
                    );
                }
                else{
                    //add the frame in the editor if allowed otherwise, do nothing
                    if(this.frameCommands[event.key.toLowerCase()] !== undefined){
                        store.dispatch(
                            "addFrameWithCommand",
                            this.frameCommands[event.key.toLowerCase()].type                
                        );
                        store.dispatch(
                            "leftRightKey",
                            "ArrowRight"                
                        );
                    }
                    
                }                
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
