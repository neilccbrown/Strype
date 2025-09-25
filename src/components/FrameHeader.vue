<template>
    <div tabindex="-1" @focus="onFocus(true)" @blur="onFocus(false)" :style="'outline: none;' + (frameType == 'projectDocFrameType' ? 'padding:10px;' : '')">
        <div :class="'frame-header-div-line' + (groupIndex > 0 ? ' frame-header-later-line' : '')"
             v-for="(group, groupIndex) in splitLabels"
             :key="groupIndex">
            <div
                :class="'next-to-eachother label-slots-struct-wrapper' + (item.label=='\'\'\'' ? ' magicdoc' : '')"
                v-for="({ item, originalIndex }) in group"
                :key="originalIndex"
            >
                <!-- the class isn't set on the parent div so the size of hidden editable slots can still be evaluated correctly -->
                <div 
                    style="font-weight: 600;"
                    :class="{['frame-header-label frame-header-label-' + frameType + ' next-to-eachother ' + scssVars.framePythonTokenClassName]: true, hidden: isLabelHidden(item), leftMargin: originalIndex > 0, rightMargin: (item.label.length > 0 && !item.appendSelfWhenInClass), [scssVars.frameColouredLabelClassName]: !isCommentFrame}"
                    v-html="item.label"
                >
                </div>
                <LabelSlotsStructure 
                    v-if="areSlotsShown(item)"
                    :isDisabled="isDisabled"
                    :default-text="item.defaultText"
                    :frameId="frameId"
                    :labelIndex="originalIndex"
                    :prependSelfWhenInClass="item.appendSelfWhenInClass"
                />
                <!-- ^^ Note: append to frame label is same as prepend to slot -->
            </div>
            <div ref="foldingControl" :class="{'folding-control': true, 'fold-doc': isFoldDoc, 'fold-header': isFoldHeader, 'fold-full': isFoldFull }" @click.stop.prevent="cycleFold" v-if="canCycleFold && groupIndex == 0">
                <img class="folding-header" src="@/assets/images/quote-circle-funcdef-empty.png" v-if="isFuncDef">
                <img class="folding-doc" src="@/assets/images/quote-circle-funcdef.png" v-if="isFuncDef">
                <img class="folding-full" src="@/assets/images/quote-circle-funcdef-filled.png" v-if="isFuncDef">
                <img class="folding-header" src="@/assets/images/quote-circle-class-empty.png" v-if="isClassDef">
                <img class="folding-doc" src="@/assets/images/quote-circle-class.png" v-if="isClassDef">
                <img class="folding-full" src="@/assets/images/quote-circle-class-filled.png" v-if="isClassDef">
            </div>
            <i v-if="wasLastRuntimeError && groupIndex == splitLabels.length - 1" :class="{'fas fa-exclamation-triangle fa-xs runtime-err-icon': true, 'runtime-past-err-icon': !erroneous}"></i>
            
        </div>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import LabelSlotsStructure from "@/components/LabelSlotsStructure.vue";
import {useStore} from "@/store/store";
import {AllFrameTypesIdentifier, CollapsedState, FrameLabel} from "@/types/types";
import {mapStores} from "pinia";
import scssVars from "@/assets/style/_export.module.scss";

// Splits into a list of lists (each outer list is a line, with 1 or more items on it)
// by looking at the newLine flag in the FrameLabel.
// If the collapsed state is header only, only the first line is returned
function splitAtNewLines(labels : FrameLabel[], state: CollapsedState) : {item: FrameLabel, originalIndex: number}[][] {
    const result : {item: FrameLabel, originalIndex: number}[][] = [];
    let currentGroup : {item: FrameLabel, originalIndex: number}[] = [];
    labels.forEach((item, index) => {
        if (item.newLine && currentGroup.length > 0) {
            result.push(currentGroup);
            currentGroup = [];
        }
        currentGroup.push({ item, originalIndex: index });
    });
    if (currentGroup.length > 0) {
        result.push(currentGroup);
    }
    if (state == CollapsedState.ONLY_HEADER_VISIBLE) {
        // Only keep the first item:
        result.length = Math.min(result.length, 1);
    }
    return result;
}

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "FrameHeader",

    components: {
        LabelSlotsStructure,
    },

    props: {
        // We need an array of labels in the case there are more
        // than a label in the frame (e.g. `with` ... `as ... ) 
        labels: Array,
        frameId: Number,
        frameType: String,
        isDisabled: Boolean,
        frameAllowChildren: Boolean,
        frameCollapsedState: Number, // Index in the enum CollapsedState
        frameAllowedCollapsedStates: Array,
        erroneous: Boolean,
        wasLastRuntimeError: Boolean,
        onFocus: Function, // Handler for focus/blur the header (see Frame.vue)
    },

    computed:{
        ...mapStores(useStore),
        
        isCommentFrame(): boolean{
            return this.frameType===AllFrameTypesIdentifier.comment;
        },

        scssVars() {
            // just to be able to use in template
            return scssVars;
        },
        
        splitLabels() {
            return splitAtNewLines(this.labels as FrameLabel[], this.frameCollapsedState as CollapsedState);
        },
        
        canCycleFold() {
            return this.frameAllowedCollapsedStates.length > 1;
        },
        
        isFuncDef() {
            return this.frameType===AllFrameTypesIdentifier.funcdef;
        },

        isClassDef() {
            return this.frameType===AllFrameTypesIdentifier.classdef;
        },
        
        isFoldDoc() {
            return (this.frameCollapsedState as CollapsedState) == CollapsedState.HEADER_AND_DOC_VISIBLE;
        },

        isFoldHeader() {
            return (this.frameCollapsedState as CollapsedState) == CollapsedState.ONLY_HEADER_VISIBLE;
        },

        isFoldFull() {
            return (this.frameCollapsedState as CollapsedState) == CollapsedState.FULLY_VISIBLE;
        },
    },

    methods:{
        isLabelHidden(labelDetails: FrameLabel): boolean {
            return !(labelDetails.showLabel??true);
        },

        areSlotsShown(labelDetails: FrameLabel): boolean {
            return labelDetails.showSlots??true;
        },
        cycleFold(): void {
            this.appStore.cycleFrameCollapsedState(this.frameId);
        },
    },
});
</script>

<style lang="scss">
.frame-header-div-line {
    display: flex;
    width: 100%;
}
.frame-header-later-line {
    margin-left: 30px;
    margin-right: 28px;
    margin-bottom: 10px;
    width: auto !important;
}

.#{$strype-classname-frame-python-token} {
    margin-top: 1px; // to align the keyword with the slots (that has 1 px border)
}

.next-to-eachother {
    display: flex;
}

.label-slots-struct-wrapper  {
    max-width:100%;
    flex-wrap: nowrap;
}

.hidden {
    display: none !important;
}

.leftMargin {
    margin-left: 4px;
}

.rightMargin {
    margin-right: 4px;
}

.#{$strype-classname-frame-coloured-label} {
    color: rgb(2, 33, 168);
}

.runtime-err-icon {
    margin: 7px 2px 0px 2px;
    margin-left: auto;
    color:#d66;
}
.runtime-past-err-icon {
    color:#706e6e;
}
.frame-header-label-projectDocumentation > img, .frame-header-label-funcdef > img, .frame-header-label-classdef > img {
    height: 0.9em;
    align-self: center;
}

.folding-control {
    margin-left: auto;
    margin-right: 7px;
    margin-top: 5px;
    position: relative;
    overflow: hidden;
    width: 0.9em;
    height: 0.9em;
    cursor: pointer;
}
.folding-control > img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    //transition: opacity 0.25s ease-in-out;
    opacity: 0;
}
// Note: important the hover is on the folding control not the img, because
// the imgs are on top of each other so only the top one gets hover
.folding-control:hover > img {
    filter: brightness(1.25);
}
.folding-control.fold-header > img.folding-header,
.folding-control.fold-doc > img.folding-doc,
.frame-div:hover > .frame-header .folding-control.fold-full > img.folding-full {
    opacity: 0.5;
}
.frame-div:hover:has(.caret-container:hover) > .frame-header .folding-control.fold-full > img.folding-full,
.frame-div:hover:has(.frame-div:hover) > .frame-header .folding-control.fold-full > img.folding-full{
    opacity: 0;
}
</style>
