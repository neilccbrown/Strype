<template>
    <div class="next-to-eachother">
        <input
            type="text"
            autocomplete="off"
            v-if="isComponentLoaded"
            :disabled="isDisabled"
            v-model="code"
            :placeholder="defaultText"
            v-focus="focused"
            @focus="onFocus()"
            @blur="onBlur()"
            @keyup.left.prevent.stop="onLRKeyUp($event)"
            @keyup.right.prevent.stop="onLRKeyUp($event)"
            @keyup.enter.prevent.stop="onLRKeyUp($event)"
            @keyup.up.prevent.stop="onUDKeyUp($event)"
            @keyup.down.prevent.stop="onUDKeyUp($event)"
            :class="{editableSlot: focused, error: erroneous}"
            :id="UIID"
            :key="UIID"
            class="input"
            :style="inputTextStyle"
        />
        <b-popover
          v-if="erroneous"
          :target="UIID"
          :title="this.$i18n.t('errorMessage.errorTitle')"
          triggers="hover focus"
          :content="errorMessage"
          class="popover"
        >
        </b-popover>
        <div 
            class="editableslot-placeholder"
            :id="placeholderUIID"
            :value="code"
        />
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import store from "@/store/store";
import { CaretPosition, Definitions, FrameObject, SearchLangDefScope} from "@/types/types";
import { getEditableSlotUIID } from "@/helpers/editor";
import { searchLanguageElements } from "@/autocompletion/acManager";
import Parser, {getStatementACContext} from "@/parser/parser";


export default Vue.extend({
    name: "EditableSlot",
    store,

    props: {
        defaultText: String,
        slotIndex: Number,
        frameId: Number,
        isDisabled: Boolean,
        optionalSlot: Boolean,
    },

    beforeDestroy() {
        store.commit("removePreCompileErrors",this.UIID);
    },

    mounted() {
        //when the component is loaded, the width of the editable slot cannot be computed yet based on the placeholder
        //because the placeholder hasn't been loaded yet. Here it is loaded so we can set the width again.
        this.isComponentLoaded  = true;
    },

    data() {
        return {
            //this flags indicates if the content of editable slot has been already modified during a sequence of action
            //as we don't want to save each single change of the content, but the full content change itself.
            isFirstChange: true, 
            
            //this flag is used to "delay" the computation of the input text field's width,
            //so that the width is rightfully computed when displayed for the first time
            isComponentLoaded : false,
        };
    },
    
    computed: {
        placeholderUIID(): string {
            return "editplaceholder_" + getEditableSlotUIID(this.frameId, this.slotIndex);
        },

        initCode(): string {
            return store.getters.getInitContentForFrameSlot();
        },

        inputTextStyle(): Record<string, string> {
            return {
                "background-color": ((this.code.trim().length > 0) ? "transparent" : "#FFFFFF") + " !important",
                "width" : this.computeFitWidthValue(),
                "color" : (store.getters.getFrameObjectFromId(this.frameId).frameType.type === Definitions.CommentDefinition.type)
                    ? "#97971E"
                    : "#000",
            };
        },

        code: {
            get(){
                return store.getters.getContentForFrameSlot(
                    this.$parent.$props.frameId,
                    this.$props.slotIndex
                );
            },
            set(value: string){
                store.dispatch(
                    "setFrameEditableSlotContent",
                    {
                        frameId: this.frameId,
                        slotId: this.slotIndex,
                        code: value,
                        initCode: this.initCode,
                        isFirstChange: this.isFirstChange,
                    }
                );
                this.isFirstChange = false;

                //get the autocompletion candidates
                const inputField = document.getElementById(this.UIID) as HTMLInputElement;
                const textArea = document.getElementById("acTextArea") as HTMLTextAreaElement;
                if(inputField && textArea){
                    const textBeforeCaret = inputField.value?.substr(0,inputField.selectionStart??0)??"";
                    let contextPath = (textBeforeCaret.indexOf(".") > -1) ? textBeforeCaret.substr(0, textBeforeCaret.lastIndexOf(".")) : "";
                    let token = (textBeforeCaret.indexOf(".") > -1) ? textBeforeCaret.substr(textBeforeCaret.lastIndexOf(".") + 1) : textBeforeCaret;
               
                    let acCandidates = ""; 
                    let showAC = true;
                    
                    //workout the correct context if we are in a code editable slot
                    const frame: FrameObject = store.getters.getFrameObjectFromId(this.frameId);
                    if(frame.frameType.type !== Definitions.ImportDefinition.type){
                        const newContext = getStatementACContext(textBeforeCaret, this.frameId);
                        contextPath = newContext.contextPath;
                        token = newContext.token;
                        showAC = newContext.showAC;
                    } 
                    
                    if(showAC){
                        searchLanguageElements(token, contextPath).forEach((acElement) => acCandidates += (acElement.name + " (kind: " + acElement.kind+")\n"));
                    }
                    textArea.textContent = acCandidates;    
                }
            },
        },

        focused(): boolean {
            return store.getters.getIsEditableFocused(
                this.$props.frameId,
                this.$props.slotIndex
            );
        },

        erroneous(): boolean {
            return store.getters.getIsErroneousSlot(
                this.$props.frameId,
                this.$props.slotIndex
            );
        },

        UIID(): string {
            return getEditableSlotUIID(this.$props.frameId, this.$props.slotIndex);
        },

        errorMessage(): string{
            return store.getters.getErrorForSlot(
                this.$props.frameId,
                this.$props.slotIndex
            );
        },
    },

    directives: {
        focus: {
            //This is needed to set the focus when a frame with slots has just been added (i.e. when `leftRightKey` is called after `addFrameWithCommand` in Commands.vue)
            inserted: function (el,binding) {
                if(binding.value) {
                    el.focus();
                }
            },
            // Used so the store can set the focus of this element
            componentUpdated: function (el, binding) {
                if(binding.value !== binding.oldValue) {
                    if(binding.value){
                        el.focus();
                    }
                    else {
                        el.blur();
                    }
                }
            },
        },
    },

    methods: {

        //Apparently focus happens first before blur when moving from one slot to another.
        onFocus(): void {
            this.isFirstChange = true;
            store.dispatch(
                "setFocusEditableSlot",
                {
                    frameId: this.$props.frameId,
                    slotId: this.$props.slotIndex,
                    caretPosition: (store.getters.getAllowChildren(this.$props.frameId)) ? CaretPosition.body : CaretPosition.below,
                }
            );      
            
            //set the language definition referential right depending on where is this editableslot
            let scope = SearchLangDefScope.inCode;
            let rootPath = "";
            const frame: FrameObject = store.getters.getFrameObjectFromId(this.frameId);
            if(frame.frameType.type === Definitions.ImportDefinition.type){
                scope = (this.slotIndex > 1) 
                    ? SearchLangDefScope.none
                    : (this.slotIndex === 1 && frame.contentDict[0].shownLabel)
                        ? SearchLangDefScope.importModulePart
                        : SearchLangDefScope.importModule; 
            }
            else if(frame.frameType.type === Definitions.CommentDefinition.type) {
                scope = SearchLangDefScope.none;
            }
            
            if(scope === SearchLangDefScope.importModulePart){
                rootPath = frame.contentDict[0].code;
            }
            
            const textArea = document.getElementById("acTextArea") as HTMLTextAreaElement;
            if(textArea){
                textArea.textContent = "";
            }
            
            store.commit(
                "setCurrentLangSearchReferential",
                {
                    scope: scope,
                    rootPath: rootPath,
                }
            );

        },

        onBlur(): void {
            store.dispatch(
                "updateErrorsOnSlotValidation",
                {
                    frameId: this.$props.frameId,
                    slotId: this.$props.slotIndex,
                    code: this.code.trim(),
                }   
            );
        },

        onLRKeyUp(event: KeyboardEvent) {
            //get the input field
            const input: HTMLInputElement = this.$el.firstElementChild as HTMLInputElement;
            if(input !== undefined){
                const start = input.selectionStart ?? 0;
                const end = input.selectionEnd ?? 0;
                
                if((start === 0 && event.key==="ArrowLeft") || (event.key === "Enter" || (end === input.value.length && event.key==="ArrowRight"))) {
                    
                    store.dispatch(
                        "leftRightKey",
                        event.key
                    );
                    this.onBlur();
                }
            }
        },

        onUDKeyUp(event: KeyboardEvent) {

            // In any case the focus is lost, and the caret is shown (below by default)
            this.onBlur();
            
            //If the up arrow is pressed you need to move the caret as well.
            if( event.key === "ArrowUp" ) {
                store.dispatch(
                    "changeCaretPosition",
                    event.key
                );
            }
        },
        
        computeFitWidthValue(): string {
            const placeholder = document.getElementById(this.placeholderUIID);
            let computedWidth = "150px"; //default value if cannot be computed
            const offset = 10;
            if (placeholder) {
                placeholder.textContent = (this.code.length > 0) ? this.code : this.defaultText;
                //the width is computed from the placeholder's width from which
                //we add extra space for the cursor.
                computedWidth = (placeholder.offsetWidth + offset) + "px";
            }
            return computedWidth;
        },

    },
});
</script>

<style lang="scss">
.error {
    border: 1px solid #FF0000 !important;
}

.input {
    border-radius: 5px;
    border: 1px solid transparent;;
}

.input:hover {
    border: 1px solid #B4B4B4;;
}

.editableslot-placeholder {
    position: absolute;
    display: inline-block;
    visibility: hidden;
    white-space: nowrap;
}

.popover {
    //Nedded for understanding the formated errors that split multiple
    // errors with \n
    white-space: pre-line !important;
}

</style>