import { defineConfig, loadEnv } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { execSync } from "child_process";
import vue2 from  "@vitejs/plugin-vue2";
import path from "path";
import { fileURLToPath } from "url";
import ConditionalCompile from "vite-plugin-conditional-compiler";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";
import { zipDir } from "./scripts/zip-dir.js";

function zipPysrcPlugin() {
    const run = () =>
        zipDir({
            rootDir: "pysrc",
            subdirs: ["strype", "python_runner"],
            outFile: path.resolve("public/pysrc.zip")
        })

    return {
        name: "zip-pysrc",

        async buildStart() {
            await run();
        },

        // Rerun when pysrc changes:
        async configureServer(server) {
            await run();

            server.watcher.add("pysrc/**");

            server.watcher.on("change", async () => {
                await run()
            });
        }
    }
}

// Taken from https://pyodide.org/en/0.29.0/usage/working-with-bundlers.html with a tweak to make paths work on Windows:
const PYODIDE_EXCLUDE = [
    "!**/*.{md,html}",
    "!**/*.d.ts",
    "!**/*.whl",
    "!**/node_modules",
];
export function viteStaticCopyPyodide() {
    const pyodideDir = path.dirname(fileURLToPath(import.meta.resolve("pyodide")));
    return viteStaticCopy({
        targets: [
            {
                // Important to use posix.join to get forward slashes instead of backslashes:
                src: [path.join(pyodideDir, "*").replaceAll("\\", "/")].concat(PYODIDE_EXCLUDE),
                dest: "assets",
            },
        ],
    });
}

function removeFilesPlugin(isStandardPython) {
    // The  library files we ship in the website depending on the platform we're on (standard Python or micro;bit).
    // This small plugin does just that.
    return {
        name: "remove-files-plugin",
        closeBundle() {
            const pathsToRemove = (isStandardPython)
                ? [
                    "./dist/demos/microbit",
                    "./dist/public_libraries/microbit",
                ]
                : [
                    "./dist/demos/console",
                    "./dist/demos/graphics",
                    "./dist/demos/turtle",
                    "./dist/graphics_images",
                    "./dist/sounds",
                    "./dist/public_libraries/strype",
                    "./dist/pyi",
                ];

            for (const p of pathsToRemove) {
                fs.rmSync(p,{recursive: true, force: true});
            }
        },
    };
}

export default defineConfig(({mode}) => {
    // Mode for the Strype "platform" (standard Python or for micro:bit)
    // We use environment variables for the possible values (only exception is in the serve/build scripts...)
    const viteEnv = loadEnv(mode, process.cwd(), "VITE_");
    const isStandardPython = mode === viteEnv.VITE_STANDARD_PYTHON_MODE;
    
    return {       
        plugins: [
            ConditionalCompile(),            
            vue2(),
            removeFilesPlugin(isStandardPython),
            VitePWA({
                registerType: "autoUpdate",
                strategies: "injectManifest",
                srcDir: "src/workers",
                filename: "service-worker.ts",
                injectManifest: {
                    globPatterns: [], // don't precache any files because we're not actually using precaching
                },
                injectRegister: "false", // we register in main.ts so that it registers in dev mode
            }),
            viteStaticCopyPyodide(),
            zipPysrcPlugin(),
        ],

        css: {
            preprocessorOptions: {
                scss: {
                    additionalData: `
                        @import "@/assets/style/variables.scss";
                    ` + (process.env.VITE_GITHUB_PAGE ?  `
                        @import "@/assets/style/test-watermark.scss";
                    ` : ""),
                },
            },
        },

        base: (process.env.VITE_GITHUB_PAGE)
            ? "/Strype/"
            : ((isStandardPython)
                ? "/editor/"
                : "/microbit/"),

        // Global Vite define variables used in the application
        define: {
            __BUILD_DATE_TICKS__: Date.now(),
            __BUILD_GIT_HASH__: JSON.stringify(
                execSync("git rev-parse --short=8 HEAD").toString().trim()
            ),
        },

        resolve: {
            // So that we still have compilation of imports like: import { STRYPE_LOCATION } from "@/helpers/pythonToFrames"
            alias: {
                "@": path.resolve(__dirname, "src"),
            },
        },

        optimizeDeps: { exclude: ["pyodide"] },

        worker: { format: 'es' },
    };
});
