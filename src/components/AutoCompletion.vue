<template>
    <div 
        v-show="results.length>0"
    >
        <div>
            <div
                :style="popupPosition"
                class="popup"
            >
                <ul>
                    <PopUpItem
                        v-for="(item,index) in results"
                        class="popUpItems"
                        :id="UIID+index"
                        :item="item"
                        :key="UIID+index"
                        :selected="index==selected"
                        v-on="$listeners"
                        :isSelectable="true"
                    />
                </ul>
            </div>
            <div
                :style="popupDocumentationPosition"
                class="popup"
            >
                <ul class="limitWidthUl">
                    <PopUpItem
                        class="newlines"
                        :id="UIID+'documentation'"
                        :item="this.documentation[this.selected]"
                        :key="UIID+'documentation'"
                        :isSelectable="false"
                    />
                </ul>
            </div>
        </div>
        <span 
            :id="resutlsSpanID"
            :key="resutlsSpanID"
            class="hidden"
            @click="loadNewSuggestionsAC"
        > 
        </span>
        <span 
            :id="documentationSpanID"
            :key="documentationSpanID"
            class="hidden"
        > 
        </span>
        <span 
            :id="typesSpanID"
            :key="typesSpanID"
            class="hidden"
        > 
        </span>
        <span 
            :id="reshowResultsID"
            :key="reshowResultsID"
            class="hidden"
            @click="showSuggestionsAC"
        > 
        </span>
    </div>
</template>

<script lang="ts">
//////////////////////
import Vue from "vue";
import store from "@/store/store.ts";
import PopUpItem from "@/components/PopUpItem.vue";
import { DefaultCursorPosition } from "@/types/types";
import { brythonBuiltins } from "@/autocompletion/pythonBuiltins";
import { getAcSpanId , getDocumentationSpanId, getReshowResultsId, getTypesSpanId } from "@/helpers/editor";

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
        cursorPosition: {
            type: Object,
            default: () => DefaultCursorPosition,
        },
        context: String,
    },

    data() {
        return {
            results: [] as string[],
            documentation: [] as string[],
            selected: 0,
        }
    },

    computed: {
        UIID(): string {
            return "popupAC" + this.slotId;
        },

        resutlsSpanID(): string {
            return getAcSpanId(this.slotId);
        },

        reshowResultsID(): string {
            return getReshowResultsId(this.slotId);
        },

        areThereResults(): boolean {
            return this.results.length>0;
        },

        documentationSpanID(): string {
            return getDocumentationSpanId(this.slotId);
        },

        typesSpanID(): string {
            return getTypesSpanId(this.slotId);
        },

        popupPosition(): Record<string, string> {
            return {
                "float" : "left",
                "left": (this.cursorPosition.left+25)+"px",
            }; 
        },

        popupDocumentationPosition(): Record<string, string> {
            return {
                "float" : "right",
                "right": -(this.cursorPosition.left+25)+"px",
            }; 
        },

        indexedAcResults:  {
            get(){
                return store.getters.getIndexedAcResults();
            },
            set(value: string){
                store.commit(
                    "setIndexedAcResults",
                    value
                )
            },
        },

    },

    methods: {  
        // On a fake Click -triggered by Brython's code- the suggestions popup
        loadNewSuggestionsAC(): void {

            // AC Results
            const allResults = (document.getElementById(this.resutlsSpanID) as HTMLSpanElement)?.textContent?.replaceAll("'","\"");
            let parsedResults: string[]= JSON.parse(allResults??"");

            // AC Documentation
            const allDocumentations = (document.getElementById(this.documentationSpanID) as HTMLSpanElement)?.textContent?.replaceAll("'","\"")??"";
            let parsedDoc: string[] = JSON.parse(allDocumentations??"");

            // AC Types
            const allTypes = (document.getElementById(this.typesSpanID) as HTMLSpanElement)?.textContent?.replaceAll("'","\"")??"";
            let parsedTypes: string[] = JSON.parse(allTypes??"");

            // Append the builtin results/docs/types to the lists IFF there is no context
            if(this.context === "") {
                parsedDoc = parsedDoc.concat(Object.values(brythonBuiltins).map((e) => e.documentation));
                parsedResults = parsedResults.concat(Object.keys(brythonBuiltins));
                parsedTypes = parsedTypes.concat(Object.values(brythonBuiltins).map((e) => e.type));
            }

            // make list with indices, values, documentation and types
            const resultsWithIndex: {index: number; value: string; documentation: string; type: string}[] = parsedResults.map( (e,i) => {
                return {index: i, value: e, documentation: parsedDoc[i], type:parsedTypes[i]}
            });

            // sort index/value/documenation tuples, based on aphabetic order of values
            resultsWithIndex.sort( (a, b) => {
                return a.value.toLowerCase().localeCompare(b.value.toLowerCase())
            });

            // store it in the store, so that if it the template is destroyed the ac remains
            this.indexedAcResults = resultsWithIndex

            this.showSuggestionsAC();

        },  

        showSuggestionsAC(): void {

            // Filter the list based on the contextAC
            const resultsWithIndex = this.indexedAcResults.filter((result: {index: number; value: string; documentation: string}) => {
                return result.value.toLowerCase().startsWith(this.token)
            });    

            this.results = resultsWithIndex.map( (e: {index: number; value: string; documentation: string}) => {
                return e.value;
            });

            this.documentation = resultsWithIndex.map( (e: {index: number; value: string; documentation: string}) => {
                return e.documentation;
            });

        },  

        changeSelection(delta: number): void {
            const newSelection = this.selected + delta;
            // The following frames the newSelectionIndex to the results array (it's like a modulo that works for negative numbers as well)
            // It frames ANY number (negative or positive) to the bounds of [0 ... Results.length()]
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
    position : "relative";
    display : "inline-block";
}

.limitWidthUl{
    max-width: 300px;
}

.popup ul {
    overflow: auto;
    max-height: 145px;
    list-style: none;
    padding-left: 0;
    width: auto;
}

.popup li {
    padding-left: 5px;
    padding-right: 25px;
}

</style>
