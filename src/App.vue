<template>
    <div id="app">
        <div id="editor">
            <div class="top">
                <MessageBanner v-if="showMessage"/>
            </div>
            <div class="left">
               <FrameContainer
                        v-for="container in containerFrames"
                        v-bind:key="container.frameType.type + '-id:' + container.id"
                        v-bind:id="container.id"
                        v-bind:containerLabel="container.frameType.labels[0].label"
                        v-bind:caretVisibility="container.caretVisibility"
                />
            </div>
            <div class="right">
                <textarea v-model="mymodel"></textarea>
            </div>
        </div>
        <Commands />
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
import { FrameObject } from "@/types/types";

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

        //this helps for debugging purposes --> printing the state in the screen
        mymodel(): string {
            return JSON.stringify(
                store.getters.getFrameObjects(),
                null,
                "  "
            );
        },

        showMessage(): boolean {
            return store.state.isMessageBannerOn;
        },
    },

    methods: {
        toggleEdition(): void {
            store.commit("toggleEditFlag");
        },
    },

});
</script>

<style lang="scss">
body {
    margin: 0px;
}
#app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    color: #2c3e50;
    display: flex;
    box-sizing: border-box;
    height: 100%;
    min-height: 100vh;
}

.top {
    text-align: center;
    margin-top: 5px;
    margin-bottom: 15px;
    flex-grow: 1;
    height: 50px;
}

.left {
    width: 70%;
}

.right {
    width: 30%;
}

#editor {
    margin-top: 0px;
    flex-grow: 1;
}
</style>
