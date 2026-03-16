<template>
    <div
        :class="{'frame-body-container frame-container-minheight':true, 'body-deletable': bodyDeletable}"
        :id="UID"
    >
        <div>
            <CaretContainer
            v-if="!isDisabled"
            :ref="getCaretContainerRef"
            :frameId="frameId"
            :caretVisibility="caretVisibility"
            :caretAssignedPosition="CaretPosition.body"
            :isFrameDisabled="isDisabled"
            />  
            <div class="frame-container-minheight">      
                <Frame
                    v-for="frame in frames"
                    :ref="getFrameUID(frame.id)"
                    :key="frame.frameType.type  + '-id:' + frame.id"
                    :frameId="frame.id"
                    :isDisabled="frame.isDisabled"
                    :isBeingDragged="isBeingDragged"
                    :frameType="frame.frameType"
                    :isJointFrame="false"
                    :caretVisibility="frame.caretVisibility"
                    :allowChildren="frame.frameType.allowChildren"
                    class="frame content-children"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import { computed, ComputedRef } from "vue";
import { useStore } from "@/store/store";
import CaretContainer from "@/components/CaretContainer.vue";
import { CaretPosition, FrameObject } from "@/types/types";
import { getCaretContainerRef, getFrameBodyUID, getFrameUID } from "@/helpers/editor";

//////////////////////
//     Component    //
//////////////////////
const props = defineProps<{
    frameId: number,
    isDisabled: boolean,
    isBeingDragged: boolean,
    caretVisibility?: string, //Flag indicating this caret is visible or not
}>();

const appStore = useStore();

const frames = computed({
    get(): FrameObject[] {
        // gets the frames objects which are nested in here (i.e. have this frameID as parent)
        return appStore.getFramesForParentId(props.frameId);
    },
    set() {
        return;
    },    
});

const UID : ComputedRef<string> = computed(() => getFrameBodyUID(props.frameId));

const bodyDeletable : ComputedRef<boolean> = computed(() => {
    // We need to get the body background at the deletable colour only if this frame is deletable
    // and we are not deleting the outer frames
    if(appStore.potentialDeleteFrameIds){
        return appStore.potentialDeleteFrameIds.includes(props.frameId) 
            && !appStore.potentialDeleteIsOuter; 
    }
    // For compatibility with previous versions of the store
    return false;                       
});
</script>

<style lang="scss">
.content-children {
    margin-left: 0px;
}

.frame-body-container {
    background-color: $strype-main-code-container-background;
    margin-bottom: 4px;
    margin-top: 4px;
    margin-right: 4px;
    border-color: #000 !important;
    border-radius: 8px;
}
.frame-div[data-frametype="classdef"] > .frame-body-container {
    background-color: rgba(255, 255, 255, 0.35);
}

.body-deletable {
    background-color: transparent !important;
}
</style>
