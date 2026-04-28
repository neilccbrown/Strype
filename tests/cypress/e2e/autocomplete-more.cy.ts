require("cypress-terminal-report/src/installLogsCollector")();
import "@testing-library/cypress/add-commands";
// Get all the beforeEach parts:
import "../support/autocomplete-test-support";
import { checkExactlyOneItem, checkNoItems, focusEditorAC, scssVars, withAC} from "../support/autocomplete-test-support";

// Needed for the "be.sorted" assertion:
chai.use(require("chai-sorted"));
import failOnConsoleError from "cypress-fail-on-console-error";
failOnConsoleError();


describe("Control flow", () => {
    it("Offers auto-complete for return of input() function", () => {
        focusEditorAC();
        // Go up to functions section, add a function named "foo", a description "bar", then go into body:
        cy.get("body").type("{uparrow}ffoo{rightarrow}{rightarrow}bar{downarrow}");
        cy.get("body").type("=level=input('Choose a level between 1 and 6:'){downarrow}");
        cy.get("body").type("ilevel.");
        cy.wait(500);
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkNoItems(acIDSel, "<any>");
            checkExactlyOneItem(acIDSel, null, "lower()");
            checkExactlyOneItem(acIDSel, null, "upper()");
        }, true);
    });
});
