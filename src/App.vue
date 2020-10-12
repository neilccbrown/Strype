<template>
    <div id="app" class="container-fluid">
        <vue-confirm-dialog></vue-confirm-dialog>
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
                    <div class="col-auto">
                        <EditorFileManager v-on:app-showprogress="applyShowAppProgress"/>
                    </div>
                    <div class="col" >
                        <FrameContainer
                            v-for="container in containerFrames"
                            v-bind:key="container.frameType.type + '-id:' + container.id"
                            v-bind:frameId="container.id"
                            v-bind:containerLabel="container.frameType.labels[0].label"
                            v-bind:caretVisibility="container.caretVisibility"
                            v-bind:frameType="container.frameType"
                        />
                    </div>
                </div>
            </div>
            <Commands class="col-4" />
        </div>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import EditorFileManager from "@/components/EditorFileManager.vue";
import MessageBanner from "@/components/MessageBanner.vue";
import FrameContainer from "@/components/FrameContainer.vue";
import Commands from "@/components/Commands.vue";
import store from "@/store/store";
import { AppEvent, FrameObject, MessageTypes } from "@/types/types";


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
        EditorFileManager,
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
    height: 100%;
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
    font-family: Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    color: #2c3e50;
    box-sizing: border-box;

}

.top {
    text-align: center;
    margin-top: 5px;
    margin-bottom: 5px;
    margin-left:10px;
}
</style>
