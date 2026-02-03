import type {StrypePyodideHandlerFunctionSync} from "@/stryperuntime/worker_bridge_type";
import {SpriteManager} from "@/stryperuntime/image_and_collisions";
import type {PyodideAPI} from "pyodide";

export interface PyodideWorkerGlobalScope extends WorkerGlobalScope {
    StrypePyodideWorkerBridge: StrypePyodideHandlerFunctionSync;
    spriteManager : SpriteManager;
    pyodide: PyodideAPI;
};
