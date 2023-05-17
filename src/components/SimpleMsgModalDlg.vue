<template>
    <ModalDlg :dlgId="dlgId" :dlgTitle="dlgTitle" :noCloseOnBackDrop="true" :hideHeaderClose="true" :okOnly="true">
        <span>{{dlgMsg}}</span>
    </ModalDlg>
</template>

<script lang="ts">
import Vue from "vue";
import ModalDlg from "@/components/ModalDlg.vue";
import { useStore } from "@/store/store";
import { mapStores } from "pinia";

export default Vue.extend({
    name: "SimpleMsgModalDlg",

    components:{
        ModalDlg,
    },

    props:{
        dlgId: String,
        dlgTitle: String,
    },

    computed:{
        ...mapStores(useStore),
        
        dlgMsg(): string{
            return this.appStore.simpleModalDlgMsg; 
        },
    },
});
</script>

<style lang="scss">
</style>