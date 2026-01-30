import type {StrypePyodideHandlerFunctionSync} from "@/stryperuntime/worker_bridge_type";
import {PersistentImageManager} from "@/stryperuntime/image_and_collisions";
import type {PyodideAPI} from "pyodide";

export interface PyodideWorkerGlobalScope extends WorkerGlobalScope {
    StrypePyodideWorkerBridge: StrypePyodideHandlerFunctionSync;
    persistentImageManager : PersistentImageManager;
    pyodide: PyodideAPI;
};
