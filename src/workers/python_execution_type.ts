import type { AsyncStrypePyodideHandlerFunction, ResponseFor, SyncStrypePyodideHandlerFunction, SyncStrypePyodideWorkerRequest, SyncStrypePyodideWorkerResponse } from "@/stryperuntime/worker_bridge_type";
import {SpriteManager} from "@/stryperuntime/image_and_collisions";
import type {PyodideAPI} from "pyodide";

// The type of the Pyodide worker.  Make sure all these fields are set in executePython before calling Pyodide.
export interface PyodideWorkerGlobalScope extends WorkerGlobalScope {
    syncStrypePyodideWorkerBridge: SyncStrypePyodideHandlerFunction;
    asyncStrypePyodideWorkerBridge: AsyncStrypePyodideHandlerFunction;
    spriteManager : SpriteManager;
    pyodide: PyodideAPI;
};

export function syncBridge<R extends SyncStrypePyodideWorkerRequest>(
    req: R
): ResponseFor<R>["response"] {
    return (globalThis as unknown as PyodideWorkerGlobalScope).syncStrypePyodideWorkerBridge(req).response as ResponseFor<R>["response"];
}

export const asyncBridge : AsyncStrypePyodideHandlerFunction = (req) => {
    return (globalThis as unknown as PyodideWorkerGlobalScope).asyncStrypePyodideWorkerBridge(req);
};
