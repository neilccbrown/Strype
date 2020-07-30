<template>
    <div id="app">
        <div id="temp-container">
            <div class="left">
                <Draggable
                    v-model="frames"
                    group="a"
                    draggable=".frame"
                    v-on:change="handleDragAndDrop($event)"
                >
                    <Frame
                        v-for="frame in frames"
                        v-bind:key="frame.frameType.type + '-id:' + frame.id"
                        v-bind:id="frame.id"
                        v-bind:frameType="frame.frameType"
                        v-bind:isJointFrame="false"
                        v-bind:caretVisibility="frame.caretVisibility"
                        v-bind:allowChildren="frame.frameType.allowChildren"
                        class="frame"
                    />
                </Draggable>
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
import Frame from "@/components/Frame.vue";
import Commands from "@/components/Commands.vue";
import store from "@/store/store";
import Draggable from "vuedraggable";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "App",
    store,

    components: {
        Frame,
        Draggable,
        Commands,
    },

    data: function () {
        return {
            newFrameType: "",
            currentParentId: 0,
        };
    },

    computed: {
        frames: {
            // gets the frames objects which are in the root
            get: function (this) {
                return store.getters.getFramesForParentId(0);
            },
            // setter
            set: function () {
                // Nothing to be done here.
                // Event handlers call mutations which change the state
            },
        },

        //this helps for debugging purposes --> printing the state in the screen
        mymodel: {
            get() {
                return JSON.stringify(
                    store.getters.getFrameObjects(),
                    null,
                    "  "
                );
            },
        },
    },

    // created: function() {
    //     window.addEventListener(
    //         "keyup",
    //         this.onKeyUp
    //     );

    // },
    methods: {
        toggleEdition: function () {
            store.commit("toggleEditFlag");
        },

        handleDragAndDrop: function (event: Event) {
            store.commit(
                "updateFramesOrder",
                {
                    event: event,
                    eventParentId: 0,
                }
            );
        },

        onKeyUp: function(event: KeyboardEvent) {
            if (
                event.key === "ArrowDown" || event.key=="ArrowUp"
            ) {
                store.dispatch(
                    "changeCaretPosition",
                    event.key
                );

            }
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

#app form {
    text-align: center;
}

.left {
    width: 70%;
}

.right {
    width: 30%;
}

#temp-container {
    margin-top: 60px;
    flex-grow: 1;
}
</style>
