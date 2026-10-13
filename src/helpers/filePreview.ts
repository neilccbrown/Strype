// Classification for the File system tab's "view" button (FileSystemTree.vue/FileSystemPane.vue):
// decides how FileViewerDlg.vue should render a file's bytes, or whether it can't be previewed at
// all.

// Files at or above this size aren't even fetched for previewing -- just shown as "unsupported,
// too large" straight away (see FileSystemPane.vue's onView()) -- previewing is a convenience, not
// something worth risking freezing the tab on a multi-hundred-MB file for.
export const MAX_PREVIEWABLE_FILE_SIZE = 10 * 1024 * 1024;

// Extension -> MIME type, for the file types we know how to render directly (via <img>/<audio> on
// an object URL built from the file's bytes -- see FileSystemPane.vue's onView()). Anything not
// listed here falls through to a UTF-8 content-sniff (see decodeAsTextIfValid below) rather than
// being read off a fixed text-extension list: source/data files come in far too many extensions to
// enumerate, whereas a valid UTF-8 decode is a good enough proxy for "this is text".
const IMAGE_MIME_TYPES: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    webp: "image/webp",
    svg: "image/svg+xml",
};

const SOUND_MIME_TYPES: Record<string, string> = {
    wav: "audio/wav",
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
};

function extensionOf(fileName: string): string {
    return fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
}

// "image"/"sound" only for a recognised extension (checked against the two MIME maps above);
// "unknown" for everything else, which the caller should then try a content-sniff on instead.
export function previewKindForExtension(fileName: string): "image" | "sound" | "unknown" {
    const ext = extensionOf(fileName);
    if (ext in IMAGE_MIME_TYPES) {
        return "image";
    }
    if (ext in SOUND_MIME_TYPES) {
        return "sound";
    }
    return "unknown";
}

// Only meaningful for a fileName previewKindForExtension() returned "image" or "sound" for.
export function mimeTypeForExtension(fileName: string): string {
    const ext = extensionOf(fileName);
    return IMAGE_MIME_TYPES[ext] ?? SOUND_MIME_TYPES[ext] ?? "application/octet-stream";
}

// Content-sniffs bytes as text: decodes as strict UTF-8 (fatal: true), returning the decoded
// string if that succeeds, or undefined if the bytes aren't valid UTF-8 (i.e. this is genuinely
// binary content we have no other way to render, like a font, spreadsheet or executable).
export function decodeAsTextIfValid(bytes: Uint8Array): string | undefined {
    try {
        return new TextDecoder("utf-8", {fatal: true}).decode(bytes);
    }
    catch {
        return undefined;
    }
}
