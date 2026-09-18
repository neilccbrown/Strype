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
    // Only set for nodes read from the cloud drive (see fileSystemTabIO.ts's listCloudTree()) --
    // the id used to address this file/folder via CloudDriveHandlerComponentAPI/cloudFileIO.ts,
    // since cloud files aren't addressed by a real filesystem path the way /data and /local are.
    // "path" is still populated for cloud nodes too (a virtual "/cloud/..." path, matching what a
    // real Python run's mounted /cloud would resolve it to), for display and as a stable v-for key.
    cloudFileId?: string,
}
