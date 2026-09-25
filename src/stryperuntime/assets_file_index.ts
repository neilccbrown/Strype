// The glob of bundled asset files (see pyodide-emscripten-assets-fs.ts, which mounts these into
// Pyodide's FS) and the top-level directory names it contains ("data", "books", "images", etc,
// one per Pyodide mount point "/data", "/books", "/images", ...). Kept in its own module, with no
// worker-only imports, so the File system tab (main thread, see fileSystemTabIO.ts) can read
// assetsFilePrefixes/buildAssetTree to list the available read-only roots without pulling in
// worker code or a worker round trip (see buildAssetTree's own comment for why that round trip
// matters).
import { FsTreeNode } from "@/stryperuntime/file_system_tree_types";

export const assetsFileIndex: Record<string, string> = import.meta.glob(
    "/src/assetsFilesystem/**/*",
    {
        eager: true,
        query: "?url",
        import: "default",
    }
);

export const assetsFilePrefixes = Array.from(new Set(Object.keys(assetsFileIndex).map((path) => {
    const parts = path.replace(/^\/src\/assetsFilesystem\//, "").replace(/^\/+/, "").split("/");
    return parts[0];
})));

// Builds the FsTreeNode shape for one asset root (e.g. "data") directly from assetsFileIndex's
// keys -- entirely on the main thread, no worker/Pyodide involved. This deliberately does NOT go
// via the worker's listFsTree() (unlike this file's own earlier version): the File system tab used
// to ask the worker to mount and list "/data" on open, and generalising that to every asset root
// (now several: /data, /books, /images, /sounds) meant several sequential Comlink round trips to
// the single Python worker thread every time the tab opened, which was observed to measurably
// delay that worker becoming ready for an actual Run right afterwards (particularly under Firefox,
// where these round trips are already known to be slow -- see openFilesTab()'s comment in
// file-system-tab.spec.ts). Building the tree from this static, build-time glob avoids the worker
// entirely for listing; readFsFile (python-execution.ts) still mounts the relevant root itself,
// lazily, the first time a file under it is actually downloaded or read.
export function buildAssetTree(prefix: string): FsTreeNode {
    const rootPath = "/" + prefix;
    const root: FsTreeNode = {name: prefix, path: rootPath, isDir: true, children: []};
    const dirNodes = new Map<string, FsTreeNode>([[rootPath, root]]);

    function ensureDir(path: string, name: string): FsTreeNode {
        const existing = dirNodes.get(path);
        if (existing) {
            return existing;
        }
        const parentPath = path.slice(0, path.lastIndexOf("/")) || rootPath;
        const parent = ensureDir(parentPath, parentPath.slice(parentPath.lastIndexOf("/") + 1));
        const node: FsTreeNode = {name, path, isDir: true, children: []};
        parent.children?.push(node);
        dirNodes.set(path, node);
        return node;
    }

    const relativePaths = Object.keys(assetsFileIndex)
        .map((path) => path.replace(/^\/src\/assetsFilesystem\//, ""))
        .filter((path) => path === prefix || path.startsWith(prefix + "/"))
        .sort();

    for (const relativePath of relativePaths) {
        const path = "/" + relativePath;
        const dirPath = path.slice(0, path.lastIndexOf("/")) || rootPath;
        const dir = ensureDir(dirPath, dirPath.slice(dirPath.lastIndexOf("/") + 1));
        const name = path.slice(path.lastIndexOf("/") + 1);
        dir.children?.push({name, path, isDir: false});
    }
    return root;
}
