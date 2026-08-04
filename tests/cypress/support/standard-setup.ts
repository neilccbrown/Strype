// This file has the standard beforeEach that most tests use.
// To use it, import standardBeforeEach and write: beforeEach(standardBeforeEach);

// Must clear all local storage between tests to reset the state,
// and also retrieve the shared CSS and HTML elements IDs exposed
// by Strype via the Window object of the app.
import { WINDOW_STRYPE_HTMLIDS_PROPNAME, WINDOW_STRYPE_SCSSVARS_PROPNAME } from "@/helpers/sharedIdCssWithTests";

// Must match AutoSaveKeyNames.strypeIndexDatabaseName in src/helpers/editor.ts. Not imported from
// there directly: that file pulls in Vite-only asset imports (Python stubs, SCSS modules, etc.)
// that Cypress's own webpack preprocessor can't parse.
const STRYPE_INDEXEDDB_NAME = "StrypeStateDatabase";

// Unlike localStorage/sessionStorage (cleared below), Strype's session-recovery state lives in
// IndexedDB, and a "stillAlive: false" record written by one test (e.g. any test using the
// discard-changes-then-load flow, such as testRoundTripImportAndDownload/loadFile) is left behind
// for the *next* test to find. App.vue's startup check for that only requires the record to be
// under 2 minutes old, so it can resurface as an undismissed "restore your session?" banner in a
// later, completely unrelated test. Clear it out here too, the same way we do for the other
// storage. We open the DB without a version and just clear whatever stores already exist, rather
// than depending on this file's own schema/version, so this doesn't need updating if that changes.
function clearSessionStateIndexedDB() : Cypress.Chainable<void> {
    return cy.window({log: false}).then((win) => new Cypress.Promise<void>((resolve) => {
        const openRequest = win.indexedDB.open(STRYPE_INDEXEDDB_NAME);
        openRequest.onsuccess = () => {
            const db = openRequest.result;
            const storeNames = Array.from(db.objectStoreNames);
            if (storeNames.length === 0) {
                db.close();
                resolve();
                return;
            }
            const tx = db.transaction(storeNames, "readwrite");
            storeNames.forEach((name) => tx.objectStore(name).clear());
            tx.oncomplete = () => {
                db.close();
                resolve();
            };
            tx.onerror = () => {
                db.close();
                resolve();
            };
        };
        // Nothing to clear yet (e.g. very first test of the run) -- fine either way:
        openRequest.onerror = () => resolve();
        openRequest.onupgradeneeded = () => { /* an empty DB was just created; nothing to clear */ };
    }));
}

export let scssVars: {[varName: string]: string};
export let strypeElIds: {[varName: string]: (...args: any[]) => string};
export function initialiseSupportStrypeGlobals() : void{
    // Only need to get the global variables if we haven't done so
    if(scssVars == undefined){
        cy.window().then((win) => {
            scssVars = (win as any)[WINDOW_STRYPE_SCSSVARS_PROPNAME];
            strypeElIds = (win as any)[WINDOW_STRYPE_HTMLIDS_PROPNAME];
        });
    }
}

export function standardBeforeEach() : void{
    cy.clearLocalStorage();
    clearSessionStateIndexedDB();
    cy.visit("/",  {onBeforeLoad: (win) => {
        win.localStorage.clear();
        win.sessionStorage.clear();
    }}).then(() => {
        initialiseSupportStrypeGlobals();
    });
    // Wait for the starting project to load fully:
    cy.get(".frame-div", { timeout: 10000 })
        .should("have.length.at.least", 2);
    
    // Register the "paste" command (unified for all Cypress tests here)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    Cypress.Commands.add("paste",
        {prevSubject : true},
        ($element, data: string | Buffer, type: string = "text/plain") => {
            const clipboardData = new DataTransfer();
            if (typeof data === "string") {
                clipboardData.setData(type, data);
            }
            else {
                const file = new File([new Blob([new Uint8Array(data)], {type: type})], "anon", { type: type });
                clipboardData.items.add(file);
            }
            const pasteEvent = new ClipboardEvent("paste", {
                bubbles: true,
                cancelable: true,
                clipboardData,
            });

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            cy.get($element).then(() => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
                $element[0].dispatchEvent(pasteEvent);
            });
        });
};
