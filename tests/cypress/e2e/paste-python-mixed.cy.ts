// eslint-disable-next-line @typescript-eslint/no-var-requires
import {
    focusEditorAndClear,
    testRoundTripImportAndDownload,
    testRoundTripPasteAndDownload
} from "../support/paste-test-support";

require("cypress-terminal-report/src/installLogsCollector")();
import failOnConsoleError from "cypress-fail-on-console-error";
import path from "path";
import os from "os";
failOnConsoleError();

// If the user pastes "mixed" code (i.e. imports, functions and body code)
// then we split it into those three categories and obey the following rules:
// - Imports go at current cursor position if in imports, otherwise at the end of the imports
// - Definitions go at current cursor position if at top-level in definitions section, otherwise at the end of the definitions
// - Body code goes at the current cursor position, unless it is top-level imports or top-level definitions, in which case it goes at the start of the main code

const IMPORT0 = "import foo";
const IMPORT1 = "import strype.graphics";
const IMPORT2 = "from strype.graphics import *";

const DEF0 = `
def foo ():
    return "65"
`.trim();
const DEF1 = `
def bar (a,b,c):
    if a>b:
        while True:
            return c
    raise "Err"
`.trim();

const MAIN0 = "x = y";
const MAIN1 = "foo(72)";
const MAIN2 = "if True:\n    z = 7";

const STARTING_IMPORT = "import time";
const STARTING_DEF = `def myfunc ():
    return 7`;
const STARTING_MAIN = "print(\"Hello\")";
const STARTING_POINT = `
${STARTING_IMPORT}
${STARTING_DEF}
${STARTING_MAIN}
`.trimStart();

describe("Tests pasting mixed content", () => {
    it("Loads/saves initial content", () => {
        const tempFilePath = path.join(os.tmpdir(), `combined_${Date.now()}.py`);
        cy.writeFile(tempFilePath, STARTING_POINT);
        testRoundTripImportAndDownload(tempFilePath);
    });
    // This is actually already a mixed test but it should work if everything is working properly:
    it("Imports initial content and saves .py", () => {
        testRoundTripPasteAndDownload(STARTING_POINT);
    });
    it("Imports initial content and saves .spy", () => {
        testRoundTripPasteAndDownload(STARTING_POINT, "", `
#(=> Strype:1:std
#(=> Section:Imports
${STARTING_IMPORT}
#(=> Section:Definitions
${STARTING_DEF}
#(=> Section:Main
${STARTING_MAIN}
#(=> Section:End
`.trimStart(), false, "spy");
    });
    
    // These tests rely on the initial paste working, but we already test that isolated above:
    // After the initial call we will be at the end of the file
    it("Pastes imports-only in main", () => {
        testRoundTripPasteAndDownload(STARTING_POINT);
        testRoundTripPasteAndDownload(IMPORT0 + "\n" + IMPORT1 + "\n" + IMPORT2, "", `
#(=> Strype:1:std
#(=> Section:Imports
${STARTING_IMPORT}
${IMPORT0}
${IMPORT1}
${IMPORT2}
#(=> Section:Definitions
${STARTING_DEF}
#(=> Section:Main
${STARTING_MAIN}
#(=> Section:End
`.trimStart(), true, "spy");        
    });

    it("Pastes defs-only in main", () => {
        testRoundTripPasteAndDownload(STARTING_POINT);
        testRoundTripPasteAndDownload(DEF0 + "\n" + DEF1, "", `
#(=> Strype:1:std
#(=> Section:Imports
${STARTING_IMPORT}
#(=> Section:Definitions
${STARTING_DEF}
${DEF0}
${DEF1}
#(=> Section:Main
${STARTING_MAIN}
#(=> Section:End
`.trimStart(), true, "spy");
    });

    it("Pastes main-only at top of main", () => {
        testRoundTripPasteAndDownload(STARTING_POINT);
        testRoundTripPasteAndDownload(MAIN0 + "\n" + MAIN1, "{home}", `
#(=> Strype:1:std
#(=> Section:Imports
${STARTING_IMPORT}
#(=> Section:Definitions
${STARTING_DEF}
#(=> Section:Main
${MAIN0}
${MAIN1}
${STARTING_MAIN}
#(=> Section:End
`.trimStart(), true, "spy");
    });

    it("Pastes imports-only at top of imports", () => {
        testRoundTripPasteAndDownload(STARTING_POINT);
        testRoundTripPasteAndDownload(IMPORT0 + "\n" + IMPORT1 + "\n" + IMPORT2, "{home}{uparrow}{home}{uparrow}{home}", `
#(=> Strype:1:std
#(=> Section:Imports
${IMPORT0}
${IMPORT1}
${IMPORT2}
${STARTING_IMPORT}
#(=> Section:Definitions
${STARTING_DEF}
#(=> Section:Main
${STARTING_MAIN}
#(=> Section:End
`.trimStart(), true, "spy");
    });

    it("Pastes defs-only at top of defs", () => {
        testRoundTripPasteAndDownload(STARTING_POINT);
        testRoundTripPasteAndDownload(DEF0 + "\n" + DEF1, "{home}{uparrow}{home}", `
#(=> Strype:1:std
#(=> Section:Imports
${STARTING_IMPORT}
#(=> Section:Definitions
${DEF0}
${DEF1}
${STARTING_DEF}
#(=> Section:Main
${STARTING_MAIN}
#(=> Section:End
`.trimStart(), true, "spy");
    });

    it("Pastes full set in imports", () => {
        testRoundTripPasteAndDownload(STARTING_POINT);
        testRoundTripPasteAndDownload([IMPORT0, IMPORT1, IMPORT2, DEF0, DEF1, MAIN0, MAIN1, MAIN2].join("\n"), "{home}{uparrow}{home}{uparrow}{home}", `
#(=> Strype:1:std
#(=> Section:Imports
${IMPORT0}
${IMPORT1}
${IMPORT2}
${STARTING_IMPORT}
#(=> Section:Definitions
${STARTING_DEF}
${DEF0}
${DEF1}
#(=> Section:Main
${MAIN0}
${MAIN1}
${MAIN2}
${STARTING_MAIN}
#(=> Section:End
`.trimStart(), true, "spy");
    });

    it("Pastes full set in defs", () => {
        testRoundTripPasteAndDownload(STARTING_POINT);
        testRoundTripPasteAndDownload([IMPORT0, IMPORT1, IMPORT2, DEF0, DEF1, MAIN0, MAIN1, MAIN2].join("\n"), "{home}{uparrow}{home}", `
#(=> Strype:1:std
#(=> Section:Imports
${STARTING_IMPORT}
${IMPORT0}
${IMPORT1}
${IMPORT2}
#(=> Section:Definitions
${DEF0}
${DEF1}
${STARTING_DEF}
#(=> Section:Main
${MAIN0}
${MAIN1}
${MAIN2}
${STARTING_MAIN}
#(=> Section:End
`.trimStart(), true, "spy");
    });

    it("Pastes full set in main", () => {
        testRoundTripPasteAndDownload(STARTING_POINT);
        testRoundTripPasteAndDownload([IMPORT0, IMPORT1, IMPORT2, DEF0, DEF1, MAIN0, MAIN1, MAIN2].join("\n"), "", `
#(=> Strype:1:std
#(=> Section:Imports
${STARTING_IMPORT}
${IMPORT0}
${IMPORT1}
${IMPORT2}
#(=> Section:Definitions
${STARTING_DEF}
${DEF0}
${DEF1}
#(=> Section:Main
${STARTING_MAIN}
${MAIN0}
${MAIN1}
${MAIN2}
#(=> Section:End
`.trimStart(), true, "spy");
    });

    it("Pastes unordered in main", () => {
        testRoundTripPasteAndDownload(STARTING_POINT);
        testRoundTripPasteAndDownload([IMPORT0, MAIN0, DEF0, IMPORT1, DEF1, MAIN1, MAIN2, IMPORT2].join("\n"), "", `
#(=> Strype:1:std
#(=> Section:Imports
${STARTING_IMPORT}
${IMPORT0}
${IMPORT1}
${IMPORT2}
#(=> Section:Definitions
${STARTING_DEF}
${DEF0}
${DEF1}
#(=> Section:Main
${STARTING_MAIN}
${MAIN0}
${MAIN1}
${MAIN2}
#(=> Section:End
`.trimStart(), true, "spy");
    });

    it("Pastes full set in funcdef body", () => {
        testRoundTripPasteAndDownload(STARTING_POINT);
        testRoundTripPasteAndDownload([IMPORT0, IMPORT1, IMPORT2, DEF0, DEF1, MAIN0, MAIN1, MAIN2].join("\n"), "{home}{uparrow}{uparrow}", `
#(=> Strype:1:std
#(=> Section:Imports
${STARTING_IMPORT}
${IMPORT0}
${IMPORT1}
${IMPORT2}
#(=> Section:Definitions
${STARTING_DEF}
    ${MAIN0}
    ${MAIN1}
    ${MAIN2.replaceAll("\n", "\n    ")}
${DEF0}
${DEF1}
#(=> Section:Main
${STARTING_MAIN}
#(=> Section:End
`.trimStart(), true, "spy");
    });
});
