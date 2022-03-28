import Vue from "vue";
import App from "@/App.vue";
import store from "@/store/store";
import i18n from "@/i18n"
import { BootstrapVue } from "bootstrap-vue";
import "bootstrap/dist/css/bootstrap.css";
import "bootstrap-vue/dist/bootstrap-vue.css";
import "vue-simple-context-menu/dist/vue-simple-context-menu.css";
import vBlur from "v-blur";
import VueConfirmDialog from "vue-confirm-dialog";
import { StrypePlatform } from "./types/types";

Vue.config.productionTip = false;

// Version of the application to check code's import compatibility in the editor
// note: that is not an offical software version of Strype, just a way to help us dealing with compatibility issues.
// it MUST be kept as an integer matching value
export const AppVersion = "2";
let appPlatform = StrypePlatform.standard;
/* IFTRUE_isMicrobit */
appPlatform = StrypePlatform.microbit;
/* FITRUE_isMicrobit */
export const AppPlatform = appPlatform;

// Install BootstrapVue
Vue.use(BootstrapVue);

// Use v-blur
Vue.use(vBlur);

// Use vue-confirm-dialog
Vue.use(VueConfirmDialog);

Vue.config.productionTip = false;

new Vue({
    store,
    i18n,
    render: (h) => h(App),
}).$mount("#app");

