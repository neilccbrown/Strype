<template>
    <div>
        <div :class="scssVars.acPopupContainerClassName" spellcheck="false">
            <div
                :style="popupPosition"
                class="popup"
            >
                <ul v-show="areResultsToShow()" @wheel="handleScrollHoverConflict" @scroll="handleScrollHoverConflict" @mousemove="handleScrollHoverConflict">
                    <div 
                        v-for="module in sortCategories(Object.keys(resultsToShow))"
                        :key="UID+module"
                        :data-title="module"
                    >
                        <div 
                            class="module"
                            v-show="module !== ''"
                            @mousedown.prevent.stop
                            @mouseup.prevent.stop
                        >
                            <em>{{module}}</em>
                        </div>
                        <PopUpItem
                            v-for="(item) in resultsToShow[module]"
                            :class="scssVars.acPopupItemClassName"
                            :id="UID+'_'+item.index"
                            :index="item.index"
                            :item="textForAC(item)"
                            :key="UID+'_'+item.index"
                            :selected="item.index==selected"
                            v-on="$listeners"
                            @[CustomEventTypes.acItemHovered]="handleACItemHover"
                            :isSelectable="true"
                            ref="results"
                            :version="item.version"
                        />
                    </div>
                </ul>
                <div v-show="!areResultsToShow()">
                    <div 
                        :class="'module ' + scssVars.acEmptyResultsContainerClassName"
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
                v-show="areResultsToShow()"
            >
                <ul class="limitWidthUl">
                    <PopUpItem
                        class="newlines"
                        :id="UID+'documentation'"
                        :item="currentDocumentation"
                        :key="UID+'documentation'"
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
import {IndexedAcResultWithCategory, IndexedAcResult, AcResultType, AcResultsWithCategory, BaseSlot, AllFrameTypesIdentifier} from "@/types/types";
import _ from "lodash";
import { mapStores } from "pinia";
import microbitModuleDescription from "@/autocompletion/microbit.json";
import {getAllEnabledUserDefinedFunctions, getFrameContainer} from "@/helpers/storeMethods";
import {getAllExplicitlyImportedItems, getAllUserDefinedVariablesUpTo, getAvailableItemsForImportFromModule, getAvailableModulesForImport, getBuiltins, extractCommaSeparatedNames, tpyDefineLibraries} from "@/autocompletion/acManager";
import Parser from "@/parser/parser"; 
import { CustomEventTypes, parseLabelSlotUID } from "@/helpers/editor";
import {Signature, SignatureArg, TPyParser} from "tigerpython-parser";
import scssVars from "@/assets/style/_export.module.scss";

//////////////////////
export default Vue.extend({
    name: "AutoCompletion",

    components: {
        PopUpItem,
    },

    props: {
        list: [String],
        slotId: String,
    },

    data: function() {
        return {
            scssVars, // just to be able to use in template 
            acResults: {} as AcResultsWithCategory,
            resultsToShow: {} as IndexedAcResultWithCategory,
            documentation: [] as string[],
            showFunctionBrackets : true,
            selected: 0,
            currentModule: "",
            currentDocumentation: "",
            CustomEventTypes, // just to be able to use in template 
            allowHoverSelection: true, // flag used to avoid accidental selection when hovering (see handleACItemHover())
            lastTokenStartedUnderscore: true,
            lastContext: undefined as string | undefined,
            lastUserCode: undefined as string | undefined,
        };
    },

    computed: {
        ...mapStores(useStore),

        UID(): string {
            return "popupAC" + this.slotId;
        },

        acVersions(): Record<string, any> {
            return microbitModuleDescription.versions;
        },

        popupPosition(): Record<string, string> {
            return {
                "float" : "left",
                "left": "25px",
            }; 
        },

        popupDocumentationPosition(): Record<string, string> {
            return {
                "float" : "right",
                "right": "-25px",
                //this is needed to avoid showing an empty documentation pane
                "min-width":((this.documentation[this.selected]?.length>0)?"200px":"0px"),
            }; 
        },
    },

    methods: {
        textForAC(item : AcResultType) : string {
            function argText(arg: SignatureArg) : string {
                return arg.name + (arg.defaultValue != null ? "=" + arg.defaultValue : "");
            }
            function paramsText(sig: Signature) : string{
                const posOnly = sig.positionalOnlyArgs.slice(sig.firstParamIsSelfOrCls ? 1 : 0);
                return [
                    ...posOnly.map(argText),
                    ...(posOnly.length > 0 ? ["/"] : []),
                    ...sig.positionalOrKeywordArgs.map(argText),
                    ...(sig.varArgs != null ? ["*" + sig.varArgs.name] : (sig.keywordOnlyArgs.length > 0 ? ["*"] : [])),
                    ...sig.keywordOnlyArgs.map(argText),
                    ...(sig.varKwargs != null ? ["**" + sig.varKwargs.name] : []),
                ].join(", ");
            }
            if (item.acResult == "load_image") {
                console.log(JSON.stringify(item));
            }
            return item.acResult + ((this.showFunctionBrackets && item.type.includes("function")) ? "(" + (item.signature ? paramsText(item.signature) : item.params?.filter((p) => !p.hide && p.defaultValue === undefined)?.map((p) => p.name)?.join(", ") || "") + ")" : "");
        },

        sortCategories(categories : string[]) : string[] {
            // Other items (like the names of variables when you do var.) will come out as -1,
            // which works nicely because they should be first:
            const isInsideFuncCallFrame = this.appStore.frameObjects[(parseLabelSlotUID(this.slotId).frameId)].frameType.type === AllFrameTypesIdentifier.funccall;
            const getOrder = (cat : string) => {
                // First is my variables and my functions (in that order, except when we are inside a function call frame.)
                if (cat === this.$i18n.t("autoCompletion.myVariables")) {
                    return (isInsideFuncCallFrame) ? 1 : 0;
                }
                else if (cat === this.$i18n.t("autoCompletion.myFunctions")) {
                    return (isInsideFuncCallFrame) ? 0 : 1;
                }
                else if (cat === this.$i18n.t("autoCompletion.importedModules")) {
                    return 2;
                }
                // Python in-built is after any custom imports:
                else if (cat === "Python") {
                    return 4;
                }
                else {
                    return 3;
                }
            };
            
            // Before returning the categories, we need to reflect the sorting change to the categories' elements indexes
            // as they may not be in order anymore. This is is required for coherence between the data list and the CSS selection.
            const sortedCategories = categories.sort((a, b) => getOrder(a) - getOrder(b));
            let indexValue = 0;
            sortedCategories.forEach((category) => {
                this.resultsToShow[category].forEach((acResult) => {
                    acResult.index = indexValue;
                    indexValue++;
                });
            });

            // Now we can return the categories
            return sortedCategories;
        },
      
        async updateACForModuleImport(token: string) : Promise<void> {
            this.acResults = await getAvailableModulesForImport();
            this.showFunctionBrackets = false;
            // Only show imports if the slot isn't following "as" (so we need to check the operator)
            const {frameId, slotId} = parseLabelSlotUID(this.slotId);
            if(parseInt(slotId) == 0 || (this.appStore.frameObjects[frameId].labelSlotsDict[0].slotStructures.operators[parseInt(slotId) - 1] as BaseSlot).code != "as"){
                this.showSuggestionsAC(token);
            }
        },

        updateACForImportFrom(token: string, module: string) : void {
            getAvailableItemsForImportFromModule(module).then((items) => {
                this.acResults = {"": items.filter((ac) => !ac.acResult.startsWith("_"))};
                this.showFunctionBrackets = false;
                this.showSuggestionsAC(token);
            });
        },
      
        // frameId is which frame we're in.
        // token is the string token being edited, or null if it's invalid to show code completion here
        // context is the part before any preceding dot before us 
        async updateAC(frameId: number, token : string | null, context: string): Promise<void> {
            const tokenStartsWithUnderscore = (token ?? "").startsWith("_");
            const parser = new Parser();
            const inFuncDef = getFrameContainer(frameId) == useStore().getFuncDefsFrameContainerId;
            const userCode = parser.getCodeWithoutErrors(frameId, inFuncDef);
            
            await tpyDefineLibraries(parser);
            
            // If nothing relevant changed, no need to recalculate, just update based on latest token:
            if (this.lastTokenStartedUnderscore == tokenStartsWithUnderscore &&
                this.lastContext === context &&
                this.lastUserCode === userCode) {
                
                this.showSuggestionsAC(token ?? "");
                return;
            }
            else {
                // Remember the details from the AC update we are about to do:
                this.lastTokenStartedUnderscore = tokenStartsWithUnderscore;
                this.lastContext = context;
                this.lastUserCode = userCode;
            }
            
            this.showFunctionBrackets = true;
            const imported = await getAllExplicitlyImportedItems(context);
            this.acResults = {};
            if (token === null) {
                this.showSuggestionsAC("");
            }
            else if (context !== "" && imported[context as keyof typeof imported]) {
                const items = imported[context as keyof typeof imported];
                this.acResults = {[context]: items};
                this.showSuggestionsAC(token);
            }
            else if (context !== "") {
                // When we generate the user code we leave off the actual frame where we want
                // the autocompletion because it won't be syntactically valid and thus would be
                // get tangled in our check for errors (plus we can't easily determine the exact
                // position we're completing at once the slots are turned into plain Python).
                //
                // To give TigerPython's autocomplete a place to examine to do the autocompletion
                // we actually generate a dummy extra line of code with the context that we want
                // plus a dot, then ask TigerPython to complete at the very end: 
                let totalCode = userCode + "\n" + parser.getStoppedIndentation() + context + ".";
                let tppCompletions = TPyParser.autoCompleteExt(totalCode, totalCode.length);
                if (tppCompletions == null) {
                    tppCompletions = [];
                }
                const items =  tppCompletions.filter((s) => !s.acResult.startsWith("_") || token.startsWith("_")).map((s) => ({
                    acResult: s.acResult,
                    documentation: s.documentation,
                    params: s.params == null ? [] : s.params.map((p) => ({name: p})),
                    type: ["function", "module", "variable", "type"].includes(s.type ?? "") ? [s.type] : [],
                    version: 0,
                } as AcResultType));
                this.acResults = {[context]: items};
                this.showSuggestionsAC(token);
            }
            else {
                // No context, just ask for all built-ins, user-defined functions, user-defined variables and everything explicitly imported with "from...import...":
              
                // Pick up built-in Python functions and types:
                this.acResults["Python"] = getBuiltins().filter((ac) => !ac.acResult.startsWith("_") || token.startsWith("_"));
              
                // Add user-defined functions:
                this.acResults[this.$i18n.t("autoCompletion.myFunctions") as string] = getAllEnabledUserDefinedFunctions().map((f) => ({
                    acResult: (f.labelSlotsDict[0].slotStructures.fields[0] as BaseSlot).code,
                    documentation: "",
                    type: ["function"],
                    params: extractCommaSeparatedNames(f.labelSlotsDict[1].slotStructures).map((p) => ({name: p})),
                    version: 0,
                }));
                
                // Add user-defined variables:
                this.acResults[this.$i18n.t("autoCompletion.myVariables") as string] = Array.from(getAllUserDefinedVariablesUpTo(frameId)).map((f) => ({
                    acResult: f,
                    documentation: "",
                    type: ["variable"],
                    version: 0,
                }));
                
                // Add any items imported via a "from ... import ..." frame
                this.acResults = {...this.acResults, ...imported};
                
                // We know everything we need, we can immediately show the autocomplete:
                this.showSuggestionsAC(token);
            }
        },

        showSuggestionsAC(token : string): void {
            // we start by reseting the results
            this.resultsToShow = {};
            this.selected = 0;
        
            // We scroll to the top of the list, because having the a/c always in the DOM
            // may cause the scroll bar to be left at a given position which we don't want 
            // to keep between two "showings" of the a/c
            this.$el.querySelector("ul")?.scrollTo(0,0);

            // At this stage and since after filtering we have ended up with the final list, we are going to
            // index the results, in order to be able to browse through it with the keys and show the selected.
            let lastIndex=0;
            for (const module in this.acResults) {
                // Filter the list based on the token
                const filteredResults: AcResultType[] = this.acResults[module].filter((element: AcResultType) => 
                    element.acResult.toLowerCase().startsWith(token.toLowerCase()));

                // Don't put empty lists in resultsToShow
                if (filteredResults.length == 0) {
                    continue;
                }
                
                // Add the indices and the versions
                // (the version is retrieved from the version json object (for microbit), if no version is found, we set 1)
                this.resultsToShow[module] = filteredResults
                    .sort((a, b) => a.acResult.localeCompare(b.acResult))
                    .map((e,i) => {
                        let contextPath = module + "." + e.acResult;
                        return {index: lastIndex+i, acResult: e.acResult, documentation: e.documentation, type: e.type??"", params: e.params, signature: e.signature, version: this.getACEntryVersion(_.get(this.acVersions, contextPath))};
                    });
                lastIndex += filteredResults.length;    
            }

            //if there are resutls
            if(this.areResultsToShow()) {
                // The results's categories should also be sorted here otherwise we have a difference between what will be returned and the UI!
                this.sortCategories(Object.keys(this.resultsToShow));
                // We want to select the entry (to get its module) which is marked as 0 (in "index" property of the IndexedAcResult object -- NOT the first element of the sorted list).
                this.currentModule = (Object.entries(this.resultsToShow)
                    .find((catIndexedACRes) => catIndexedACRes[1].some((indexedACRes) => indexedACRes.index == 0)) // here we find which category has its property "index" at 0 ([1] is to get the Object value)
                    ?.[0]) ?? ""; // if we have found (we should) the right entry, we get its key value (hence ?.[0]) which is the module, or empty to keep TS happy.
                this.currentDocumentation = this.getCurrentDocumentation();   
            }
        },  

        handleScrollHoverConflict(event: Event){
            // When we scroll the a/c we ignore mouse hover until the mouse is moved again (see handleACItemHover()).
            if(event.type == "scroll" || event.type == "wheel"){
                this.allowHoverSelection = false;
            }
            else if(!this.allowHoverSelection && event.type == "mousemove" && (Math.abs((event as MouseEvent).movementX) > 2 || Math.abs((event as MouseEvent).movementY) > 2)) {
                this.allowHoverSelection = true;
                this.$nextTick(() => {
                    // Select the item immediately manually, because otherwise we need to wait that another item is selected for hover to work
                    const selectedItem = document.querySelector("." + scssVars.acItemClassName + ":hover");
                    if(selectedItem){
                        const indexOfSelected = parseInt(selectedItem.id.replace(this.UID + "_",""));
                        this.handleACItemHover(indexOfSelected);
                    }
                });
            }
        },

        handleACItemHover(selectedItem: number){
            // We want to set the hovered item as selected. However, we cannot do that systematically:
            // when the a/c has been scrolled, there is a chance another item get passively hovered as it would "fall under the mouse".
            // So, we set a flag to detect a mouse move to make sure accidently hovered items don't get selected
            if(this.allowHoverSelection){      
                this.selected = selectedItem;
                // We retrieve the module with CSS, it is just easier than trying to deduce it from the a/c content!
                this.currentModule = this.getModuleOfSelected();
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
            const items = this.$el.querySelectorAll(".ac-popup-item");
            // we want to get the selected item to the end of the scrolling area (so inline set to "end", the other properties are used
            // to avoid the whole page to scroll down (bug #279), see https://stackoverflow.com/questions/11039885/scrollintoview-causing-the-whole-page-to-move).
            items[this.selected].scrollIntoView({block:"nearest", inline:"end"});
            
            // and we also set the flag to prevent selection by hovering (cf. handleACItemHover())
            this.allowHoverSelection = false;
        },

        getTypeOfSelected(id: string): ("function" | "module" | "variable" | "type")[] {
            // We start by getting the index
            const indexOfSelected = parseInt(id.replace(this.UID + "_",""));
            // Here we are making all the ACresult objects in a flatten array (with contact.apply()) in which we are then finding the selected and return its type
            return ((([] as IndexedAcResult[]).concat.apply([], Object.values(this.resultsToShow))).find((e)=>e.index==indexOfSelected) as IndexedAcResult)?.type ?? [];
        },

        getModuleOfSelected(delta?: number): string {
            // Gets the module of the current selection. There are 2 ways of achieving this: using the a/c content object resultsToShow or CSS.
            // If no delta is given as argument of the method, then we search with CSS (which is the case when using the mouse to select an item).
            if(delta != undefined){
                const numItemsInCurrModule = this.resultsToShow[this.currentModule].length;

                // If the selected is out of bounds, i.e.  (selected < indexOfFirstElement OR selected>indexOfLastElement) within this module's items
                if (this.selected < this.resultsToShow[this.currentModule][0].index 
                    || this.selected > this.resultsToShow[this.currentModule][numItemsInCurrModule -1].index){
                    // We need to find out the module corresponding to the item that will be selected,
                    // we cannot rely on the order of the modules in this.resultsToShow as they are not the same as the UI,
                    // we rely on the "index" property of the a/c item of the items instead: it's are ordered as per the UI.
                    const selectedResultItem = Object.entries(this.resultsToShow)
                        .find((resultsToShowForModule) => resultsToShowForModule[1]
                            .find((resultToShowForModule) => resultToShowForModule.index == this.selected) != undefined);
                    if(selectedResultItem){
                        // We should get a result. If for some reason we don't, then the module returned will be the current one...
                        return selectedResultItem[0];
                    }


                }
                return this.currentModule;
            }
            else{
                // With CSS, we simply look up the parent of the *hovered* item (one of the LIs) and retrieve its data-title attribute.
                // There SHOULD be a selection, but in case something is messed up and we don't retrieve, we'll return the current module.
                // (we use "hover" because when this method is called, the new selection isn't yet reflected in the change of styling);
                const selectedLIElementParent = document.querySelector("li." + scssVars.acItemClassName +":hover")?.parentElement;
                return (selectedLIElementParent?.getAttribute("data-title")) ?? this.currentModule;
            }
        },

        getCurrentDocumentation(): string {
            const curAC = this.resultsToShow[this.currentModule].find((e) => e.index === this.selected) as AcResultType;
            if (curAC) {
                return curAC.documentation || (this.$i18n.t("autoCompletion.noDocumentation") as string); 
            }
            else {
                return "";
            }
        },

        areResultsToShow(): boolean {
            return Object.values(this.resultsToShow)?.length > 0;
        },

        getACEntryVersion(entry: any): number {
            if (entry && typeof entry === "number"){
                return entry as number;
            }
            // If nothing matches at all, then we return the default value: 1.
            return 1;
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

.#{$strype-classname-ac-empty-results-container} {
    white-space: nowrap;
    padding-right: 3px;
}

.#{$strype-classname-ac-popup-container} {
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



