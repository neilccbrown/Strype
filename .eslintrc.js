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
        "brace-style": ["error", "stroustrup"],
        "arrow-parens": ["error", "always"],
        "function-call-argument-newline": ["error", "consistent"],
        "function-paren-newline": ["error", "consistent"],
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

        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-explicit-any": "off",
        // Don't mind if function arguments are unused:
        "@typescript-eslint/no-unused-vars": ["error", {args: "none"}],
    },

    overrides: [
        {
            files: [
                "**/__tests__/*.{j,t}s?(x)",
                "**/tests/unit/**/*.spec.{j,t}s?(x)",
            ],
            env: {
                mocha: true,
            },
        },
    ],
};
