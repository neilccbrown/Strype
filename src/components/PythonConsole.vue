
<template>
    <div>
        <button id="runPythonConsoleButton" @click="runCodeOnPyConsole" v-html="'▶ '+$t('console.run')"></button>
        <textarea 
            id="pythonConsole"
            ref="pythonConsole"
            @focus="onFocus()"
            @change="onChange"
            @wheel="stopPropateEvent"
            @keydown.self.stop="stopPropateEvent"
            @keyup.self.stop="stopPropateEvent"
            disabled
        >    
        </textarea>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import { useStore } from "@/store/store";
import { storeCodeToDOM } from "@/autocompletion/acManager";
import Parser from "@/parser/parser";
import { runPythonConsole } from "@/helpers/runPythonConsole";
import { mapStores } from "pinia";
import { hasEditorCodeErrors } from "@/helpers/editor";
import i18n from "@/i18n";

export default Vue.extend({
    name: "PythonConsole",

    computed:{
        ...mapStores(useStore),
    },

    methods: {
        runCodeOnPyConsole() {
            // Before doing anything, we make sure there are no errors found in the in code
            if(hasEditorCodeErrors()) {
                Vue.$confirm({
                    message: i18n.t("appMessage.preCompiledErrorNeedFix") as string,
                    button: {
                        yes: i18n.t("buttonLabel.ok"),
                    },
                });    
                return;
            }

            const console = this.$refs.pythonConsole as HTMLTextAreaElement;
            console.value = "";
            const parser = new Parser();
            const userCode = parser.getFullCode();
            storeCodeToDOM(userCode);
            // Trigger the actual console launch
            runPythonConsole(console, userCode);
        },

        onFocus(): void {
            this.appStore.isEditing = false;
        },

        onChange(): void {
            const consoleTextarea = this.$refs.pythonConsole as HTMLTextAreaElement
            consoleTextarea.scrollTop = consoleTextarea.scrollHeight;
        },

        stopPropateEvent(event: WheelEvent | KeyboardEvent) {
            // Mouse scrolling on the right panel (commands) is forwarded to the editor -- for the console, we don't want to propagate the event
            // Key events are captured by the UI to navigate the blue cursor -- for the console, we don't want to propagate the event
            event.stopPropagation();
        },
    },

})
</script>

<style lang="scss">
    textarea {
        -webkit-box-sizing: border-box; /* Safari/Chrome, other WebKit */
        -moz-box-sizing: border-box;    /* Firefox, other Gecko */
        box-sizing: border-box;         /* Opera/IE 8+ */
    }

    #pythonConsole {
        width:100%;
        min-height: 5vh;
        max-height: 30vh;
        font-size: 12px;
        background-color: #0a090c;
        color: #f0edee;
        flex-grow: 2;
    }
</style>
