// eslint-disable-next-line @typescript-eslint/no-var-requires
require("cypress-terminal-report/src/installLogsCollector")();
import "@testing-library/cypress/add-commands";
import failOnConsoleError from "cypress-fail-on-console-error";
failOnConsoleError();
// For the beforeEach part:
import "../support/param-prompt-support";
import {testRawFuncs} from "../support/param-prompt-support";

describe("Parameter prompts for user-defined functions", () => { 
    // Each item is a triple: the module, the function name within the module, the list of param names
    const rawFuncs : [string | null | [string, string] | {udf: string}, string, string[] | [string[], string[]]][] = [
        [{udf: "draw_circle(x,y,radius,thickness=5,fill=None)"}, "draw_circle", [["x", "y", "radius"], ["x", "y", "radius", "thickness=5","fill=None"]]],
        [{udf: "sum(*numbers)"}, "sum", [[], ["*numbers"]]],
        [{udf: "draw_text(x,y,text,*,font_family=None)"}, "draw_text", [["x", "y", "text"], ["x", "y", "text", "font_family=None"]]],
        // TODO a class function
    ];
    testRawFuncs(rawFuncs);
});
