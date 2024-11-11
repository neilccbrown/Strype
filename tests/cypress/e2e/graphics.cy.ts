// eslint-disable-next-line @typescript-eslint/no-var-requires
require("cypress-terminal-report/src/installLogsCollector")();
// eslint-disable-next-line @typescript-eslint/no-var-requires
const compareSnapshotCommand = require("cypress-image-diff-js/command");
compareSnapshotCommand();
import failOnConsoleError from "cypress-fail-on-console-error";
failOnConsoleError();

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
    cy.get("#frame_id_-3").focus();
    // Delete existing content (bit of a hack):
    cy.get("body").type("{uparrow}{uparrow}{uparrow}{del}{downarrow}{downarrow}{downarrow}{downarrow}{backspace}{backspace}");
}

enum ImageComparison {
    COMPARE_TO_EXISTING,
    // If we want to set a new expected image after a change in the code, you can pass
    // this value but you should not commit this because it effectively stops the test
    // from ever being able to fail.  So if you see a committed use of this as a parameter,
    // reject the commit!
    WRITE_NEW_EXPECTED_DO_NOT_COMMIT_USE_OF_THIS
}

function runCodeAndCheckImage(functions: string, main: string, expectedImageFileName : string, comparison = ImageComparison.COMPARE_TO_EXISTING) : void {
    focusEditorPasteAndClear();
    cy.get("body").type("{uparrow}{uparrow}");
    (cy.get("body") as any).paste("from strype.graphics import *\nfrom time import sleep\n");
    cy.wait(2000);
    cy.get("body").type("{downarrow}");
    (cy.get("body") as any).paste(functions);
    cy.wait(3000);
    cy.get("body").type("{downarrow}");
    (cy.get("body") as any).paste(main);
    cy.wait(3000);
    cy.contains("a", "\uD83D\uDC22 Graphics").click();
    cy.get("#runButton").contains("Run");
    cy.get("#runButton").click();
    // Wait for it to finish:
    cy.wait(5000);
    // Assert it has finished, by looking at the run button:
    cy.get("#runButton").contains("Run");
    // Check the screenshot matches expected:
    // (Note: if you want to set a new expected, delete the file in tests/cypress/e2e/expected-screenshots/baseline,
    // temporarily change FAIL_ON_MISSING_BASELINE to false in cypress-image-diff-config.js, and then
    // the new expected will be regenerated and saved on the next run.  Then change the config setting back.)
    (cy.get("#pythonGraphicsCanvas") as any).compareSnapshot({name: expectedImageFileName, testThreshold: 0.01});
    
}

describe("Basic operation", () => {
    if (Cypress.env("mode") == "microbit") {
        // Graphics tests can't run in microbit
        return;
    }
    it("Blank canvas", () => {
        runCodeAndCheckImage("", "print('Hello')\n", "graphics-blank");
    });
    it("Basic cat", () => {
        runCodeAndCheckImage("", "Actor('cat-test.jpg')\nsleep(1)\n", "graphics-just-cat");
    });
    it("Basic cat rotated +45", () => {
        runCodeAndCheckImage("", "cat = Actor('cat-test.jpg')\ncat.set_rotation(45)\nsleep(1)\n", "graphics-just-cat-rotated-45");
    });
    it("Basic cat rotated -60", () => {
        runCodeAndCheckImage("", "cat = Actor('cat-test.jpg')\ncat.set_rotation(-60)\nsleep(1)\n", "graphics-just-cat-rotated-minus-60");
    });
    // TODO add a grid of squares and colour them if they collide
});
