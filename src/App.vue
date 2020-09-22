<template>
    <div id="app" class="container-fluid">
        <div class="row">
            <div id="editor" class="col-8">
                <div class="top">
                    <MessageBanner 
                        v-if="showMessage"
                    />
                </div>
                <div>
                    <FrameContainer
                        v-for="container in containerFrames"
                        v-bind:key="container.frameType.type + '-id:' + container.id"
                        v-bind:id="container.id"
                        v-bind:containerLabel="container.frameType.labels[0].label"
                        v-bind:caretVisibility="container.caretVisibility"
                        v-bind:frameType="container.frameType"
                    />
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
import MessageBanner from "@/components/MessageBanner.vue"
import FrameContainer from "@/components/FrameContainer.vue";
import Commands from "@/components/Commands.vue";
import store from "@/store/store";
import { FrameObject, MessageTypes } from "@/types/types";


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
    },

    data() {
        return {
            newFrameType: "",
            currentParentId: 0,
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
