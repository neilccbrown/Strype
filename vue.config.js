/* eslint @typescript-eslint/no-var-requires: "off" */
const MoveAssetsPlugin = require("move-assets-webpack-plugin");
const RemoveFilePlugin = require("remove-files-webpack-plugin");

// Application environment variable for the built date/hash.
// The idea is to have a date value and hash at build time, so
// we don't need to manually set a release date or copy the hash.
process.env.VUE_APP_BUILD_DATE_TICKS = Date.now();
process.env.VUE_APP_BUILD_GIT_HASH = require("child_process").execSync("git rev-parse --short=8 HEAD").toString().trim();

const configureWebpackExtraProps = 
    {
        plugins: [(process.env.npm_config_microbit) ?
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
            }) 
            :new RemoveFilePlugin({
                after: {
                    // Do not include at all the folder containing the microbit python files
                    include: ["./dist/pythonLib"],
                    trash: true,
                },
            }) ,
        ],
    };

module.exports = {
    configureWebpack: {
        devtool: "source-map",
        ...configureWebpackExtraProps,
        // allows pinia to compile fine (https://github.com/vuejs/pinia/issues/675)
        module: {
            rules: [
                {
                    test: /\.mjs$/,
                    include: /node_modules/,
                    type: "javascript/auto",
                },
            ],
        },
    },

    chainWebpack: (config) => {
        config.module
            .rule("conditionalCompilerVue")
            .test(/\.vue$/)
            .use("vue-loader")
            .loader("js-conditional-compile-loader")
            .options( {
                // the following are from the library js-conditional-compile-loader https://github.com/hzsrc/js-conditional-compile-loader
                isPurePython: process.env.npm_config_python,
                isMicrobit: process.env.npm_config_microbit,
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
                options.patterns[0].globOptions.ignore.push("pythonLib/**");
            }
            return [options];
        });
        // From https://stackoverflow.com/questions/61031121/vue-js-with-mocha-and-styles-resources-loader-cant-load-dependency-sass
        if (process.env.NODE_ENV === "test") {
            const scssRule = config.module.rule("scss");
            scssRule.uses.clear();
            scssRule.use("null-loader").loader("null-loader");
        }
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

    css: {
        loaderOptions: {
            scss: {
                additionalData: `
                    @import "@/assets/style/variables.scss";
                `,
            },
        },
    },
};
