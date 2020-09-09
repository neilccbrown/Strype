<template>
    <div class="frame-container">
        <div class="frame-container-header">
            <button class="frame-container-btn-collapse" @click="toggleCollapse">{{collapseButtonLabel}}</button>
            <span class="frame-container-label-span" @click.self="toggleCaret($event)">{{containerLabel}}</span>
        </div>

        <div v-bind:style="containerStyle">
            <Caret v-show="caretVisibility===caretPosition.body" />

            <Draggable
                v-model="frames" 
                v-bind:group="draggableGroup"
                @change.self="handleDragAndDrop($event)"
                animation="200"
                filter = ".editableSlot"
                preventOnFilter= "false"
                v-bind:key="'Draggagle-Container-'+this.id"
            >
                <Frame 
                    v-for="frame in frames" 
                    v-bind:key="frame.frameType.type + '-id:' + frame.id"
                    v-bind:frameId="frame.id"
                    v-bind:frameType="frame.frameType"
                    v-bind:isJointFrame="false"
                    v-bind:allowChildren="frame.frameType.allowChildren"
                    v-bind:caretVisibility="frame.caretVisibility"
                    class="frame" 
                />
            </Draggable>
        </div>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import Frame from "@/components/Frame.vue";
import Caret from "@/components/Caret.vue";
import store from "@/store/store";
import Draggable from "vuedraggable";
import { CaretPosition, FrameObject, DraggableGroupTypes } from "@/types/types";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "FrameContainer",
    store,

    components: {
        Frame,
        Caret,
        Draggable,
    },

    data() {
        return {
            collapseButtonLabel: "\u25BC",
            containerStyle: {display:"block"},
            isCollapsed: false,
        }
    },

    props: {
        id: Number,
        caretVisibility: String,
        containerLabel: String,
    },

    computed: {
        frames(): FrameObject[] {
            // gets the frames objects which are nested in here (i.e. have this frameID as parent)
            return store.getters.getFramesForParentId(this.$props.id);
        },

        draggableGroup(): DraggableGroupTypes {
            return store.getters.getDraggableGroupById(this.$props.id); 
        },
        
        // Needed in order to use the `CaretPosition` type in the v-show
        caretPosition(): typeof CaretPosition {
            return CaretPosition;
        },
    },

    methods: {
        toggleCollapse(): void {
            this.$data.isCollapsed = !this.$data.isCollapsed;
            //update the button label
            this.$data.collapseButtonLabel = (this.$data.isCollapsed) ? "\u25B6" : "\u25BC";
            //update the div style
            this.$data.containerStyle = (this.$data.isCollapsed) ? {display:"none"} : {display:"block"};
        },
        handleDragAndDrop(event: Event): void {
            store.commit(
                "updateFramesOrder",
                {
                    event: event,
                    eventParentId: this.id,
                }
            );
        },
        toggleCaret(): void {
            store.dispatch(
                "toggleCaret",
                {id:this.$props.id, caretPosition: CaretPosition.body}
            );
            //expand the container
            this.$data.isCollapsed = true;
            this.toggleCollapse();
        },

    },
});

</script>

<style lang="scss">
.frame-container {
    margin-bottom: 5px;
    margin-left:10px;
    border: #888 1px solid;
    background-color: #ececc8;
}
.frame-container-btn-collapse {
    background-color: #ececc8;
    border-color: transparent;
}
.frame-container-label-span {       
    margin-left: 5px;
    cursor:default;
}



</style>
