<template>
  <div>
    <FrameHeader v-if="frameLabel !== null" v-bind:parent="id" v-bind:labels="frameLabel"/>

  </div>
</template>

<script lang="ts">

//////////////////////
//      Imports     //
//////////////////////
import Vue from 'vue';
import { BootstrapVue, IconsPlugin } from 'bootstrap-vue';
import FrameHeader from './FrameHeader.vue';
import store from '.././store/store';



//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: 'Frame',
    store,
    components:
    {
        FrameHeader
    },

    props:
    {
        id: Number, // Unique Indentifier for each Frame
        type: String, //Type of the Frame
        parent: Number // ID of the parent

        // NOTE that type declarations here start with a Capital Letter!!! (different to types.ts!)
    },

    data: function () 
    {
        return{
            // `False` if a single line frame and `True` if a block
            compound : false,

            // The body can be one of the following two:
            // 1) An editable slot, if our `Frame` is a single-line statement (eg. method call, variable assignment)
            // 2) A `Frame` in order to hold more frames in it 
            body : null
           
        }
    },

    computed:
    {
        // Frame label holds the initialisation object for the frame
        frameLabel : function() 
        {
            return store.state.framesDefinitions.find(o => o.name === this.type).labels;
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


        ////////////////////////////
        //   Type Declarations    //
        ////////////////////////////
        // declare module 'vue/types/vue' {
        //   // 3. Declare augmentation for Vue
        //   interface Vue {
        //     $codeText: string;
        //   }
        // }

        // $codeText : this.$props.type,

        // return store.state.framesDefinitions.find(o => o.name === this.$data.$codeText).labels;

        // const typ = this.$props.type as string;

</script>
