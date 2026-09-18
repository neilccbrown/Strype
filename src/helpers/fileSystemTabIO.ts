// Orchestration for the "File system" tab (see FileSystemPane.vue): listing and downloading files
// from the internal Pyodide filesystem's "/data" (read-only bundled assets) and "/local" (writeable
// scratch area) roots. "/cloud" is deliberately not handled here in Phase 1 -- it will be read
// directly via cloudFileIO.ts in a later phase, without going through the worker at all.
import { saveAs } from "file-saver";
import * as Comlink from "comlink";
import { getPythonClient } from "@/stryperuntime/main_thread_python_handler";
import { FsTreeNode } from "@/stryperuntime/file_system_tree_types";
import { SyncOrAsyncStrypePyodideWorkerRequest } from "@/stryperuntime/worker_bridge_type";
import { encodeUint8ToString } from "@/stryperuntime/worker_bridge_type";
import { isServiceWorkerChannelResponsive, serviceWorkerReadyAndInControl } from "@/workers/shared_helpers";
import { serviceWorkerChannel } from "@/stryperuntime/main_thread_python_handler";

// isPythonWorkerReady only reflects whether a worker is up and its service worker channel is
// confirmed responsive -- both listFsTree/readFsFile just need a live worker to talk to, so we
// don't gate on it here; getPythonClient() returning null (e.g. "TestingNoPyodide") is the only
// case we need to guard against.
export async function listFsRootTree(root: "/data" | "/local"): Promise<FsTreeNode | null> {
    const client = getPythonClient();
    if (client == null) {
        return null;
    }
    return await client.workerProxy.listFsTree(root);
}

export async function downloadFsFile(path: string, fileName: string): Promise<void> {
    const client = getPythonClient();
    if (client == null) {
        return;
    }
    // readFsFile is pyodideExpose'd (see python-execution.ts's own comment for why) so, unlike
    // listFsTree, it must go via client.call() and is handed a callback for any synchronous
    // request it makes back to the main thread while reading -- in practice the only kind it can
    // ever issue is "assetFile_fetch" (fetching a lazily-loaded /data asset's bytes; /local files
    // never trigger this). This mirrors PythonExecutionArea.vue's own sync-request handling in
    // execPythonCode(), just narrowed to the one request kind relevant here.
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
