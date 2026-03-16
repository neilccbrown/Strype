<template>
    <div class="joint-frames">
        <Frame
            v-for="frame in jointFrames"
            :ref="getFrameUID(frame.id)"
            :key="frame.frameType.type + '-id:' + frame.id"
            :frameId="frame.id"
            :isDisabled="frame.isDisabled || isDisabled"
            :isBeingDragged="isBeingDragged"
            :frameType="frame.frameType"
            :isJointFrame="true"
            :isParentSelected="isParentSelected"
            :allowChildren="frame.frameType.allowChildren"
            :caretVisibility="frame.caretVisibility"
        />
    </div>
</template>

<script setup lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import { computed } from "vue";
import { useStore } from "@/store/store";
import { FrameObject } from "@/types/types";
import { getFrameUID } from "@/helpers/editor";


//////////////////////
//     Component    //
//////////////////////
const props = defineProps<{
    jointParentId: number, // Unique Indentifier for each Frame
    isDisabled: boolean,
    isBeingDragged: boolean,
    isParentSelected: boolean,
}>();

const appStore = useStore();

const jointFrames = computed({
    get(): FrameObject[] {
        return appStore.getJointFramesForFrameId(props.jointParentId);
    },
    set() {
        return;
    },
});
</script>

<style lang="scss">
.content-children {
    margin-left: 0px;
}
</style>
