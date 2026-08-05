import { standardBeforeEach, strypeElIds } from "../support/standard-setup";

require("cypress-terminal-report/src/installLogsCollector")();
import failOnConsoleError from "cypress-fail-on-console-error";
failOnConsoleError();

import {testInsert, testInsertExisting, focusEditor, assertState} from "../support/expression-test-support";
import {pressFrameShortcut} from "../support/test-support";

// Must clear all local storage between tests to reset the state, and set the 'paste' command:
beforeEach(standardBeforeEach);

describe("Test colon overtyping", () => {
    // Typing ":" at the very end of the (only, top-level) slot of an if-frame's condition should be treated
    // as overtyping the frame's own " :" label, i.e. it should not be inserted and the cursor should leave
    // the slot instead (so there is no "$" left inside the condition's content):
    testInsert("x:", "{x}", false);

    // Typing ":" part-way through a slot (not at the end) should just insert a literal ":" character:
    testInsertExisting("ab$c", ":", "{ab}:{$c}");

    // Typing ":" at the end of a slot that is nested inside brackets (i.e. not at the top level) should
    // just insert a literal ":" character, even though it is the last slot within those brackets:
    it("Does not overtype the colon inside brackets", () => {
        focusEditor();
        pressFrameShortcut("i");
        assertState("{$}");
        cy.get("body").type("(x:");
        assertState("{}_({x}:{$})_{}");
    });

    // Typing ")" to overtype the closing bracket of a function definition's parameter list moves the
    // cursor into the docs field (following the "):" label). Since the user has therefore effectively
    // already "typed" the colon that ends the def line, a ":" typed as the very first character of the
    // docs field is discarded rather than inserted:
    it("Discards a colon typed at the start of a function definition's docs field", () => {
        focusEditor();
        pressFrameShortcut("d");
        // "(x)" : the "(" auto-inserts the closing ")", "x" is the parameter name, and the final ")"
        // overtypes the auto-inserted one, moving the cursor into the docs field:
        cy.get("body").type("foo(x)");
        cy.get("body").type(":Explanation");
        cy.get("#" + strypeElIds.getEditorID()).then((eds) => {
            const focusId = eds.get()[0].getAttribute("data-slot-focus-id") || "";
            cy.get("#" + focusId.replaceAll(",", "\\,")).should("have.text", "Explanation");
        });
    });

    // Same as above, but for a class definition's docs field:
    it("Discards a colon typed at the start of a class definition's docs field", () => {
        focusEditor();
        pressFrameShortcut("c");
        cy.get("body").type("Foo{rightarrow}");
        cy.get("body").type(":Explanation");
        cy.get("#" + strypeElIds.getEditorID()).then((eds) => {
            const focusId = eds.get()[0].getAttribute("data-slot-focus-id") || "";
            cy.get("#" + focusId.replaceAll(",", "\\,")).should("have.text", "Explanation");
        });
    });
});
