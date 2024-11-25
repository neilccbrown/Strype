import Vue from "vue";
import VueI18n, { LocaleMessages } from "vue-i18n";

Vue.use(VueI18n);

function loadLocaleMessages (): LocaleMessages {
    // Strype locale files are store in locale folders (2 letter coded name, e.g. "en")
    // that are living in ./localisation. A locale folder may contain more than 1 file
    // as we split the json files for easier work on the translations.
    const locales = require.context(
        "./localisation",
        true,
        /[A-Za-z]{2}_.*\.json$/i
    );
    const messages: LocaleMessages = {};
    // We restrict the regex here against the file naming we mentioned above.
    // Since our locale files are split, we need to "combine" the json KPV in one, 
    // which can be achieved by appending the found KVP for a same locale
    // (see https://stackoverflow.com/questions/60628853/how-to-use-multiple-files-per-language-with-vue-i18n-in-vue)        
    locales.keys().forEach((key) => {
        const matched = key.match(/\.\/[A-Za-z]{2}\/([A-Za-z]{2})_/i);
        if (matched && matched.length > 1) {
            const locale = matched[1];
            messages[locale] = {...messages[locale], ...locales(key)};
        }
    });
    return messages;
}

export default new VueI18n({
    locale: process.env.VUE_APP_I18N_LOCALE || "en",
    fallbackLocale: process.env.VUE_APP_I18N_FALLBACK_LOCALE || "en",
    messages: loadLocaleMessages(),
});
