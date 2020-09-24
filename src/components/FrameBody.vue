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
        />

        <Draggable
            v-model="frames"
            group="code"
            @change.self="handleDragAndDrop($event)"
            animation= "200"
            :disabled="isEditing"
            v-bind:key="'Draggagle-Body-'+this.frameId"
        >
            <Frame
                v-for="frame in frames"
                v-bind:key="frame.frameType.type  + '-id:' + frame.id"
                v-bind:frameId="frame.id"
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
          title="Error!"
          triggers="hover focus"
          content="Body cannot be empty"
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
import { CaretPosition, FrameObject, DraggableGroupTypes } from "@/types/types";

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
        caretVisibility: String, //Flag indicating this caret is visible or not
    },

    computed: {
        frames(): FrameObject[] {
            // gets the frames objects which are nested in here (i.e. have this frameID as parent)
            return store.getters.getFramesForParentId(this.$props.frameId);
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
            if(this.frames.length < 1 && this.caretVisibility !== this.caretPosition.body) {
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
            
            store.dispatch(
                "updateFramesOrder",
                {
                    event: event,
                    eventParentId: this.$props.frameId,
                }
            );
        },
        
    },
});
</script>

<style lang="scss">
.content-children {
    margin-left: 0px;
}

.frame-body-container {
    background-color: #FFF !important;
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
