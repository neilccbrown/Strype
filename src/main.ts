import Vue from "vue";
import App from "@/App.vue";
import store from "@/store/store";
import i18n from "./i18n"
import { BootstrapVue } from "bootstrap-vue";
import "bootstrap/dist/css/bootstrap.css";
import "bootstrap-vue/dist/bootstrap-vue.css";
import VueInputAutoWidth from "vue-input-autowidth"

// Install BootstrapVue
Vue.use(BootstrapVue);

//Install VueInputAutoWidth
Vue.use(VueInputAutoWidth); 

Vue.config.productionTip = false;

new Vue({
    store,
    i18n,
    render: (h) => h(App),
}).$mount("#app");
