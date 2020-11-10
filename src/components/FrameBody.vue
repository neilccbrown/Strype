<template>
    <div
        class="frame-body-container"
        v-bind:class="{error: empty}"
        v-bind:id="id"
    >
        <CaretContainer
            v-bind:frameId="this.frameId"
            v-bind:caretVisibility="this.caretVisibility"
            v-bind:caretAssignedPosition="caretPosition.body"
            v-bind:isFrameDisabled="this.isDisabled"
        />

        <Draggable
            v-model="frames"
            group="code"
            @change.self="handleDragAndDrop($event)"
            @unchoose="showSelectedFrames()"
            animation= "200"
            :disabled="isEditing"
            v-bind:key="'Draggagle-Body-'+this.frameId"
            @start="handleMultiDrag($event)"
        >
            <Frame
                v-for="frame in frames"
                v-bind:key="frame.frameType.type  + '-id:' + frame.id"
                v-bind:frameId="frame.id"
                v-bind:isDisabled="frame.isDisabled"
                v-bind:frameType="frame.frameType"
                v-bind:isJointFrame="false"
                v-bind:caretVisibility="frame.caretVisibility"
                v-bind:allowChildren="frame.frameType.allowChildren"
                class="frame content-children"
            />
        </Draggable>
        <b-popover
          v-if="empty"
          v-bind:target="id"
          v-bind:title="this.$i18n.t('errorMessage.errorTitle')"
          triggers="hover focus"
          v-bind:content="this.$i18n.t('errorMessage.emptyFrameBody')"
        ></b-popover>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import store from "@/store/store";
import Frame from "@/components/Frame.vue";
import CaretContainer from "@/components/CaretContainer.vue";
import Draggable from "vuedraggable";
import { CaretPosition, DraggableGroupTypes, FrameObject } from "@/types/types";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "FrameBody",
    store,

    components: {
        Frame,
        Draggable,
        CaretContainer,
    },
    
    props: {
        frameId: Number,
        isDisabled: Boolean,
        caretVisibility: String, //Flag indicating this caret is visible or not
    },

    computed: {
        frames: {
            get(): FrameObject[] {
                // gets the frames objects which are nested in here (i.e. have this frameID as parent)
                return store.getters.getFramesForParentId(this.$props.frameId);
            },
            set() {
                return;
            },    
        },

        draggableGroup(): DraggableGroupTypes {
            return store.getters.getDraggableGroupById(this.$props.frameId); 
        },

        // Needed in order to use the `CaretPosition` type in the v-show
        caretPosition(): typeof CaretPosition {
            return CaretPosition;
        }, 

        isEditing(): boolean {
            return store.getters.getIsEditing();
        },

        id(): string {
            return "frameBodyId_" + this.$props.frameId;
        },

        empty(): boolean {
            let empty = false;
            if(!this.isDisabled && this.frames.length < 1 && this.caretVisibility !== this.caretPosition.body) {
                empty = true;
                store.commit("addPreCompileErrors",this.id);                
            }
            else {
                store.commit("removePreCompileErrors",this.id);
            }
            return empty;
        },

    },

    beforeDestroy() {
        store.commit("removePreCompileErrors",this.id);
    },

    methods: {
        handleDragAndDrop(event: Event): void {
            const eventType = Object.keys(event)[0];
            const chosenFrame = event[eventType].element;
            // If the frame is part of a selection
            if(store.getters.getIsSelected(chosenFrame.id)) {
                //If the move can happen
                store.dispatch(
                    "moveSelectedFramesToPosition",
                    {
                        event: event,
                        parentId: this.$props.frameId,
                    }
                );
            }
            else{
                store.dispatch(
                    "updateFramesOrder",
                    {
                        event: event,
                        eventParentId: this.$props.frameId,
                    }
                );
            }
        },
        
        handleMultiDrag(event: Event): void {
            const chosenFrame = this.frames[event.oldIndex];
            // If the frame is part of a selection
            if(store.getters.getIsSelected(chosenFrame.id)) {
                // Make it appear as the whole selection is being dragged
                store.dispatch("prepareForMultiDrag",chosenFrame.id);
            }
        },   

        // Some times, when draging and droping in the original position of where the
        // selected frames were taken, the `change` event is not fired; hence you need to
        // catch the `unchoose` event
        showSelectedFrames(): void {
            store.commit("makeSelectedFramesVisible");
        },
    },
});
</script>

<style lang="scss">
.content-children {
    margin-left: 0px;
}

.frame-body-container {
    background-color: #F6F2E9;
    margin-bottom: 4px;
    margin-right: 0px;
    margin-left: 12px;
    border-color: #000 !important;
    border-radius: 8px;

}

.error {
    border: 1px solid #d66 !important;
}

</style>
