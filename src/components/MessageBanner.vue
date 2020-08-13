<template>
    <div class="message-banner-container">
        <span>test banner</span>
        <span class="message-banner-cross" v-on:click="close">&#x2716;</span>
        <br/>
        <button>OK</button>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import store from "@/store/store";

export default Vue.extend({
    name: "MessageBanner",
    store,

    methods: {

        close(): void {
            store.commit("toggleMessageBanner");
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
