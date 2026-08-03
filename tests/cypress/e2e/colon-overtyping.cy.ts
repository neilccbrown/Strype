import { standardBeforeEach } from "../support/standard-setup";

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
});
