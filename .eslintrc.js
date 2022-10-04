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

        "@typescript-eslint/array-type": ["error", {default: "array"}],
        "@typescript-eslint/ban-ts-comment": "error",
        "@typescript-eslint/ban-types": "error",
        "@typescript-eslint/default-param-last": "error",
        "@typescript-eslint/explicit-module-boundary-types": "error",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-invalid-void-type": "error",
        "@typescript-eslint/no-namespace": "error",
        "@typescript-eslint/no-non-null-asserted-nullish-coalescing": "error",
        "@typescript-eslint/no-non-null-asserted-optional-chain": "error",
        "@typescript-eslint/no-non-null-assertion": "error",
        "@typescript-eslint/no-this-alias": "error",
        // Don't mind if function arguments are unused:
        "@typescript-eslint/no-unused-vars": ["error", {args: "none"}],
        "@typescript-eslint/triple-slash-reference": "error",
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
