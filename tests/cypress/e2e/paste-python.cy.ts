import {sampleSize} from "lodash";
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("cypress-terminal-report/src/installLogsCollector")();
import failOnConsoleError from "cypress-fail-on-console-error";
failOnConsoleError();


// Must clear all local storage between tests to reset the state:
import path from "path";
import i18n from "@/i18n";

beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit("/",  {onBeforeLoad: (win) => {
        win.localStorage.clear();
        win.sessionStorage.clear();
    }});
});

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
Cypress.Commands.add("paste",
    {prevSubject : true},
    ($element, data) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData("text", data);
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

function focusEditorPasteAndClear(): void {
    // Not totally sure why this hack is necessary, I think it's to give focus into the webpage via an initial click:
    // (on the main code container frame -- would be better to retrieve it properly but the file won't compile if we use Apps.ts and/or the store)
    cy.get("#frame_id_-3").focus();
    // Delete existing content (bit of a hack):
    cy.get("body").type("{uparrow}{uparrow}{uparrow}{del}{downarrow}{downarrow}{downarrow}{downarrow}{backspace}{backspace}");
}

function checkDownloadedCodeEquals(fullCode: string) : void {
    const downloadsFolder = Cypress.config("downloadsFolder");
    cy.task("deleteFile", path.join(downloadsFolder, "main.py"));
    // Conversion to Python is located in the menu, so we need to open it first, then find the link and click on it
    // Force these because sometimes cypress gives false alarm about webpack overlay being on top:
    cy.get("button#showHideMenu").click({force: true});
    cy.contains(i18n.t("appMenu.downloadPython") as string).click({force: true});

    cy.readFile(path.join(downloadsFolder, "main.py")).then((p : string) => {
        // Before comparing, we fix up a few oddities of our generated code:
        // Get rid of any spaces at end of lines:
        p = p.replaceAll(/ +\n/g, "\n");
        // Get rid of spaces before colons at end of line:
        p = p.replaceAll(/ +:\n/g, ":\n");
        // Get rid of spaces before closing brackets:
        p = p.replace(/ +([)\]}])/g, "$1");
        // Get rid of any multiple spaces between words:
        p = p.replace(/([^ \n])  +([^ ])/g, "$1 $2");
        // Print out full version in message (without escaped \n), to make it easier to diff:
        expect(p, "Actual unescaped:\n" + p).to.equal(fullCode);
    });
}

// if expected is missing, use the original code
function testRoundTripPasteAndDownload(code: string, extraPositioning?: string, expected?: string) {
    // Delete existing:
    focusEditorPasteAndClear();
    if (extraPositioning) {
        cy.get("body").type(extraPositioning);
    }
    // Get rid of any Windows file endings:
    code = code.replaceAll(/\r\n/g, "\n");
        
    (cy.get("body") as any).paste(code);
    checkDownloadedCodeEquals(expected ?? code);
}

describe("Python round-trip", () => {
    // Some of these are semantically invalid but as long as they're syntactically valid,
    // they should work:
    const binary_operators = ["^",">>","<<","==","!=",">=","<=","<",">", "in", "is not", "is", "not in"];
    const nary_operators = ["+","-","/","*","%","//","**","&","|", "and", "or"];
    //const unary_operators = ["not ", "~", "-"];
    const terminals = ["0", "5.2", "-6.7", "\"hi\"", "'bye'", "True", "False", "None", "foo", "bar_baz"];
    
    const basics = [
        "raise 0\n",
        "raise 0 + 1\n",
        "raise 0 and 3\n",
        "raise 0 is not 3\n",
        "raise 0 not in 3\n",
        "raise (1 + 2 - 3)\n",
        "raise (1 + 2 - 3) == (4 * 5 / 6)\n",
    ];
    for (const basic of basics) {
        it("Supports pasting: " + basic, () => testRoundTripPasteAndDownload(basic));
    }
    it("Allows pasting fixture file with functions", () => {
        cy.fixture("python-functions.py").then((py) => testRoundTripPasteAndDownload(py, "{uparrow}"));
    });
    it("Allows pasting fixture file with main code", () => {
        cy.fixture("python-code.py").then((py) => testRoundTripPasteAndDownload(py));
    });
    it("Handles global and assignment commas", () => {
        testRoundTripPasteAndDownload(`
def myFunc (param1 , param2):
    global x
    global y
    x , y = param1 , param2
`, "{uparrow}");
    });
    it("Handles import and from import", () => {
        testRoundTripPasteAndDownload(`
import x
import a . b . c
from x import *
from x import y
from a . b . c import x
from a . b . c import *
`, "{uparrow}{uparrow}");
    });
    
    it("Supports basic binary operator combinations", () => {
        for (const op of sampleSize(binary_operators, 3)) {
            for (const lhs of sampleSize(terminals, 2)) {
                for (const rhs of sampleSize(terminals, 3)) {
                    const code = "raise " + lhs + " " + op + " " + rhs + "\n";
                    testRoundTripPasteAndDownload(code);
                }
            }
        }
    });
    it("Supports basic n-ary operator combinations", () => {
        for (const op of sampleSize(nary_operators, 5)) {
            const code = "raise " + sampleSize(terminals, 5).join(" " + op + " ") + "\n";
            testRoundTripPasteAndDownload(code);
        }
    });
    
    // Check that if you paste something that already has indent on every line, we manage to preserver
    // the relation among the lines correctly:
    it("Handles multiple lines that are all indented correctly", () => {
        testRoundTripPasteAndDownload(`
                    if x > 0:
                        x = 0
                        x = 1
                    else:
                        x = -1
                    x = x * x
`, "", `
if x > 0:
    x = 0
    x = 1
else:
    x = -1
x = x * x
`);
    });
});
