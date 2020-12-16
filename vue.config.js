module.exports = {
    configureWebpack: {
        devtool: "source-map",
    },
    publicPath: "/webframes-test/",
    pluginOptions: {
        i18n: {
            locale: "en",
            fallbackLocale: "en",
            localeDir: "localisation",
            enableInSFC: false,
        },
    },
}
