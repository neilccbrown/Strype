<template>
    <div>
        <div 
            v-bind:style="frameStyle" 
            class="block frameDiv" 
            v-bind:class="{error: erroneous}"
            v-bind:id="id"
            @click="toggleCaret($event)"
            @contextmenu.prevent.stop="handleClick($event,'frame-context-menu')"
        >
            <vue-simple-context-menu
                v-show="allowContextMenu"
                :elementId="id+'frameContextMenu'"
                :options="this.frameContextMenuOptions"
                :ref="'frameContextMenu'"
                @option-clicked="optionClicked"
            />

            <FrameHeader
                v-if="frameType.labels !== null"
                v-bind:isDisabled="isDisabled"
                v-blur="isDisabled"
                v-bind:frameId="frameId"
                v-bind:labels="frameType.labels"
                class="frame-header"
            />
            <FrameBody
                v-if="allowChildren"
                v-bind:frameId="frameId"
                v-bind:isDisabled="isDisabled"
                v-bind:caretVisibility="caretVisibility"
                ref="frameBody"
            />
            <CaretContainer
                v-bind:frameId="this.frameId"
                v-bind:caretVisibility="this.caretVisibility"
                v-bind:caretAssignedPosition="caretPosition.below"
                v-bind:isFrameDisabled="this.isDisabled"
                @hide-context-menus="handleClick($event,'paste')"
            />
            
            <JointFrames 
                v-if="allowsJointChildren"
                v-bind:jointParentId="frameId"
                v-bind:isDisabled="isDisabled"
            />
        </div>
        <b-popover
          v-if="erroneous"
          v-bind:target="id"
          v-bind:title="this.$i18n.t('errorMessage.errorTitle')"
          triggers="hover focus"
          v-bind:content="errorMessage"
        ></b-popover>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import FrameHeader from "@/components/FrameHeader.vue";
import CaretContainer from "@/components/CaretContainer.vue"
import store from "@/store/store";
import { FramesDefinitions, DefaultFramesDefinition, CaretPosition, Definitions } from "@/types/types";
import VueSimpleContextMenu, {VueSimpleContextMenuConstructor}  from "vue-simple-context-menu";
import $ from "jquery";

//////////////////////
//     Component    //
//////////////////////
const duplicateOptionContextMenuPos = 1;
const enableDisableOptionsContextMenuPos = 3;

export default Vue.extend({
    name: "Frame",
    store,

    components: {
        FrameHeader,
        VueSimpleContextMenu,
        CaretContainer,
    },

    beforeCreate() {
        const components = this.$options.components;
        if (components !== undefined) {
            components.FrameBody = require("@/components/FrameBody.vue").default;
            components.JointFrames = require("@/components/JointFrames.vue").default;
        }
    },

    props: {
        // NOTE that type declarations here start with a Capital Letter!!! (different to types.ts!)
        frameId: Number, // Unique Indentifier for each Frame
        isDisabled: Boolean,
        frameType: {
            type: Object,
            default: () => DefaultFramesDefinition,
        }, //Type of the Frame
        isJointFrame: Boolean, //Flag indicating this frame is a joint frame or not
        caretVisibility: String,
        allowChildren: Boolean,
    },

    data: function () {
        return {
            frameContextMenuOptions: [
                {name: this.$i18n.t("contextMenu.copy"), method: "copy"},
                {name: this.$i18n.t("contextMenu.duplicate"), method: "duplicate"},
                {name: "", method: "", type: "divider"},
                {name: this.$i18n.t("contextMenu.disable"), method: "disable"}],
        }
    },

    computed: {
        hasJointFrameObjects(): boolean {
            return store.getters.getJointFramesForFrameId(
                this.frameId,
                "all"
            ).length >0;
        },

        allowsJointChildren(): boolean {
            return store.getters.getAllowsJointChildren(this.frameId);
        },

        frameStyle(): Record<string, string> {
            return this.isJointFrame === true
                ? {"color":"#000 !important"}
                : {
                    "background-color": `${
                        (this.frameType as FramesDefinitions).colour
                    } !important`,
                    "padding-left": "2px",
                    "color": (this.frameType === Definitions.CommentDefinition) ? "#97971E !important" : "#000 !important",
                };
        },

        // Needed in order to use the `CaretPosition` type in the v-show
        caretPosition(): typeof CaretPosition {
            return CaretPosition;
        },

        erroneous(): boolean {
            return store.getters.getIsErroneousFrame(
                this.$props.frameId
            );
        },

        id(): string {
            return "frame_id_"+this.$props.frameId;
        },

        errorMessage(): string{
            return store.getters.getErrorForFrame(
                this.$props.frameId
            );
        },

        allowContextMenu(): boolean {
            return store.getters.getContextMenuShownId() === this.id; 
        },

    },

    methods: {

        handleClick (event: MouseEvent, action: string) {

            store.commit("setContextMenuShownId",this.id);

            if(action === "frame-context-menu") {
                //keep information of what offset has to be observed from the "normal" menu positioning
                let menuPosOffset = 0;

                // Not all frames should be duplicated (e.g. Else)
                const duplicateOptionIndex = this.frameContextMenuOptions.findIndex((entry) => entry.method === "duplicate");
                // The target id, for a duplication, should be the same as the copied frame 
                // except if that frame has joint frames: the target is the last joint frame.
                const targetFrameJointFrames = store.getters.getJointFramesForFrameId(this.frameId, "all");
                const targetFrameId = (targetFrameJointFrames.length > 0) ? targetFrameJointFrames[targetFrameJointFrames.length-1].id : this.frameId;
                const canDuplicate = store.getters.getIfPositionAllowsFrame(targetFrameId, CaretPosition.below, this.$props.frameId); 
                if(canDuplicate && duplicateOptionIndex === -1){
                    this.frameContextMenuOptions.splice(
                        duplicateOptionContextMenuPos,
                        0,
                        {name: this.$i18n.t("contextMenu.duplicate"), method: "duplicate"}
                    );    
                }
                else if(!canDuplicate &&  duplicateOptionIndex > -1){
                    this.frameContextMenuOptions.splice(
                        duplicateOptionContextMenuPos,
                        1
                    );
                }

                if(!canDuplicate){
                    //update the offset if we don't have the "duplicate" menu item
                    menuPosOffset --;
                }
              
                //if a frame is disabled [respectively, enabled], show the enable [resp. disable] option
                const disableOrEnableOption = (this.isDisabled) 
                    ?  {name: this.$i18n.t("contextMenu.enable"), method: "enable"}
                    :  {name: this.$i18n.t("contextMenu.disable"), method: "disable"};
                Vue.set(
                    this.frameContextMenuOptions,
                    enableDisableOptionsContextMenuPos + menuPosOffset,
                    disableOrEnableOption
                );

                ((this.$refs.frameContextMenu as unknown) as VueSimpleContextMenuConstructor).showMenu(event);
            }
        },

        // Item is passed anyway in the event, in case the menu is attached to a list
        optionClicked (event: {item: any; option: {name: string; method: string}}) {
            // `event.option.method` holds the name of the method to be called.
            // In case the menu gets more complex this can clear up the code. However, it is a bit unsafe - in the case you
            // misstype a method's name.
            const thisCompProps = Object.entries(this).find((entry) => entry[0] === event.option.method);
            if(thisCompProps){
                thisCompProps[1]();
            }
        },

        toggleCaret(event: MouseEvent): void {
            const frame: HTMLDivElement = event.srcElement as HTMLDivElement;

            // This checks the propagated click events, and prevents the parent event to handle the event as well. 
            // Stop and Prevent do not work in this case, as the event needs to be propagated 
            // (for the context menu to close) but it does not need to trigger always a caret change.
            if(frame.id !== this.id ){
                return;
            }

            // get the rectangle of the div with its coordinates
            const rect = frame.getBoundingClientRect();
            
            let position: CaretPosition = CaretPosition.none;
            // if clicked above the middle, or if I click on the label show the body caret
            if((frame.className === "frame-header" || event.y <= rect.top + rect.height/2) && this.allowChildren) {
                position = CaretPosition.body;
            }
            //else show caret below
            else{
                position = CaretPosition.below;
            }
            store.dispatch(
                "toggleCaret",
                {id:this.$props.frameId, caretPosition: position}
            );
        },


        duplicate(): void {
            store.dispatch(
                "copyFrameToPosition",
                {
                    frameId : this.$props.frameId,
                    newParentId: store.getters.getParentOfFrame(this.frameId),
                    newIndex: store.getters.getIndexInParent(this.frameId)+1,
                }
            );
        },

        copy(): void {
            store.dispatch(
                "copyFrame",
                this.$props.frameId
            );
        },

        disable(): void {
            store.dispatch(
                "changeDisableFrame",
                {
                    frameId: this.$props.frameId,
                    isDisabling: true,
                }
            )
        },
        
        enable(): void {
            store.dispatch(
                "changeDisableFrame",
                {
                    frameId: this.$props.frameId,
                    isDisabling: false,
                }
            )
        },

    },

});

</script>

<style lang="scss">
.block {
    padding-right: 4px;
    padding-top: 1px;
    padding-bottom: 1px;
    border-radius: 8px;
    border: 1px solid transparent;
}

.block:hover{
    border: 1px solid #B4B4B4;
}


.error {
    border: 1px solid #FF0000 !important;
}
</style>
