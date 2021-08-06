<template>
    <div class="commands">
        <div :id="buttonsContainerUIID" class="commands-container">
            <button type="button" v-if="uploadThroughUSB" @click="flash" v-t="'buttonLabel.uploadToMicrobit'" class="btn btn-secondary cmd-button-margin cmd-button"/>
            <button type="button" @click="downloadHex" v-t="(uploadThroughUSB)?'buttonLabel.downloadHex':'buttonLabel.sendToMicrobit'" class="btn btn-secondary cmd-button-margin cmd-button"/>
            <button type="button" @click="downloadPython" v-t="'buttonLabel.downloadPython'" class="btn btn-secondary cmd-button"/>
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
        <div @mousedown.prevent.stop @mouseup.prevent.stop>
            <b-tabs id="commandsTabs" content-class="mt-2" v-model="tabIndex">
                <b-tab :title="$t('commandTabs.0')" active :title-link-class="getTabClasses(0)">
                    <div :id="commandsContainerUUID" class="command-tab-content" >
                        <div id="addFramePanel" v-if="!isEditing">
                            <div class="frameCommands">
                                <AddFrameCommand
                                    v-for="addFrameCommand in addFrameCommands"
                                    :key="addFrameCommand[0].type.type"
                                    :type="addFrameCommand[0].type.type"
                                    :shortcut="addFrameCommand[0].shortcut"
                                    :symbol="
                                        addFrameCommand[0].symbol !== undefined
                                            ? addFrameCommand[0].symbol
                                            : addFrameCommand[0].shortcut
                                    "
                                    :description="addFrameCommand[0].description"
                                    :index="
                                        addFrameCommand[0].index!==undefined
                                        ? addFrameCommand[0].index
                                        : 0
                                    "
                                />
                            </div>
                        </div>
                        <div class="toggleFrameLabelCommands">
                            <ToggleFrameLabelCommand
                                v-for="toggleFrameLabelCommand in toggleFrameLabelCommands"
                                :key="toggleFrameLabelCommand.type"
                                :type="toggleFrameLabelCommand.type"
                                :modifierKeyShortcuts="toggleFrameLabelCommand.modifierKeyShortcuts"
                                :keyShortcut="toggleFrameLabelCommand.keyShortcut"
                                :description="toggleFrameLabelCommand.displayCommandText"
                            />
                        </div>
                    </div>
                </b-tab>
                <b-tab :title="$t('commandTabs.1')" :title-link-class="getTabClasses(1)"><APIDiscovery  class="command-tab-content"/></b-tab>
            </b-tabs>
        </div>
        <text id="userCode"></text>
        <span id="keystrokeSpan"></span>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import store from "@/store/store";
import AddFrameCommand from "@/components/AddFrameCommand.vue";
import ToggleFrameLabelCommand from "@/components/ToggleFrameLabelCommand.vue";
import APIDiscovery from "@/components/APIDiscovery.vue"
import { flashData } from "@/helpers/webUSB";
import { getCommandsContainerUIID, getEditorButtonsContainerUIID, getTutorialUIID, getEditorMiddleUIID, getMenuLeftPaneUIID, getCommandsRightPaneContainerId } from "@/helpers/editor"
import { downloadHex, downloadPython } from "@/helpers/download";
import { AddFrameCommandDef,ToggleFrameLabelCommandDef, WebUSBListener, MessageDefinitions, FormattedMessage, FormattedMessageArgKeyValuePlaceholders, FrameObject, CaretPosition, ImportDefinition} from "@/types/types";
import { KeyModifier } from "@/constants/toggleFrameLabelCommandsDefs"
import browserDetect from "vue-browser-detect-plugin";
import $ from "jquery";
import Parser from "@/parser/parser";

export default Vue.extend({
    name: "Commands",
    store,

    components: {
        AddFrameCommand,
        ToggleFrameLabelCommand,
        APIDiscovery,
    },

    data: function () {
        return {
            showProgress: false,
            progressPercent: 0,
            uploadThroughUSB: false,
            tabIndex: 0,
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

        isEditing(): boolean {
            return store.getters.getIsEditing();
        },

        addFrameCommands(): Record<string, AddFrameCommandDef[]> {
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
        if(store.state.showKeystroke){
            window.addEventListener(
                "dblclick",
                () => {
                    (document.getElementById("keystrokeSpan") as HTMLSpanElement).textContent = "[double click]";
                    //leave the message for a short moment only
                    setTimeout(()=> (document.getElementById("keystrokeSpan") as HTMLSpanElement).textContent = "", 1000);    
                }
            );
            
            window.addEventListener(
                "mousedown",
                (event: MouseEvent) => {
                    let mouseButton = "unknown mouse click";
                    switch(event.button){
                    case 0:
                        mouseButton = "left click";
                        break;
                    case 1:
                        mouseButton = "middle click";
                        break;
                    case 2:
                        mouseButton = "right click";
                        break;
                    }
                    (document.getElementById("keystrokeSpan") as HTMLSpanElement).textContent = "["+mouseButton+"]";
                    //leave the message for a short moment only
                    setTimeout(()=> (document.getElementById("keystrokeSpan") as HTMLSpanElement).textContent = "", 1000);    
                }
            );
        }

        window.addEventListener(
            "keydown",
            (event: KeyboardEvent) => {
                //if we requested to log keystroke, display the keystroke event in an unobtrusive location
                //when editing, we don't show the keystroke for basic keys (like [a-zA-Z0-1]), only those whose key value is longer than 1
                if(store.state.showKeystroke && (!store.state.isEditing || event.key.match(/^.{2,}$/))){
                    (document.getElementById("keystrokeSpan") as HTMLSpanElement).textContent = "["+event.key+"]";
                    //leave the message for a short moment only
                    setTimeout(()=> (document.getElementById("keystrokeSpan") as HTMLSpanElement).textContent = "", 1000);         
                }

                const tutorial = document.getElementById(getTutorialUIID());
                if(tutorial !== null || store.getters.isAppMenuOpened()){
                    if(store.getters.isAppMenuOpened() && store.getters.getIsEditing()){
                        return;
                    }
                    //if the tutorial or the application menu are displayed, we don't do anything here
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
                    return;
                }

                const isEditing = store.getters.getIsEditing();

                //prevent default scrolling and navigation
                if (!isEditing && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "ArrowLeft" || event.key === "ArrowRight")) {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp" ) {
                        //first we remove the focus of the current active element (to avoid editable slots to keep it)
                        (document.activeElement as HTMLElement).blur();

                        if(event.shiftKey){
                            store.dispatch( 
                                "selectMultipleFrames",
                                event.key
                            );
                        }
                        else {
                            store.dispatch(
                                "changeCaretPosition",
                                event.key
                            );
                        }
                    }
                    else{
                        //at this stage, left/right arrows are handled only if not editing: editing cases are directly handled by EditableSlots.
                        store.dispatch(
                            "leftRightKey",
                            event.key
                        );
                        event.stopImmediatePropagation();
                        event.preventDefault();
                    }
                    return;
                }

                //prevent default browser behaviours when an add frame command key is typed (letters and spaces) (e.g. Firefox "search while typing")
                if(!isEditing && !(event.ctrlKey || event.metaKey) && (event.key.match(/^[a-z A-Z=]$/) || event.key === "Backspace")){
                    event.preventDefault();
                    return;
                }

                //prevent specific characters in specific frames (cf details)
                if(isEditing){
                    const frameType = store.getters.getCurrentFrameObject().frameType.type;
                    //space in import frame's editable slots
                    if(frameType === ImportDefinition.type && event.key === " "){
                        event.preventDefault();
                        return;
                    }
                }
            }
        );
        
        window.addEventListener(
            "keyup",
            //lambda is has the advantage over a `function` that it preserves `this`. not used in this instance, just mentioning for future reference.
            (event: KeyboardEvent) => {
                const tutorial = document.getElementById(getTutorialUIID());
                if(tutorial !== null || store.getters.isAppMenuOpened()){
                    //if the tutorial or the application menu are displayed, we don't do anything here
                    event.preventDefault();
                    return;
                }

                const isEditing = store.getters.getIsEditing();
                const ignoreKeyEvent: boolean = store.getters.getIgnoreKeyEvent();

                if(event.key == "Escape"){
                    if(store.getters.areAnyFramesSelected()){
                        store.commit("unselectAllFrames");
                        store.commit("makeSelectedFramesVisible");
                    }
                    if(isEditing){
                        (document.activeElement as HTMLElement).blur();
                        store.commit("setEditFlag",false);
                    }
                }
                else {
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
                    else if(!(event.ctrlKey || event.metaKey)){
                        if(event.key == "Delete" || event.key == "Backspace"){
                            if(!ignoreKeyEvent){
                                //delete a frame or a frame selection
                                store.dispatch(
                                    "deleteFrames",
                                    event.key
                                );
                                event.stopImmediatePropagation();
                            }
                            else{
                                store.commit("setIgnoreKeyEvent", false);
                            }
                        }
                        //add the frame in the editor if allowed
                        else if(this.addFrameCommands[event.key.toLowerCase()] !== undefined){
                            store.dispatch(
                                "addFrameWithCommand",
                                this.addFrameCommands[event.key.toLowerCase()][0].type                
                            );
                        }
                    }
                }
            }                
        );
    },

    mounted() {
        //scroll events on the left pane (menu) and right pane (commands) are forwarded to the editor
        document.getElementById(getMenuLeftPaneUIID())?.addEventListener(
            "wheel",
            this.handleAppScroll,
            false
        );

        document.getElementById(getCommandsRightPaneContainerId())?.addEventListener(
            "wheel",
            this.handleAppScroll,
            false
        );
    },

    methods: {
        handleAppScroll(event: WheelEvent) {
            const currentScroll = $("#"+getEditorMiddleUIID()).scrollTop();
            $("#"+getEditorMiddleUIID()).scrollTop((currentScroll??0) + (event as WheelEvent).deltaY/2);
        },

        flash() {
            let proceed = true;
            if(store.getters.getPreCompileErrors().length>0) {
                proceed = false;
                //a "fake" confirm, just to use the nicer version from Vue. It really still behaves as an alert.
                Vue.$confirm({
                    message: this.$i18n.t("appMessage.preCompiledErrorNeedFix") as string,
                    button: {
                        yes: this.$i18n.t("buttonLabel.ok"),
                    },
                });    
            }
            else{
                //before we actually try to check webUSB, we make sure the code doesn't have any other errors (tigerpython)
                //(we clear the errors because when the code is parsed, the lines with errors are ignored from the output
                // so we need to reset those errors before reparsing - errors will be "reconstructed" in getErrorsFormatted())
                store.commit("clearAllErrors");
                const parser = new Parser();
                const out = parser.parse();
                const errors = parser.getErrorsFormatted(out);
                if (errors) {
                    proceed = false;
                    //a "fake" confirm, just to use the nicer version from Vue. It really still behaves as an alert.
                    Vue.$confirm({
                        message: this.$i18n.t("appMessage.preCompiledErrorNeedFix") as string,
                        button: {
                            yes: this.$i18n.t("buttonLabel.ok"),
                        },
                    });    
                }
            }            
            
            if(proceed){
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
                    //a "fake" confirm, just to use the nicer version from Vue. It really still behaves as an alert.
                    Vue.$confirm({
                        message: this.$i18n.t("appMessage.noWebUSB") as string,
                        button: {
                            yes: this.$i18n.t("buttonLabel.ok"),
                        },
                    });    
                }
            }
        },

        downloadHex() {
            if(store.getters.getPreCompileErrors().length > 0) {
                //a "fake" confirm, just to use the nicer version from Vue. It really still behaves as an alert.
                Vue.$confirm({
                    message: this.$i18n.t("appMessage.preCompiledErrorNeedFix") as string,
                    button: {
                        yes: this.$i18n.t("buttonLabel.ok"),
                    },
                });    
                return;
            }
            //clear any code error before checking the code (because otherwise the parsing will be wrong - errors will be "reacreated" anyway)
            store.commit("clearAllErrors");
            const succeeded = downloadHex(); 
            //We show the image only if the download has succeeded
            if(succeeded) {
                store.dispatch("setMessageBanner", MessageDefinitions.DownloadHex);
            }
        },

        downloadPython() {
            if(store.getters.getPreCompileErrors().length>0) {
                //a "fake" confirm, just to use the nicer version from Vue. It really still behaves as an alert.
                Vue.$confirm({
                    message: this.$i18n.t("appMessage.preCompiledErrorNeedFix") as string,
                    button: {
                        yes: this.$i18n.t("buttonLabel.ok"),
                    },
                });    
                return;
            }
            //clear any code error before checking the code (because otherwise the parsing will be wrong - errors will be "reacreated" anyway)
            store.commit("clearAllErrors");
            downloadPython(); 
        },

        getTabClasses(tabIndex: number): string[] {
            if(tabIndex == this.tabIndex){
                return ["commands-tab commands-tab-active"]
            }
            else {
                return ["commands-tab"]
            }
        },
    },
});
</script>

<style lang="scss">
.commands {
    border-left: #383b40 1px solid;
    color: #252323;
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

#keystrokeSpan{
    bottom:2px;
    left: 50%;
    transform: translate(-50%, 0);
    position: absolute;
    font-size:large;
    color:#666666;
}

.cmd-button{
    padding: 1px 6px 1px 6px !important;
    margin-top: 5px;
}

.cmd-button-margin{
    margin-right: 5px;
}

.commands-tab{
    color: #787978 !important;
    border-color: #bbc8b6 !important;
    background-color: transparent !important;
    margin-top: 10px;
}

.commands-tab-active{
    color: #274D19 !important;
    border-bottom-color: #E2E7E0 !important;
}

.command-tab-content {
 margin-left: 5px;
}

//the following overrides the bootstrap tab generated styles
#commandsTabs ul{
    border-bottom-color: #bbc8b6 !important;
}
</style>
