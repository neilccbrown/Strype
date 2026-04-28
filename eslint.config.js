// eslint.config.js
import vue from "eslint-plugin-vue";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import vueParser from "vue-eslint-parser";

import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
    {
        ignores: [
            "dist/**",
            "build/**",
            "coverage/**",
            "node_modules/**",
            "**/*.min.js",
            "assets/**",
            "public/**/*.js",
            "temp-scripts/**",
            "scripts/compiled/**",
            "docs-sphinx/**",
        ],
    },
    {
        files: ["**/*.{js,ts,vue}"],

        languageOptions: {
            parser: vueParser,
            parserOptions: {
                parser: tsParser,
                ecmaVersion: 2020,
                sourceType: "module",
            },
        },

        plugins: {
            vue,
            "@typescript-eslint": ts,
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
                "error", {
                    arrays: "always-multiline",
                    objects: "always-multiline",
                    imports: "always-multiline",
                    exports: "always-multiline",
                    functions: "never",
                },
            ],
            "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
            "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",

            semi: ["error", "always"],

            "@typescript-eslint/array-type": ["error", { default: "array" }],
            "@typescript-eslint/ban-ts-comment": "error",
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
            "@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
            "@typescript-eslint/triple-slash-reference": "error",
        },
    },

    // No exports from workers:
    {
        files: ["src/workers/python-execution.ts", "src/workers/service-worker.ts"],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    selector: "ExportNamedDeclaration",
                    message: "Do not export from worker files.",
                },
                {
                    selector: "ExportDefaultDeclaration",
                    message: "Do not export from worker files.",
                },
                {
                    selector: "ExportAllDeclaration",
                    message: "Do not export from worker files.",
                },
            ],
        },
    },
    
    // No missing await in Playwright tests:
    {
        files: ["**/*.spec.ts"],
        languageOptions: {
            parser: vueParser,
            parserOptions: {
                parser: tsParser,
                project: "./tsconfig.json",
                tsconfigRootDir: __dirname,
                ecmaVersion: 2020,
                sourceType: "module",
            },
        },
        rules: {
            "@typescript-eslint/no-floating-promises": "error",
        },
    },
];
