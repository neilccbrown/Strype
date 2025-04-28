// This file tests loading and saving, especially the new .spy file format (basically, .py + annotations)
// but also loading old files, which we want to support for a while.

// We have two kinds of things to test.  One is loading .spy files, which we then check can be saved again to get
// the same result.  The other is that if we enter some code (especially code with metadata-required things like disabled frames)
// it should save correctly.

// eslint-disable-next-line @typescript-eslint/no-var-requires
require("cypress-terminal-report/src/installLogsCollector")();
import failOnConsoleError from "cypress-fail-on-console-error";
failOnConsoleError();

import path from "path";
import i18n from "@/i18n";
import "../support/expression-test-support";
import { WINDOW_STRYPE_HTMLIDS_PROPNAME, WINDOW_STRYPE_SCSSVARS_PROPNAME } from "../../../src/helpers/sharedIdCssWithTests";

// Must clear all local storage between tests to reset the state,
// and also retrieve the shared CSS and HTML elements IDs exposed
// by Strype via the Window object of the app.
let scssVars: {[varName: string]: string};
let strypeElIds: {[varName: string]: (...args: any[]) => string};
beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit("/",  {onBeforeLoad: (win) => {
        win.localStorage.clear();
        win.sessionStorage.clear();
    }}).then(() => {
        // Only need to get the global variables if we haven't done so
        if(scssVars == undefined){
            cy.window().then((win) => {
                scssVars = (win as any)[WINDOW_STRYPE_SCSSVARS_PROPNAME];
                strypeElIds = (win as any)[WINDOW_STRYPE_HTMLIDS_PROPNAME];
            });
        }
        // The Strype IDs and CSS class names aren't directly used in the test
        // but they are used in the support file, so we make them available.
        cy.initialiseSupportStrypeGlobals();

        // Wait for code initialisation
        cy.wait(2000);
    });
});

function focusEditorPasteAndClear(): void {
    // Not totally sure why this hack is necessary, I think it's to give focus into the webpage via an initial click:
    // (on the main code container frame -- would be better to retrieve it properly but the file won't compile if we use Apps.ts and/or the store)
    cy.get("#" + strypeElIds.getFrameUID(-3)).focus();
    // Delete existing content (bit of a hack):
    cy.get("body").type("{uparrow}{uparrow}{uparrow}{del}{downarrow}{downarrow}{downarrow}{downarrow}{backspace}{backspace}");
}

function checkDownloadedFileEquals(fullContent: string, filename: string, firstSave?: boolean) : void {
    const downloadsFolder = Cypress.config("downloadsFolder");
    const destFile = path.join(downloadsFolder, filename);
    cy.task("deleteFile", destFile);
    // Save is located in the menu, so we need to open it first, then find the link and click on it
    // Force these because sometimes cypress gives false alarm about webpack overlay being on top:
    cy.get("button#" + strypeElIds.getEditorMenuUID()).click({force: true});
    cy.contains(i18n.t("appMenu.saveProject") as string).click({force: true});
    if (firstSave) {
        // For testing, we always want to save to this device:
        cy.contains(i18n.t("appMessage.targetFS") as string).click({force: true});
        cy.contains(i18n.t("OK") as string).click({force: true});
    }

    cy.readFile(destFile).then((p : string) => {
        // Print out full version in message (without escaped \n), to make it easier to diff:
        expect(p, "Actual unescaped:\n" + p).to.equal(fullContent);
    });
}

function testRoundTripImportAndDownload(filepath: string) {
    // The filename is a path, fixture just needs the filename:
    cy.readFile(filepath).then((spy) => {
        // Delete existing:
        focusEditorPasteAndClear();

        cy.get("#" + strypeElIds.getEditorMenuUID()).click();
        cy.get("#" + strypeElIds.getLoadProjectLinkId()).click();
        // If the current state of the project is modified,
        // we first need to discard the changes (we check the button is available)
        cy.get("button").contains(i18n.t("buttonLabel.discardChanges") as string).should("exist").click();
        cy.wait(2000);
        // The "button" for the target selection is now a div element.
        cy.get("#" + strypeElIds.getLoadFromFSStrypeButtonId()).click();
        // Must force because the <input> is hidden:
        cy.get("." + scssVars.editorFileInputClassName).selectFile(filepath, {force : true});
        cy.wait(2000);
        
        // We must make sure there are no comment frames starting "(=>" because that would indicate
        // our special comments have become comment frames, rather than being processed:
        // Making sure there's zero items is awkward in Cypress so we drop to doing it manually:
        cy.document().then((doc) => {
            const spans = Array.from(doc.querySelectorAll("span.comment-slot"));
            const matching = spans.filter((el) => el.textContent?.trim().startsWith("(=>"));
            expect(matching.length).to.eq(0);
        });
        
        // We make sure there are no slots containing ___strype_ because they should have been processed:
        cy.document().then((doc) => {
            const spans = Array.from(doc.querySelectorAll("span"));
            const matching = spans.filter((el) => el.textContent?.includes("___strype_"));
            expect(matching.length).to.eq(0);
        });

        checkDownloadedFileEquals(spy.replaceAll("\r\n", "\n"), filepath.split("/").pop() ?? "My project.spy");
    });
}

function testEntryDisableAndSave(commands: string, disableFrames: string[], filepath: string) {
    cy.readFile(filepath).then((spy) => {
        // Delete existing:
        focusEditorPasteAndClear();
        
        cy.get("body").type(commands);
        
        disableFrames.forEach((txt) => {
            cy.contains("span", txt).rightclick();
            cy.contains("*", i18n.t("contextMenu.disable") as string).click();
        });

        checkDownloadedFileEquals(spy.replaceAll("\r\n", "\n"), "My project.spy", true);
    });
} 

describe("Loads and re-saves fixture files", () => {
    if (Cypress.env("mode") === "microbit") {
        // TODO instead issue a warning dialog when loading from another platform:
        return;
    }
    it("Loads a basic project", () => {
        testRoundTripImportAndDownload("tests/cypress/fixtures/project-basic.spy");
    });
    it("Loads a basic trisection project", () => {
        testRoundTripImportAndDownload("tests/cypress/fixtures/project-basic-trisection.spy");
    });
    it("Outputs a dummy for solo try", () => {
        // Make an empty try, which should save with a placeholder:
        testEntryDisableAndSave("tpmsg{enter}{downarrow}{backspace}", [], "tests/cypress/fixtures/project-try-solo.spy");
    });
    it("Loads and saves a solo try", () => {
        // Make an empty try, which should save with a placeholder:
        testRoundTripImportAndDownload("tests/cypress/fixtures/project-try-solo.spy");
    });
});

describe("Tests disabling frames", () => {
    if (Cypress.env("mode") === "microbit") {
        // TODO instead issue a warning dialog when loading from another platform:
        return;
    }
    it("Outputs a dummy for try with disabled except", () => {
        // Make an empty try, which should save with a placeholder:
        testEntryDisableAndSave("tpmsg{enter}{rightarrow}extype{rightarrow}pword", ["extype"], "tests/cypress/fixtures/project-try-disabled-except.spy");
    });
    it("Loads and saves a try with disabled except", () => {
        // Make an empty try, which should save with a placeholder:
        testRoundTripImportAndDownload("tests/cypress/fixtures/project-try-disabled-except.spy");
    });
    
    it("Save a basic disable project", () => {
        testEntryDisableAndSave("=msg=\"Hello\"{enter} print(msg)", ["print"], "tests/cypress/fixtures/project-basic-disable.spy");
    });
    it("Loads and saves a basic disable project", () => {
        testRoundTripImportAndDownload("tests/cypress/fixtures/project-basic-disable.spy");
    });

    
    it("Loads and saves a complex disable project", () => {
        testRoundTripImportAndDownload("tests/cypress/fixtures/project-complex-disable.spy");
    });
});

describe("Tests blanks", () => {
    if (Cypress.env("mode") === "microbit") {
        // TODO instead issue a warning dialog when loading from another platform:
        return;
    }
    it("Outputs a file with lots of blanks", () => {
        // import x as ___strype_blank
        // from ___strype_blank import ___strype_blank
        // def ___strype_blank ( ) :
        //     if ___strype_blank  :
        //         ( )
        //     return
        // raise ___strype_blank
        // ___strype_blank = 1 + ___strype_blank * ___strype_blank / () - __strype_blank
        testEntryDisableAndSave("{uparrow}{uparrow}" +
            "ix {rightarrow}f{downarrow}{downarrow}" +
            "f{downarrow}i{rightarrow} {downarrow}{downarrow}r{rightarrow}{downarrow}{downarrow}" +
            "a{rightarrow}==1+*/()-", [], "tests/cypress/fixtures/project-blanks.spy");
    });
    it("Loads and saves with lots of blanks", () => {
        testRoundTripImportAndDownload("tests/cypress/fixtures/project-blanks.spy");
    });
    
});

describe("Tests invalid characters", () => {
    if (Cypress.env("mode") === "microbit") {
        // TODO instead issue a warning dialog when loading from another platform:
        return;
    }
    it("Outputs a file with invalid chars", () => {
        testEntryDisableAndSave("{uparrow}{uparrow}" +
            "i100{rightarrow}ffoo{rightarrow}£1000{downarrow}i50{downarrow}ifoo（）{downarrow}{downarrow}" +
            "f#include{rightarrow}100,abc,#35{downarrow}r$50{downarrow}{downarrow}{downarrow}" +
            " 100($50, 24.24a)", [], "tests/cypress/fixtures/project-invalid-chars.spy");
    });
    it("Loads and saves a file with invalid chars", () => {
        testRoundTripImportAndDownload("tests/cypress/fixtures/project-invalid-chars.spy");
    });
});
