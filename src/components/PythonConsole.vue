
<template>
    <div>
        <button id="run" @click="runCodeOnPyConsole" v-html="'▶ '+$t('console.run')" ></button>
        <textarea 
            id="strypePythonConsole"
            ref="strypePythonConsole"
            @focus="onFocus()"
            @blur="onBlur()"
            @change="onChange"
            disabled
        >    
        </textarea>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import store from "@/store/store";
import { storeCodeToDOM } from "@/autocompletion/acManager";
import Parser from "@/parser/parser";
import { runPythonConsole } from "@/helpers/runPythonConsole";

export default Vue.extend({
    name: "PythonConsole",

    methods: {
        runCodeOnPyConsole() {
            const console = this.$refs.strypePythonConsole as HTMLTextAreaElement;
            console.value = "";
            const parser = new Parser();
            const userCode = parser.getFullCode();
            storeCodeToDOM(userCode);
            // Trigger the actual console launch
            runPythonConsole(console, userCode);
        },

        onFocus(): void {
            store.commit(
                "setEditFlag",
                true
            );    
        },

        onBlur(): void {
            store.commit(
                "setEditFlag",
                false
            );    
        },

        onChange(): void {
            const consoleTextarea = this.$refs.strypePythonConsole as HTMLTextAreaElement
            consoleTextarea.scrollTop = consoleTextarea.scrollHeight;
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
    #strypePythonConsole {
        width:100%;
        height:300px;
        font-size: 12px;
        float:none;
        background-color: #0a090c;
        color: #f0edee;
    }
</style>
