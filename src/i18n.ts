import Vue from "vue"
import VueI18n, { LocaleMessages } from "vue-i18n"

Vue.use(VueI18n)

function loadLocaleMessages (): LocaleMessages {
    // We don't use require.context because it interferes with jest (for unit testing)
    // as per https://stackoverflow.com/questions/38332094/how-can-i-mock-webpacks-require-context-in-jest
    return {
        "el": require("./localisation/el.json"),
        "en": require("./localisation/en.json"),
        "fr": require("./localisation/fr.json"),
        "ja": require("./localisation/ja.json"),
    };
}

export default new VueI18n({
    locale: process.env.VUE_APP_I18N_LOCALE || "en",
    fallbackLocale: process.env.VUE_APP_I18N_FALLBACK_LOCALE || "en",
    messages: loadLocaleMessages(),
})
