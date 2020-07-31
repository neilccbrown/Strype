<template>
    <div class="container">
        <div>
            <button v-on:click="flash">Connect Serial</button>
            <button v-on:click="downloadHex">Download Hex</button>
            <button v-on:click="downloadPython">Download Python</button>
        </div>
        <hr />
        <div class="temp-div">
            <span>temp div here --> components for Python/microbit</span>
        </div>
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

export default Vue.extend({
    name: "Commands",
    store,

    components: {
        FrameCommand,
    },

    computed: {
        frameCommands: function () {
            return frameCommandsDefs.FrameCommandsDefs;
        },
    },

    created: function () {
        window.addEventListener(
            "keyup",
            this.onKeyUp
        );
    },
    methods: {
        flash: function () {
            if (navigator.usb) {
                flashData();
            }
            else {
                alert("This browser does not support webUSB connections. Please use a browser such as Google Chrome.");
            }
        },
        downloadHex: function () {
            downloadHex();
        },
        downloadPython: function () {
            downloadPython();
        },
        onKeyUp: function (event: KeyboardEvent) {
            if (
                event.key === "ArrowDown" || event.key=="ArrowUp"
            ) {
                store.dispatch(
                    "changeCaretPosition",
                    event.key
                );

            }
            else if (
                store.state.isEditing === false &&
                this.frameCommands[event.key] !== undefined
            ) {
                //add the frame in the editor
                store.dispatch(
                    "addFrameWithCommand",
                    this.frameCommands[event.key].type
                );
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

.temp-div {
    border-bottom: #383b40 1px solid;
}
</style>
