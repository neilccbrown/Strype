<template>
    <div class="frame-container">
        <div class="frame-container-header">
            <button class="frame-container-btn-collapse" v-on:click="toggleCollapse">{{collapseButtonLabel}}</button>
            <span class="frame-container-label-span" v-on:click.self="toggleCaret($event)">{{containerLabel}}</span>
        </div>

        <div :style="containerStyle">
            <Caret v-show="caretVisibility===caretPosition.body" />

            <Draggable
                v-model="frames" 
                :group="draggableGroup"
                v-on:choose="print($event)"
                v-on:change.self="handleDragAndDrop($event)"
                animation="200"
                v-bind:key="'Draggagle-'+this.id"
                draggable=".frame"
            >
                <Frame 
                    v-for="frame in frames" 
                    v-bind:key="frame.frameType.type + '-id:' + frame.id"
                    v-bind:id="frame.id"
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
        frames: {
            // gets the frames objects which are nested in here (i.e. have this frameID as parent)
            get(): FrameObject[] {
                return store.getters.getFramesForParentId(this.$props.id);
            },
            // setter
            set(): void {
            // Nothing to be done here.
            // Event handlers call mutations which change the state
            },
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

        print(event: Event): void {
            console.log("FrameContainer's drag and drop");
            console.log(event);
        },
    },
});

</script>

<style lang="scss">
.frame-container {
    margin-bottom: 5px;
    margin-left:10px;
    border: #888 1px solid;
}
.frame-container-btn-collapse {
    background-color: transparent;
    border-color: transparent;
}
.frame-container-label-span {       
    margin-left: 5px;
    cursor:default;
}

</style>
