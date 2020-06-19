<template>
    <div class="block">
        <div class="next-to-eachother" v-for="item in labels" v-bind:key="item.label + parent">
            <div>{{item.label}}</div>
            <EditableSlot v-if="item.slot" default-text="Default display text"/>
        </div>
    </div>
</template>



<script lang="ts">

//////////////////////
//      Imports     //
//////////////////////
import Vue from 'vue';
import { BootstrapVue, IconsPlugin } from 'bootstrap-vue';
import EditableSlot from './EditableSlot.vue';


//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: 'FrameHeader',
    
    components: 
    {
        EditableSlot
    },

    props: 
    {
        // We need an array of labels in the case there are more
        // than one labels in the frame (e.g. `with` ... `as ... )
        labels : Array,
        parent: Number
    }

});
</script>



<style lang="scss">
.block 
{
    color: #000 !important;
    background-color: #ddffff !important;
    border-left: 6px solid #2c3e50 !important;
    border-left-color: rgb(204, 204, 204);
    margin-top: 7px;
}

.next-to-eachother
{
    display: inline-block;
}

</style>