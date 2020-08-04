<template>
    <div class="next-to-eachother">
        <input
            type="text"
            v-model="code"
            v-bind:placeholder="defaultText"
            v-on:focus="onFocus"
            v-on:blur="onBlur"
        />
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import store from "@/store/store";

export default Vue.extend({
    name: "EditableSlot",
    store,
    props: {
        defaultText: String,
        slotIndex: Number,
    },

    data() {
        return {
            code: store.getters.getContentForFrameSlot(
                this.$parent.$props.frameId,
                this.$props.slotIndex
            ),
        };
    },
    methods: {
        onFocus(): void {
            store.commit("toggleEditFlag");
        },
        onBlur(): void {
            store.commit("toggleEditFlag");
            store.commit(
                "setFrameEditorSlot",
                {
                    frameId: this.$parent.$props.frameId,
                    slotId: this.$props.slotIndex,
                    code: this.$data.code,
                }
            );
        },
    },
});
</script>
