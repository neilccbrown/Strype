require("cypress-terminal-report/src/installLogsCollector")();
import "@testing-library/cypress/add-commands";
import failOnConsoleError from "cypress-fail-on-console-error";
failOnConsoleError();
// For the beforeEach part:
import "../support/param-prompt-support";
import {testRawFuncs} from "../support/param-prompt-support";


describe("Parameter prompts Python random function", () => {
    // Each item is a triple: the module, the function name within the module, the list of param names
    const rawFuncs : [string | null | [string, string], string, string[]][] = [];
    if (Cypress.env("mode") !== "microbit") {
        rawFuncs.push(["random", "random", []]);
        rawFuncs.push(["random", "choice", ["seq"]]);
    }
    testRawFuncs(rawFuncs);
});
