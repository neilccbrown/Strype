// Whether the given text exactly names a file shown in the File system tab -- either its bare
// filename or its full path -- used by LabelSlot.vue's onCodePasteImpl() to decide whether a
// plain-text paste should become a string literal instead of being parsed as code (e.g. pasting
// "photo.png", copied from the Files tab, into a code slot should paste as the string "photo.png"
// rather than being parsed as an identifier).
//
// Only checks the two sources available synchronously -- paste handling can't await anything:
// "/local" (localFsCache.ts's in-memory mirror of the scratch area) and the read-only bundled
// asset roots ("/data", "/books", etc, from the build-time glob in assets_file_index.ts). "/cloud"
// isn't checked: listing it needs a live network round trip to the connected drive.
import * as localFsCache from "@/helpers/localFsCache";
import { assetsFileIndex } from "@/stryperuntime/assets_file_index";

function baseName(path: string): string {
    return path.slice(path.lastIndexOf("/") + 1);
}

export function isKnownFileNameOrPath(text: string): boolean {
    if (!text) {
        return false;
    }
    for (const path of Object.keys(localFsCache.listEntries())) {
        if (path === text || baseName(path) === text) {
            return true;
        }
    }
    for (const assetPath of Object.keys(assetsFileIndex)) {
        const relativePath = "/" + assetPath.replace(/^\/src\/assetsFilesystem\//, "");
        if (relativePath === text || baseName(relativePath) === text) {
            return true;
        }
    }
    return false;
}
