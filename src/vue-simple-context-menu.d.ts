declare module "vue-simple-context-menu" {
    import { VueConstructor } from "vue";
    
    export interface VueSimpleContextMenuConstructor extends VueConstructor {
      props: any;
      data: () => any;
      watch: any;
      methods: any;
      showMenu: any;
    }
    
    export const vueSimpleContextMenu: VueSimpleContextMenuConstructor;
    export default vueSimpleContextMenu;
    
}