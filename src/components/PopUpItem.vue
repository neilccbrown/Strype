<template>
    <!-- @mousedown must be kept to avoid the click to move the focus from input text field -->
    <li
        v-show="this.item"
        :class="selectedItem"
        :id="id"
        @mouseover="hoverOver()"
        @mouseout="hoverOut()"
        @mousedown.prevent.stop
        @mouseup.self="$emit('acItemClicked',id)"
    >
        {{item}}
        <span v-if="version > 1" class="api-item-version" :title="$t('apidiscovery.v2InfoMsg')">v{{version}}</span>
    </li>
</template>

<script lang="ts">
//////////////////////
import Vue from "vue";

//////////////////////

export default Vue.extend({
    name: "PopUpItem",

    props: {
        item: String,
        id: String,
        selected: Boolean,
        isSelectable: Boolean,
        version: Number,
    },

    data: function() {
        return {
            hoveredOver: false,
        };
    },

    computed: {
        selectedItem(): string {
            return this.hoveredOver && !this.selected?
                "acItem hoveredContextMenuItem"
                :
                this.selected? 
                    "acItem selectedContextMenuItem"
                    :
                    "acItem"; 
        },
    },

    methods: {
        hoverOver(): void {
            this.hoveredOver = true && this.isSelectable;
        },

        hoverOut(): void {
            this.hoveredOver = false;
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
</style>

