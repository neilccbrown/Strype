<template>
    <div>
        <div>
            <div
                class="next-to-eachother"
                v-for="(item, index) in labels"
                :key="item.label + frameId"
            >
                <!-- the class isn't set on the parent div so the size of hidden editable slots can still be evaluated correctly -->
                <div 
                    style="font-weight: 600;"
                    :class="{'next-to-eachother': true, hidden: isLabelHidden(item), leftMargin: index > 0, rightMargin: (item.label.length > 0),'frameColouredLabel': !isCommentFrame}"
                    v-html="item.label"
                >
                </div>
                <LabelSlotsStructure 
                    v-if="areSlotsShown(item)"
                    :isDisabled="isDisabled"
                    :default-text="item.defaultText"
                    :frameId="frameId"
                    :labelIndex="index"
                />
            </div>
        </div>
        <i v-if="wasLastRuntimeError" :class="{'fas fa-exclamation-triangle fa-xs runtime-err-icon': true, 'runtime-past-err-icon': !erroneous}"></i>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import LabelSlotsStructure from "@/components/LabelSlotsStructure.vue";
import { useStore } from "@/store/store";
import {AllFrameTypesIdentifier, FrameLabel} from "@/types/types";
import { mapStores } from "pinia";

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
        erroneous: Boolean,
        wasLastRuntimeError: Boolean,
    },

    computed:{
        ...mapStores(useStore),
        
        isCommentFrame(): boolean{
            return this.frameType===AllFrameTypesIdentifier.comment;
        },
    },

    methods:{
        isLabelHidden(labelDetails: FrameLabel): boolean {
            return !(labelDetails.showLabel??true);
        },

        areSlotsShown(labelDetails: FrameLabel): boolean {
            return labelDetails.showSlots??true;
        },
    },
});
</script>

<style lang="scss">
.next-to-eachother {
    display: inline-block;
}

.hidden {
    display: none;
}

.leftMargin {
    margin-left: 2px;
}

.rightMargin {
    margin-right: 2px;
}

.frameColouredLabel {
    color: rgb(2, 33, 168);
}

.runtime-err-icon {
    margin: 7px 2px 0px 2px;
    color:#d66;
}

.runtime-past-err-icon {
    color:#706e6e;
}
</style>
