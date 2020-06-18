<template>
    <form>
        <input type="text" v-model="code" v-bind:placeholder="defaultText" v-on:change="changeHandler">
    </form>
</template>

<script lang="ts">
import Vue from 'vue';

import { BootstrapVue, IconsPlugin } from 'bootstrap-vue';

export default Vue.extend({
    name: 'EditableSlot',
  
    props: 
    {
        defaultText: String
    },

    data: function () 
    {
        return{
            code: ""
        }
    },
    
    methods:
    {
        changeHandler: function()
        {
            this.$data.code = this.$data.code.split('').reverse().join('')
        }
    }

    

});
</script>