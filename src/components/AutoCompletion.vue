<template>
    <div 
        v-show="Object.keys(resultsToShow).length>0"
    >
        <div class="popupContainer">
            <div
                :style="popupPosition"
                class="popup"
            >
                <ul >
                    <div 
                        v-for="module in Object.keys(resultsToShow)"
                        :key="UIID+module"
                    >
                        <div 
                            class="module"
                            v-if="resultsToShow[module].length>0"
                            @mousedown.prevent.stop
                            @mouseup.prevent.stop
                        >
                            <em>{{module}}</em>
                        </div>
                        <PopUpItem
                            v-for="(item) in resultsToShow[module]"
                            class="popUpItems"
                            :id="UIID+item.index"
                            :item="item.acResult"
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
import { DefaultCursorPosition, UserDefinedElement, indexedAcResultsWithModule, indexedAcResult, acResultType, acResultsWithModule } from "@/types/types";
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
            resultsToShow: {} as indexedAcResultsWithModule,
            documentation: [] as string[],
            selected: 0,
            currentModule: "",
            currentDocumentation: "",
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

        acResults: {
            get(){
                return store.getters.getAcResults();
            },
            set(value: acResultsWithModule){
                store.commit(
                    "setAcResults",
                    value
                )
            },
        },

    },

    methods: {  
        // On a fake Click -triggered by Brython's code- the suggestions popup
        loadNewSuggestionsAC(): void {
            // get AC Results from Brython
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

            // get AC Types from Brython
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

                // The list of results might not include some the user-defined functions and variables because the user code can't compile. 
                // If so, we should still allow them to displayed (for the best we can retrieve) for simple basic autocompletion functionality.

                const userDefinedFuncVars: UserDefinedElement[] = store.getters.retrieveUserDefinedElements(); 
                userDefinedFuncVars.forEach((userDefItem) => {
                    if(userDefItem.isFunction) {
                        //If module has not been created, create it
                        if(parsedResults["My Functions"] === undefined) { 
                            parsedResults["My Functions"] = []
                            parsedDoc["My Functions"] = []
                            parsedTypes["My Functions"] = []
                        }
                        if(parsedResults["My Functions"].find((result) => (result === userDefItem.name)) === undefined) {
                            parsedResults["My Functions"].push(userDefItem.name);
                            parsedDoc["My Functions"].push(this.$i18n.t("errorMessage.errorUserDefinedFuncMsg") as string);
                            parsedTypes["My Functions"].push(""); 
                        }
                    }
                    else {
                        //If module has not been created, create it
                        if(parsedResults["My Variables"] === undefined) { 
                            parsedResults["My Variables"] = []
                            parsedDoc["My Variables"] = []
                            parsedTypes["My Variables"] = []
                        }
                        if(parsedResults["My Variables"].find((result) => (result === userDefItem.name)) === undefined) {
                            parsedResults["My Variables"].push(userDefItem.name);
                            parsedDoc["My Variables"].push(this.$i18n.t("errorMessage.errorUserDefinedVarMsg") as string);
                            parsedTypes["My Variables"].push("");
                        }
                    }
                });

                parsedDoc["Python"] = Object.values(brythonBuiltins).map((e) => e.documentation);
                parsedResults["Python"] = Object.keys(brythonBuiltins);
                parsedTypes["Python"] = Object.values(brythonBuiltins).map((e) => e.type);
            }
            
            const acResults: acResultsWithModule = {};
            
            Object.keys(parsedDoc).forEach( (module: string) => {

                // For each module we create an indexed list with all the results
                const listOfElements: acResultType[] = parsedResults[module].map( (element,i) => {
                    // We are not assigning the indexes at that stage as we will need to sort first
                    return {acResult: element, documentation: parsedDoc[module][i], type:parsedTypes[module][i]}
                });
                // Sort is done as a seperate step, as it is more efficient to join the lists (parsedResults, parsedDoc and parsedTypes) first
                // and then sort, instead of sorting first, as this would require to sort one list and based on this sorting, sort the others as well
                listOfElements.sort( (a, b) => {
                    return a.acResult.toLowerCase().localeCompare(b.acResult.toLowerCase())
                });
                
                acResults[module] = listOfElements;
            });

            // store it in the store, so that if it the template is destroyed the ac remains
            this.acResults = acResults;
            this.showSuggestionsAC();
        },  

        showSuggestionsAC(): void {

            // we start by reseting the results
            this.resultsToShow = {};
            this.selected = 0;

            // At this stage and since after filtering we have ended up with the final list, we are going to
            // index the results, in order to be able to browse through it with the keys and show the selected.
            let lastIndex=0;
            for (const module in this.acResults) {
                // Filter the list based on the token
                const filteredResults: acResultType[] = this.acResults[module].filter( (element: indexedAcResult) => 
                    element.acResult.toLowerCase().startsWith(this.token))

                // Add the indices
                this.resultsToShow[module] = filteredResults.map((e,i) => {
                    return {index: lastIndex+i, acResult: e.acResult, documentation: e.documentation, type: e.type }
                })
                lastIndex += filteredResults.length;    
            }    

            //if there are resutls
            if(Object.values(this.resultsToShow)[0].length > 0) {
                // get the first module as the selected
                this.currentModule = Object.keys(this.resultsToShow).filter((e) => this.resultsToShow[e].length>0)[0];

                this.currentDocumentation = this.getCurrentDocumentation();
            }
            
        },  

        changeSelection(delta: number): void {
            const newSelection = this.selected + delta;
            
            // We need to calculate how many elements in total. Each module has a `subList` which we need to take into account
            let resultsLength = 0;
            Object.values(this.resultsToShow).forEach((subList) => resultsLength+=subList.length)
            
            // The following frames the newSelectionIndex to the results array (it's like a modulo that works for negative numbers as well)
            // It frames ANY number (negative or positive) to the bounds of [0 ... resultsLength]
            this.selected = (((newSelection)%resultsLength)+resultsLength)%resultsLength;

            this.currentModule = this.getModuleOfSelected(delta);
            this.currentDocumentation = this.getCurrentDocumentation();

            // now scroll to the selected view
            const items = document.querySelectorAll(".popUpItems");
            // the `false` in the method tells it to leave the item at the bottom while scrolling (not scroll and show the selected at the top.
            items[this.selected].scrollIntoView(false);

        },

        getTypeOfSelected(): string {
            // Here we are making all the ACresult objects in one single array in which we are then finding the selected and return its type
            return ((([] as indexedAcResult[]).concat.apply([], Object.values(this.resultsToShow))).find((e)=>e.index==this.selected) as indexedAcResult)?.type;
        },

        getModuleOfSelected(delta: number): string {

            const numItemsInCurrModule = this.resultsToShow[this.currentModule].length;

            // if theselected is out of bounds, i.e.  (selected < indexOfFirstElement OR selected>indexOfLastElement)
            if ( this.selected < this.resultsToShow[this.currentModule][0].index 
                ||
                this.selected > this.resultsToShow[this.currentModule][numItemsInCurrModule -1].index
            ){
                // We want all the (non-zero result) modules
                const listOfAllModules = Object.keys(this.resultsToShow).filter((e) => this.resultsToShow[e].length>0);
                const allModulesLength = listOfAllModules.length;
                const currentModuleIndex = listOfAllModules.indexOf(this.currentModule);
                // The following frames the newSelectionIndex to the results array (it's like a modulo that works for negative numbers as well)
                // It frames ANY number (negative or positive) to the bounds of [0 ... modulesLength]
                return listOfAllModules[(((currentModuleIndex+delta)%allModulesLength)+allModulesLength)%allModulesLength];
            }
            return this.currentModule;
        },

        getCurrentDocumentation(): string {
            return (this.resultsToShow[this.currentModule].find((e) => e.index === this.selected) as acResultType)?.documentation??"";
        },
        
    }, 

});
</script>

<style lang="scss">

.module{
    color: #919191;
    border-top: 1px;
    border-bottom: 1px;
    border-color:#919191;
}
.module:hover{
    cursor: default;
}

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
    width: max-content;
    cursor: pointer;
}

.popup li {
    padding-left: 5px;
    padding-right: 25px;
}

</style>


