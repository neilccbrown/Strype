// Orchestration for the "File system" tab (see FileSystemPane.vue): listing, downloading and
// uploading files from the internal Pyodide filesystem's "/data" (read-only bundled assets),
// "/local" (writeable scratch area) and "/cloud" (the connected cloud drive, when the project is
// saved to one) roots.
import { saveAs } from "file-saver";
import * as Comlink from "comlink";
import { getPythonClient } from "@/stryperuntime/main_thread_python_handler";
import { FsTreeNode } from "@/stryperuntime/file_system_tree_types";
import { SyncOrAsyncStrypePyodideWorkerRequest } from "@/stryperuntime/worker_bridge_type";
import { encodeUint8ToString } from "@/stryperuntime/worker_bridge_type";
import { isServiceWorkerChannelResponsive, serviceWorkerReadyAndInControl } from "@/workers/shared_helpers";
import { serviceWorkerChannel } from "@/stryperuntime/main_thread_python_handler";
import * as localFsCache from "@/helpers/localFsCache";
import { cloudCloseFile, cloudCreate, cloudListDir, cloudReadFile, cloudWriteFile } from "@/helpers/cloudFileIO";
import { useStore } from "@/store/store";
import { ArchiveEntry } from "@/helpers/archive";

export type FsRoot = "/data" | "/local" | "/cloud";

// Whether the project is currently saved to a cloud drive -- the same condition
// PythonExecutionArea.vue uses to decide whether a run mounts "/cloud" at all
// (startInSlashCloud). Used by FileSystemPane.vue to decide whether to show the "/cloud" section.
export function isCloudMounted(): boolean {
    return typeof useStore().strypeProjectLocation === "string";
}

// isPythonWorkerReady only reflects whether a worker is up and its service worker channel is
// confirmed responsive -- listFsTree just needs a live worker to talk to, so we don't gate on it
// here; getPythonClient() returning null (e.g. "TestingNoPyodide") is the only case we need to
// guard against. "/local" never asks the worker at all -- see localFsCache.ts's own comment for
// why it, not a live worker, is the single source of truth for what's shown here. "/cloud" never
// asks the worker either -- cloudFileIO.ts's functions are plain main-thread async functions, so
// there's no need to go via the worker just to browse it.
export async function listFsRootTree(root: FsRoot): Promise<FsTreeNode | null> {
    if (root === "/local") {
        return localFsCache.listTree();
    }
    if (root === "/cloud") {
        return await listCloudTree();
    }
    const client = getPythonClient();
    if (client == null) {
        return null;
    }
    return await client.workerProxy.listFsTree(root);
}

async function buildCloudTree(cloudFileId: string, virtualPath: string, name: string): Promise<FsTreeNode> {
    const children = await cloudListDir({cloudFileId});
    const childNodes = await Promise.all(children.map(async (child) => {
        const childPath = `${virtualPath}/${child.name}`;
        if (child.isDir) {
            return await buildCloudTree(child.fileId.cloudFileId, childPath, child.name);
        }
        return {name: child.name, path: childPath, isDir: false, size: child.fileSize, cloudFileId: child.fileId.cloudFileId} as FsTreeNode;
    }));
    return {name, path: virtualPath, isDir: true, children: childNodes, cloudFileId};
}

async function listCloudTree(): Promise<FsTreeNode | null> {
    const loc = useStore().strypeProjectLocation;
    if (typeof loc !== "string") {
        return null;
    }
    // Mirrors file_getRoot's handling in main_bridge_handler.ts exactly (the project's own file id
    // is used as the root folder id for cloud file lookups) -- see that file's comment for why.
    return await buildCloudTree(loc, "/cloud", "cloud");
}

export async function downloadFsFile(node: FsTreeNode, root: FsRoot): Promise<void> {
    if (root === "/local") {
        const bytes = localFsCache.readFile(node.path);
        if (bytes != null) {
            saveAs(new Blob([bytes as BlobPart], {type: "application/octet-stream"}), node.name);
        }
        return;
    }
    if (root === "/cloud") {
        if (node.cloudFileId == null || node.size == null) {
            return;
        }
        const bytes = await cloudReadFile({cloudFileId: node.cloudFileId}, 0, node.size, node.path);
        saveAs(new Blob([bytes as BlobPart], {type: "application/octet-stream"}), node.name);
        return;
    }

    const client = getPythonClient();
    if (client == null) {
        return;
    }
    // readFsFile is pyodideExpose'd (see python-execution.ts's own comment for why) so, unlike
    // listFsTree, it must go via client.call() and is handed a callback for any synchronous
    // request it makes back to the main thread while reading -- in practice the only kind it can
    // ever issue is "assetFile_fetch" (fetching a lazily-loaded /data asset's bytes). This mirrors
    // PythonExecutionArea.vue's own sync-request handling in execPythonCode(), just narrowed to
    // the one request kind relevant here.
    if (!(await isServiceWorkerChannelResponsive(serviceWorkerChannel.baseUrl))) {
        console.error("Service worker sync channel not responding; file download may fail");
    }
    const bytes: Uint8Array = await client.call(
        client.workerProxy.readFsFile,
        node.path,
        Comlink.proxy((asreq: SyncOrAsyncStrypePyodideWorkerRequest) => {
            if (asreq.kind !== "sync" || asreq.request.request !== "assetFile_fetch") {
                console.error("Unexpected request while reading a file for the File system tab: " + JSON.stringify(asreq));
                return;
            }
            const req = asreq.request;
            fetch(req.url).then((resp) => resp.arrayBuffer()).then((arr) => encodeUint8ToString(new Uint8ClampedArray(arr)))
                .then(async (r) => {
                    await serviceWorkerReadyAndInControl();
                    await client.writeMessage({request: req.request, response: r});
                })
                .catch(async (err) => {
                    await serviceWorkerReadyAndInControl();
                    await client.writeMessage({request: req.request, error: err.toString()});
                });
        })
    );
    saveAs(new Blob([bytes as BlobPart], {type: "application/octet-stream"}), node.name);
}

// Uploads a file into "/local" at the given directory node's path (e.g. "/local" itself, or a
// subfolder). Writes straight into the main-thread cache -- callers must not allow this while
// Python is executing (see FileSystemPane.vue): the cache is only resynced with a running worker
// at the start/end of a run (see terminateAndRestartPyodide(), main_thread_python_handler.ts), so
// a write made mid-run here would silently be lost when that run's own snapshot is taken at the end.
export async function uploadToLocal(dirNode: FsTreeNode, file: File): Promise<void> {
    const data = new Uint8Array(await file.arrayBuffer());
    const path = dirNode.path === "/local" ? `/local/${file.name}` : `${dirNode.path}/${file.name}`;
    localFsCache.writeFile(path, data);
}

// Uploads a file into "/cloud" at the given directory node (its cloudFileId is the parent folder
// to create the new file in). Goes straight through cloudFileIO.ts's main-thread functions --
// create, write the actual content, then close (which awaits the write actually landing, the same
// way a Python open()/write()/close() would via the worker's sync bridge -- see cloudCloseFile's
// own comment for why closing is what forces/awaits the flush).
export async function uploadToCloud(dirNode: FsTreeNode, file: File): Promise<void> {
    if (dirNode.cloudFileId == null) {
        return;
    }
    const data = new Uint8Array(await file.arrayBuffer());
    const filePath = `${dirNode.path}/${file.name}`;
    const newFileId = await cloudCreate({cloudFileId: dirNode.cloudFileId}, file.name, false, filePath);
    await cloudWriteFile(newFileId, data, 0, filePath, true);
    await cloudCloseFile(newFileId);
}

// Uploads a set of extracted archive entries (see archive.ts's unzipEntries()) into "/local",
// preserving each entry's subfolder structure -- localFsCache.listTree() already builds nested
// directories from flat paths, so no special-casing is needed here beyond joining the path.
export async function uploadEntriesToLocal(dirNode: FsTreeNode, entries: ArchiveEntry[]): Promise<void> {
    for (const entry of entries) {
        const path = dirNode.path === "/local" ? `/local/${entry.path}` : `${dirNode.path}/${entry.path}`;
        localFsCache.writeFile(path, entry.data);
    }
}

// Uploads a set of extracted archive entries into "/cloud". Unlike /local, entries are flattened
// into the target folder using just their base file name: cloudCreate() (cloudFileIO.ts) can't
// create directories at all (Strype's cloud file IO only ever creates files, never folders), so
// there's no way to recreate an archive's subfolder structure in the cloud drive. Sequential
// (not parallelised) to keep this simple and avoid hammering the cloud API with a burst of
// concurrent create+write+close calls for a large archive.
export async function uploadEntriesToCloud(dirNode: FsTreeNode, entries: ArchiveEntry[]): Promise<void> {
    if (dirNode.cloudFileId == null) {
        return;
    }
    for (const entry of entries) {
        const name = entry.path.split("/").pop() as string;
        const filePath = `${dirNode.path}/${name}`;
        const newFileId = await cloudCreate({cloudFileId: dirNode.cloudFileId}, name, false, filePath);
        await cloudWriteFile(newFileId, entry.data, 0, filePath, true);
        await cloudCloseFile(newFileId);
    }
}
