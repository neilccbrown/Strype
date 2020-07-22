<template>
    <div class="container">
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

export default Vue.extend({
    name: "Commands",
    store,

    components: {
        FrameCommand,
    },

    computed: {
        frameCommands: function() {
            return frameCommandsDefs.FrameCommandsDefs;
        },
    },

    created: function() {
        window.addEventListener("keyup", this.onKeyUp);
    },
    methods: {
        onKeyUp: function(event: KeyboardEvent) {
            if (
                store.state.isEditing === false &&
                this.frameCommands[event.key] !== undefined
            ) {
                //add the frame in the editor
                const frameCommand = this.frameCommands[event.key];
                const isJointFrame = store.getters.getIsJointFrame(
                    store.state.currentFrameID,
                    frameCommand.type.type
                );
                store.commit("addFrameObject", {
                    frameType: frameCommand.type,
                    id: store.state.nextAvailableId,
                    parentId: isJointFrame ? -1 : store.state.currentFrameID,
                    childrenIds: [],
                    jointParentId: isJointFrame
                        ? store.state.currentFrameID
                        : -1,
                    jointFrameIds: [],
                    contentDict: {},
                });
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
