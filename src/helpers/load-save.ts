import { deflateRaw, inflateRaw } from "pako";
import { Base64 } from "js-base64";
import { parseCodeAndGetParseElements } from "@/parser/parser";
import { useStore } from "@/store/store";
import {StrypeLayoutDividerSettings, StrypePEALayoutMode} from "@/types/types";
import { AppName, AppPlatform, AppSPYFullPrefix, AppSPYSaveVersion } from "./appContext";
import * as localFsCache from "@/helpers/localFsCache";

export function saveDivider(divider: StrypeLayoutDividerSettings | undefined) : string | undefined {
    if (divider === undefined) {
        return undefined;
    }
    const obj: Record<string, number> = {};
    Object.entries(divider).forEach(([key, value]) => {
        if (value !== undefined) {
            obj[key] = Math.round(value * 100) / 100; // round to 2 decimals
        }
    });
    return JSON.stringify(obj);    
}

export function loadDivider(json: string | undefined): StrypeLayoutDividerSettings | undefined {
    if (json === undefined) {
        return undefined;
    }
    const obj = JSON.parse(json) as Record<string, number>;
    const map = {} as StrypeLayoutDividerSettings;
    Object.entries(obj).forEach(([key, value]) => {
        const enumKey = StrypePEALayoutMode[key as keyof typeof StrypePEALayoutMode];
        if (value !== undefined) {
            map[enumKey] = value;
        }
    });
    return map;
}

// Serialises every currently-pinned "/local" file (see localFsCache.ts's listPinnedEntries()) into
// one header value: a JSON object mapping each file's path relative to "/local" (e.g. "sub/a.txt",
// not "/local/sub/a.txt" -- shorter, and portable if "/local" itself were ever renamed) to the
// base64 of its deflated bytes, following the same compress-then-base64 approach already used for
// the "share link" feature (see Menu.vue's shareContentZippedBase64). Returns undefined (so the
// header is omitted entirely) when nothing is pinned.
export function savePinnedLocalFiles(): string | undefined {
    const entries = localFsCache.listPinnedEntries();
    const relativePaths = Object.keys(entries);
    if (relativePaths.length === 0) {
        return undefined;
    }
    const encoded: Record<string, string> = {};
    for (const path of relativePaths) {
        const relativePath = path.replace(/^\/local\//, "");
        encoded[relativePath] = Base64.fromUint8Array(deflateRaw(entries[path]));
    }
    return JSON.stringify(encoded);
}

// The other side of savePinnedLocalFiles() above -- restores each pinned file straight into
// localFsCache.ts (marked pinned again, so re-saving the project keeps them) so they show up in
// the File system tab's "Local files" section next time it's opened, exactly like any other
// "/local" file. Called from App.vue's setStateFromPythonFile() alongside the divider restoration.
export function loadPinnedLocalFiles(json: string | undefined): void {
    if (json === undefined) {
        return;
    }
    const encoded = JSON.parse(json) as Record<string, string>;
    for (const [relativePath, base64Data] of Object.entries(encoded)) {
        const bytes = inflateRaw(Base64.toUint8Array(base64Data)) as Uint8Array;
        const path = `/local/${relativePath}`;
        localFsCache.writeFile(path, bytes);
        localFsCache.setPinned(path, true);
    }
}

export function generateSPYFileContent(): string {
    let saveContent = parseCodeAndGetParseElements(false, "spy").parsedOutput;
    // We add the initial headers:
    const headers = new Map<string, string | undefined>();
    headers.set(AppName, AppSPYSaveVersion + ":" + AppPlatform);
    headers.set("editorCommandsSplitterPane2Size", saveDivider(useStore().editorCommandsSplitterPane2Size));
    // #v-ifdef STRYPE_PLATFORM == VITE_STANDARD_PYTHON_MODE
    const peaLayoutMode = useStore().peaLayoutMode;
    headers.set("peaLayoutMode", (peaLayoutMode === undefined || peaLayoutMode == StrypePEALayoutMode.tabsCollapsed) ? undefined : StrypePEALayoutMode[peaLayoutMode]);
    headers.set("peaCommandsSplitterPane2Size", saveDivider(useStore().peaCommandsSplitterPane2Size));
    headers.set("peaSplitViewSplitterPane1Size", saveDivider(useStore().peaSplitViewSplitterPane1Size));
    headers.set("peaExpandedSplitterPane2Size", saveDivider(useStore().peaExpandedSplitterPane2Size));
    headers.set("pinnedLocalFiles", savePinnedLocalFiles());
    // #v-endif
    saveContent = Array.from(headers.entries()).filter(([k, v]) => v !== undefined).map((e) => AppSPYFullPrefix + " " + e[0] + ":" + e[1] + "\n").join("") + saveContent;
    return saveContent;
}
