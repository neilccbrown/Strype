/* eslint @typescript-eslint/no-var-requires: "off" */
const MoveAssetsPlugin = require("move-assets-webpack-plugin")

module.exports = {
    configureWebpack: {
        devtool: "source-map",
        plugins: [
            new MoveAssetsPlugin({
                clean: true,
                patterns: [
                    {
                        from: "dist/aclib",
                        // files in `to` will be deleted
                        // unless `clean` is set to `false`
                        to: "dist/",
                    },
                ],
            }),
        ],
    },
    publicPath: "/",//"/webframes-test/",
    pluginOptions: {
        i18n: {
            locale: "en",
            fallbackLocale: "en",
            localeDir: "localisation",
            enableInSFC: false,
        },
    },
}
