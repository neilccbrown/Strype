<template>
    <!-- @mousedown must be kept to avoid the click to move the focus from input text field -->
    <li
        v-show="this.item"
        :class="{acItem: true, acItemSelected: selected}"
        :id="id"
        @mouseover="onHover"
        @mousedown.prevent.stop
        @mouseup.self="$emit('acItemClicked',id)"
    >
        {{item}}
        <span v-if="version > 1" class="api-item-version" :title="$t('apidiscovery.v2InfoMsg')">v{{version}}</span>
    </li>
</template>

<script lang="ts">
//////////////////////
import { CustomEventTypes } from "@/helpers/editor";
import Vue from "vue";

//////////////////////

export default Vue.extend({
    name: "PopUpItem",

    props: {
        item: String,
        id: String,
        index: Number,
        selected: Boolean,
        isSelectable: Boolean,
        version: Number,
    },

    methods: {
        onHover(): void {
            // The a/c context menu isn't exactly a context menu, it can't have focus as focus needs to be kept on the code slot,
            // so we do not use the same mechanism than the context menu to handle hovering/selecting styling.
            if(this.index !== undefined){
                this.$emit(CustomEventTypes.acItemHovered, this.index);
            }
        },
    },
});
</script>

<style lang="scss">
.newlines {
    //Nedded for understanding the formated errors that split multiple
    // lines with \n
    white-space: pre-line !important;
}

// Style related to the context menu are in App.vue
</style>

