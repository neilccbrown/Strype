<template>
    <div>
        <div
            class="next-to-eachother"
            v-for="(item, index) in labels"
            v-bind:key="item.label + frameId"
            v-bind:class="{hidden: isLabelHidden(index)}"
        >
            <div class="next-to-eachother">{{ item.label }}</div>
            <EditableSlot
                v-if="item.slot"
                v-bind:isDisabled="isDisabled"
                v-bind:default-text="item.defaultText"
                v-bind:slotIndex="index"
                v-bind:frameId="frameId"
                v-bind:optionalSlot="item.optionalSlot"
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
import store from "@/store/store";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "FrameHeader",
    store,

    components: {
        EditableSlot,
    },

    props: {
        // We need an array of labels in the case there are more
        // than a label in the frame (e.g. `with` ... `as ... ) 
        labels: Array,
        frameId: Number,
        isDisabled: Boolean,
    },

    methods: {
        isLabelHidden(slotIndex: number): boolean { 
            return !store.getters.getIsCurrentFrameLabelShown(this.$props.frameId, slotIndex);
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
</style>
