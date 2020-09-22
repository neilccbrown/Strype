<template>
    <div class="frame-container" v-bind:style="frameStyle">
        <div class="frame-container-header">
            <button class="frame-container-btn-collapse" v-bind:style="frameStyle" @click="toggleCollapse">{{collapseButtonLabel}}</button>
            <span class="frame-container-label-span" @click.self="toggleCaret($event)">{{containerLabel}}</span>
        </div>

        <div v-bind:style="containerStyle" class="container-frames">
            <Caret v-show="caretVisibility===caretPosition.body" />

            <Draggable
                v-model="frames" 
                v-bind:group="draggableGroup"
                @change.self="handleDragAndDrop($event)"
                animation="200"
                :disabled="isEditing"
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
import { CaretPosition, FrameObject, DraggableGroupTypes, DefaultFramesDefinition, FramesDefinitions } from "@/types/types";

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
        frameType: {
            type: Object,
            default: () => DefaultFramesDefinition,
        }, //Type of the Frame  
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

        isEditing(): boolean {
            return store.getters.getIsEditing();
        },

        frameStyle(): Record<string, string> {
            return {
                "background-color": `${
                    (this.frameType as FramesDefinitions).colour
                } !important`,
            };
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
            store.dispatch(
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
}

.frame-container-btn-collapse {
    border-color: transparent;
}

.frame-container-label-span {       
    margin-left: 5px;
    cursor:default;
    color: #274D19;
}

.container-frames {
    margin-left: 15px;
    margin-right: 15px;  
    margin-bottom: 15px;
    border-radius: 8px;
    border: 1px solid #B4B4B4;
    background-color: #F6F2E9 !important;
}


</style>
