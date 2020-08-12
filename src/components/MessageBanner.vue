<template>
    <div class="message-banner-container">
        <span>test banner</span>
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
});
</script>

<style lang="scss">
.message-banner-container {
    display: inline-block;
}
</style>
