// eslint-disable-next-line @typescript-eslint/no-var-requires
require("cypress-terminal-report/src/installLogsCollector")();
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
Cypress.Commands.add("assertValueCopiedToClipboard", (value) => {
    cy.window().its("navigator.clipboard")
        .invoke("readText").should("equal", value);
});


import {assertState, focusEditor} from "../support/expression-test-support";

export function testSelection(code : string, selectKeys: string, expectedAfterDeletion : string) : void {
    it("Tests " + code, () => {
        focusEditor();
        cy.get("body").type("{backspace}{backspace}i");
        assertState("{$}");
        cy.get("body").type(" " + code);
        cy.get("body").type(selectKeys);
        cy.get("body").type("{del}");
        assertState(expectedAfterDeletion);
    });
}

describe("Shift-Home selects to the beginning", () => {
    testSelection("a+b","{end}{shift}{home}", "{$}");
    testSelection("a+b","{end}{leftarrow}{shift}{home}", "{$b}");

    testSelection("a+math.sin(b)","{end}{shift}{home}", "{$}");
    testSelection("a+max(b,c)","{end}{shift}{home}", "{$}");
});

describe("Shift-End selects to the end", () => {
    testSelection("a+b","{home}{shift}{end}", "{$}");
    testSelection("a+b","{home}{rightarrow}{shift}{end}", "{a$}");

    testSelection("a+abs(b)","{home}{rightarrow}{shift}{end}", "{a$}");
    testSelection("a+math.sin(b)","{home}{rightarrow}{shift}{end}", "{a$}");
    testSelection("a+max(b,c)","{home}{rightarrow}{shift}{end}", "{a$}");
});
