import type { PyodideInterface } from "pyodide";
import { loadPyodideAndPackage, OutputPart, pyodideExpose, PyodideExtras, PyodideFatalErrorReloader } from "pyodide-worker-runner";
import * as Comlink from "comlink";
import { SyncExtras } from "comsync";

declare const globalThis: any;
async function loadOnly() : Promise<PyodideInterface> {
    console.log("Loading pyodide");
    const ourPyodideLoader = async () => {
        await import(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            /* webpackIgnore: true */ "./pyodide-0.29.0/pyodide.js"
        );
        return await globalThis.loadPyodide({indexURL: "./pyodide-0.29.0/"}) as PyodideInterface;
    };

    const pyodide = await loadPyodideAndPackage({url: "../public_libraries/python_runner.zip", format: "zip"}, ourPyodideLoader);
    console.log("Loaded pyodide and package");
    
    return pyodide;
}
const reloader = new PyodideFatalErrorReloader(loadOnly);

interface RunnerCallbacks {
    input?: (prompt: string) => void;
    output: (parts: OutputPart[]) => unknown;
    other?: (type: string, data: unknown) => unknown;
}
function makeRunnerCallbackLogTemp(
    comsyncExtras: SyncExtras,
    callbacks: RunnerCallbacks
) {
    return function (type: string, data: any) {
        if (data.toJs) {
            data = data.toJs({dict_converter: Object.fromEntries});
        }

        if (type === "input") {
            console.log(">>> Runner requesting input");
            callbacks.input && callbacks.input(data.prompt);
            console.log(">>> Runner requested input, reading... " + JSON.stringify(comsyncExtras));
            return comsyncExtras.readMessage() + "\n";
        }
        else if (type === "sleep") {
            comsyncExtras.syncSleep(data.seconds * 1000);
        }
        else if (type === "output") {
            return callbacks.output(data.parts);
        }
        else {
            return (callbacks.other as any)(type, data);
        }
    };
}

const executePython = pyodideExpose(async (
    extras: PyodideExtras,
    pythonCode: string,
    printStdout: Comlink.Remote<(output: string) => void>,
    requestInput: Comlink.Remote<(prompt: string) => void>
) : Promise<string | null> => {
    console.log("About to execute Python: " + pythonCode);
    return await reloader.withPyodide(async (pyodide : PyodideInterface) => {
        console.log("Found Pyodide");
        const runner = pyodide.runPython("from python_runner import PyodideRunner\nPyodideRunner()");
        const callback = makeRunnerCallbackLogTemp(extras, {
            output: (outputText: OutputPart[]) => {
                console.log("Received output from Python: " + JSON.stringify(outputText));
                const stdoutParts = outputText.filter((t) => t.type == "stdout");
                if (stdoutParts.length > 0) {
                    printStdout(stdoutParts.map((t) => t.text).join(""));
                }
            },
            // We fire off the input request and it asynchronously gives back the input
            input: requestInput,
            other: (type: string, data: any) => {
                console.log("Received other [" + type + "] from Python: " + JSON.stringify(data));
            },
        });
        runner.set_callback(callback);
        console.log("Awaiting async Python runner");
        await runner.run_async(pythonCode, {});
        console.log("Python runner complete");
        return null;
    });
});

const onReady = pyodideExpose(async (extras: PyodideExtras, callOnceReady:  Comlink.Remote<() => void>)=> {
    await reloader.withPyodide(async () => callOnceReady());
});

Comlink.expose({
    executePython,
    onReady,
});
