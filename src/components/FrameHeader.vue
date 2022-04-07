<template>
    <div>
        <div
            class="next-to-eachother"
            v-for="(item, index) in labels"
            :key="item.label + frameId"
        >
            <!-- the class isn't set on the parent div so the size of hidden editable slots can still be evaluated correctly -->
            <div 
                style="font-weight: 600;"
                :class="{'next-to-eachother rightMargin': true, hidden: isLabelHidden(index), leftMargin: index > 0, 'frameColouredLabel': !isCommentFrame}"
                v-html="item.label"
            >
            </div>
            <EditableSlot
                v-if="item.slot"
                :isDisabled="isDisabled"
                :default-text="item.defaultText"
                :slotIndex="index"
                :frameId="frameId"
                :optionalSlot="item.optionalSlot"
                :isHidden="isLabelHidden(index)"
            />
        </div>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import EditableSlot from "@/components/EditableSlot.vue";
import { useStore } from "@/store/store";
import {CommentDefinition} from "@/types/types";
import { mapStores } from "pinia";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "FrameHeader",

    components: {
        EditableSlot,
    },

    props: {
        // We need an array of labels in the case there are more
        // than a label in the frame (e.g. `with` ... `as ... ) 
        labels: Array,
        frameId: Number,
        frameType: String,
        isDisabled: Boolean,
        frameAllowChildren: Boolean,
    },

    computed:{
        ...mapStores(useStore),
        
        isCommentFrame(): boolean{
            return this.frameType===CommentDefinition.type;
        },
    },

    methods: {
        isLabelHidden(slotIndex: number): boolean { 
            return !this.appStore.isCurrentFrameLabelShown(this.frameId, slotIndex);
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

.leftMargin{
    margin-left: 2px;
}

.rightMargin{
    margin-right: 2px;
}

.frameColouredLabel{
    color: rgb(2, 33, 168);
}
</style>
