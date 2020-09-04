<template>
    <div id="app" class="container-fluid h-100">
        <div class="row h-100">
            <div class="col-8">
                <FrameContainer
                    v-for="container in containerFrames"
                    v-bind:key="container.frameType.type + '-id:' + container.id"
                    v-bind:id="container.id"
                    v-bind:containerLabel="container.frameType.labels[0].label"
                    v-bind:caretVisibility="container.caretVisibility"
                />
            </div>
            <Commands class="col-4 h-100" />
        </div>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
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
    },

    methods: {
        toggleEdition(): void {
            store.commit(
                "setEditFlag",
                false
            );
        },
    },

});
</script>

<style lang="scss">
html,body {
    margin: 0px;
    height: 100%;
}
#app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    color: #2c3e50;
    box-sizing: border-box;
}

#app form {
    text-align: center;
}

#temp-container {
    margin-top: 60px;
    flex-grow: 1;
}
</style>
