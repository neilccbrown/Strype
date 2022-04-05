/* eslint @typescript-eslint/no-var-requires: "off" */
const MoveAssetsPlugin = require("move-assets-webpack-plugin")

const configureWebpackExtraProps = (process.env.npm_config_microbit)
    ? {
        plugins: [
            new MoveAssetsPlugin({
                clean: true,
                patterns: [
                    {
                        from: "dist/pythonLib",
                        // files in `to` will be deleted
                        // unless `clean` is set to `false`
                        to: "dist/",
                    },
                ],
            }),
        ],
    }
    : {};

module.exports = {
    configureWebpack: {
        devtool: "source-map",
        ...configureWebpackExtraProps,
    },

    chainWebpack: (config) => {
        config.module
            .rule("conditionalCompilerVue")
            .test(/\.vue$/)
            .use("vue-loader")
            .loader("js-conditional-compile-loader")
            .options( {
                // the following are from the library js-conditional-compile-loader
                //isDebug: process.env.NODE_ENV === "development", // optional, this expression is default  /* IFDEBUG  CODE  FIDEBUG */
                // isDebug: process.env.VUE_APP_PYTHON_OR_MICROBIT === "python",
                isPurePython: process.env.npm_config_python,//process.env.VUE_APP_PYTHON_OR_MICROBIT === "python",
                isMicrobit: process.env.npm_config_microbit,//process.env.VUE_APP_PYTHON_OR_MICROBIT === "microbit",
                // envTest: process.env.ENV_CONFIG === "test", // any prop name you want, used for /* IFTRUE_evnTest ...js code... FITRUE_evnTest */
            });
        config.module
            .rule("conditionalCompilerTS")
            .test(/\.ts$/)
            .use("vue-loader")
            .loader("js-conditional-compile-loader")
            .options( {
                isPurePython: process.env.npm_config_python,
                isMicrobit: process.env.npm_config_microbit,
            });
        config.plugin("copy").tap(([options]) => {
            if(process.env.npm_config_python) {
                options[0].ignore.push("pythonLib/**");
            }
            return [options];
        });
    },

    publicPath: (process.env.npm_config_python)?"/editor/":"/microbit/",
    pluginOptions: {
        i18n: {
            locale: "en",
            fallbackLocale: "en",
            localeDir: "localisation",
            enableInSFC: false,
        },
    },
}
