<template>
    <div 
        v-show="results.length>0"
    >
        <div
            :style="popupPosition"
            class="popup"
        >
            <ul>
                <PopUpItem
                    v-for="(item,index) in results"
                    :id="UIID+index"
                    :item="item"
                    :key="item"
                    :selected="index==selected"
                    v-on="$listeners"
                />
            </ul>
        </div>
        <span 
            :id="spanID"
            :key="spanID"
            class="hidden"
            @click="showSuggestionsAC"
        > 
        </span>
    </div>
</template>

<script lang="ts">
//////////////////////
import Vue from "vue";
import PopUpItem from "@/components/PopUpItem.vue";
import { DefaultCursorPosition } from "@/types/types"

//////////////////////
export default Vue.extend({
    name: "AutoCompletion",

    components: {
        PopUpItem,
    },

    props: {
        list: [String],
        slotId: String,
        token: String,
        contextAC: String,
        cursorPosition: {
            type: Object,
            default: () => DefaultCursorPosition,
        },
    },

    data() {
        return {
            results: [] as string[],
            selected: 0,
        }
    },

    computed: {
        UIID(): string {
            return "popupAC" + this.slotId;
        },

        spanID(): string {
            return "popupAC" + this.slotId + "Span";
        },

        popupPosition(): Record<string, string> {
            return {
                "position": "absolute",
                "top": this.cursorPosition.top,
                "left": this.cursorPosition.left,
            }; 
        },

    },

    methods: {  
        // On a fake Click -triggered by Brython's code- the suggestions popup
        showSuggestionsAC(): void {
            const allResults = (document.getElementById(this.spanID) as HTMLSpanElement).textContent?.replaceAll("'","\"");
            const parsedResults: string[]= JSON.parse(allResults??"");
            this.results = parsedResults.filter( (result) => result.toLowerCase().startsWith(this.token))
        },

        changeSelection(delta: number): void {
            const newSelection = this.selected + delta;
            // The following frames the newSelectionIndex to the results array (it's like a modulo that works for negative numbers as well)
            this.selected = (((newSelection)%this.results.length)+this.results.length)%this.results.length;

            // now scroll to the selected view
            const items = document.querySelectorAll(".popUpItems");
            // the `false` in the method tells it to leave the item at the bottom while scrolling (not scroll and show the selected at the top.
            items[this.selected].scrollIntoView(false);
        },
    }, 

});
</script>

<style lang="scss">
.hidden{
    display: "none";
}

.popup{
    background-color: #fff;
    border:1px solid #d0d0d0;
}

ul {
    overflow: auto;
    max-height: 145px;
    list-style: none;
    padding-left: 0;
    width: auto;
}

li {
    padding-left: 5px;
    padding-right: 25px;
}

</style>
