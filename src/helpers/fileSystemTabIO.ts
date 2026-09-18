// Orchestration for the "File system" tab (see FileSystemPane.vue): listing, downloading and (for
// "/local") uploading files from the internal Pyodide filesystem's "/data" (read-only bundled
// assets) and "/local" (writeable scratch area) roots. "/cloud" is deliberately not handled here
// yet -- it will be read directly via cloudFileIO.ts in a later phase, without going through the
// worker at all.
import { saveAs } from "file-saver";
import * as Comlink from "comlink";
import { getPythonClient } from "@/stryperuntime/main_thread_python_handler";
import { FsTreeNode } from "@/stryperuntime/file_system_tree_types";
import { SyncOrAsyncStrypePyodideWorkerRequest } from "@/stryperuntime/worker_bridge_type";
import { encodeUint8ToString } from "@/stryperuntime/worker_bridge_type";
import { isServiceWorkerChannelResponsive, serviceWorkerReadyAndInControl } from "@/workers/shared_helpers";
import { serviceWorkerChannel } from "@/stryperuntime/main_thread_python_handler";
import * as localFsCache from "@/helpers/localFsCache";

// isPythonWorkerReady only reflects whether a worker is up and its service worker channel is
// confirmed responsive -- listFsTree just needs a live worker to talk to, so we don't gate on it
// here; getPythonClient() returning null (e.g. "TestingNoPyodide") is the only case we need to
// guard against. "/local" never asks the worker at all -- see localFsCache.ts's own comment for
// why it, not a live worker, is the single source of truth for what's shown here.
export async function listFsRootTree(root: "/data" | "/local"): Promise<FsTreeNode | null> {
    if (root === "/local") {
        return localFsCache.listTree();
    }
    const client = getPythonClient();
    if (client == null) {
        return null;
    }
    return await client.workerProxy.listFsTree(root);
}

export async function downloadFsFile(path: string, fileName: string, root: "/data" | "/local"): Promise<void> {
    if (root === "/local") {
        const bytes = localFsCache.readFile(path);
        if (bytes != null) {
            saveAs(new Blob([bytes as BlobPart], {type: "application/octet-stream"}), fileName);
        }
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
        path,
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
    saveAs(new Blob([bytes as BlobPart], {type: "application/octet-stream"}), fileName);
}

// Uploads a file into "/local" at the given directory path (e.g. "/local" itself, or a subfolder).
// Writes straight into the main-thread cache -- callers must not allow this while Python is
// executing (see FileSystemPane.vue): the cache is only resynced with a running worker at the
// start/end of a run (see terminateAndRestartPyodide(), main_thread_python_handler.ts), so a write
// made mid-run here would silently be lost when that run's own snapshot is taken at the end.
export async function uploadToLocal(dirPath: string, file: File): Promise<void> {
    const data = new Uint8Array(await file.arrayBuffer());
    const path = dirPath === "/local" ? `/local/${file.name}` : `${dirPath}/${file.name}`;
    localFsCache.writeFile(path, data);
}
