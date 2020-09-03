<template>
    <div>
        <div
            class="next-to-eachother"
            v-for="(item, index) in labels"
            v-bind:key="item.label + frameId"
        >
            <div class="next-to-eachother">{{ item.label }}</div>
            <EditableSlot
                class="editable-input"
                v-if="item.slot"
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
    },
});
</script>

<style lang="scss">
.next-to-eachother {
    display: inline-block;
}

.editable-input {
    margin: 0px 5px 0px 5px;
}
</style>
