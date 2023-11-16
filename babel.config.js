module.exports = {
    presets: ["@vue/cli-plugin-babel/preset"],
    // From https://github.com/vuejs/vue-cli/issues/6833
    // Needed to handle ?. operator when running tests with mochapack:
    plugins: [
        "@babel/plugin-transform-nullish-coalescing-operator",
        "@babel/plugin-transform-optional-chaining",
    ],
};
