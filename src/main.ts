import Vue from "vue";
import App from "@/App.vue";
import store from "@/store/store";
import i18n from "@/i18n"
import { BootstrapVue } from "bootstrap-vue";
import "bootstrap/dist/css/bootstrap.css";
import "bootstrap-vue/dist/bootstrap-vue.css";
import "vue-simple-context-menu/dist/vue-simple-context-menu.css";


Vue.config.productionTip = false;

 
//version of the application to check code's import compatibilty in the editor
export const AppVersion = "0.5";

// Install BootstrapVue
Vue.use(BootstrapVue);

new Vue({
    store,
    i18n,
    render: (h) => h(App),
}).$mount("#app");
