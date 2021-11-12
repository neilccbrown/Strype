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

    chainWebpack: (config) => {
        config.module
            .rule("conditionalCompilerVue")
            .test(/\.vue$/)
            .use("vue-loader")
            .loader("js-conditional-compile-loader")
            .options( {
                //isDebug: process.env.NODE_ENV === "development", // optional, this expression is default  /* IFDEBUG  CODE  FIDEBUG */
                isDebug: process.env.VUE_APP_PYTHON_OR_MICROBIT === "python",
                // envTest: process.env.ENV_CONFIG === "test", // any prop name you want, used for /* IFTRUE_evnTest ...js code... FITRUE_evnTest */
                // python: process.env.npm_config_python, // enabled by `npm run build --python`
                //myFlag: process.env.npm_config_myflag, // enabled by `npm run build --myflag` /* IFTRUE_myFlag */ CODE /*FITRUE_myFlag */
            });
    },

    publicPath: "/",
    pluginOptions: {
        i18n: {
            locale: "en",
            fallbackLocale: "en",
            localeDir: "localisation",
            enableInSFC: false,
        },
    },
}
