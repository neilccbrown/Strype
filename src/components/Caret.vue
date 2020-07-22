<template>
    <div 
        class="caret" 
    > 
    </div>
</template>

<script lang="ts">

//////////////////////
import Vue from 'vue';


//////////////////////
/**
 * Caret is used as a vertical cursor for browsing
 * throughout the code's frames and showing where
 * a frame will be droped when dragged.
 */

export default Vue.extend({
    name: 'Caret',
  
    props: 
    {
        focused: Boolean    // Tells if the caret is focused==visible or not.
    },

});
</script>

<style lang="scss">

.caret
{
    margin-top: 3px;
    width: 120px;
    background-color: #FFB831;
    border-radius: 6px;
    height: 6px;
}

</style>





///////////////////////
//     JUNK YARD     //
///////////////////////

// v-visible="focused"
// data: function () 
// {
//     return {
//         focused: true
//     }
// },

// directives:
// {
//     visible: function(el, binding) 
//     {
//         el.style.visibility = binding.value ? 'visible' : 'hidden'
//     }
// }