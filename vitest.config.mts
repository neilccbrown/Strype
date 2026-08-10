import { defineConfig } from "vitest/config";
import path from "path";

// Deliberately minimal and separate from vite.config.mjs (which needs a live git checkout, the
// full Pyodide package, and other build-time-only setup) -- these unit tests only exercise plain
// TS parsing/helper modules, not the Vue app, so they don't need any of that.
export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
    test: {
        include: ["tests/unit/**/*.test.ts"],
    },
});
