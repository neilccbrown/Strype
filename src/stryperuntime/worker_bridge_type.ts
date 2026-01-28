import * as Comlink from "comlink";
import {loadPyodide, PyodideInterface} from "pyodide";
import {loadPyodideAndPackage} from "pyodide-worker-runner";
import {strype_bridge} from "@/stryperuntime/pyodide_bridge";

// Ideally we'd have a separate function for each request, but it's
// a pain to try to proxy multiple functions between the threads, so
// we combine it all into one mega function:
export type StrypePyodideWorkerRequestInput =
    | { request: "loadImage"; url: string }
    | { request: "loadLibraryAsset"; libraryShortName: string; fileName: string };

export type StrypePyodideWorkerRequestOutput = {
    loadImage: ImageBitmap;
    loadLibraryAsset: string | undefined;
};

export type StrypePyodideHandlerFunctionSync = <K extends StrypePyodideWorkerRequestInput["request"]>(
    req: Extract<StrypePyodideWorkerRequestInput, { request: K }>
) => StrypePyodideWorkerRequestOutput[K];


export type StrypePyodideHandlerFunctionAsync =
    (req: StrypePyodideWorkerRequestInput) => Promise<
        StrypePyodideWorkerRequestOutput[StrypePyodideWorkerRequestInput["request"]]
    >;

export type StrypePyodideHandlerFunctionVoid = (req: StrypePyodideWorkerRequestInput) => void;
