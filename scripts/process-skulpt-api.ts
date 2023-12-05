// This script is used as a preprocessing step.  It is NOT run live by Strype,
// but instead run manually via the preprocess:update-skulpt-api NPM task.
// It runs Skulpt to ask for the contents of each of Skulpt's modules
// then processes them into a JSON file with all the API details for Strype's
// autocomplete.  It thus only needs to be re-run if the Skulpt API
// has changed.  The resulting file is checked in to Git since it won't change
// often.  (This script just outputs on console, which goes to stdout; the path
// of the resulting  file is set in package.json where the NPM task is defined.)
//
// Note that Skulpt can only run in a browser because it looks for e.g. the window
// object.  So in order to run it we must use a fake browser environment.
// This is done from the package.json command, which uses browser-run to run
// the Typescript (after it has been compiled to Javascript and bundled into a
// single file).

import "../public/js/skulpt.min";
import "../public/js/skulpt-stdlib";
import { pythonBuiltins } from "../src/autocompletion/pythonBuiltins";
import {configureSkulptForAutoComplete, prepareSkulptCode} from "../src/autocompletion/ac-skulpt";
import { AcResultType } from "../src/types/ac-types";


declare const Sk: any;
declare const window: any;

const promises : Promise<{[module: string] : AcResultType[]}>[] = [];
for (const key in pythonBuiltins) {
    if (pythonBuiltins[key].type === "module") {
        // Ask Skulpt about the module's contents:
        const codeToRun = prepareSkulptCode("import " + key + "\n", key, (x : string) => x);
        configureSkulptForAutoComplete();
        const myPromise = Sk.misceval.asyncToPromise(function() {
            return Sk.importMainWithBody("<stdin>", false, codeToRun, true);
        }, {});
        // Show error in JS console if error happens
        promises.push(myPromise.then(() => {
            return Promise.resolve(Sk.ffi.remapToJs(Sk.globals["ac"]) as {[module: string] : AcResultType[]});
        },
        (err: any) => {
            console.log("Error running autocomplete code: " + err + "Code was:\n" + codeToRun);
        }));
    }
}
Promise.all(promises).then((results) => {
    const moduleContents: Record<string, AcResultType[]> = {};
    moduleContents[""] = [];
    for (let i = 0; i < results.length; i++) {
        for (const resultKey in results[i]) {
            moduleContents[resultKey] = results[i][resultKey];
        }
    }
    // Also add Skulpt's builtin functions to the default module:
    for (const func of Object.keys(Sk.builtin)) {
        if (!func.includes("$")) {
            moduleContents[""].push({acResult: func, documentation: "", version: 0, type: "function"});
        }
    }
    
    // Outputting the results to console actually goes to stdout, which the surrounding
    // task redirects to the API file:
    console.log(JSON.stringify(moduleContents, null, 4));
    // This tells browser-run to exit, without it the browser stays open and the process never terminates.
    // However, if we do it immediately it seems the console is not flushed to stdout, so we put it on a timer:
    setTimeout(() => window.close(), 2000);
    
});
