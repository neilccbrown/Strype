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
import {
    configureSkulptForAutoComplete,
    getPythonCodeForNamesInContext,
    getPythonCodeForTypeAndDocumentation,
} from "../src/autocompletion/ac-skulpt";
import {AcResultsWithCategory, AcResultType} from "../src/types/ac-types";

declare const Sk: any;
declare const window: any;

const modules : string[] = Object.keys(pythonBuiltins).filter((k) => pythonBuiltins[k].type === "module");

// The challenge with Skulpt is that everything is in a Promise, but we have to be careful that we pull out
// the global acs variable before running the next Skulpt.  We can't await the Promise because the "browser-run"
// environment we are in does not support top-level await.  So instead, we just make an absolutely huge
// promise chain that adds each item to the list until there is nothing left to process, then we output them
// all and tell the browser to exit:

function getDetailsForListOfItems(module: string | null, items: AcResultType[], next: number, atEnd: () => void) {
    if (next >= items.length) {
        atEnd();
        return;
    }
    const codeToRun = getPythonCodeForTypeAndDocumentation(module ? "import " + module + "\n" : "", (module ? module + "." : "") + items[next].acResult);
    Sk.misceval.asyncToPromise(function() {
        return Sk.importMainWithBody("<stdin>", false, codeToRun, true);
    }, {}).then(() => {
        items[next].type = Sk.ffi.remapToJs(Sk.globals["itemTypes"]) as AcResultType["type"];
        items[next].documentation = Sk.ffi.remapToJs(Sk.globals["itemDocumentation"]) as string;
        // Sanity check the returns.  type can be the empty list and documentation can be the empty string,
        // so we can't do e.g. !items[next].type, we must explicitly compare to null and undefined:
        if (items[next].type === null || items[next].type === undefined || items[next].documentation === null || items[next].documentation === undefined) {
            console.log("Undefined type or documentation for " + module + "." + items[next].acResult);
        }
        getDetailsForListOfItems(module, items, next + 1, atEnd);
    },
    (err: any) => {
        console.log("Error running autocomplete code: " + err + "Code was:\n" + codeToRun);
    });
}

function getModuleMembersOneByOne(next : number, soFar : AcResultsWithCategory, atEnd: () => void) {
    if (next >= modules.length) {
        // Done everything, so execute last bit instead:
        atEnd();
        return;
    }
    
    // Ask Skulpt about the module's contents:
    const codeToRun = getPythonCodeForNamesInContext("import " + modules[next] + "\n", modules[next]);
    Sk.misceval.asyncToPromise(function() {
        return Sk.importMainWithBody("<stdin>", false, codeToRun, true);
    }, {}).then(() => {
        const items : AcResultType[] = (Sk.ffi.remapToJs(Sk.globals["acs"]) as string[]).map((s) => ({acResult: s, documentation: "", type: [], version: 0}));
        getDetailsForListOfItems(modules[next], items, 0, () => {
            soFar[modules[next]] = items;
            getModuleMembersOneByOne(next + 1, soFar, atEnd);
        });
    },
    (err: any) => {
        console.log("Error running autocomplete code: " + err + "Code was:\n" + codeToRun);
    });
}

const allContent : AcResultsWithCategory = {"": Object.keys(Sk.builtins).filter((func) => !func.includes("$")).map((s) => ({acResult: s, documentation: "", type: [], version: 0}))};
configureSkulptForAutoComplete();
// Add Skulpt's builtin functions to the default module:
getDetailsForListOfItems(null, allContent[""], 0, () => {
    getModuleMembersOneByOne(0, allContent, () => {
        // Outputting the results to console actually goes to stdout, which the surrounding
        // task redirects to the API file:
        console.log(JSON.stringify(allContent, null, 4));
        // This tells browser-run to exit, without it the browser stays open and the process never terminates.
        // However, if we do it immediately it seems the console is not flushed to stdout, so we put it on a timer:
        setTimeout(() => window.close(), 2000);
    });
});
