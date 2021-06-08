<template>
    <div 
        v-show="Object.keys(indexedAcResults).length>0"
    >
        <div class="popupContainer">
            <div
                :style="popupPosition"
                class="popup"
            >
                <ul >
                    <div 
                         v-for="module in Object.keys(indexedAcResults)"
                        :key="UIID+module"
                    >
                        <div style="background-color: #f00">
                            {{module}}
                        </div>
                        <PopUpItem
                            v-for="(item) in indexedAcResults[module]"
                            class="popUpItems"
                            :id="UIID+item.index"
                            :item="item.value"
                            :key="UIID+item.index"
                            :selected="item.index==selected"
                            v-on="$listeners"
                            :isSelectable="true"
                            ref="results"
                        />
                    </div>
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
                        :item="currentDocumentation"
                        :key="UIID+'documentation'"
                        :isSelectable="false"
                        ref="documentations"
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
import store from "@/store/store";
import PopUpItem from "@/components/PopUpItem.vue";
import { DefaultCursorPosition, UserDefinedElement, indexedAcResultsWithModule, indexedAcResult } from "@/types/types";
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
            selected: 7,
            currentModule: "",
        }
    },

    computed: {
        UIID(): string {
            return "popupAC" + this.slotId;
        },

        test(): string {
            return "test";
        },

        resutlsSpanID(): string {
            return getAcSpanId(this.slotId);
        },

        reshowResultsID(): string {
            return getReshowResultsId(this.slotId);
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
                //this is needed to avoid showing an empty documentation pane
                "min-width":((this.documentation[this.selected]?.length>0)?"200px":"0px"),
            }; 
        },

        indexedAcResults: {
            get(){
                return store.getters.getIndexedAcResults();
            },
            set(value: indexedAcResultsWithModule){
                store.commit(
                    "setIndexedAcResults",
                    value
                )
            },
        },

        currentDocumentation(): string {

            return ((this.indexedAcResults[this.$data.currentModule]??"")[this.$data.selected]??"").documentation;
            //((this.indexedAcResults??{})[this.$data.currentModule??""][this.$data.selected??0].documentation)??"";
            //(((this.indexedAcResults[this.$data.currentModule??""]??{})[this.$data.selected??0]).documentation)??"";
        },

    },

    methods: {  
        // On a fake Click -triggered by Brython's code- the suggestions popup
        loadNewSuggestionsAC(): void {
            // AC Results
            const allResults = (document.getElementById(this.resutlsSpanID) as HTMLSpanElement)?.textContent?.replaceAll("'","\"")??"{}";
            let parsedResults: Record<string, string[]> = {};
            try {
                parsedResults= JSON.parse(allResults);    
            }
            catch (error) {
                console.log("Error on Results");
            }

            // AC Documentation -- generated by Brython
            const allDocumentations = (document.getElementById(this.documentationSpanID) as HTMLSpanElement)?.textContent?.replaceAll("'","\"")??"{}";
            let parsedDoc: Record<string, string[]> = {};
            try {
                parsedDoc= JSON.parse(allDocumentations);    
            }
            catch (error) {
                console.log("Error on Documentation");
            }

            // AC Types
            const allTypes = (document.getElementById(this.typesSpanID) as HTMLSpanElement)?.textContent?.replaceAll("'","\"")??"{}";
            let parsedTypes: Record<string, string[]> = {};
            try {
                parsedTypes= JSON.parse(allTypes);    
            }
            catch (error) {
                console.log("Error on  Types");
            }


            // Append the Python results,docs and types to the lists IFF there is no context
            if(this.context === "") {
                parsedDoc["Python"] = Object.values(brythonBuiltins).map((e) => e.documentation);
                parsedResults["Python"] = Object.keys(brythonBuiltins);
                parsedTypes["Python"] = Object.values(brythonBuiltins).map((e) => e.type);

                // The list of results might not include some the user-defined functions and variables because the user code can't compile. 
                // If so, we should still allow them to displayed (for the best we can retrieve) for simple basic autocompletion functionality.

                // TODO TODO  TODO TODO TODO TODO TODO TODO TODO 
                // TODO TODO TODO TODO TODO TODO TODO TODO TODO 
                // TODO TODO TODO TODO TODO TODO TODO TODO 
                // TODO TODO TODO TODO TODO TODO TODO TODO 
                // TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO 
                // TODO TODO TODO TODO TODO TODO 
                // TODO TODO TODO TODO TODO 
                // TODO TODO TODO 
                // TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO 

                // const userDefinedFuncVars: UserDefinedElement[] = store.getters.retrieveUserDefinedElements(); 
                // userDefinedFuncVars.forEach((userDefItem) => {
                //     if(parsedResults.find((result) => (result === userDefItem.name)) === undefined){
                //         parsedResults.push(userDefItem.name);
                //         parsedDoc.push((userDefItem.isFunction) ? this.$i18n.t("errorMessage.errorUserDefinedFuncMsg") as string : this.$i18n.t("errorMessage.errorUserDefinedVarMsg") as string);
                //         parsedTypes.push("");
                //     }
                // });
            }

            // OLD SOLUTION -- NO MODULES
            // make list with indices, values, documentation and types
            // const resultsWithIndex: {index: number; module: string; value: string; documentation: string; type: string}[] = parsedResults.map( (e,i) => {
            //     return {index: i, value: e, documentation: parsedDoc[i], type:parsedTypes[i]}
            // });

            // NEW SOLUTION 1 -- ONE LIST WITH MODULE AS AN ATTRIBUTE
            // make list with indices, values, documentation and types
            // const resultsWithIndex: {index: number; module: string; value: string; documentation: string; type: string}[] = [];
            // let i = 0;
            // // For each module
            // for (const module in parsedResults) {
            //     // For each item in the results
            //     for (let j = 0; j < parsedResults[module].length; j++) {
            //         resultsWithIndex.push({index: i, module: module, value: parsedResults[module][j] , documentation: parsedDoc[module][j], type: parsedTypes[module][j]});
            //         i++;
            //     }
            // }


            // TRY WITH MAP
            // let resultsWithIndex = new Map();
            // Object.keys(parsedDoc).forEach(element => {
            //     resultsWithIndex.set(element,{values: parsedResults[element}, index);
            // });
            //Record<string, {index: number; module: string; value: string; documentation: string; type: string}[]> = parsedResults.map( (e,i) => {
            //     return {module: e, list:Object.};
            // });

            const resultsWithIndex: indexedAcResultsWithModule = {};
            let lastIndex=0;
            Object.keys(parsedDoc).forEach( (module) => {
                // For each module we create an indexed list with all the results
                const listOfElements: indexedAcResult[] = parsedResults[module].map( (element,i) => {
                    return {index: lastIndex+i, value: element, documentation: parsedDoc[module][i], type:parsedTypes[module][i]}
                });
                lastIndex += listOfElements.length;
                resultsWithIndex[module] = listOfElements;
            });

            // // sort index/value/documenation tuples, based on aphabetic order of values
            // resultsWithIndex.sort( (a, b) => {
            //     return a.value.toLowerCase().localeCompare(b.value.toLowerCase())
            // });

            // store it in the store, so that if it the template is destroyed the ac remains
            this.currentModule = Object.keys(resultsWithIndex)[0];
            console.log("yeap");
            console.log(this.currentModule);
            this.indexedAcResults = resultsWithIndex;
            console.log(this.indexedAcResults );
            this.showSuggestionsAC();

        },  

        showSuggestionsAC(): void {

            this.currentModule = Object.keys(this.indexedAcResults)[0];
            // Filter the list based on the contextAC
            // const resultsWithIndex = this.indexedAcResults.filter((result: {index: number; value: string; documentation: string}) => {
            //     return result.value.toLowerCase().startsWith(this.token)
            // });    

            // this.results = resultsWithIndex.map( (e: {index: number; value: string; documentation: string}) => {
            //     return e.value;
            // });

            // this.documentation = resultsWithIndex.map( (e: {index: number; value: string; documentation: string}) => {
            //     return e.documentation;
            // });

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

.popupContainer {
    display: flex;
}

.popup{
    background-color: #fff;
    border:1px solid #d0d0d0;
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
    cursor: pointer;
}

.popup li {
    padding-left: 5px;
    padding-right: 25px;
}

</style>
