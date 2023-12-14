declare module "vue-context" {
    import { VueConstructor } from "vue";
    
    export interface VueContextConstructor extends VueConstructor {
      props: any;
      data: () => any;
      watch: any;
      methods: any;
      open: any;
      close: any;
    }
    
    export const vueContext: VueContextConstructor;
    export default vueContext;
    
}