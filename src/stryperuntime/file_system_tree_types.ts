// Types shared between the worker (python-execution.ts, which builds these from the live Pyodide
// FS) and the main thread (FileSystemPane.vue/FileSystemTree.vue, which render them). Kept as plain
// data only, per the Comlink "plain data across threads" constraint described at the top of
// python-execution.ts.
export interface FsTreeNode {
    name: string,
    path: string,
    isDir: boolean,
    // Only meaningful for files; omitted for directories.
    size?: number,
    // Only populated for directories.
    children?: FsTreeNode[],
}
