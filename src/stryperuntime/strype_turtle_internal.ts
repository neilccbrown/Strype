import { syncBridge } from "@/workers/python_execution_type";
import { PyProxy } from "pyodide/ffi";

//declare const globalThis: PyodideWorkerGlobalScope;

export function callback(name: string, params: Record<string, any>) : void {
    if (name === "turtle") {
        const buffer = (params.data as PyProxy).toJs() as [string, string, any][];
        
        syncBridge({request:"turtle", buffer});
    }
}
