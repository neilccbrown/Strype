<template>
    <div id="app" class="container-fluid">
        <vue-confirm-dialog />
        <tutorial/>
        <div v-if="showAppProgress" class="app-progress-pane">
            <div class="app-progress-container">
                <div class="progress">
                    <div 
                        class="progress-bar progress-bar-striped bg-info progress-bar-animated" 
                        role="progressbar"
                        style="width: 100%"
                        aria-valuenow="100"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        >
                        <span class="progress-bar-text">{{progressbarMessage}}</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="row">
            <div id="editor" class="col-8">
                <div class="top">
                    <MessageBanner 
                        v-if="showMessage"
                    />
                </div>
                <div class="row no-gutters" >
                    <Menu 
                        :id="menuUIID" 
                        class="col-auto noselect"
                    />
                    <div class="col">
                        <div :id="editorUIID" class="editor-code-div noselect" >
                            <FrameContainer
                                v-for="container in containerFrames"
                                :key="container.frameType.type + '-id:' + container.id"
                                :id="getFrameContainerUIID(container.id)"
                                :frameId="container.id"
                                :containerLabel="container.frameType.labels[0].label"
                                :caretVisibility="container.caretVisibility"
                                :frameType="container.frameType"
                            />
                        </div>
                    </div>
                </div>
            </div>
            <Commands :id="commandsContainerId" class="col-4 noselect" />
        </div>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import MessageBanner from "@/components/MessageBanner.vue";
import FrameContainer from "@/components/FrameContainer.vue";
import Commands from "@/components/Commands.vue";
import Menu from "@/components/Menu.vue";
import Tutorial from "@/components/Tutorial.vue";
import store from "@/store/store";
import { AppEvent, FrameObject, MessageTypes } from "@/types/types";
import { getFrameContainerUIID, getMenuLeftPaneUIID, getEditorMiddleUIID, getCommandsRightPaneContainerId, isElementEditableSlotInput, getFrameContextMenuUIID } from "./helpers/editor";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "App",
    store,

    components: {
        MessageBanner,
        FrameContainer,
        Commands,
        Menu,
        Tutorial,
    },

    data() {
        return {
            newFrameType: "",
            currentParentId: 0,
            showAppProgress: false,
            progressbarMessage: "",
        };
    },

    computed: {            
        // gets the container frames objects which are in the root
        containerFrames(): FrameObject[] {
            return store.getters.getFramesForParentId(0);
        },

        showMessage(): boolean {
            return store.getters.getIsMessageBannerOn();
        },

        menuUIID(): string {
            return getMenuLeftPaneUIID();
        },

        editorUIID(): string {
            return getEditorMiddleUIID();
        },

        commandsContainerId(): string {
            return getCommandsRightPaneContainerId();
        },

    },

    created() {
        window.addEventListener("beforeunload", function(event) {
            // Browsers won't display a customised message, and can detect when to prompt the user,
            // so we don't need to do anything special.
            event.returnValue = true;
        });

        //prevent the native context menu to be shown at some places we don't want it to be shown (basically everywhere but editable slots)
        window.addEventListener(
            "contextmenu",
            (event: MouseEvent) => {
                if(!isElementEditableSlotInput(event.target)){
                    event.stopImmediatePropagation();
                    event.preventDefault();
                }
                else{
                    const currentCustomMenuId: string = store.getters.getContextMenuShownId();
                    if(currentCustomMenuId.length > 0){
                        const customMenu = document.getElementById(getFrameContextMenuUIID(currentCustomMenuId));
                        customMenu?.setAttribute("hidden", "true");
                    }
                }
            }
        );

        //register an event for WebUSB to detect when the micro:bit has been disconnected. We only do that once, and if WebUSB is available...
        if (navigator.usb) {
            navigator.usb.addEventListener("disconnect", () => store.commit("setPreviousDAPWrapper", undefined));
        }
    },

    methods: {
        applyShowAppProgress(event: AppEvent) {
            //if the progress bar is shown, we block the width of the application to the viewport
            //and revert it otherwise
            this.showAppProgress = event.requestAttention;
            if(event.requestAttention) {
                this.progressbarMessage = event.message ?? "";   
            }
            const heightVal = (this.showAppProgress) ? " 100vh": "100%";
            const overflowVal = (this.showAppProgress) ? "hidden" : "auto";
            (document.getElementsByTagName("html")[0] as HTMLHtmlElement).style.height = heightVal;
            (document.getElementsByTagName("body")[0] as HTMLBodyElement).style.height = heightVal;
            (document.getElementById("app") as HTMLDivElement).style.height = heightVal;
            (document.getElementById("app") as HTMLDivElement).style.overflow = overflowVal;
        },

        getFrameContainerUIID(frameId: number){
            return getFrameContainerUIID(frameId);
        },

        toggleEdition(): void {
            store.commit(
                "setEditFlag",
                false
            );
        },

        messageTop(): boolean {
            return store.getters.getCurrentMessage().type !== MessageTypes.imageDisplay;
        },
    },
});
</script>

<style lang="scss">

html,body {
    margin: 0px;
    height: 100vh;
    background-color: #bbc6b6 !important;
}

.app-progress-pane {
    width: 100%;
    height: 100vh;
    background-color: rgba($color: gray, $alpha: 0.7);
    position: absolute;
    left: 0px;
    z-index: 5000;
}

.app-progress-container {
    position:relative;
    top: 50vh;
    padding-left: 10%;
    padding-right:10%;
 }

#app {
    font-family: 'Source Sans Pro', sans-serif;
    font-size: 17px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    color: #2c3e50;
    box-sizing: border-box;
    height: 100vh;
    max-height: 100vh;
    overflow:hidden;
}

#editor {
    height: 100vh;
    max-height: 100vh;
}

.editor-code-div {
    overflow-y: auto;
    height: 100vh;
    max-height: 100vh;
}

.top {
    text-align: center;
    margin-left:10px;
}

.noselect {
  -webkit-touch-callout: none; /* iOS Safari */
    -webkit-user-select: none; /* Safari */
     -khtml-user-select: none; /* Konqueror HTML */
       -moz-user-select: none; /* Old versions of Firefox */
        -ms-user-select: none; /* Internet Explorer/Edge */
            user-select: none; /* Non-prefixed version, currently
                                  supported by Chrome, Edge, Opera and Firefox */
}
</style>
