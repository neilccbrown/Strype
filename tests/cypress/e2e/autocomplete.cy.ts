// eslint-disable-next-line @typescript-eslint/no-var-requires
require("cypress-terminal-report/src/installLogsCollector")();
import "@testing-library/cypress/add-commands";
import "../support/autocomplete-test-support";
import {BUILTIN, MYFUNCS, MYVARS, checkAutocompleteSorted, checkExactlyOneItem, checkNoItems, checkNoneAvailable, focusEditorAC, withAC, assertState, scssVars} from "../support/autocomplete-test-support";

// Needed for the "be.sorted" assertion:
// eslint-disable-next-line @typescript-eslint/no-var-requires
chai.use(require("chai-sorted"));
import failOnConsoleError from "cypress-fail-on-console-error";
failOnConsoleError();


describe("Built-ins", () => {
    it("Has built-ins, that narrow down when you type", () => {
        focusEditorAC();
        // Add a function frame and trigger auto-complete:
        cy.get("body").type(" ");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel).should("be.visible");
            checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
            checkExactlyOneItem(acIDSel, BUILTIN, "AssertionError()");
            // We had a previous bug with multiple sum items in microbit:
            checkExactlyOneItem(acIDSel, BUILTIN, "sum(iterable)");
            checkExactlyOneItem(acIDSel, BUILTIN, "ZeroDivisionError()");
            checkExactlyOneItem(acIDSel, BUILTIN, "zip()");
            checkNoItems(acIDSel, "__name__");
            // Once we type "a", should show things beginning with A but not the others:
            cy.get("body").type("a");
            cy.wait(600);
            checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
            checkExactlyOneItem(acIDSel, BUILTIN, "AssertionError()");
            checkNoItems(acIDSel, "ZeroDivisionError");
            checkNoItems(acIDSel, "zip");
            checkAutocompleteSorted(acIDSel, true);
            // Once we type "b", should show things beginning with AB but not the others:
            cy.get("body").type("b");
            cy.wait(600);
            checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
            checkNoItems(acIDSel, "AssertionError");
            checkNoItems(acIDSel, "ZeroDivisionError");
            checkNoItems(acIDSel, "zip");
            checkAutocompleteSorted(acIDSel, true);
            // Check docs are showing for built-in function:
            cy.get(acIDSel).contains("Return the absolute value of the argument.");
            
            // Now complete and check content:
            cy.get("body").type("s");
            cy.wait(600);

            cy.get("body").type("{enter}");
            assertState(frameId, "abs($)", "abs(x)");
        }, true);
    });
    it("Shows text when no documentation available", () => {
        focusEditorAC();
        // Add a function frame and trigger auto-complete:
        const targetNoDocs = Cypress.env("mode") === "microbit" ? "ellipsis" : "buffer";
        cy.get("body").type(" " + targetNoDocs);
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel).should("be.visible");
            // buffer is a Skulpt-only function with no documentation available:
            // ellipsis is a type with no docs
            
            checkExactlyOneItem(acIDSel, BUILTIN, targetNoDocs + (Cypress.env("mode") === "microbit" ? "()" : ""));
            cy.get("body").type("{downarrow}");
            // Check docs are showing even though there's no documentation:
            const acIDDoc = acIDSel.replace("#", "#popupAC").replace("_AutoCompletion", "documentation");
            cy.get(acIDDoc).should("be.visible");
            cy.get(acIDDoc).contains("No documentation available");
        }, true);
    });
});

// This is the Python version:
//const UPPER_DOC = "Return a copy of the string converted to uppercase.";
// but TigerPython has its own:
const UPPER_DOC = "Return a copy of the string with all the cased characters converted to uppercase.";

describe("Behaviour with operators, brackets and complex expressions", () => {
    const prefixesWhichShouldShowBuiltins = ["0+", "1.6-", "not ", "1**(2+6)", "[a,", "array[", "~", "(1*", "{3:"];
    const prefixesWhichShouldShowStringMembers = ["\"a\".", "'a'.upper().", "myString.", "(\"a\").", "(\"a\".upper()).", "[\"a\"][0]."];
    const prefixesWhichShouldShowNone = ["z..", "123", "123.", "\"", "\"abc", "\"abc.", "'", "totally_unique_stem", "nonexistentvariable."];

    for (const prefix of prefixesWhichShouldShowBuiltins) {
        it("Shows built-ins, if you autocomplete after " + prefix, () => {
            focusEditorAC();
            // Add a function frame and trigger auto-complete:
            cy.get("body").type(" ");
            cy.wait(500);
            cy.get("body").type(prefix);
            cy.wait(500);
            cy.get("body").type("{ctrl} ");
            withAC((acIDSel) => {
                cy.get(acIDSel).should("be.visible");
                checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
                checkExactlyOneItem(acIDSel, BUILTIN, "AssertionError()");
                // We had a previous bug with multiple sum items in microbit:
                checkExactlyOneItem(acIDSel, BUILTIN, "sum(iterable)");
                checkExactlyOneItem(acIDSel, BUILTIN, "ZeroDivisionError()");
                checkExactlyOneItem(acIDSel, BUILTIN, "zip()");
                checkNoItems(acIDSel, "__name__");
                // Once we type "a", should show things beginning with A but not the others:
                cy.get("body").type("a");
                cy.wait(600);
                checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
                checkExactlyOneItem(acIDSel, BUILTIN, "AssertionError()");
                checkNoItems(acIDSel, "ZeroDivisionError");
                checkNoItems(acIDSel, "zip");
                checkAutocompleteSorted(acIDSel, true);
                // Once we type "b", should show things beginning with AB but not the others:
                cy.get("body").type("b");
                cy.wait(600);
                checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
                checkNoItems(acIDSel, "AssertionError");
                checkNoItems(acIDSel, "ZeroDivisionError");
                checkNoItems(acIDSel, "zip");
                checkAutocompleteSorted(acIDSel, true);
                // Check docs are showing for built-in function:
                cy.get(acIDSel).contains("Return the absolute value of the argument.");
            }, true);
        });
    }

    for (const prefix of prefixesWhichShouldShowStringMembers) {
        it("Shows string members, if you autocomplete after " + prefix, () => {
            focusEditorAC();
            // Add a function frame (after the default line assigning to myString) and trigger auto-complete:
            cy.get("body").type("{downarrow} ");
            cy.wait(500);
            cy.get("body").type(prefix);
            cy.wait(500);
            cy.get("body").type("{ctrl} ");
            withAC((acIDSel) => {
                cy.get(acIDSel).should("be.visible");
                checkExactlyOneItem(acIDSel, null, "lower()");
                checkExactlyOneItem(acIDSel, null, "upper()");
                checkNoItems(acIDSel, "divmod");
                cy.get("body").type("u");
                cy.wait(600);
                checkNoItems(acIDSel, "lower");
                checkExactlyOneItem(acIDSel, null, "upper()");
                checkNoItems(acIDSel, "divmod");
                checkAutocompleteSorted(acIDSel, true);
                // Check docs show:
                cy.get("body").type("pper");
                cy.get(acIDSel).contains(UPPER_DOC);
            }, true);
        });
    }

    for (const prefix of prefixesWhichShouldShowNone) {
        it("Shows no completions, if you autocomplete after " + prefix, () => {
            focusEditorAC();
            // Add a function frame and trigger auto-complete:
            cy.get("body").type(" ");
            cy.wait(500);
            cy.get("body").type(prefix);
            cy.wait(500);
            cy.get("body").type("{ctrl} ");
            withAC((acIDSel) => {
                cy.get(acIDSel).should("be.visible");
                checkNoneAvailable(acIDSel);
                checkNoItems(acIDSel, "abs(x)");
                checkNoItems(acIDSel, "AssertionError");
                checkNoItems(acIDSel, "ZeroDivisionError");
                checkNoItems(acIDSel, "zip");
            }, true, true);
        });
    }
});

describe("User-defined items", () => {
    it("Offers auto-complete for user-defined functions", () => {
        focusEditorAC();
        // Go up to functions section, add a function named "foo" then come back down and make a function call frame:
        cy.get("body").type("{uparrow}ffoo{downarrow}{downarrow}{downarrow} ");
        cy.wait(500);
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, MYFUNCS, "foo()");
            cy.get("body").type("foo");
            cy.wait(600);
            cy.get("body").type("{enter}");
            assertState(frameId, "foo($)");
        }, true);
    });

    it("Offers auto-complete for user-defined variables", () => {
        focusEditorAC();
        // Make an assignment frame that says "myVar=23", then make a function call frame beneath:
        cy.get("body").type("=myVar=23{enter} ");
        cy.wait(500);
        // Trigger auto-completion:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, MYVARS, "myVar");
            // Not a function, so shouldn't show brackets:
            checkNoItems(acIDSel, "myVar()");
        }, true);
    });

    it("Offers auto-complete for user-defined function parameters", () => {
        focusEditorAC();
        // Make a function frame with "foo(myParam)" 
        // then make a function call frame inside:
        cy.get("body").type("{uparrow}ffoo(myParam{rightarrow} ");
        // Trigger auto-completion:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, MYVARS, "myParam");
            // Go out of this call and into the main body:
            cy.get("body").type("{backspace}");
            cy.wait(500);
            cy.get("body").type("{downarrow}{downarrow}");
        }, true);
        // Make a function call and check myParam doesn't show there:
        cy.get("body").type(" {ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkNoItems(acIDSel, "myParam", true);
        }, true);
    });

    it("Offers auto-complete for for-loop iterating variables", () => {
        focusEditorAC();
        // Make a for loop:
        cy.get("body").type("fmyIterator{rightarrow}imaginaryList{rightarrow}");
        // Trigger auto-completion in a new function call frame:
        cy.get("body").type(" {ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, MYVARS, "myIterator");
            checkNoItems(acIDSel, "imaginaryList");
            // Go out of this call and beneath the loop:
            cy.get("body").type("{backspace}");
            cy.wait(500);
            cy.get("body").type("{downarrow}");
        }, true);
        // Make a function call and check myIterator shows there -- Python semantics
        // are that the loop variable is available after the loop:
        cy.get("body").type(" {ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, MYVARS, "myIterator");
            checkNoItems(acIDSel, "imaginaryList");
        }, true);
    });

    it("Offers auto-complete for items on user-defined variables", () => {
        focusEditorAC();
        // Make an assignment frame myVar="hi" then add a function call frame beneath with "myVar."
        cy.get("body").type("=myVar=\"hi{enter} myVar.");
        cy.wait(500);
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, "myVar", "lower()");
            checkExactlyOneItem(acIDSel, "myVar", "upper()");
            checkNoItems(acIDSel, "divmod");
            cy.get("body").type("u");
            cy.wait(600);
            checkNoItems(acIDSel, "lower");
            checkExactlyOneItem(acIDSel, "myVar", "upper()");
            checkNoItems(acIDSel, "divmod");
            checkAutocompleteSorted(acIDSel, true);
            // Check docs show:
            cy.get("body").type("pper");
            cy.get(acIDSel).contains(UPPER_DOC);
        }, true);
    });

    it("Offers auto-complete for user-defined variables but not before declaration", () => {
        focusEditorAC();
        // Make an assignment frame with myVar=23, then go before it and add a function call frame:
        cy.get("body").type("=myVar=23{enter}{uparrow} ");
        cy.wait(500);
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
            checkNoItems(acIDSel, "myVar");
        }, true);
    });
});


describe("Control flow", () => {
    it("Shows autocomplete when in a try", () => {
        // There was a bug where if you autocompleted inside a try, it would be missing
        // any of the following frames (even if they were present in the code)

        focusEditorAC();
        // Go down then add a try then a print then a method call on myString.: 
        cy.get("body").type("{downarrow}{downarrow}tpmyString{downarrow} myString.{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "capitalize()");
            checkExactlyOneItem(acIDSel, null, "lower()");
        }, true);
    });
});
