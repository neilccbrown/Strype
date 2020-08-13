<template>
    <div class="message-banner-container">
        <span>{{message}}</span>
        <span class="message-banner-cross" v-on:click="close">&#x2716;</span>
        <br/>
        <button 
            v-for="button in buttons"
            v-bind:key="'messageButton-'+buttons.indexOf(button)"
            v-on:click="onButtonClick(button.action)">
            {{button.label}}
            </button>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import store from "@/store/store";
import { MessageDefinedActions } from "@/types/types";

export default Vue.extend({
    name: "MessageBanner",
    store,

    props:{
        message: String,
        buttons: Array,
    },

    methods: {
        close(): void {
            store.commit("toggleMessageBanner");
        },
        onButtonClick(payload: VoidFunction | string){
            if((typeof payload) === "function"){
                (payload as VoidFunction)();
            }
            else{
                switch(payload){
                case MessageDefinedActions.closeBanner:
                    store.commit("toggleMessageBanner");
                    break;
                case MessageDefinedActions.undo:
                    alert("Will Undo whan has been done.");
                    break;
                default:
                    break;
                }
            }
        },
    },
});
</script>

<style lang="scss">
.message-banner-container {
    display: inline-block;
    width: 100%;
    background-color: #BBBBBB;
    padding:5px;
}

.message-banner-cross {
    float: right;
    margin-right:15px;
    cursor:pointer;
}
</style>
