// eslint-disable-next-line @typescript-eslint/no-var-requires
require("cypress-terminal-report/src/installLogsCollector")();

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

function focusEditorPaste(): void {
    // Not totally sure why this hack is necessary, I think it's to give focus into the webpage via an initial click:
    // (on the main code container frame -- would be better to retrieve it properly but the file won't compile if we use Apps.ts and/or the store)
    cy.get("#frame_id_-3").focus();
}

function checkDownloadedCodeEquals(fullCode: string) : void {
    const downloadsFolder = Cypress.config("downloadsFolder");
    cy.task("deleteFile", path.join(downloadsFolder, "main.py"));
    // Conversion to Python is located in the menu, so we need to open it first, then find the link and click on it
    // Force these because sometimes cypress gives false alarm about webpack overlay being on top:
    cy.get("button#showHideMenu").click({force: true});
    cy.contains(i18n.t("appMenu.downloadPython") as string).click({force: true});

    cy.readFile(path.join(downloadsFolder, "main.py")).then((p : string) => {
        expect(p).to.equal(fullCode);
    });
}

function testRoundTripPasteAndDownload(code: string) {
    focusEditorPaste();
    // Delete existing:
    cy.get("body").type("{del}{del}");
    (cy.get("body") as any).paste(code);
    checkDownloadedCodeEquals(code);
}

describe("Python round-trip", () => {
    // Some of these are semantically invalid but as long as they're syntactically valid,
    // they should work:
    it("Supports basics", () => {
        testRoundTripPasteAndDownload("raise 0 \n");
    });
});
