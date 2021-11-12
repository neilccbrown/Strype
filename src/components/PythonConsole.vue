
<template>
    <div>
        <button id="run" @click="runCodeOnPyConsole" v-html="'▶ '+$t('console.run')" ></button>
        <textarea id="console" autocomplete="off"></textarea>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import { runPythonCode } from "@/autocompletion/acManager";
import Parser from "@/parser/parser";

export default Vue.extend({
    name: "PythonConsole",

    methods: {
        runCodeOnPyConsole() {
            const parser = new Parser();
            const userCode = parser.getFullCode();
            console.log(userCode);
            runPythonCode(userCode);
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
    #console {
        width:100%;
        height:100%;
        font-size: 12px;
        float:none;
        background-color: #0a090c;
        color: #f0edee;
    }
</style>
