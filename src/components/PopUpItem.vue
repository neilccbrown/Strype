<template>
    <li
        v-show="this.item"
        :id="item"
        class="popUpItems"
        :class="selectedItem"
        @mouseover="hoverOver()"
        @mouseout="hoverOut()"
        @mousedown.prevent.stop
        @mouseup.prevent.stop="$emit('acItemClicked',item)"
    >
        {{item}}
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
        selected: Boolean,
        isSelectable: Boolean,
    },

    data() {
        return {
            hoveredOver: false,
        }
    },

    computed: {
        selectedItem(): string {
            return this.hoveredOver && !this.selected?
                "hoveredAcItem"
                :
                this.selected? 
                    "selectedAcItem"
                    :
                    "unselectedAcItem" 
        },
    },

    methods: {
        hoverOver(): void {
            this.$data.hoveredOver = true && this.isSelectable
        },

        hoverOut(): void {
            this.$data.hoveredOver = false
        },
    },

});
</script>


<style lang="scss">
.selectedAcItem {
    background-color: #5a7bfc;
    color: white;
}

.unselectedAcItem {

}

.hoveredAcItem {
     background-color: #9aaefd;
}

</style>

