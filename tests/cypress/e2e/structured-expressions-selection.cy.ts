// eslint-disable-next-line @typescript-eslint/no-var-requires
require("cypress-terminal-report/src/installLogsCollector")();
import failOnConsoleError from "cypress-fail-on-console-error";
import {assertState, focusEditor} from "../support/expression-test-support";

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
        if (!selection || selection.rangeCount === 0) {
            cy.log("No selection found to extend (text item not focused?)");
            return;
        }

        // Find the top-level label-slot-structure container
        const containerSelector = ".label-slot-structure";
        const container = doc.activeElement == null ? null : doc.activeElement.closest(containerSelector);
        if (!container || !(container as HTMLElement).isContentEditable) {
            cy.log(`Could not find contenteditable container with selector: ${containerSelector} starting from ${doc.activeElement?.id}, found ${container} [${container?.id}] with ${(container as HTMLElement)?.isContentEditable}`);
            return;
        }
        
        // For collapsed selection (no text selected yet)
        if (selection.isCollapsed) {
            // Find the next position (potentially across nodes)
            const nextPosition = findNextPosition(selection.focusNode, selection.focusOffset, container);

            if (nextPosition) {
                // Set the selection from current position to the next character
                selection.collapse(selection.focusNode, selection.focusOffset);
                selection.extend(nextPosition.node, nextPosition.offset);
            }
        }
        else {
            if (!selection.anchorNode) {
                return;
            }
            
            // For existing selection, just move the focus point
            const focusNode = selection.focusNode;
            const focusOffset = selection.focusOffset;

            const nextPosition = findNextPosition(focusNode, focusOffset, container);
            if (nextPosition) {
                selection.extend(nextPosition.node, nextPosition.offset);
            }
        }
    });
});

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignorecommand
Cypress.Commands.add("extendSelectionLeft", () => {
    cy.document().then((doc: Document) => {
        const selection: Selection | null = doc.getSelection();
        if (!selection || selection.rangeCount === 0) {
            cy.log("No selection found to extend (text item not focused?)");
            return;
        }

        // Find the label-slot-structure container
        const containerSelector = ".label-slot-structure";
        const container = doc.activeElement == null ? null : doc.activeElement.closest(containerSelector);
        if (!container || !(container as HTMLElement).isContentEditable) {
            cy.log(`Could not find contenteditable container with selector: ${containerSelector}`);
            return;
        }

        // For collapsed selection (no text selected yet)
        if (selection.isCollapsed) {
            // Find the previous position (potentially across nodes)
            const previousPosition = findPreviousPosition(selection.focusNode, selection.focusOffset, container);

            if (previousPosition) {
                // Create selection from current to previous position
                selection.collapse(selection.anchorNode, selection.anchorOffset);
                selection.extend(previousPosition.node, previousPosition.offset);
            }
        }
        else {
            if (!selection.anchorNode) {
                return;
            }
            
            // For existing selection, just move the focus point
            const focusNode = selection.focusNode;
            const focusOffset = selection.focusOffset;

            // Forward selection (anchor on left, focus on right)
            // Move the focus (right side) to the left
            const previousPosition = findPreviousPosition(focusNode, focusOffset, container);
            if (previousPosition) {
                selection.extend(previousPosition.node, previousPosition.offset);
            }
        }
    });
});

// Helper function to check if a node is inside a contenteditable element
function isNodeEditableText(node: Node | null): boolean {
    if (!node || node.nodeType !== Node.TEXT_NODE) {
        return false;
    }

    // Check if the nearest element ancestors is contenteditable
    let current: Node | null = node;
    while (current) {
        if (current.nodeType === Node.ELEMENT_NODE) {
            const element = current as HTMLElement;
            if (element.isContentEditable) {
                return true;
            }
            else {
                return false;
            }
        }
        current = current.parentNode;
    }
    return false;
}

// Kept for investigating test failures:
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getPathToNode(node : Node | null): string {
    const path = [];

    while (node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const nodeEl = node as Element;
            if (nodeEl.id) {
                path.unshift(`#${nodeEl.id}`);
            }
            else {
                path.unshift(nodeEl.tagName.toLowerCase());
            }
        }

        node = node.parentElement;
    }

    return path.join(" > ");
}


/**
 * Finds the position one character to the left of the given node/offset
 * Works across node boundaries in a nested contenteditable structure
 * Only selects within contenteditable elements
 */
function findPreviousPosition(node: Node | null, offset: number, container: Element): { node: Node, offset: number } | null {
    if (!node) {
        return null;
    }

    // Case 1: We can simply move left within the current text node
    if (node.nodeType === Node.TEXT_NODE && offset > 0 && isNodeEditableText(node)) {
        return { node, offset: offset - 1 };
    }

    // Case 2: We're at the beginning of a text node or at an element node

    // Create a TreeWalker to navigate text nodes within the container
    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // Only accept nodes that are within contenteditable elements
                return isNodeEditableText(node)
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
            },
        } as NodeFilter
    );

    // Position the walker at our current node (or as close as possible)
    let currentNode = node;
    if (node.nodeType !== Node.TEXT_NODE) {
        // If we're at an element node, find the closest text node
        if (offset > 0 && node.childNodes.length > 0) {
            // We're between child nodes, get the child before the offset
            currentNode = node.childNodes[offset - 1];
        }
    }

    let found = false;
    let previousTextNode: Node | null = null;

    // Try to find our current position in the tree
    while (walker.nextNode()) {
        if (walker.currentNode === currentNode) {
            found = true;
            break;
        }
        previousTextNode = walker.currentNode;
    }

    // If we found our node and we're at its start, return the end of previous text node
    if (found && offset === 0 && previousTextNode) {
        return {
            node: previousTextNode,
            offset: previousTextNode.textContent?.length || 0,
        };
    }

    // If we didn't find our exact node but have a previous text node
    if (!found && previousTextNode) {
        // This handles the case when we're at an element node
        return {
            node: previousTextNode,
            offset: previousTextNode.textContent?.length || 0,
        };
    }

    // Couldn't find a previous position
    return null;
}

/**
 * Finds the position one character to the right of the given node/offset
 * Works across node boundaries in a nested contenteditable structure
 * Only selects within contenteditable elements
 */
function findNextPosition(node: Node | null, offset: number, container: Element): { node: Node, offset: number } | null {
    if (!node) {
        return null;
    }

    // Case 1: We can simply move right within the current text node
    if (node.nodeType === Node.TEXT_NODE &&
        node.textContent &&
        offset < node.textContent.length &&
        isNodeEditableText(node)) {
        return { node, offset: offset + 1 };
    }

    // Case 2: We're at the end of a text node or at an element node

    // Create a TreeWalker to navigate text nodes within the container
    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // Only accept nodes that are within contenteditable elements
                return isNodeEditableText(node)
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
            },
        } as NodeFilter
    );

    // Position the walker at our current node (or as close as possible)
    let currentNode = node;
    if (node.nodeType !== Node.TEXT_NODE) {
        // If we're at an element node, find the closest text node
        if (offset < node.childNodes.length) {
            // We're between child nodes, get the child at the offset
            currentNode = node.childNodes[offset];
        }
    }

    let found = false;

    // Try to find our current position in the tree
    while (walker.nextNode()) {
        if (walker.currentNode === currentNode) {
            found = true;
            break;
        }
    }

    // If we found our node and we're at its end, get the next text node
    if (found && node.nodeType === Node.TEXT_NODE &&
        node.textContent && offset >= node.textContent.length) {
        if (walker.nextNode()) {
            return { node: walker.currentNode, offset: 0 };
        }
    }

    // If we're at an element node or we didn't find our exact node
    if (!found || node.nodeType !== Node.TEXT_NODE) {
        // Reset the walker and find the next editable text node
        walker.currentNode = node;

        if (walker.nextNode()) {
            return { node: walker.currentNode, offset: 0 };
        }
    }

    // Couldn't find a next position
    return null;
}

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

function testSelectionBoth(code: string, startIndex: number, endIndex: number, thenType: string, expectedAfter : string) : void {
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
    testSelectionBoth("neighbour", 2, 5, "fax", "{nefax$bour}");
    testSelectionBoth("neighbour", 2, 5, " ", "{ne $bour}");
    // Invalid entry but should still delete the selection, and replace with nothing:
    testSelectionBoth("neighbour", 2, 5, ")", "{ne$bour}");

    // Replace with operator:
    testSelectionBoth("neighbour", 2, 5, "+", "{ne}+{$bour}");
    testSelectionBoth("neighbour", 2, 5, ".", "{ne}.{$bour}");

    // Surround with brackets:
    testSelectionBoth("neighbour", 5, 9, "(", "{neigh}_({$bour})_{}");
    testSelectionBoth("neighbour(xyz)", 5, 9, "(", "{neigh}_({$bour})_{}_({xyz})_{}");
    
    // Multidim brackets by closing:
    testSelectionBoth("fax(neighbour)", 6, 9, ")", "{fax}_({ne})_{}_({$bour})_{}");
    testSelectionBoth("fax(neighbour)", 1, 3, ")", "{f}_({$})_{}_({neighbour})_{}");
    
    // Numbers:
    testSelectionBoth("123456", 2, 4, "+", "{12}+{$56}");
    testSelectionBoth("123456", 2, 4, "-", "{12}-{$56}");
    testSelectionBoth("123456", 2, 4, "e", "{12e$56}");
    testSelectionBoth("123456", 2, 4, ".", "{12.$56}");

    // Turn into a number slot by replacement:
    testSelectionBoth("abc123", 0, 3, "+", "{+$123}");
    testSelectionBoth("abc123", 0, 3, "-", "{-$123}");
    testSelectionBoth("abc123", 0, 3, "*", "{}*{$123}");
});

describe("Selecting then typing in multiple slots", () => {
    // Note that because of Cypress not being able to send shift-left/right in a way
    // that the browser handles to move selection, we are moving our own selection.
    // Thus some selections are possible (e.g. across brackets) for us to set
    // that would not be allowed in Strype (e.g. selecting across multiple bracketing levels)
    // So we just don't make those selections; we can't test that those are banned
    // programmatically.
    testSelectionBoth("123+456", 2,5, "0", "{120$56}");
    testSelectionBoth("123+456", 2,5, ".", "{12.$56}");
    testSelectionBoth("123+456", 2,5, "*", "{12}*{$56}");
    
    testSelectionBoth("123+456", 2,5, "(", "{12}_({3}+{4})_{$56}");
});

describe("Selecting then deleting in multiple slots", () => {
    testSelectionBoth("123+456", 2,5, "{del}", "{12$56}");
    testSelectionBoth("123+456", 2,5, "{backspace}", "{12$56}");
});

// TODO also test copy, and paste, with multi-slot selection
