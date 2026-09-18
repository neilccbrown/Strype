// Main-thread mirror of the Pyodide worker's "/local" scratch filesystem. The worker itself is
// fully discarded and recreated on every Run (see terminateAndRestartPyodide(),
// main_thread_python_handler.ts), so nothing on the worker side can persist across runs -- this
// cache, living in the main thread's own JS heap, is what actually survives instead. It is
// resynced with the worker only at run boundaries: main_thread_python_handler.ts snapshots the
// outgoing worker's "/local" into here just before terminating it, and restores this cache's
// contents into the incoming worker's fresh "/local" right after it's created. There is
// deliberately no live sync while a run is in progress (see the File system tab plan) -- so this
// cache is also the single source of truth for what the File system tab shows under "/local",
// whether or not a worker currently exists.
//
// This is plain in-memory state, not IndexedDB or any other persistent store -- it does NOT
// survive a page reload. Making "/local" survive a reload is explicitly out of scope for now.
import { FsTreeNode } from "@/stryperuntime/file_system_tree_types";

const files = new Map<string, Uint8Array>();

export function mergeSnapshot(entries: Record<string, Uint8Array>): void {
    for (const [path, data] of Object.entries(entries)) {
        files.set(path, data);
    }
}

export function listEntries(): Record<string, Uint8Array> {
    return Object.fromEntries(files.entries());
}

export function writeFile(path: string, data: Uint8Array): void {
    files.set(path, data);
}

export function readFile(path: string): Uint8Array | undefined {
    return files.get(path);
}

export function deleteFile(path: string): void {
    files.delete(path);
}

// Builds the same FsTreeNode shape the worker's listFsTree() produces for "/data", but from this
// cache's flat path list instead of a live Pyodide FS -- see fileSystemTabIO.ts's listFsRootTree().
export function listTree(): FsTreeNode {
    const root: FsTreeNode = {name: "local", path: "/local", isDir: true, children: []};
    const dirNodes = new Map<string, FsTreeNode>([["/local", root]]);

    function ensureDir(path: string, name: string): FsTreeNode {
        const existing = dirNodes.get(path);
        if (existing) {
            return existing;
        }
        const parentPath = path.slice(0, path.lastIndexOf("/")) || "/local";
        const parent = ensureDir(parentPath, parentPath.slice(parentPath.lastIndexOf("/") + 1));
        const node: FsTreeNode = {name, path, isDir: true, children: []};
        parent.children?.push(node);
        dirNodes.set(path, node);
        return node;
    }

    for (const path of [...files.keys()].sort()) {
        const dirPath = path.slice(0, path.lastIndexOf("/")) || "/local";
        const dir = ensureDir(dirPath, dirPath.slice(dirPath.lastIndexOf("/") + 1));
        const name = path.slice(path.lastIndexOf("/") + 1);
        dir.children?.push({name, path, isDir: false, size: files.get(path)?.length});
    }
    return root;
}
