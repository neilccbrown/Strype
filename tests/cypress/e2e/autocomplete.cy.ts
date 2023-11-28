// eslint-disable-next-line @typescript-eslint/no-var-requires
require("cypress-terminal-report/src/installLogsCollector")();
import "@testing-library/cypress/add-commands";
// Needed for the "be.sorted" assertion:
// eslint-disable-next-line @typescript-eslint/no-var-requires
chai.use(require("chai-sorted"));


// Must clear all local storage between tests to reset the state:
beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit("/",  {onBeforeLoad: (win) => {
        win.localStorage.clear();
        win.sessionStorage.clear();
    }});
});

function withAC(inner : (acIDSel : string) => void) : void {
    // We need a delay to make sure last DOM update has occurred:
    cy.wait(200);
    cy.get("#editor").then((eds) => {
        const ed = eds.get()[0];
        // Find the auto-complete corresponding to the currently focused slot:
        const acIDSel = "#" + ed.getAttribute("data-slot-focus-id") + "_AutoCompletion";
        // Should always be sorted:
        checkAllSectionsInternallySorted(acIDSel);
        // Call the inner function:
        inner(acIDSel);
    });
}

function focusEditorAC(): void {
    // Not totally sure why this hack is necessary, I think it's to give focus into the webpage via an initial click:
    // (on the main code container frame -- would be better to retrieve it properly but the file won't compile if we use Apps.ts and/or the store)
    cy.get("#frame_id_-3").focus();
}

// Given a selector for the auto-complete and text for an item, checks that exactly one item with that text
// exists in the autocomplete
function checkExactlyOneItem(acIDSel : string, category: string | null, text : string) : void {
    cy.get(acIDSel + " .popupContainer " + (category == null ? "" : "div[data-title='" + category + "']")).within(() => {
        // Logging; useful in case of failure but we don't want it on by default:
        // cy.findAllByText(text, { exact: true}).each(x => cy.log(x.get()[0].id));
        cy.findAllByText(text, { exact: true}).should("have.length", 1);
    });
}

// Given a selector for the auto-complete and text for an item, checks that no items with that text
// exists in the autocomplete
function checkNoItems(acIDSel : string, text : string) : void {
    cy.get(acIDSel + " .popupContainer").within(() => cy.findAllByText(text, { exact: true}).should("not.exist"));
}

function checkAllSectionsInternallySorted(acIDSel: string) : void {
    cy.get(acIDSel + " .popupContainer ul > div").each((section) => {
        cy.wrap(section).find("li.popUpItems")
            .then((items) => [...items].map((item) => item.innerText.toLowerCase()))
            .should("be.sorted");
    });
}

const MYVARS = "My variables";
const MYFUNCS = "My functions";
const BUILTIN = "Python";
const IMPORTED = "Python";

describe("Built-ins", () => {
    it("Has built-ins, that narrow down when you type", () => {
        focusEditorAC();
        // Must wait for Brython to fully initialise:
        cy.wait(1000);
        // Add a function frame and trigger auto-complete:
        cy.get("body").type(" ");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel).should("be.visible");
            checkExactlyOneItem(acIDSel, BUILTIN, "abs");
            checkExactlyOneItem(acIDSel, BUILTIN, "ArithmeticError");
            // We had a previous bug with multiple sum items in microbit:
            checkExactlyOneItem(acIDSel, BUILTIN, "sum");
            checkExactlyOneItem(acIDSel, BUILTIN, "ZeroDivisionError");
            checkExactlyOneItem(acIDSel, BUILTIN, "zip");
            // Once we type "a", should show things beginning with A but not the others:
            cy.get("body").type("a");
            checkExactlyOneItem(acIDSel, BUILTIN, "abs");
            checkExactlyOneItem(acIDSel, BUILTIN, "ArithmeticError");
            checkNoItems(acIDSel, "ZeroDivisionError");
            checkNoItems(acIDSel, "zip");
            checkAllSectionsInternallySorted(acIDSel);
            // Once we type "b", should show things beginning with AB but not the others:
            cy.get("body").type("b");
            checkExactlyOneItem(acIDSel, BUILTIN, "abs");
            checkNoItems(acIDSel, "ArithmeticError");
            checkNoItems(acIDSel, "ZeroDivisionError");
            checkNoItems(acIDSel, "zip");
            checkAllSectionsInternallySorted(acIDSel);
            // Check docs are showing (for pure Python, at least):
            if (Cypress.env("mode") != "microbit") {
                cy.get(acIDSel).contains("Return the absolute value of the argument.");
            }
        });
    });
});

describe("Modules", () => {
    it("Offers auto-complete in import frames", () => {
        focusEditorAC();
        // Must wait for Brython to fully initialise:
        cy.wait(1000);
        // Go up to imports, add one, then trigger auto-complete:
        cy.get("body").type("{uparrow}{uparrow}i");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            if (Cypress.env("mode") == "microbit") {
                cy.get(acIDSel + " .popupContainer").should("be.visible");
                checkExactlyOneItem(acIDSel, null, "machine");
                checkExactlyOneItem(acIDSel, null, "microbit");
                checkExactlyOneItem(acIDSel, null, "random");
                checkExactlyOneItem(acIDSel, null, "time");
                checkNoItems(acIDSel, "uuid");
                // Once we type "m", should show things beginning with M but not the others:
                cy.get("body").type("m");
                cy.wait(500);
                checkExactlyOneItem(acIDSel, null, "machine");
                checkExactlyOneItem(acIDSel, null, "microbit");
                checkNoItems(acIDSel, "random");
                checkNoItems(acIDSel, "time");
                checkAllSectionsInternallySorted(acIDSel);
                // Once we type "i", should show things beginning with MI but not the others:
                cy.get("body").type("i");
                checkNoItems(acIDSel, "machine");
                checkExactlyOneItem(acIDSel, null, "microbit");
                checkNoItems(acIDSel, "random");
                checkNoItems(acIDSel, "time");
                checkAllSectionsInternallySorted(acIDSel);
            }
            else {
                cy.get(acIDSel + " .popupContainer").should("be.visible");
                checkExactlyOneItem(acIDSel, null, "antigravity");
                checkExactlyOneItem(acIDSel, null, "array");
                checkExactlyOneItem(acIDSel, null, "uuid");
                checkExactlyOneItem(acIDSel, null, "webbrowser");
                checkNoItems(acIDSel, "microbit");
                // Once we type "a", should show things beginning with A but not the others:
                cy.get("body").type("a");
                cy.wait(500);
                checkExactlyOneItem(acIDSel, null, "antigravity");
                checkExactlyOneItem(acIDSel, null, "array");
                checkNoItems(acIDSel, "uuid");
                checkNoItems(acIDSel, "webbrowser");
                checkAllSectionsInternallySorted(acIDSel);
                // Once we type "r", should show things beginning with AR but not the others:
                cy.get("body").type("r");
                checkNoItems(acIDSel, "antigravity");
                checkExactlyOneItem(acIDSel, null, "array");
                checkNoItems(acIDSel, "uuid");
                checkNoItems(acIDSel, "webbrowser");
                checkAllSectionsInternallySorted(acIDSel);
            }
        });
    });
    
    it("Offers auto-completion for imported modules", () => {
        if (Cypress.env("mode") == "microbit") {
            // This test is currently failing in microbit because we can't ask Skulpt for the contents
            // of imported modules.  It will need more work, so for now we skip it.
            // TODO make this work on microbit
            return;
        }
        
        focusEditorAC();
        // Must wait for Brython to fully initialise:
        cy.wait(1000);
        // Go up to imports and add an import frame:
        cy.get("body").type("{uparrow}{uparrow}i");
        cy.wait(500);
        // Trigger autocomplete, type "tim" then press enter to complete and right arrow to leave frame:
        cy.get("body").type("{ctrl} ");
        cy.get("body").type("tim");
        cy.get("body").type("{enter}{rightarrow}");
        // Back down to main body, add a function frame and type "time." then trigger auto-complete:
        cy.get("body").type("{downarrow}{downarrow}");
        cy.get("body").type(" time.{ctrl} ");
        withAC((acIDSel) => {
            // Microbit and Python have different items in the time module, so pick accordingly:
            const target = Cypress.env("mode") == "microbit" ? "ticks_add" : "gmtime";
            const nonAvailable = Cypress.env("mode") == "microbit" ? "gmtime" : "ticks_add";
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            // Should have time related queries, but not the standard completions:
            checkExactlyOneItem(acIDSel, null, target);
            checkNoItems(acIDSel, nonAvailable);
            checkExactlyOneItem(acIDSel, null, "sleep");
            checkNoItems(acIDSel, "abs");
            checkNoItems(acIDSel, "ArithmeticError");
            // Type first letter of the target:
            cy.get("body").type(target.at(0) || "");
            checkExactlyOneItem(acIDSel, null, target);
            checkNoItems(acIDSel, "sleep");
            checkNoItems(acIDSel, "abs");
            checkNoItems(acIDSel, "ArithmeticError");
            checkAllSectionsInternallySorted(acIDSel);
        });
    });

    it("Offers auto-completion for imported modules with a from import *", () => {
        focusEditorAC();
        // Must wait for Brython to fully initialise:
        cy.wait(1000);
        // Go up to the imports and add a "from..import.." frame
        cy.get("body").type("{uparrow}{uparrow}f");
        cy.wait(500);
        // Trigger autocomplete (in first section), type "tim" and hit enter to auto-complete, then right arrow to go across to the second part of the frame:
        cy.get("body").type("{ctrl} ");
        cy.get("body").type("tim");
        cy.get("body").type("{enter}{rightarrow}");
        // Put * in the second bit, then back down to main section, make a function frame and hit auto-complete:
        cy.get("body").type("*{rightarrow}");
        cy.get("body").type("{downarrow}{downarrow}");
        cy.get("body").type(" {ctrl} ");
        withAC((acIDSel) => {
            // Microbit and Python have different items in the time module, so pick accordingly:
            const target = Cypress.env("mode") == "microbit" ? "ticks_add" : "gmtime";
            const nonAvailable = Cypress.env("mode") == "microbit" ? "gmtime" : "ticks_add";
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            // Should have time related queries, but not the standard completions:
            checkExactlyOneItem(acIDSel, IMPORTED, target);
            checkNoItems(acIDSel, nonAvailable);
            checkExactlyOneItem(acIDSel, IMPORTED, "sleep");
            checkExactlyOneItem(acIDSel, IMPORTED, "abs");
            checkExactlyOneItem(acIDSel, IMPORTED, "ArithmeticError");
            cy.get("body").type(target.at(0) || "");
            checkExactlyOneItem(acIDSel, IMPORTED, target);
            checkNoItems(acIDSel, "sleep");
            checkNoItems(acIDSel, "abs");
            checkNoItems(acIDSel, "ArithmeticError");
            checkAllSectionsInternallySorted(acIDSel);
        });
    });
});
describe("User-defined items", () => {
    it("Offers auto-complete for user-defined functions", () => {
        focusEditorAC();
        // Must wait for Brython to fully initialise:
        cy.wait(1000);
        // Go up to functions section, add a function named "foo" then come back down and make a function call frame:
        cy.get("body").type("{uparrow}ffoo{downarrow}{downarrow}{downarrow} ");
        cy.wait(500);
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            checkExactlyOneItem(acIDSel, MYFUNCS, "foo");
        });
    });

    it("Offers auto-complete for user-defined variables", () => {
        focusEditorAC();
        // Must wait for Brython to fully initialise:
        cy.wait(1000);
        // Make an assignment frame that says "myVar=23", then make a function call frame beneath:
        cy.get("body").type("=myVar=23{enter} ");
        cy.wait(500);
        // Trigger auto-completion:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            checkExactlyOneItem(acIDSel, MYVARS, "myVar");
        });
    });

    it("Offers auto-complete for items on user-defined variables", () => {
        focusEditorAC();
        // Must wait for Brython to fully initialise:
        cy.wait(1000);
        // Make an assignment frame myVar="hi" then add a function call frame beneath with "myVar."
        cy.get("body").type("=myVar=\"hi{enter} myVar.");
        cy.wait(500);
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            checkExactlyOneItem(acIDSel, "myVar", "lower");
            checkExactlyOneItem(acIDSel, "myVar", "upper");
            checkNoItems(acIDSel, "divmod");
            cy.get("body").type("u");
            checkNoItems(acIDSel, "lower");
            checkExactlyOneItem(acIDSel, "myVar", "upper");
            checkNoItems(acIDSel, "divmod");
            checkAllSectionsInternallySorted(acIDSel);
        });
    });

    it("Offers auto-complete for user-defined variables but not before declaration", () => {
        focusEditorAC();
        // Must wait for Brython to fully initialise:
        cy.wait(1000);
        // Make an assignment frame with myVar=23, then go before it and add a function call frame:
        cy.get("body").type("=myVar=23{enter}{uparrow} ");
        cy.wait(500);
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            checkExactlyOneItem(acIDSel, BUILTIN, "abs");
            checkNoItems(acIDSel, "myVar");
        });
    });
});
