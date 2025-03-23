import {sampleSize} from "lodash";
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("cypress-terminal-report/src/installLogsCollector")();
import failOnConsoleError from "cypress-fail-on-console-error";
failOnConsoleError();

import path from "path";
import i18n from "@/i18n";
import * as os from "os";
import {focusEditor} from "../support/expression-test-support";
import { getEditorMenuUID, getFrameUID, getLoadFromFSStrypeButtonId, getLoadProjectLinkId } from "@/helpers/editor";
import scssVars from "@/assets/style/_export.module.scss";

// Must clear all local storage between tests to reset the state:
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
    cy.get("#" + getFrameUID(-3)).focus();
    // Delete existing content (bit of a hack):
    cy.get("body").type("{uparrow}{uparrow}{uparrow}{del}{downarrow}{downarrow}{downarrow}{downarrow}{backspace}{backspace}");
}

function checkDownloadedCodeEquals(fullCode: string) : void {
    const downloadsFolder = Cypress.config("downloadsFolder");
    cy.task("deleteFile", path.join(downloadsFolder, "main.py"));
    // Conversion to Python is located in the menu, so we need to open it first, then find the link and click on it
    // Force these because sometimes cypress gives false alarm about webpack overlay being on top:
    cy.get("button#" + getEditorMenuUID()).click({force: true});
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
function testRoundTripPasteAndDownload(code: string, extraPositioning?: string, expected?: string, retainExisting?: boolean) {
    if (retainExisting) {
        focusEditor();
    }
    else {
        // Delete existing:
        focusEditorPasteAndClear();
    }
    if (extraPositioning) {
        cy.get("body").type(extraPositioning);
    }
    // Get rid of any Windows file endings:
    code = code.replaceAll(/\r\n/g, "\n");
        
    (cy.get("body") as any).paste(code);
    checkDownloadedCodeEquals(expected ?? code);
    // Refocus the editor and go to the bottom:
    cy.get("#" + getFrameUID(-3)).focus();
    cy.get("body").type("{end}");
}

function testRoundTripImportAndDownload(filepath: string, expected?: string) {
    // The filename is a path, fixture just needs the filename:
    cy.readFile(filepath).then((py) => {
        // Delete existing:
        focusEditorPasteAndClear();

        cy.get("#" + getEditorMenuUID()).click();
        cy.get("#" + getLoadProjectLinkId()).click();
        // If the current state of the project is modified,
        // we first need to discard the changes (we check the button is available)
        cy.get("button").contains("Discard changes").should("exist").click();
        cy.wait(2000);
        // The "button" for the target selection is now a div element.
        cy.get("#" + getLoadFromFSStrypeButtonId()).click();
        // Must force because the <input> is hidden:
        cy.get("." + scssVars.editorFileInputClassName).selectFile(filepath, {force : true});
        cy.wait(2000);
        
        checkDownloadedCodeEquals(expected ?? py);
        // Refocus the editor and go to the bottom:
        cy.get("#" + getFrameUID(-3)).focus();
        cy.get("body").type("{end}");
    });
}


describe("Python round-trip", () => {
    // Some of these are semantically invalid but as long as they're syntactically valid,
    // they should work:
    const binary_operators = ["^",">>","<<","==","!=",">=","<=","<",">", "in", "is not", "is", "not in"];
    const nary_operators = ["+","-","/","*","%","//","&","|", "and", "or"];
    //const unary_operators = ["not ", "~", "-"];
    const terminals = ["0", "5.2", "-6.7", "\"hi\"", "'bye'", "True", "False", "None", "foo", "bar_baz"];
    
    const basics = [
        "raise 0\n",
        "raise 0+1\n",
        "raise 0 and 3\n",
        "raise 0 is not 3\n",
        "raise 0 not in 3\n",
        "raise (1+2-3)\n",
        "raise (1+2-3)==(4*5/6)\n",
        // ** binds tighter than unary -, hence the space before:
        "raise foo**-6.7**False**True**'bye'\n",
        "try:\n    x = 0\nexcept:\n    x = 1\n",
    ];
    for (const basic of basics) {
        it("Supports pasting: " + basic, () => testRoundTripPasteAndDownload(basic));
    }
    it("Allows pasting fixture file with functions", () => {
        cy.fixture("python-functions.py").then((py) => testRoundTripPasteAndDownload(py, "{uparrow}"));
    });
    it("Allows pasting fixture file with bubble sort function", () => {
        cy.fixture("python-bubble.py").then((py) => testRoundTripPasteAndDownload(py, "{uparrow}"));
    });
    it("Allows pasting fixture file with main code", () => {
        cy.fixture("python-code.py").then((py) => testRoundTripPasteAndDownload(py));
    });
    it("Allows importing fixture file with functions", () => {
        testRoundTripImportAndDownload("tests/cypress/fixtures/python-functions.py");
    });
    it("Allows importing fixture file with bubble sort function", () => {
        testRoundTripImportAndDownload("tests/cypress/fixtures/python-bubble.py");
    });
    it("Allows importing fixture file with main code", () => {
        testRoundTripImportAndDownload("tests/cypress/fixtures/python-code.py");
    });
    it("Allows importing mixed code", () => {
        testRoundTripImportAndDownload("tests/cypress/fixtures/python-mixed-1.py");
    });
    it("Allows importing mixed code 2", () => {
        testRoundTripImportAndDownload("tests/cypress/fixtures/python-hints-extract.py");
    });
    it("Allows importing triple in right order", () => {
        cy.fixture("python-only-imports.py", "utf8").then((imports) => {
            cy.fixture("python-only-funcdefs.py", "utf8").then((defs) => {
                cy.fixture("python-only-main.py", "utf8").then((main) => {
                    const tempFilePath = path.join(os.tmpdir(), `combined_${Date.now()}.py`);
                    cy.writeFile(tempFilePath, imports + defs + main);
                    testRoundTripImportAndDownload(tempFilePath);
                });
            });
        });
    });

    it("Allows importing triple in wrong order", () => {
        cy.fixture("python-only-imports.py", "utf8").then((imports) => {
            cy.fixture("python-only-funcdefs.py", "utf8").then((defs) => {
                cy.fixture("python-only-main.py", "utf8").then((main) => {
                    const tempFilePath = path.join(os.tmpdir(), `combined_${Date.now()}.py`);
                    cy.writeFile(tempFilePath, main + defs + imports);
                    testRoundTripImportAndDownload(tempFilePath, imports + defs + main);
                });
            });
        });
    });
    
    it("Shows an error for invalid code", () => {
        testRoundTripImportAndDownload("tests/cypress/fixtures/python-invalid.py", "");
        assertVisibleError(/invalid.*import.*line: 1/si);
    });

    it("Shows an error for invalid code with wrong code", () => {
        testRoundTripImportAndDownload("tests/cypress/fixtures/python-invalid-hints-extract.py", "");
        assertVisibleError(/invalid.*import.*if.*line: 20/si);
    });

    it("Shows an error for invalid code when mixed with invalid placement", () => {
        cy.fixture("python-only-imports.py", "utf8").then((imports) => {
            cy.fixture("python-only-funcdefs.py", "utf8").then((defs) => {
                cy.fixture("python-only-main.py", "utf8").then((main) => {
                    const tempFilePath = path.join(os.tmpdir(), `combined_${Date.now()}.py`);
                    cy.writeFile(tempFilePath, imports + defs + main + "\nglobal y\n");
                    testRoundTripImportAndDownload(tempFilePath, "");
                    assertVisibleError(/invalid.*import/i);
                });
            });
        });
    });

    it("Shows an error for invalid code when mixed with unparseable", () => {
        cy.fixture("python-only-imports.py", "utf8").then((imports) => {
            cy.fixture("python-only-funcdefs.py", "utf8").then((defs) => {
                cy.fixture("python-only-main.py", "utf8").then((main) => {
                    const tempFilePath = path.join(os.tmpdir(), `combined_${Date.now()}.py`);
                    cy.writeFile(tempFilePath, imports + defs + main + "\nthis nonsense should not be parseable\n");
                    testRoundTripImportAndDownload(tempFilePath, "");
                    const line = 1 + (imports + defs + main).split(/\r?\n/).length;
                    assertVisibleError(new RegExp(`invalid.*import.*nonsense.*line: ${line}`, "si"));
                });
            });
        });
    });
    
    it("Handles global and assignment commas", () => {
        testRoundTripPasteAndDownload(`
def myFunc (param1 , param2):
    global x
    global y
    x , y = param1 , param2
`, "{uparrow}", `def myFunc (param1,param2):
    global x
    global y
    x,y = param1,param2
`);
    });
    it("Handles import and from import", () => {
        testRoundTripPasteAndDownload(`
import x
import a . b . c
from x import *
from x import y
from a . b . c import x
from a . b . c import *
`, "{uparrow}{uparrow}",`import x
import a.b.c
from x import *
from x import y
from a.b.c import x
from a.b.c import *
`);
    });
    
    it("Supports basic binary operator combinations", () => {
        for (const op of sampleSize(binary_operators, 3)) {
            for (const lhs of sampleSize(terminals, 2)) {
                for (const rhs of sampleSize(terminals, 3)) {
                    // Keep a space between operands only for keyword operators (they all contains "i")
                    const operatorSpacing = (op.includes("i")) ? " " : ""; 
                    const code = "raise " + lhs + operatorSpacing + op + operatorSpacing + rhs + "\n";
                    testRoundTripPasteAndDownload(code);
                }
            }
        }
    });
    it("Supports basic n-ary operator combinations", () => {
        for (const op of sampleSize(nary_operators, 5)) {
            // Keep a space between operands only for keyword operators (they all contains "i")
            const operatorSpacing = (["and", "or"].includes(op)) ? " " : "";
            const code = "raise " + sampleSize(terminals, 5).join(operatorSpacing + op + operatorSpacing) + "\n";
            testRoundTripPasteAndDownload(code);
        }
    });
    
    // Check that if you paste something that already has indent on every line, we manage to preserve
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
if x>0:
    x = 0
    x = 1
else:
    x = -1
x = x*x
`);
    });
    it("Handles multiple functions that are all indented the same amount", () => {
        testRoundTripPasteAndDownload(`
                        def foo():
                            return "foo"
                        def bar():
                            return "bar"
`, "{uparrow}", `
def foo ():
    return "foo"
def bar ():
    return "bar"
`.trimStart());
    });
    it("Handles function that is indented the same amount as preceding comment", () => {
        testRoundTripPasteAndDownload(`
                        # Returns foo
                        def foo():
                            return "foo"
`, "{uparrow}", `
# Returns foo
def foo ():
    return "foo"
`.trimStart());
    });
    
    it("Allows pasting inside elif/else", () => {
        // We had a bug where you couldn't paste anything inside elif/else:
        const bareIfElifElseCode = `
if True:
    x = 0
elif False:
    y = 1
else:
    z = 2
        `.trimEnd() + "\n";
        testRoundTripPasteAndDownload(bareIfElifElseCode);
        // Now we should be after the whole thing:
        testRoundTripPasteAndDownload("alpha = 6", "{uparrow}", `
if True:
    x = 0
elif False:
    y = 1
else:
    z = 2
    alpha = 6
             `.trimEnd() + "\n", true);
        testRoundTripPasteAndDownload("beta = 7", "{uparrow}{uparrow}{uparrow}{uparrow}", `
if True:
    x = 0
elif False:
    y = 1
    beta = 7
else:
    z = 2
    alpha = 6
        `.trimEnd() + "\n", true);
    });

    it("Allows pasting inside elif/else, nested", () => {
        // We had a bug where you couldn't paste anything inside elif/else:
        const bareIfElifElseCode = `
if True:
    x = 0
elif False:
    y = 1
else:
    while True:
        if True:
            pass
        else:
            z = 2
        `.trimEnd() + "\n";
        testRoundTripPasteAndDownload(bareIfElifElseCode);
        // Now we should be after the whole thing:
        testRoundTripPasteAndDownload("alpha = 6", "{uparrow}{uparrow}{uparrow}", `
if True:
    x = 0
elif False:
    y = 1
else:
    while True:
        if True:
            pass
        else:
            z = 2
            alpha = 6
             `.trimEnd() + "\n", true);
    });

    it("Allows pasting inside except/finally", () => {
        // We had a bug where you couldn't paste anything inside except/finally:
        const bareTryExceptFinallyCode = `
try:
    x = 0
except e:
    y = 1
finally:
    z = 2
        `.trimEnd() + "\n";
        testRoundTripPasteAndDownload(bareTryExceptFinallyCode);
        // Now we should be after the whole thing:
        testRoundTripPasteAndDownload("alpha = 6", "{uparrow}", `
try:
    x = 0
except e:
    y = 1
finally:
    z = 2
    alpha = 6
             `.trimEnd() + "\n", true);
        testRoundTripPasteAndDownload("beta = 7", "{uparrow}{uparrow}{uparrow}{uparrow}", `
try:
    x = 0
except e:
    y = 1
    beta = 7
finally:
    z = 2
    alpha = 6
        `.trimEnd() + "\n", true);
    });
    
    it("Allows pasting else/elif at only the right places", () => {
        // Put the initial if in and clear everything else:
        const ifCode = "if True:\n    x = -10\n";
        testRoundTripPasteAndDownload(ifCode);
        const elseCode = "else:\n    x = -9\n";
        // Parameterise, to be able to tell them apart:
        const elifCode = (x : number) => "elif x==" + x + ":\n    x = -" + x + "\n";
        
        // Test just the else after if:
        cy.get("body").type("{end}{uparrow}");
        (cy.get("body") as any).paste(elseCode);
        checkDownloadedCodeEquals(ifCode + elseCode);
        // Delete just the else:
        cy.get("body").type("{end}{backspace}");
        cy.wait(500);
        cy.get("body").type("{uparrow}");
        
        // Test with one elif
        (cy.get("body") as any).paste(elifCode(0));
        checkDownloadedCodeEquals(ifCode + elifCode(0));
        // Delete just the elif:
        cy.get("body").type("{end}{backspace}");
        cy.wait(500);
        cy.get("body").type("{uparrow}");
        
        // Clear and try if with two elif:
        (cy.get("body") as any).paste(elifCode(0) + elifCode(1));
        checkDownloadedCodeEquals(ifCode + elifCode(0) + elifCode(1));
        // Delete just the two elif:
        cy.get("body").type("{end}{backspace}");
        cy.wait(500);
        cy.get("body").type("{backspace}");
        checkDownloadedCodeEquals(ifCode);
        // Now if with three elif and an else:
        cy.get("body").type("{end}{uparrow}");
        (cy.get("body") as any).paste(elifCode(0) + elifCode(1) + elifCode(2) + elseCode);
        checkDownloadedCodeEquals(ifCode + elifCode(0) + elifCode(1) + elifCode(2) + elseCode);
        // Check deletion works:
        cy.get("body").type("{end}{backspace}");
        cy.wait(500);
        cy.get("body").type("{backspace}");
        cy.wait(500);
        cy.get("body").type("{backspace}");
        cy.wait(500);
        cy.get("body").type("{backspace}");
        checkDownloadedCodeEquals(ifCode);
    });

    it("Allows pasting except/else/finally after a try", () => {
        // Put the initial if in and clear everything else:
        const tryCode = "try:\n    x = -10\n";
        const elseCode = "else:\n    x = -9\n";
        const finallyCode = "finally:\n    x = -8\n";
        // Parameterise, to be able to tell them apart:
        const exceptCode = (errType : string, varName?: string) => "except" + (errType ? " " + errType : "") + (varName ? " as " + varName : "") + ":\n    x = " + (varName ?? "0") + "\n";

        testRoundTripPasteAndDownload(tryCode + finallyCode);
        // Delete the finally:
        cy.get("body").type("{end}{backspace}");
        
        const testCode = (code : string[]) => {
            cy.get("body").type("{end}{uparrow}");
            (cy.get("body") as any).paste(code.join(""));
            checkDownloadedCodeEquals(tryCode + code.join(""));
            cy.get("body").type("{end}");
            for (let i = 0; i < code.length; i++) {
                cy.wait(500);
                cy.get("body").type("{backspace}");
            }
            // Can't test try by itself because it is now an error state (via TigerPython):
            // checkDownloadedCodeEquals(tryCode);
        };
        
        testCode([exceptCode("")]);
        testCode([exceptCode(""), finallyCode]);
        testCode([exceptCode("Exception")]);
        testCode([exceptCode("Exception"), finallyCode]);
        testCode([exceptCode("Exception", "e")]);
        testCode([exceptCode("Exception", "e"), elseCode, finallyCode]);
        testCode([exceptCode("CustomError"), exceptCode("Exception", "e"), elseCode, finallyCode]);
    });
});

function assertVisibleError(error: RegExp | null) {
    if (error != null) {
        cy.get("." + scssVars.messageBannerContainerClassName + " span:first-child").invoke("text").should("match", error);
        cy.get("." + scssVars.messageBannerCrossClassName).click();
    }
    // Whether it never existed, or we closed it, it should now not exist:
    cy.get("." + scssVars.messageBannerContainerClassName).should("not.exist");
}

// If error is null, there shouldn't be an error banner
function assertPasteError(codeToPaste: string, error: RegExp | null) {
    focusEditorPasteAndClear();
    (cy.get("body") as any).paste(codeToPaste);
    assertVisibleError(error);
}

describe("Python paste errors", () => {
    it("Shows no error on blank or valid paste", () => {
        assertPasteError("", null);
        assertPasteError("    ", null);
        assertPasteError("    x = 0", null);
        assertPasteError("    x", null);
    });
    it("Shows an error on invalid paste", () => {
        assertPasteError("!", /Invalid Python code pasted.*!/);
        assertPasteError("ifg True:\n    pass", /Invalid Python code pasted.*True/);
        assertPasteError("if True:\n    invalid%%%", /Invalid Python code pasted.*%%%/);
        // We have a different message for when we paste an else with more content after (which we can't handle)
        assertPasteError("else:\n    pass\nprint(\"Hi\")", /else/);
    });
    it("Forbids nested functions in functions", () => {
        cy.get("body").type("{uparrow}");
        assertPasteError(`
def outer():
    def inner():
        pass
    pass
`, /Invalid Python code pasted.*section/);
    });
    it("Forbids nested imports or functions in main code", () => {
        assertPasteError(`
if True:
    def inner():
        pass
    pass
`,/Invalid Python code pasted.*section/);
        assertPasteError(`
if True:
    import random
    random.random()
`,/Invalid Python code pasted.*section/);
    });
});

describe("Python complex function", () => {
    it("Allows pasting complex function", () => {
        testRoundTripPasteAndDownload(`def displayBoard (missedLetters,correctLetters,secretWord):
    print("Misses:"+str(len(missedLetters)))
    print()
    print("Missed letters:",end=' ')
    for letter in missedLetters:
        print(letter,end=' ')
    print()
    blanks = '_'*len(secretWord)
    for i in range(len(secretWord)):
        if secretWord[i] in correctLetters:
            blanks = blanks[:i]+secretWord[i]+blanks[i+1:]
    for letter in blanks:
        print(letter,end=' ')
    print()
`, "{uparrow}");
    });
});
