import Vue from "vue";
import App from "@/App.vue";
import {createPinia, PiniaVuePlugin} from "pinia";
import i18n from "@/i18n";
import { BootstrapVue } from "bootstrap-vue";
import "bootstrap/dist/css/bootstrap.css";
import "bootstrap-vue/dist/bootstrap-vue.css";
import vBlur from "v-blur";
import AsyncComputed from "vue-async-computed";
import scssVars  from "@/assets/style/_export.module.scss";
import { WINDOW_STRYPE_HTMLIDS_PROPNAME, WINDOW_STRYPE_SCSSVARS_PROPNAME } from "./helpers/sharedIdCssWithTests";
import {getAppLangSelectId, getEditorID, getEditorMenuUID, getFrameBodyUID, getFrameContainerUID, getFrameHeaderUID, getFrameLabelSlotsStructureUID, getFrameUID, getImportFileInputId, getLabelSlotUID, getLoadFromFSStrypeButtonId, getLoadProjectLinkId, getNewProjectLinkId, getSaveProjectLinkId, getSaveStrypeProjectToFSButtonId, getStrypeSaveProjectNameInputId, getShareProjectLinkId} from "./helpers/editor";
import { setVM } from "./helpers/appContext";
// #v-ifdef MODE == VITE_STANDARD_PYTHON_MODE
/* IFTRUE_isPython */
import {getPEATabContentContainerDivId} from "./helpers/editor";
// #v-endif

// #v-ifdef MODE == VITE_STANDARD_PYTHON_MODE
// We have to register the service worker ourselves so that it works in dev.
// (If we used the Vite PWA auto-register it would only work in production.)
if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
        // Note: service-worker.js is our desired name, the dev-sw.js is the one PWA always uses in dev mode.
        const swUrl = import.meta.env.BASE_URL + "compiled-service-worker.js";
        try {
            const registration = await navigator.serviceWorker.register(swUrl, {type: "module", scope: import.meta.env.BASE_URL});
            console.log("SW registered:", registration);
        }
        catch (err) {
            console.error(`SW registration failed for ${swUrl} because:`, err);
        }
    });
}
else {
    console.error("No service worker support");
}
// #v-endif


// Set the SCSS variables for the tests here
(window as any)[WINDOW_STRYPE_SCSSVARS_PROPNAME] = scssVars;
// Set the HTML Elements shared IDs for the test here
(window as any)[WINDOW_STRYPE_HTMLIDS_PROPNAME] = {
    getEditorID: getEditorID,
    getEditorMenuUID: getEditorMenuUID,
    getFrameContainerUID: getFrameContainerUID,
    getFrameUID: getFrameUID,
    getFrameHeaderUID: getFrameHeaderUID, 
    getFrameBodyUID: getFrameBodyUID,
    getFrameLabelSlotsStructureUID: getFrameLabelSlotsStructureUID,
    getNewProjectLinkId: getNewProjectLinkId,
    getLoadProjectLinkId: getLoadProjectLinkId,
    getLoadFromFSStrypeButtonId: getLoadFromFSStrypeButtonId,
    getSaveProjectLinkId: getSaveProjectLinkId,
    getShareProjectLinkId: getShareProjectLinkId,
    getImportFileInputId: getImportFileInputId,
    getAppLangSelectId: getAppLangSelectId,
    getFrameLabelSlotId: getLabelSlotUID,
    getStrypeSaveProjectNameInputId: getStrypeSaveProjectNameInputId,
    getSaveStrypeProjectToFSButtonId: getSaveStrypeProjectToFSButtonId,
    // #v-ifdef MODE == VITE_STANDARD_PYTHON_MODE
    getPEATabContentContainerDivId: getPEATabContentContainerDivId,
    // #v-endif
};
Vue.use(AsyncComputed);

// Install BootstrapVue
Vue.use(BootstrapVue);

// Use v-blur
Vue.use(vBlur);

// Use a Pinia store (instead of Vuex store, because it handles type inferrence better)
Vue.use(PiniaVuePlugin);
const pinia = createPinia();

const vm = new Vue({
    pinia,
    i18n,
    render: (h) => h(App),
});
setVM(vm);
vm.$mount("#app");
