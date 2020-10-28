<template>
    <div 
        v-bind:class="{
            selected: (selectedStatus !== 'unselected'),
            selectedTop: (selectedStatus === 'first'),
            selectedBottom: (selectedStatus === 'last'),
            selectedTopBottom: (selectedStatus === 'first-and-last')
        }">
        <div 
            v-bind:style="frameStyle" 
            class="block frameDiv" 
            v-bind:class="{error: erroneous, statementOrJoint: isStatementOrJointFrame, blockWithBody: !isStatementOrJointFrame}"
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

//////////////////////
//     Component    //
//////////////////////

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
            //prepare a "default" version of the menu: it will be amended if required in handleClick()
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

        selectedStatus(): string {
            return store.getters.getSelectionPosition(this.$props.frameId);
        },

        

        isStatementOrJointFrame(): boolean {
            return this.$props.frameType.isJointFrame || !this.$props.frameType.allowChildren;
        },
    },

    methods: {

        handleClick (event: MouseEvent, action: string) {

            store.commit("setContextMenuShownId",this.id);

            if(action === "frame-context-menu") {
                //keep information of what offset has to be observed from the "normal" menu positioning
                let menuPosOffset = 0;

                // Not all frames should be duplicated (e.g. Else)
                // The target id, for a duplication, should be the same as the copied frame 
                // except if that frame has joint frames: the target is the last joint frame.
                const targetFrameJointFrames = store.getters.getJointFramesForFrameId(this.frameId, "all");
                const targetFrameId = (targetFrameJointFrames.length > 0) ? targetFrameJointFrames[targetFrameJointFrames.length-1].id : this.frameId;
                // Duplication allowance should be examined based on whether we are talking about a single frame or a selection frames
                const canDuplicate = (this.selectedStatus !== "unselected") ?
                    store.getters.getIfPositionAllowsSelectedFrames(targetFrameId, CaretPosition.below, false) : 
                    store.getters.getIfPositionAllowsFrame(targetFrameId, CaretPosition.below, this.$props.frameId); 
                if(!canDuplicate){
                    const duplicateOptionContextMenuPos = this.frameContextMenuOptions.findIndex((entry) => entry.method === "duplicate");
                    //We don't need the duplication option: remove it from the menu options if not present
                    if(duplicateOptionContextMenuPos > -1){
                        this.frameContextMenuOptions.splice(
                            duplicateOptionContextMenuPos,
                            1
                        );
                    }
                    //update the offset
                    menuPosOffset --;
                }

                //if a frame is disabled [respectively, enabled], show the enable [resp. disable] option
                const disableOrEnableOption = (this.isDisabled) 
                    ?  {name: this.$i18n.t("contextMenu.enable"), method: "enable"}
                    :  {name: this.$i18n.t("contextMenu.disable"), method: "disable"};
                const enableDisableIndex = this.frameContextMenuOptions.findIndex((entry) => entry.name === this.$i18n.t("contextMenu.enable") || entry.name === this.$i18n.t("contextMenu.disable")  );
                Vue.set(
                    this.frameContextMenuOptions,
                    enableDisableIndex + menuPosOffset,
                    disableOrEnableOption
                );

                // overwrite readonly properties pageX and set correct value
                Object.defineProperty(event, "pageX", {
                    value: event.pageX - 60,
                    writable: true,
                });
                
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
            if(this.selectedStatus === "unselected"){
                store.dispatch(
                    "copyFrameToPosition",
                    {
                        frameId : this.$props.frameId,
                        newParentId: store.getters.getParentOfFrame(this.frameId),
                        newIndex: store.getters.getIndexInParent(this.frameId)+1,
                    }
                );
            }
            else {
                store.dispatch(
                    "copySelectedFramesToPosition",
                    {
                        newParentId: store.getters.getParentOfFrame(this.frameId),
                    }
                );
            }
        },

        copy(): void {
            if(this.selectedStatus === "unselected"){
                store.dispatch(
                    "copyFrame",
                    this.$props.frameId
                );
            }
            else{
                store.dispatch(
                    "copySelection"
                );
            }
        },

        disable(): void {
            if(this.selectedStatus === "unselected"){
                store.dispatch(
                    "changeDisableFrame",
                    {
                        frameId: this.$props.frameId,
                        isDisabling: true,
                    }
                )
            }
            else {
                store.dispatch(
                    "changeDisableSelection",
                    true
                )
            }
        },
        
        enable(): void {
            if(this.selectedStatus === "unselected"){
                store.dispatch(
                    "changeDisableFrame",
                    {
                        frameId: this.$props.frameId,
                        isDisabling: false,
                    }
                )
            }
            else {
                store.dispatch(
                    "changeDisableSelection",
                    false
                )
            }
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
    border: 1px solid #B4B4B4;
}

.statementOrJoint {
    border: 1px solid transparent;
}

.blockWithBody {
    border: 1px solid #B4B4B4;
}

.block:hover{
    border: 1px solid #B4B4B4;
}

.error {
    border: 1px solid #FF0000 !important;
}

.selected {
    border-left: 3px solid #000000 !important;
    border-right: 3px solid #000000 !important;
}


.selectedTop {
    border-top: 3px solid #000000 !important;
}

.selectedBottom {
    border-bottom: 3px solid #000000 !important;
}

.selectedTopBottom{
    border-top: 3px solid #000000 !important;
    border-bottom: 3px solid #000000 !important;
}

</style>
