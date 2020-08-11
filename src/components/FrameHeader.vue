<template>
    <div>
        <div
            class="next-to-eachother"
            v-for="item in labels"
            v-bind:key="item.label + frameId"
        >
            <div class="next-to-eachother">{{ item.label }}</div>
            <EditableSlot
                class="editable-input"
                v-if="item.slot"
                default-text="Default display text"
                v-bind:slotIndex="labels.indexOf(item)"
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
        // than one labels in the frame (e.g. `with` ... `as ... ) 
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
