<template>
    <div class="next-to-eachother">
        <input type="text" v-model="code" v-bind:placeholder="defaultText" >
    </div>
</template>

<script lang="ts">
import Vue from 'vue';

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
    }
});
</script>