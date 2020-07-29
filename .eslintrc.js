module.exports = {
    root: true,
    env: {
        node: true,
    },
    extends: [
        "plugin:vue/essential",
        "eslint:recommended",
        "@vue/typescript/recommended",
    ],
    parserOptions: {
        ecmaVersion: 2020,
    },
    rules: {
        quotes: ["error", "double"],
        curly: "error",
        "brace-style": ["error", "1tbs"],
        "arrow-parens": ["error", "always"],
        "function-call-argument-newline": ["error", "always"],
        "function-paren-newline": ["error", "multiline"],
        indent: ["error", 4, { FunctionDeclaration: { parameters: "first" } }],
        "comma-dangle": [
            "error",
            {
                arrays: "always-multiline",
                objects: "always-multiline",
                imports: "always-multiline",
                exports: "always-multiline",
                functions: "never",
            },
        ],
        "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
        "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    },
};
