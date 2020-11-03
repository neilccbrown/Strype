<template>
    <div class="commands">
        <div v-bind:id="buttonsContainerUIID" class="commands-container">
            <button  v-if="uploadThroughUSB" @click="flash" v-t="'buttonLabel.uploadToMicrobit'"/>
            <button @click="downloadHex" v-t="'buttonLabel.downloadHex'"/>
            <button @click="downloadPython" v-t="'buttonLabel.downloadPython'"/>
        </div>
        <div v-if="showProgress" class="progress cmd-progress-container">
            <div 
                class="progress-bar progress-bar-striped bg-info" 
                role="progressbar"
                :style="progressPercentWidthStyle" 
                :aria-valuenow="progressPercent"
                aria-valuemin="0"
                aria-valuemax="100"
                >
                <span v-t="'action.uploadingToMicrobit'" class="progress-bar-text"></span>
            </div>
        </div>
        <hr />
        <div v-bind:id="commandsContainerUUID">
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
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import store from "@/store/store";
import AddFrameCommand from "@/components/AddFrameCommand.vue";
import ToggleFrameLabelCommand from "@/components/ToggleFrameLabelCommand.vue";
import { flashData } from "@/helpers/webUSB";
import { getCommandsContainerUIID, getEditorButtonsContainerUIID, getTutorialUIID } from "@/helpers/editor"
import { downloadHex, downloadPython } from "@/helpers/download";
import { AddFrameCommandDef,ToggleFrameLabelCommandDef, WebUSBListener, MessageDefinitions, FormattedMessage, FormattedMessageArgKeyValuePlaceholders, FrameObject, CaretPosition} from "@/types/types";
import {KeyModifier} from "@/constants/toggleFrameLabelCommandsDefs"
import browserDetect from "vue-browser-detect-plugin";

export default Vue.extend({
    name: "Commands",
    store,

    components: {
        AddFrameCommand,
        ToggleFrameLabelCommand,
    },

    data: function () {
        return {
            showProgress: false,
            progressPercent: 0,
            uploadThroughUSB: false,
        }
    },

    beforeMount() {
        Vue.use(browserDetect);
        this.uploadThroughUSB = (this.$browserDetect.isChrome || this.$browserDetect.isOpera || this.$browserDetect.isEdge);
    },

    computed: {
        buttonsContainerUIID(): string {
            return getEditorButtonsContainerUIID();
        },

        commandsContainerUUID(): string {
            return getCommandsContainerUIID();
        },

        addFrameCommands(): Record<string, AddFrameCommandDef> {
            //We retrieve the add frame commands associated with the current frame 
            //if the frame is enabled, we always check, if it is disabled we return no frame when caret is body, and check when caret is below
            const currentFrame: FrameObject = store.getters.getCurrentFrameObject();
            if(currentFrame.isDisabled && ((currentFrame.caretVisibility === CaretPosition.body) ? true : !store.getters.canAddFrameBelowDisabled(currentFrame.id))){
                return {};
            }
            
            return store.getters.getCurrentFrameAddFrameCommands(store.state.currentFrame.id, store.state.currentFrame.caretPosition);
        },

        toggleFrameLabelCommands(): ToggleFrameLabelCommandDef[] {
            //We retrieve the toggle frame label commands associated with the current frame (if editable slots are focused (i.e. editing))
            if(store.getters.getIsEditing()){
                return store.getters.getCurrentFrameToggleFrameLabelCommands();
            }
            
            return [];
        },

        progressPercentWidthStyle(): string {
            return "width: " + this.$data.progressPercent + "%;";
        },
    },

    created() {
        window.addEventListener(
            "keydown",
            (event: KeyboardEvent) => {
                const tutorial = document.getElementById(getTutorialUIID());
                if(tutorial){
                    //if the tutorial is displayed, we don't do anything here
                    event.preventDefault();
                    return;
                }

                if((event.ctrlKey || event.metaKey) && (event.key === "z" || event.key === "y")) {
                    //undo-redo
                    store.dispatch(
                        "undoRedo",
                        (event.key === "z")
                    );
                    event.preventDefault();
                }
            }
        );
        
        window.addEventListener(
            "keyup",
            //lambda is has the advantage over a `function` that it preserves `this`. not used in this instance, just mentioning for future reference.
            (event: KeyboardEvent) => {
                const tutorial = document.getElementById(getTutorialUIID());
                if(tutorial){
                    //if the tutorial is displayed, we don't do anything here
                    event.preventDefault();
                    return;
                }
                
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
                        }
                    }
                }
            }                
        );
    },

    methods: {
        flash() {
            if (navigator.usb) {
                const webUSBListener: WebUSBListener = {
                    onUploadProgressHandler: (percent) => {
                        this.$data.showProgress = true;
                        this.$data.progressPercent = percent;
                    },

                    onUploadSuccessHandler: () => {
                        store.commit(
                            "setMessageBanner",
                            MessageDefinitions.UploadSuccessMicrobit
                        );

                        this.$data.showProgress = false;

                        //don't leave the message for ever
                        setTimeout(()=>store.commit(
                            "setMessageBanner",
                            MessageDefinitions.NoMessage
                        ), 7000);
                    },
                    onUploadFailureHandler: (error) => {
                        this.$data.showProgress = false;
 
                        const message = MessageDefinitions.UploadFailureMicrobit;
                        const msgObj: FormattedMessage = (message.message as FormattedMessage);
                        msgObj.args[FormattedMessageArgKeyValuePlaceholders.error.key] = msgObj.args.errorMsg.replace(FormattedMessageArgKeyValuePlaceholders.error.placeholderName, error);

                        store.commit(
                            "setMessageBanner",
                            message
                        );

                        this.$data.showProgress = false;

                        //don't leave the message for ever
                        setTimeout(()=>store.commit(
                            "setMessageBanner",
                            MessageDefinitions.NoMessage
                        ), 7000);
                    },
                };
                flashData(webUSBListener);
            }
            else {
                alert("This browser does not support webUSB connections. Please use a browser such as Google Chrome.");
            }
        },
        downloadHex() {
            if(store.getters.getPreCompileErrors().length>0) {
                alert("Please fix existing errors first.");
            }
            else {
                downloadHex(); 
                store.dispatch("setMessageBanner", MessageDefinitions.DownloadHex);
            }
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
    background-color: #E2E7E0;
}

.cmd-progress-container {
    margin-top: 5px;
    background-color: #E2E7E0 !important;
    border: 1px lightgrey solid;
}

@mixin centerer {
  position: absolute;
  left: 50%;
  transform: translate(-50%, -50%);
}

.progress-bar-text {
    @include centerer;
    color:#fefefe !important;
    text-align: left !important;
    font-weight: bold;
}

.commands-container{
    display: inline-block;
}
</style>
