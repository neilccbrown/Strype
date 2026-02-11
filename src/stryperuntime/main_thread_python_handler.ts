// The code in this file runs on the main thread, and handles starting,
// stopping and restarting the Pyodide worker.
//
// It also managers the graphics Renderer as that is tied up
// with the communication with Pyodide.

import {Renderer} from "@/stryperuntime/renderer";
import {PyodideClient} from "pyodide-worker-runner";
import * as Comlink from "comlink";
import {makeServiceWorkerChannel} from "sync-message";
import {ref} from "vue";

// Can be re-used:
const serviceWorkerChannel = makeServiceWorkerChannel({scope: import.meta.env.BASE_URL});

export const renderer = new Renderer();
export const isPythonWorkerReady = ref(false);
// These two will get recreated when we restart Pyodide:
let pythonWorker : Worker = makeNewPyodideWorker();
let pythonClient = makePyodideClient(pythonWorker);


function makeNewPyodideWorker() : Worker {
    // The channel used to send Sprite updates asynchronously, outside of the main requests:
    // (channels cannot be re-used/re-transferred so we need a new one for each Pyodide worker
    // and thus we have to tell the renderer about the new channel too:
    const updateChannel = new MessageChannel();
    renderer.setMessageChannel(updateChannel.port2);
    // We initialise this out here to make it load earlier:
    const pythonWorker = new Worker(new URL("@/workers/python-execution.ts", import.meta.url), {type: "module"});
    // Must post it the update channel before wrapping in Pyodide:
    pythonWorker.postMessage({updatePort: updateChannel.port1}, [updateChannel.port1]);
    return pythonWorker;
}
function makePyodideClient(pythonWorker: Worker) : PyodideClient {
    isPythonWorkerReady.value = false;
    const pythonClient = new PyodideClient(() => pythonWorker, serviceWorkerChannel);
    pythonClient.call(
        pythonClient.workerProxy.onReady,
        Comlink.proxy(() => {
            isPythonWorkerReady.value = true;
        })
    );
    return pythonClient;
}

export function terminateAndRestartPyodide() : void {
    pythonWorker.terminate();
    isPythonWorkerReady.value = false;
    pythonWorker = makeNewPyodideWorker();
    pythonClient = makePyodideClient(pythonWorker);
}

// Note that the value of this function will change after you call terminateAndRestartPyodide()
export function getPythonClient() : PyodideClient {
    return pythonClient;
}
