import {createLazyFetchFS} from "@/stryperuntime/pyodide-emscript-fetch-fs";
import {PyodideAPI} from "pyodide";
import {EmscriptenFileSystemPlugin} from "@/types/emscripten-fs-types";

const fileIndex: Record<string, string> = import.meta.glob(
    "/src/assetsFilesystem/**/*",
    {
        eager: true,
        query: "?url",
        import: "default",
    }
);

// The content shouldn't change after page load so we have the cache as top-level item
// so that we don't refetch the files on each run:
const cache : Map<string, Uint8ClampedArray> = new Map();

export function createLazyFetchAssetsFS(pyodide : PyodideAPI) : EmscriptenFileSystemPlugin {
    return createLazyFetchFS(pyodide, fileIndex, undefined, cache);
}
