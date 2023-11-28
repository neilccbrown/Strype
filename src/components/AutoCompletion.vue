<template>
    <div>
        <div class="popupContainer">
            <div
                :style="popupPosition"
                class="popup"
            >
                <ul v-show="areResultsToShow()">
                    <div 
                        v-for="module in Object.keys(resultsToShow)"
                        :key="UIID+module"
                        :data-title="module"
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
                            :version="item.version"
                        />
                    </div>
                </ul>
                <div v-show="!areResultsToShow()">
                    <div 
                        class="module empty-results"
                        @mousedown.prevent.stop
                        @mouseup.prevent.stop
                    >
                        <em v-html="$t('autoCompletion.invalidState')"></em>
                    </div>
                </div>
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
                        :version="1"
                    />
                </ul>
            </div>

        </div>
    </div>
</template>

<script lang="ts">
//////////////////////
import Vue from "vue";
import { useStore } from "@/store/store";
import PopUpItem from "@/components/PopUpItem.vue";
import { DefaultCursorPosition, IndexedAcResultWithModule, IndexedAcResult, AcResultType, AcResultsWithModule } from "@/types/types";
import _ from "lodash";
import { mapStores } from "pinia";
import microbitModuleDescription from "@/autocompletion/microbit.json";
import { getAllEnabledUserDefinedFunctions } from "@/helpers/storeMethods";
import { configureSkulptForAutoComplete, getAllExplicitlyImportedItems, getAllUserDefinedVariablesUpTo, getAvailableModulesForImport, prepareSkulptCode, getBuiltins } from "@/autocompletion/acManager";
import Parser from "@/parser/parser";
declare const Sk: any;


//////////////////////
export default Vue.extend({
    name: "AutoCompletion",

    components: {
        PopUpItem,
    },

    props: {
        list: [String],
        slotId: String,
        cursorPosition: {
            type: Object,
            default: () => DefaultCursorPosition,
        },
    },

    data: function() {
        return {
            // We must keep track of whether our request is still the latest one
            // If it is not, we should not record our results, because they are now "stale"
            // and inapplicable.  So we put a number in here that we increment each time
            // we update:
            acRequestIndex : 0,
            acResults: {} as AcResultsWithModule,
            resultsToShow: {} as IndexedAcResultWithModule,
            documentation: [] as string[],
            selected: 0,
            currentModule: "",
            currentDocumentation: "",
        };
    },

    computed: {
        ...mapStores(useStore),

        UIID(): string {
            return "popupAC" + this.slotId;
        },

        acVersions(): Record<string, any> {
            return microbitModuleDescription.versions;
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
    },

    methods: {
        updateACForImport(token: string) : void {
            this.acRequestIndex += 1;
            this.acResults = getAvailableModulesForImport();
            this.showSuggestionsAC(token);
        },
      
        updateAC(frameId: number, token : string, context: string): void {
            this.acRequestIndex += 1;
            const ourAcRequest = this.acRequestIndex;
            this.acResults = {};
            if (context !== "") {
                // There is context, ask Skulpt for a dir() of that context
                const parser = new Parser();
                const userCode = parser.getCodeWithoutErrorsAndLoops(frameId);
                const codeToRun = prepareSkulptCode(userCode, context);
                configureSkulptForAutoComplete();
                const myPromise = Sk.misceval.asyncToPromise(function() {
                    return Sk.importMainWithBody("<stdin>", false, codeToRun, true);
                }, {});
                // Show error in JS console if error happens
                myPromise.then(() => {
                    if (ourAcRequest == this.acRequestIndex) {
                        this.acResults = Sk.ffi.remapToJs(Sk.globals["ac"]);
                        this.showSuggestionsAC(token);
                    }                    
                },
                (err: any) => {
                    console.log("Error running autocomplete code: " + err + "Code was:\n" + codeToRun);
                });
                // Everything else will happen in the callback once Skulpt finishes
            }
            else {
                // No context, just ask for all built-ins, user-defined functions, user-defined variables and everything explicitly imported with "from...import...":
              
                // Pick up built-in Python functions and types:
                this.acResults["Python"] = getBuiltins();
              
                // Add user-defined functions:
                this.acResults[this.$i18n.t("autoCompletion.myFunctions") as string] = getAllEnabledUserDefinedFunctions().map((f) => ({
                    acResult: f.name,
                    documentation: f.documentation,
                    type: "function",
                    version: 0,
                }));
                
                // Add user-defined variables:
                this.acResults[this.$i18n.t("autoCompletion.myVariables") as string] = Array.from(getAllUserDefinedVariablesUpTo(frameId)).map((f) => ({
                    acResult: f,
                    documentation: "",
                    type: "variable",
                    version: 0,
                }));
                
                // Add any items imported via a "from ... import ..." frame
                Promise.all(getAllExplicitlyImportedItems()).then((exportedPerModule : AcResultsWithModule[]) => {
                    if (this.acRequestIndex != ourAcRequest) {
                        return;
                    }
                    for (const exportedOneModule of exportedPerModule) {
                        for (const mod of Object.keys(exportedOneModule)) { 
                            this.acResults["Python"].push(...(exportedOneModule[mod] as AcResultType[]));
                        }
                    }
                    this.showSuggestionsAC(token);
                });
            }
        },

        showSuggestionsAC(token : string): void {
            // we start by reseting the results
            this.resultsToShow = {};
            this.selected = 0;

            // At this stage and since after filtering we have ended up with the final list, we are going to
            // index the results, in order to be able to browse through it with the keys and show the selected.
            let lastIndex=0;
            for (const module in this.acResults) {
                // Filter the list based on the token
                const filteredResults: AcResultType[] = this.acResults[module].filter((element: AcResultType) => 
                    element.acResult.toLowerCase().startsWith(token));

                // Add the indices and the versions
                // (the version is retrieved from the version json object (for microbit), if no version is found, we set 1)
                this.resultsToShow[module] = filteredResults.map((e,i) => {
                    //The context path for the ac results version is matched according to those 3 cases:
                    //1) there is a acContextPath: we just concatenate the acResult of that element,
                    //2) there is no acContextPath and the acResult is the content of an imported module: the acContext is that module and we append the acResult of that element
                    //3) there is no acContextPath and the acResult is an imported module*: the path to check is the acResult itself if that is an imported module 
                    //4) there is no acContextPath and the acResult is not an imported module: there would not be a version so we just use an empty context
                    //(*) which means that the module variable is either empty or "imported modules".
                    let contextPath;
                    if(microbitModuleDescription.modules.includes(module)){
                        contextPath = module + "." + e.acResult;
                    }
                    else{
                        contextPath = (module.length ==0 || module === (this.$i18n.t("autoCompletion.importedModules") as string))  ? e.acResult : "";
                    }
                    return {index: lastIndex+i, acResult: e.acResult, documentation: e.documentation, type: e.type??"", version: this.getACEntryVersion(_.get(this.acVersions, contextPath))};
                });
                lastIndex += filteredResults.length;    
            }    
            //console.log("Results: " + JSON.stringify(this.resultsToShow));

            //if there are resutls
            if(this.areResultsToShow()) {
                // set the first module as the selected one
                this.currentModule = Object.keys(this.resultsToShow).filter((e) => this.resultsToShow[e].length>0)[0];

                this.currentDocumentation = this.getCurrentDocumentation();
                
            }
            
        },  

        changeSelection(delta: number): void {
            const newSelection = this.selected + delta;
            
            // We need to calculate how many elements in total. Each module has a `subList` which we need to take into account
            let resultsLength = 0;
            Object.values(this.resultsToShow).forEach((subList) => resultsLength+=subList.length);
            
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

        getTypeOfSelected(id: string): string {
            // We start by getting the index
            const indexOfSelected = parseInt(id.replace(this.UIID,""));
            // Here we are making all the ACresult objects in a flatten array (with contact.apply()) in which we are then finding the selected and return its type
            return ((([] as IndexedAcResult[]).concat.apply([], Object.values(this.resultsToShow))).find((e)=>e.index==indexOfSelected) as IndexedAcResult)?.type;
        },

        getModuleOfSelected(delta: number): string {

            const numItemsInCurrModule = this.resultsToShow[this.currentModule].length;

            // if the selected is out of bounds, i.e.  (selected < indexOfFirstElement OR selected>indexOfLastElement)
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
            return (this.resultsToShow[this.currentModule].find((e) => e.index === this.selected) as AcResultType)?.documentation??"";
        },

        areResultsToShow(): boolean {
            return Object.values(this.resultsToShow).filter((e) => e.length>0)?.length > 0;
        },

        getACEntryVersion(entry: any): number{
            // The version is stored in 2 ways*: either directly as a numbered value, or as a sub property called "__value__".
            // So we check the first and if no match, the latter.
            // If nothing matches at all, then we return the default value: 1.
            //(*) at the moment not used for microbit, but may be useful in future
            if(!entry){
                return 1;
            }
            else if (typeof entry === "number"){
                return entry;
            }
            else {
                return entry["__version__"];
            }
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

.empty-results {
    white-space: nowrap;
    padding-right: 3px;
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



