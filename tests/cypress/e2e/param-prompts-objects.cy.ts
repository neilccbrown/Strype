// eslint-disable-next-line @typescript-eslint/no-var-requires
require("cypress-terminal-report/src/installLogsCollector")();
import "@testing-library/cypress/add-commands";
import failOnConsoleError from "cypress-fail-on-console-error";
failOnConsoleError();
// For the beforeEach part:
import "../support/param-prompt-support";
import {testRawFuncs} from "../support/param-prompt-support";


describe("Parameter prompts objects", () => {
    // Each item is a triple: the module, the function name within the module, the list of param names
    const rawFuncs : [string | null | [string, string], string, string[]][] = [];
    rawFuncs.push([null, "str(8).center", ["width"]]);
    if (Cypress.env("mode") !== "microbit") {
        rawFuncs.push(["strype.graphics", "Actor(s).move", ["distance"]]);
        rawFuncs.push(["strype.graphics", "Actor(t).set_location", ["x", "y"]]);
        rawFuncs.push(["strype.graphics", "get_background().draw_circle", ["centre_x", "centre_y", "radius"]]);
        rawFuncs.push(["strype.graphics", "load_image(i).draw_text", ["text", "x", "y"]]);
        rawFuncs.push([["http://localhost:8089/test-library/", "mediacomp"], "Pixel(0,1,2,3).set_color", ["color"]]);
    }
    testRawFuncs(rawFuncs);
});
