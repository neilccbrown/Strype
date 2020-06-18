<template>
  <div>
    <FrameLabel v-if="frameLabel !== null" v-bind:parent="id" v-bind:labels="frameLabel"/>

  </div>
</template>

<script lang="ts">

//////////////////////
//      Imports     //
//////////////////////
import Vue from 'vue';
import { BootstrapVue, IconsPlugin } from 'bootstrap-vue';
import FrameLabel from '../FrameLabel.vue';
import store from '../../store';

////////////////////////////
//   Type Declarations    //
////////////////////////////
declare module 'vue/types/vue' {
  // 3. Declare augmentation for Vue
  interface Vue {
    $codeText: string;
  }
}

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: 'Frame',
    store,
    components:
    {
        FrameLabel
    },

    props: 
    {
        id: Number, // Unique Indentifier for each Frame
        type: String, //Type of the Frame
        parent: Number // ID of the parent
    },

    data: function () 
    {
        return{
            //Assign the props to internal <data> variables
            $codeText : this.$props.type,
            parentId :  this.$props.parent,
            // `False` if a single line frame and `True` if a block
            compound : false,

            // This is an array as there are more than one labels for if.
            // Note that the slot variable of each objects tells if the
            // Label needs an editable slot as well attached to it. 
            //frameLabel: [{label :'if' , slot : true},{label :':' , slot : false}],
            // frameLabel: null,

            // The body can be one of the following two:
            // 1) An editable slot, if our `Frame` is a single-line statement (eg. method call, variable assignment)
            // 2) A `Frame` in order to hold more frames in it 
            body : null
           
        }
    },

    computed:
    {

        frameLabel : function() 
        {
            // console.log("code=" + this.$props.type); 
            // console.log(store.state.frames.find(o => o.name === this.$data.$codeText));
            return store.state.frames.find(o => o.name === this.$data.$codeText).labels;
        }        
    },

    

});

//////////////////////////
//      JUND YARD       //
/////////////////////////
        //frameLabel: this.getFrameLabelWithType(this.$props.type)
        // frameLabel : (this.codeText) => (store.getters.getLabelsByName((typeof this.codeText === 'string')?this.codeText:"");)
        // frameLabel : store.getters.getLabelsByName(this.codeText)
        // frameLabel : store.getters.getLabelsByName(this.codeText)
        // frameLabel : this.$store.getters.getLabelsByName(this.codeText)
        // var code:this.codeText,
        //  code:string = this.codeText;
        // frameLabel : this.$store.state.frames.find(o => o.name === this.codeText)
        //    return store.getters.getLabelsByName(this.$codeText)

</script>
