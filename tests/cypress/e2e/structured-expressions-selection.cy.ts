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
    }}).then(() => {
        // The Strype IDs and CSS class names aren't directly used in the test
        // but they are used in the support file, so we make them available.
        cy.initialiseSupportStrypeGlobals();
    });
});

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
Cypress.Commands.add("assertValueCopiedToClipboard", (value) => {
    cy.window().its("navigator.clipboard")
        .invoke("readText").should("equal", value);
});

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
Cypress.Commands.add("extendSelectionRight", () => {
    cy.document().then((doc: Document) => {
        const selection: Selection | null = doc.getSelection();
        const activeElement: Element | null = doc.activeElement;

        // Check if we're in a text input or contenteditable element
        const isEditableElement = Boolean(
            activeElement && (activeElement as HTMLElement).isContentEditable
        );

        if (!isEditableElement) {
            cy.log("No editable element is focused");
            return;
        }

        // Get current positions
        let currentPos: number;
        let text: string;

        if ((activeElement as HTMLElement).isContentEditable && selection && selection.rangeCount > 0) {
            // Handle contenteditable elements
            const range: Range = selection.getRangeAt(0);
            currentPos = range.endOffset;

            // Get text node where selection ends
            const container: Node = range.endContainer;
            text = container.textContent || "";

            // If there's no selection, create one
            if (range.collapsed) {
                // Create a new range for a single character
                if (currentPos < text.length) {
                    cy.log("Setting initial: 1 + " + currentPos);
                    range.setEnd(container, currentPos + 1);
                }
            }
            else {
                // Extend existing selection
                if (currentPos < text.length) {
                    cy.log("Extending to: 1 + " + currentPos);
                    range.setEnd(container, currentPos + 1);
                }
            }

            // Apply the new selection
            selection.removeAllRanges();
            selection.addRange(range);
        }
    });
});

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignorecommand
Cypress.Commands.add("extendSelectionLeft", () => {
    cy.document().then((doc: Document) => {
        const selection: Selection | null = doc.getSelection();
        const activeElement: Element | null = doc.activeElement;

        // Check if we're in a contenteditable element
        const isContentEditable = Boolean(
            activeElement && (activeElement as HTMLElement).isContentEditable
        );

        if (!isContentEditable) {
            cy.log("No contenteditable element is focused");
            return;
        }

        if (selection && selection.rangeCount > 0) {
            // Get the current position information
            const focusNode = selection.focusNode;
            const focusOffset = selection.focusOffset;

            // If there's no selection (collapsed), create one
            if (selection.isCollapsed) {
                if (focusNode && focusOffset > 0) {
                    // Create a selection one character to the left
                    // First, set the caret position
                    selection.collapse(focusNode, focusOffset);

                    // Then extend one character to the left
                    // This keeps the anchor at the current position and moves the focus
                    selection.extend(focusNode, focusOffset - 1);
                }
            } else {
                // For existing selections, we just need to extend the focus
                if (focusNode && focusOffset > 0) {
                    // The extend method moves the focus point while keeping the anchor fixed
                    selection.extend(focusNode, focusOffset - 1);
                }
            }
        }
    });
});

import {assertState, focusEditor} from "../support/expression-test-support";

function testSelection(code : string, startIndex: number, endIndex: number, secondEntry : string, expectedAfter : string) : void {
    it("Tests selecting in " + code + " from " + startIndex + " to " + endIndex + " then " + secondEntry, () => {
        focusEditor();
        cy.get("body").type("{backspace}{backspace}i");
        assertState("{$}");
        cy.get("body").type(" " + code);
        cy.get("body").type("{home}" + "{rightarrow}".repeat(startIndex));
        while (startIndex < endIndex) {
            (cy as any).extendSelectionRight();
            startIndex += 1;
        }
        while (endIndex < startIndex) {
            (cy as any).extendSelectionLeft();
            startIndex -= 1;
        }
        cy.wait(500);
        cy.get("body").type(secondEntry);
        assertState(expectedAfter);
    });
}

function testSelectionThenDelete(code : string, selectKeys: string, expectedAfterDeletion : string) : void {
    it("Tests selecting and deleting in " + code, () => {
        focusEditor();
        cy.get("body").type("{backspace}{backspace}i");
        assertState("{$}");
        cy.get("body").type(" " + code);
        cy.get("body").type(selectKeys);
        cy.get("body").type("{del}");
        assertState(expectedAfterDeletion);
    });
}

function testSelectionByIndices(code: string, startIndex: number, endIndex: number, thenType: string, expectedAfter : string) : void {
    // Test selecting from start to end:
    testSelection(code, startIndex, endIndex, thenType, expectedAfter);
    // Then end to start:
    testSelection(code, endIndex, startIndex, thenType, expectedAfter);
}

describe("Shift-Home selects to the beginning", () => {
    testSelectionThenDelete("a+b","{end}{shift}{home}", "{$}");
    testSelectionThenDelete("a+b","{end}{leftarrow}{shift}{home}", "{$b}");

    testSelectionThenDelete("a+math.sin(b)","{end}{shift}{home}", "{$}");
    testSelectionThenDelete("a+max(b,c)","{end}{shift}{home}", "{$}");
});

describe("Shift-End selects to the end", () => {
    testSelectionThenDelete("a+b","{home}{shift}{end}", "{$}");
    testSelectionThenDelete("a+b","{home}{rightarrow}{shift}{end}", "{a$}");

    testSelectionThenDelete("a+abs(b)","{home}{rightarrow}{shift}{end}", "{a$}");
    testSelectionThenDelete("a+math.sin(b)","{home}{rightarrow}{shift}{end}", "{a$}");
    testSelectionThenDelete("a+max(b,c)","{home}{rightarrow}{shift}{end}", "{a$}");
});

describe("Selecting then typing in one slot", () => {
    // Words mainly chosen to avoid having duplicate characters, to help
    // see more easily if something went wrong, and what:
    testSelectionByIndices("neighbour", 2, 5, "fax", "{nefax$bour}");
    testSelectionByIndices("neighbour", 2, 5, " ", "{ne $bour}");
    // Invalid entry but should still delete the selection, and replace with nothing:
    testSelectionByIndices("neighbour", 2, 5, ")", "{ne$bour}");

    // Replace with operator:
    testSelectionByIndices("neighbour", 2, 5, "+", "{ne}+{$bour}");
    testSelectionByIndices("neighbour", 2, 5, "+", "{ne}.{$bour}");

    // Surround with brackets:
    testSelectionByIndices("neighbour", 5, 9, "(", "{neigh}_({$bour})_{}");
    testSelectionByIndices("neighbour(xyz)", 5, 9, "(", "{neigh}_({$bour})_{}_({xyz})_{}");
    
    // Multidim brackets by closing:
    testSelectionByIndices("fax(neighbour)", 6, 9, ")", "{fax}_({ne})_{}_({$bour})_{}");
    testSelectionByIndices("fax(neighbour)", 1, 3, ")", "{f}_({$})_{}_({neighbour})_{}");
    
    // Numbers:
    testSelectionByIndices("123456", 2, 4, "+", "{12}+{$56}");
    testSelectionByIndices("123456", 2, 4, "-", "{12}-{$56}");
    testSelectionByIndices("123456", 2, 4, "e", "{12e$56}");
    testSelectionByIndices("123456", 2, 4, ".", "{12.$56}");

    // Turn into a number slot by replacement:
    testSelectionByIndices("abc123", 0, 3, "+", "{+$123}");
    testSelectionByIndices("abc123", 0, 3, "-", "{-$123}");
    testSelectionByIndices("abc123", 0, 3, "*", "{}*{$123}");
});
