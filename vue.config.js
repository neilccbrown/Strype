/* eslint @typescript-eslint/no-var-requires: "off" */
const MoveAssetsPlugin = require("move-assets-webpack-plugin")

const conditionalCompiler = {
    loader: "js-conditional-compile-loader",
    options: {
        isDebug: process.env.NODE_ENV === "development", // optional, this expression is default
        envTest: process.env.ENV_CONFIG === "test", // any prop name you want, used for /* IFTRUE_evnTest ...js code... FITRUE_evnTest */
        myFlag: process.env.npm_config_python, // enabled by `npm run build --python`
        //myFlag: process.env.npm_config_myflag, // enabled by `npm run build --myflag`
    },
}

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
            

            // new webpack.LoaderOptionsPlugin({
            //     // test: /\.xxx$/, // may apply this only for some modules
            //     options: {
            //         chainWebpack: (config) => {
            //             // conditionalCompiler Loader
            //             config.module
            //                 .rule("conditionalCompiler")
            //                 .test(/\.vue$/)
            //                 .use("conditionalCompiler")
            //                 .loader("conditionalCompiler")
            //                 .end();
            //         },
            //     },
            // }),

            // new conditionalCompiler({
            //     rules: [
            //         {
            //             test: /\.vue$/,
            //             use: ["vue-loader", conditionalCompiler],
            //         },
            //         {
            //             test: /\.js$/,
            //             // include: [resolve("src"), resolve("test")],
            //             use: [
            //                 //step-2
            //                 "babel-loader?cacheDirectory",
            //                 //step-1
            //                 conditionalCompiler,
            //             ],
            //         },
            //     ],
            // }),
        ],

        // Create named rules which can be modified later

        // chainWebpack: (config) => {
        //     // Pug Loader
        //     config.module
        //         .rule("conditionalCompiler")
        //         .test(/\.vue$/)
        //         .use("conditionalCompiler")
        //         .loader("conditionalCompiler")
        //         .end();
        // },
    },

    chainWebpack: (config) => {
        config.module
            .rule("conditionalCompilerVue")
            .test(/\.vue$/)
            // .pre()
            // .include
            // .add("src")
        // Even create named uses (loaders)
            .use("vue-loader")
            .loader("conditionalCompiler");
        // config.module
        //     .rule("conditionalCompilerTS")
        //     .test(/\.ts$/)
        //     .use("conditionalCompiler")
        //     .loader("conditionalCompiler")
        // config.module
        //     .rule("conditionalCompilerJS")
        //     .test(/\.js$/)
        //     .use("conditionalCompiler")
        //     .loader("conditionalCompiler")
        // .end()
            
    },

    // chainWebpack: (config) => {
    //     config.module
    //         .rule("cond")
    //         .test(/\.vue$/)
    //         .use("vue-loader", conditionalCompiler)
    // },

    publicPath: "/",
    pluginOptions: {
        i18n: {
            locale: "en",
            fallbackLocale: "en",
            localeDir: "localisation",
            enableInSFC: false,
        },
    },

    // module: {
    //     rules: [
    //         {
    //             test: /\.vue$/,
    //             use: ["vue-loader", conditionalCompiler],
    //         },
    //         {
    //             test: /\.js$/,
    //             // include: [resolve("src"), resolve("test")],
    //             use: [
    //             //step-2
    //                 "babel-loader?cacheDirectory",
    //                 //step-1
    //                 conditionalCompiler,
    //             ],
    //         },

    //     ],
    // },
}
