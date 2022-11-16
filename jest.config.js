module.exports = {
    preset: "@vue/cli-plugin-unit-jest/presets/typescript-and-babel",
    verbose: true,
    moduleFileExtensions: ["js", "jsx", "json", "vue", "ts"],
    transform: {
        "^.+\\.ts?$": "ts-jest",
        ".+\\.(css|styl|less|sass|scss|png|jpg|ttf|woff|woff2)$": "jest-transform-stub"
    },
    moduleNameMapper: {
        "^.+.(css|styl|less|sass|scss|png|jpg|ttf|woff|woff2)$": "jest-transform-stub"
    },
    transformIgnorePatterns: [
        "node_modules/(?!tigerpython-parser)"
    ],
}
