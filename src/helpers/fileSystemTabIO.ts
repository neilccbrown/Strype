// Orchestration for the "File system" tab (see FileSystemPane.vue): listing, downloading and
// uploading files from the internal Pyodide filesystem's read-only bundled asset roots ("/data",
// "/books", "/images", etc -- see assetsRoots() below), "/local" (writeable scratch area) and
// "/cloud" (the connected cloud drive, when the project is saved to one).
import { saveAs } from "file-saver";
import * as Comlink from "comlink";
import { watch } from "vue";
import { getPythonClient, isPythonWorkerReady } from "@/stryperuntime/main_thread_python_handler";
import { FsTreeNode } from "@/stryperuntime/file_system_tree_types";
import { SyncOrAsyncStrypePyodideWorkerRequest } from "@/stryperuntime/worker_bridge_type";
import { encodeUint8ToString } from "@/stryperuntime/worker_bridge_type";
import { isServiceWorkerChannelResponsive, serviceWorkerReadyAndInControl } from "@/workers/shared_helpers";
import { serviceWorkerChannel } from "@/stryperuntime/main_thread_python_handler";
import * as localFsCache from "@/helpers/localFsCache";
import { cloudCloseFile, cloudCreate, cloudListDir, cloudReadFile, cloudWriteFile } from "@/helpers/cloudFileIO";
import { useStore } from "@/store/store";
import { ArchiveEntry } from "@/helpers/archive";
import { assetsFilePrefixes, buildAssetTree } from "@/stryperuntime/assets_file_index";

// "/local" and "/cloud" are the two writeable roots; anything else is one of the read-only asset
// roots mounted from src/assetsFilesystem/ (see assetsRoots() below).
export type FsRoot = "/local" | "/cloud" | string;

// The read-only asset roots to show in the File system tab, one per top-level directory under
// src/assetsFilesystem/ (e.g. "/data", "/books", "/images") -- derived dynamically from
// assetsFilePrefixes so this list tracks whatever directories actually exist there, rather than
// being a hard-coded list that would go stale if those directories change.
export function assetsRoots(): FsRoot[] {
    return assetsFilePrefixes.map((prefix) => "/" + prefix);
}

// Whether the project is currently saved to a cloud drive -- the same condition
// PythonExecutionArea.vue uses to decide whether a run mounts "/cloud" at all
// (startInSlashCloud). Used by FileSystemPane.vue to decide whether to show the "/cloud" section.
export function isCloudMounted(): boolean {
    return typeof useStore().strypeProjectLocation === "string";
}

// None of the three kinds of root need a live Pyodide worker just to be listed: "/local" is read
// from localFsCache.ts's own main-thread mirror (see its comment for why that, not a live worker,
// is the single source of truth for what's shown here); "/cloud" goes via cloudFileIO.ts's plain
// main-thread async functions; and the read-only asset roots are built straight from the
// build-time glob in assets_file_index.ts (see buildAssetTree's own comment for why -- avoiding a
// worker round trip here matters for how quickly the worker becomes ready for an actual Run
// straight after the File system tab is opened). Downloading an asset file (downloadFsFile below)
// is the only place that still needs the worker, to lazily mount and fetch that file's real bytes.
export async function listFsRootTree(root: FsRoot): Promise<FsTreeNode | null> {
    if (root === "/local") {
        return localFsCache.listTree();
    }
    if (root === "/cloud") {
        return await listCloudTree();
    }
    const prefix = root.slice(1);
    if (assetsFilePrefixes.includes(prefix)) {
        return buildAssetTree(prefix);
    }
    return null;
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
    // client.call() (comsync's SyncClient) throws immediately if the client isn't in its "idle"
    // state -- it doesn't queue -- and createPyodideSlot() already has one client.call() running
    // from page load (awaiting the worker's onReady) until Pyodide finishes loading. Calling
    // client.call() again (for readFsFile, below) while that's still in flight throws "State is
    // running, not idle" -- silently, since onDownload (FileSystemPane.vue) fires this whole
    // function without awaiting it, so the rejection becomes an invisible unhandled promise
    // rejection rather than a console error. Wait out both: isPythonWorkerReady (true once onReady's
    // *callback* has fired -- see main_thread_python_handler.ts) first, then client.state actually
    // settling back to "idle" (there's a brief further gap while the pyodideExpose wrapper finishes
    // returning over Comlink). Previously this whole race was masked by accident: opening the File
    // system tab always listed "/data" via a plain (non-client.call()) worker RPC first, which took
    // long enough that Pyodide -- and thus onReady's call -- had always finished by the time a
    // download's client.call() ran. Listing no longer touches the worker at all (see
    // listFsRootTree() above), so that accidental ordering guarantee is gone and must be made
    // explicit here instead:
    if (!isPythonWorkerReady.value) {
        await new Promise<void>((resolve) => {
            const stopWatching = watch(isPythonWorkerReady, (ready) => {
                if (ready) {
                    stopWatching();
                    resolve();
                }
            });
        });
    }
    while (client.state !== "idle") {
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    // readFsFile is pyodideExpose'd (see python-execution.ts's own comment for why) so, unlike
    // the plain worker RPCs above, it must go via client.call() and is handed a callback for any
    // synchronous request it makes back to the main thread while reading -- in practice the only
    // kind it can ever issue is "assetFile_fetch" (fetching a lazily-loaded asset file's bytes).
    // This mirrors PythonExecutionArea.vue's own sync-request handling in execPythonCode(), just
    // narrowed to the one request kind relevant here.
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
