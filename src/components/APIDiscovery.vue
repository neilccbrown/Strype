<template>
    <div class="api-container">
        <div class="api-items-container">
            <div v-for="(apiDescItem) in flatAPIDesc" :key="apiDescItem.name">
                <div v-if="isItemShowable(apiDescItem.name, apiDescItem.level)" class="api-item-container"
                    @click="updateSelectedItem(apiDescItem.name, apiDescItem.isFinal, apiDescItem.immediateParentName, apiDescItem.exampleCodePortion, apiDescItem.level)"
                    :style="getAPIItemContainerStyle(apiDescItem.level)">
                    <span :id="apiDescItem.name+'_bullet'" v-html="getItemBullet(apiDescItem.name, apiDescItem.isFinal, apiDescItem.level)" :class="{'api-item-bullet-icon': true, 'api-item-bullet-invisible-icon': apiDescItem.isFinal}"/>
                    <b-card :style="getCardStyle(apiDescItem.name, apiDescItem.level)" style="flex-grow:2; cursor: pointer;">
                        <b-card-text>
                            {{apiDescItem.label}}
                            <i :id="apiDescItem.name+'_info'" v-if="apiDescItem.doc.length > 0" class="fas fa-info-circle" v-b-tooltip.html.v-info.bottomright="{customClass: 'api-info-tooltip'}" :title="apiDescItem.doc" style="color: #bbc6b6;"/> 
                        </b-card-text>
                    </b-card>
                </div> 
            </div>
        </div>
        <div class="api-code-container" v-if="showCodeGeneratorPart">
            <button @click="useExampleCode()" v-html="(isEditing) ? $t('buttonLabel.insertInFrame') : $t('buttonLabel.addFrame')" :disabled="isCodeEmpty() || isSelectedIntermediateItem()" class="api-code-button btn btn-secondary" />
            <div>
                <span class="api-code-label" v-html="$t('apidiscovery.generatedColdeLabel')"/>
                <span v-for="level in codeLevels" :key="'apiCodeSpan_'+level" :style="'color:'+getLevelColor(level)">{{mbAPIExampleCodeParts[level-1]}}</span>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import {APIItemTextualDescription, EmptyDefinition, FrameObject} from "@/types/types"
import store from "@/store/store"

export default Vue.extend({
    name: "APIDiscovery",
    store: store,

    data: function () {
        return {
            selectedAPIItemName: "",
            selectedAPIHierarchyNames: [] as string[], //the list containing the names of the selected item's parents, then selected item, and then its immediate children
            codeLevels: 4, //this shouldn't change in the component, but just makes an easy way to adapt the code if more levels in the API are changed some day
            mbAPIExampleCodeParts: [] as string[], //the example code parts generated when using the API discovery tool (each part <==> one API level)
        }
    },

    computed:{
        //the api description is retrieved from the store: we don't want to recompile it every single time
        flatAPIDesc(): APIItemTextualDescription[]{
            return store.getters.getAPIDescription();
        },

        isEditing(): boolean {
            return store.getters.getIsEditing();
        },

        showCodeGeneratorPart(): boolean {
            return store.getters.getCanShowAPICodeGenerator();
        },
    },

    methods:{
        isCodeEmpty(): boolean{
            return !this.mbAPIExampleCodeParts.find((name) => (name && name.length > 0));
        },

        isSelectedIntermediateItem(): boolean {
            return (!this.flatAPIDesc.find((item) => item.name === this.selectedAPIItemName)?.isFinal)??true;
        },

        isItemShowable(itemName: string, itemLevel: number): boolean {
            //To decide if this API item should be shown, we check these two cases:
            //- if there is no item selected, then all level 1 items are shown
            //- if there is an item selected, we keep all level 1 items, the parents to that item, it's immediate parent siblings, its siblings and its first children
            if(this.selectedAPIItemName.length == 0){
                return itemLevel == 1;
            }
            else {             
                const selectedItemImmedateParent = this.flatAPIDesc.find((item) => item.name == this.selectedAPIItemName)?.immediateParentName??"";
                const selectedItemSiblings = this.flatAPIDesc.filter((item) => item.immediateParentName == selectedItemImmedateParent && item.name != this.selectedAPIItemName).map((item) => item.name);
                const selectedItemGrandParent = this.flatAPIDesc.find((item) => item.name == selectedItemImmedateParent)?.immediateParentName??"";
                const selectedItemImmediateParentSiblings = this.flatAPIDesc.filter((item) => item.immediateParentName == selectedItemGrandParent).map((item) => item.name);
                return itemLevel==1 || this.selectedAPIHierarchyNames.includes(itemName) || selectedItemSiblings.includes(itemName) || selectedItemImmediateParentSiblings.includes(itemName);
            }
        },

        getAPIItemContainerStyle(itemLevel: number): Record<string, string> {
            //the left margin is based on the level: level 1 doesn't have any margin, and the deeper the level, the bigger offset
            const marginLeft = ((itemLevel-1)*20)+"px";
            return {"margin-left": marginLeft};
        },

        getLevelColor(level: number): string {
            //the colour palette we use for each levels obtained using the tool https://hihayk.github.io/scale/#1/3/50/80/-51/67/20/14/7064CE/38/192/219/white
            let levelColor = "";
            switch(level){
            case 1: levelColor = "#095256"; break;
            case 2: levelColor = "#087F8C"; break;
            case 3: levelColor = "#5AAA95"; break;
            case 4: levelColor = "#86A873"; break;
            }
            return levelColor;
        },

        getCardStyle(itemName: string, itemLevel: number): Record<string, string> {
            //the background of the card changes according to two factors:
            //1) selected/no selected
            //2) the level
            const backgroundColor = (this.selectedAPIHierarchyNames.slice(0, this.selectedAPIHierarchyNames.indexOf(this.selectedAPIItemName) + 1).includes(itemName)) 
                ? this.getLevelColor(itemLevel) 
                : "";

            //the text colour changes to white when the card is selected to increase the contrast from the background colours
            //(the non selected colour is in line with the commands foreground colour CSS in Commands.vue)
            const foregroundColor =  (this.selectedAPIHierarchyNames.slice(0, this.selectedAPIHierarchyNames.indexOf(this.selectedAPIItemName) + 1).includes(itemName)) ? "white" : "#252323";
            
            return {"background-color": backgroundColor, "color": foregroundColor};
        },

        getItemBullet(itemName: string, isItemFinal: boolean, itemLevel: number): string {
            // Returns the string value for setting the bullet of an item.
            // We follow that logic:
            // - show a (+) bullet for all items when nothing is selected (i.e. all level 1 entries)
            // - show a (-) to parents of an item and the item when one item is selected
            // - show a (+) to a selected item children if they are not final, nothing otherwise
            // - show an *invisible* bullet (-) to keep the same alignment with other levels for final items
            
            if(this.selectedAPIItemName.length == 0){
                return "+";
            }

            const selectedItemLevel = (this.flatAPIDesc.find((item) => item.name === this.selectedAPIItemName)?.level)??0; //the level *should* be retrieved, that's too keep TS happy
            if(itemLevel <= selectedItemLevel && this.selectedAPIHierarchyNames.includes(itemName) && !isItemFinal){
                return "&minus;"; // the "-" from the numpad is shorter than "+" and makes the alignment messy, that's why we use this symbol instead 
            }
            
            return "+";
        },

        updateSelectedItem(itemName: string, isItemFinal: boolean, itemImmediateParentName: string, itemCodePortion: string, itemLevel: number) {
            // Change the selected item to the item clicked on if its bullet was "(+)" (i.e. expandable) or a final item,
            // change to its immediate parent (or to none if reached level 1) if it's bullet was "(-)" (i.e. collapsable),
            //find out if the item is currently expandable - the class *should* be set, test undefined for keeping TS happy
            const itemBulletValue = (document.getElementById(itemName+"_bullet")?.textContent)??"";
            if(itemBulletValue == "+" || (isItemFinal && (this.selectedAPIItemName != itemName))){
                //when the item is selected, we add the code portion in the code example only if the selected item is in the same hierarchy than the previously selected
                //otherwise, we reconstruct a new example code from scratch
                if(this.selectedAPIHierarchyNames.includes(itemName)){
                    this.mbAPIExampleCodeParts[itemLevel-1] = itemCodePortion; 
                }
                else{
                    let parentName = itemName;
                    let hierarchyLevel = itemLevel;
                    this.mbAPIExampleCodeParts.splice(0, this.codeLevels);
                    while(hierarchyLevel > 0){
                        const parentItem = this.flatAPIDesc.find((item) => item.name == parentName);
                        this.mbAPIExampleCodeParts[hierarchyLevel-1] =  parentItem?.exampleCodePortion??"";
                        parentName = parentItem?.immediateParentName??"";
                        hierarchyLevel--;
                    }
                }   
                this.selectedAPIItemName = itemName;
            }
            else{
                this.selectedAPIItemName = itemImmediateParentName;
                //as we could have closed any level of the hierarchy, we just rewrite the whole code example from scratch
                let hierarchyLevel = itemLevel;
                this.mbAPIExampleCodeParts.splice(0, this.codeLevels);
                let parentName = itemImmediateParentName;
                while(hierarchyLevel > 0){
                    const parentItem = this.flatAPIDesc.find((item) => item.name == parentName);
                    this.mbAPIExampleCodeParts[hierarchyLevel-1] =  parentItem?.exampleCodePortion??"";
                    parentName = parentItem?.immediateParentName??"";
                    hierarchyLevel--;
                }
            }

            //update the hierarchy api item names when we change the selection
            if(this.selectedAPIItemName.length > 0) {
                this.selectedAPIHierarchyNames = []; 
                //first add the parents
                let parentName = (this.flatAPIDesc.find((item) => item.name == this.selectedAPIItemName)?.immediateParentName)??"";
                while(parentName.length > 0){
                    this.selectedAPIHierarchyNames.push(parentName);
                    const parentItem = this.flatAPIDesc.find((item) => item.name == parentName);
                    if(parentItem){
                        parentName = parentItem.immediateParentName;
                    }
                }
                //then the selected item itself
                this.selectedAPIHierarchyNames.push(this.selectedAPIItemName);
                //now get the children (level + 1) of the selected item (i.e. all items which have this item as a parent)
                this.selectedAPIHierarchyNames.push(...this.flatAPIDesc.filter((item) => item.immediateParentName == this.selectedAPIItemName).map((item) => item.name));   
            }
            else{
                this.selectedAPIHierarchyNames = [];
            }
        },

        // Actions to take when the generated code is to be sent to the main code:
        // 1) add a new method call frame if we are not editing
        // 2) insert the code in the current frame (if 1) was done, the current frame becomes this newly added frame),
        // 3) reset the API discovery
        // Note: for avoiding repeating a section of the code, 2) is moved to another method
        useExampleCode(): void {
            const newCode = this.mbAPIExampleCodeParts.join("");
            if(!this.isEditing){
                // part 1): not editing the code: we create a new method call frame, then add the code in (parts 2 & 3)
                store.dispatch(
                    "addFrameWithCommand",
                    EmptyDefinition
                ).then(() => {
                    //as we added a new frame, we need to get the new current frame
                    this.addExampleCodeInSlot(store.getters.getCurrentFrameObject().id, 0, newCode);1
                });
            }
            else{
                //editing mode, just add the code in the existing slot (parts 2 & 3)
                const currentFrame = store.getters.getCurrentFrameObject() as FrameObject;
                const currentSlotIndex = parseInt(Object.entries(currentFrame.contentDict).find((entry) => entry[1].focused)?.[0]??"-1") ;
                this.addExampleCodeInSlot(currentFrame.id, currentSlotIndex, newCode); 
            }            
        },

        // The externalised part to add the code example content in an editable slot (cf useExampleCode() parts 2 & 3) 
        addExampleCodeInSlot(frameId: number, slotIndex: number, content: string){
            store.dispatch(
                "setFrameEditableSlotContent",
                {
                    frameId: frameId,
                    slotId: slotIndex,
                    code: content,
                    initCode: "",
                    isFirstChange: true,
                }
            )
                .then(()=>{
                //in any case, once the code generator has been used, we reset the API discovery
                    this.selectedAPIItemName = "";
                    this.selectedAPIHierarchyNames = [];
                });
        },
    },
});
</script>

<style lang="scss">
.api-container{
    background-color:transparent;
}

.api-items-container{
    max-height: 60vh; //% won't work here. use vh and adapt if the presentation changes...
    overflow-y: auto;
}

.api-item-container {
    display:flex;
    align-items: center;
}

.api-item-bullet-icon{
    margin-left:2px;
    margin-right:3px;
    cursor: pointer;
    font-weight: 600;
}

.api-item-bullet-invisible-icon {
    color: transparent;
    cursor: default;
}
 
.api-code-container{
    display: flex;
    align-items: baseline; 
    margin-top: 10px;
}

.api-code-label{
    color:#6c757d;
}

.api-code-button {
    padding: 1px 6px 1px 6px !important;
    white-space:nowrap;
    margin-right: 5px;
}

.api-info-tooldtip{
    max-width: none !important;
}

//this class is used in the API documentation (in the localised json files)
.api-link {
    color:white;
    text-decoration: underline;
}

.api-link:hover {
    color:rgb(234, 190, 240) ;
}

//the following ovewrites the bootstrap card class
.card-body{
    padding: 5px !important;
}

//the following overwrites the bootstrap tooltip class
.tooltip-inner {
    max-width: 500px !important;
    text-align: justify !important;
}
</style>
