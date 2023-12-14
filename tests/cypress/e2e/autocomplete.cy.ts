// eslint-disable-next-line @typescript-eslint/no-var-requires
require("cypress-terminal-report/src/installLogsCollector")();
import "@testing-library/cypress/add-commands";
// Needed for the "be.sorted" assertion:
// eslint-disable-next-line @typescript-eslint/no-var-requires
chai.use(require("chai-sorted"));

chai.Assertion.addMethod("beLocaleSorted", function () {
    const $element = this._obj;

    new chai.Assertion($element).to.be.exist;
    
    const actual = [...$element] as string[];
    // Important to spread again to make a copy, as sort sorts in-place:
    const expected = [...actual].sort((a, b) => a.localeCompare(b));
    expect(actual).to.deep.equal(expected);
});


// Must clear all local storage between tests to reset the state:
beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit("/",  {onBeforeLoad: (win) => {
        win.localStorage.clear();
        win.sessionStorage.clear();
    }});
});

function withAC(inner : (acIDSel : string, frameId: number) => void, skipSortedCheck?: boolean) : void {
    // We need a delay to make sure last DOM update has occurred:
    cy.wait(200);
    cy.get("#editor").then((eds) => {
        const ed = eds.get()[0];
        // Find the auto-complete corresponding to the currently focused slot:
        // Must escape any commas in the ID because they can confuse CSS selectors:
        const acIDSel = "#" + ed.getAttribute("data-slot-focus-id")?.replace(",", "\\,") + "_AutoCompletion";
        // Should always be sorted:
        if (!skipSortedCheck) {
            checkAutocompleteSorted(acIDSel);
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const frameId = parseInt(new RegExp("input_frame_(\\d+)").exec(acIDSel)[1]);
        // Call the inner function:
        inner(acIDSel, frameId);
    });
}

function withFrameId(inner : (frameId: number) => void) : void {
    // We need a delay to make sure last DOM update has occurred:
    cy.wait(200);
    cy.get("#editor").then((eds) => {
        const ed = eds.get()[0];
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const frameId = parseInt(new RegExp("input_frame_(\\d+)").exec(ed.getAttribute("data-slot-focus-id"))[1]);
        // Call the inner function:
        inner(frameId);
    });
}

function focusEditorAC(): void {
    // Not totally sure why this hack is necessary, I think it's to give focus into the webpage via an initial click:
    // (on the main code container frame -- would be better to retrieve it properly but the file won't compile if we use Apps.ts and/or the store)
    cy.get("#frame_id_-3").focus();
}

function withSelection(inner : (arg0: { id: string, cursorPos : number }) => void) : void {
    // We need a delay to make sure last DOM update has occurred:
    cy.wait(200);
    cy.get("#editor").then((eds) => {
        const ed = eds.get()[0];
        inner({id : ed.getAttribute("data-slot-focus-id") || "", cursorPos : parseInt(ed.getAttribute("data-slot-cursor") || "-2")});
    });
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
function checkNoItems(acIDSel : string, text : string, exact? : boolean) : void {
    cy.get(acIDSel + " .popupContainer").within(() => cy.findAllByText(text, { exact: exact ?? false}).should("not.exist"));
}

function checkNoneAvailable(acIDSel : string) {
    cy.get(acIDSel + " .popupContainer").within(() => {
        cy.findAllByText("No completion available", { exact: true}).should("have.length", 1);
    });
}

const MYVARS = "My variables";
const MYFUNCS = "My functions";
const BUILTIN = "Python";


// Checks all sections in the autocomplete are internally sorted (i.e. that the items
// within that section are in alphabetical order).  Also checks that the sections
// themselves are in the correct order.
function checkAutocompleteSorted(acIDSel: string) : void {
    // Other items (like the names of variables when you do var.) will come out as -1,
    // which works nicely because they should be first:
    const intendedOrder : string[] = [MYVARS, MYFUNCS, "microbit", "microbit.accelerometer", "time", BUILTIN];
    cy.get(acIDSel + " div.module:not(.empty-results) > em")
        .then((items) => [...items].map((item) => intendedOrder.indexOf(item.innerText.trim())))
        .should("be.sorted");

    cy.get(acIDSel + " .popupContainer ul > div").each((section) => {
        cy.wrap(section).find("li.popUpItems")
            // Replace opening bracket onwards as we want to check it's sorted by function name, ignoring params:
            .then((items) => [...items].map((item) => item.innerText.toLowerCase().replace(new RegExp("\\(.*"), "")))
            .should("beLocaleSorted");
    });
}

// Checks that the first labelslot in the given frame has content equivalent to expectedState (with a dollar indicating cursor position),
// and equivalent to expectedStateWithPlaceholders if you count placeholders as the text for blank spans
// If the last parameter is missing, it's assumed that expectedStateWithPlaceholders is the same as expectedState
// (but without the dollar)
function assertState(frameId: number, expectedState : string, expectedStateWithPlaceholders?: string) : void {
    expectedStateWithPlaceholders = expectedStateWithPlaceholders ?? expectedState.replaceAll("$", "");
    withSelection((info) => {    
        cy.get("#frameHeader_" + frameId + " #labelSlotsStruct" + frameId + "_0 .labelSlot-input").then((parts) => {
            let content = "";
            let contentWithPlaceholders = "";
            for (let i = 0; i < parts.length; i++) {
                const p : any = parts[i];
                let text = p.value || p.textContent || "";

                // If the text for a span is blank, use the placeholder since that's what the user will be seeing:
                if (!text) {
                    // Get rid of zero-width spaces (trim() doesn't seem to do this):
                    contentWithPlaceholders += p.getAttribute("placeholder")?.replace(/\u200B/g,"") ?? "";
                }
                else {
                    contentWithPlaceholders += text;
                }
                
                // If we're the focused slot, put a dollar sign in to indicate the current cursor position:
                if (info.id === p.getAttribute("id") && info.cursorPos >= 0) {
                    text = text.substring(0, info.cursorPos) + "$" + text.substring(info.cursorPos);
                }
                
                content += text;
            }
            expect(content).to.equal(expectedState);
            expect(contentWithPlaceholders).to.equal(expectedStateWithPlaceholders);
        });
    });
}



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
            checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
            checkExactlyOneItem(acIDSel, BUILTIN, "AssertionError()");
            checkNoItems(acIDSel, "ZeroDivisionError");
            checkNoItems(acIDSel, "zip");
            checkAutocompleteSorted(acIDSel);
            // Once we type "b", should show things beginning with AB but not the others:
            cy.get("body").type("b");
            checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
            checkNoItems(acIDSel, "AssertionError");
            checkNoItems(acIDSel, "ZeroDivisionError");
            checkNoItems(acIDSel, "zip");
            checkAutocompleteSorted(acIDSel);
            // Check docs are showing for built-in function:
            cy.get(acIDSel).contains("Return the absolute value of the argument.");
            
            // Now complete and check content:
            cy.get("body").type("s{enter}");
            assertState(frameId, "abs($)", "abs(x)");
        });
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
        });
    });
});

describe("Behaviour with operators, brackets and complex expressions", () => {
    const prefixesWhichShouldShowBuiltins = ["0+", "1.6-", "not ", "1**(2+6)", "[a,", "array[", "~", "(1*", "{3:"];
    const prefixesWhichShouldShowStringMembers = ["\"a\".", "'a'.upper().", "(\"a\").", "(\"a\".upper()).", "myString.", "[\"a\"][0]."];
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
                checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
                checkExactlyOneItem(acIDSel, BUILTIN, "AssertionError()");
                checkNoItems(acIDSel, "ZeroDivisionError");
                checkNoItems(acIDSel, "zip");
                checkAutocompleteSorted(acIDSel);
                // Once we type "b", should show things beginning with AB but not the others:
                cy.get("body").type("b");
                checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
                checkNoItems(acIDSel, "AssertionError");
                checkNoItems(acIDSel, "ZeroDivisionError");
                checkNoItems(acIDSel, "zip");
                checkAutocompleteSorted(acIDSel);
                // Check docs are showing for built-in function:
                cy.get(acIDSel).contains("Return the absolute value of the argument.");
            });
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
                checkNoItems(acIDSel, "lower");
                checkExactlyOneItem(acIDSel, null, "upper()");
                checkNoItems(acIDSel, "divmod");
                checkAutocompleteSorted(acIDSel);
                // Check docs show:
                cy.get("body").type("pper");
                cy.get(acIDSel).contains("Return a copy of the string converted to uppercase.");
            });
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
            }, true);
        });
    }
});

describe("Modules", () => {
    it("Offers auto-complete in import frames", () => {
        focusEditorAC();
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
                checkNoItems(acIDSel, "signal");
                // Once we type "m", should show things beginning with M but not the others:
                cy.get("body").type("m");
                cy.wait(500);
                checkExactlyOneItem(acIDSel, null, "machine");
                checkExactlyOneItem(acIDSel, null, "microbit");
                checkNoItems(acIDSel, "random");
                checkNoItems(acIDSel, "time");
                checkAutocompleteSorted(acIDSel);
                // Once we type "i", should show things beginning with MI but not the others:
                cy.get("body").type("i");
                checkNoItems(acIDSel, "machine");
                checkExactlyOneItem(acIDSel, null, "microbit");
                checkNoItems(acIDSel, "random");
                checkNoItems(acIDSel, "time");
                checkAutocompleteSorted(acIDSel);
                cy.get(acIDSel).contains("Pins, images, sounds, temperature and volume.");
            }
            else {
                cy.get(acIDSel + " .popupContainer").should("be.visible");
                checkExactlyOneItem(acIDSel, null, "antigravity");
                checkExactlyOneItem(acIDSel, null, "array");
                checkExactlyOneItem(acIDSel, null, "signal");
                checkExactlyOneItem(acIDSel, null, "webbrowser");
                checkNoItems(acIDSel, "microbit");
                // Once we type "a", should show things beginning with A but not the others:
                cy.get("body").type("a");
                cy.wait(500);
                checkExactlyOneItem(acIDSel, null, "antigravity");
                checkExactlyOneItem(acIDSel, null, "array");
                checkNoItems(acIDSel, "signal");
                checkNoItems(acIDSel, "webbrowser");
                checkAutocompleteSorted(acIDSel);
                // Once we type "r", should show things beginning with AR but not the others:
                cy.get("body").type("r");
                checkNoItems(acIDSel, "antigravity");
                checkExactlyOneItem(acIDSel, null, "array");
                checkNoItems(acIDSel, "signal");
                checkNoItems(acIDSel, "webbrowser");
                checkAutocompleteSorted(acIDSel);
                cy.get(acIDSel).contains("Efficient arrays of numeric values.");
            }
        });
    });

    it("Offers auto-complete in LHS of from...import frames", () => {
        focusEditorAC();
        // Go up to imports, add one, then trigger auto-complete:
        cy.get("body").type("{uparrow}{uparrow}f");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            if (Cypress.env("mode") == "microbit") {
                cy.get(acIDSel + " .popupContainer").should("be.visible");
                checkExactlyOneItem(acIDSel, null, "machine");
                checkExactlyOneItem(acIDSel, null, "microbit");
                checkExactlyOneItem(acIDSel, null, "random");
                checkExactlyOneItem(acIDSel, null, "time");
                checkNoItems(acIDSel, "signal");
                // Once we type "m", should show things beginning with M but not the others:
                cy.get("body").type("m");
                cy.wait(500);
                checkExactlyOneItem(acIDSel, null, "machine");
                checkExactlyOneItem(acIDSel, null, "microbit");
                checkNoItems(acIDSel, "random");
                checkNoItems(acIDSel, "time");
                checkAutocompleteSorted(acIDSel);
                // Once we type "i", should show things beginning with MI but not the others:
                cy.get("body").type("i");
                checkNoItems(acIDSel, "machine");
                checkExactlyOneItem(acIDSel, null, "microbit");
                checkNoItems(acIDSel, "random");
                checkNoItems(acIDSel, "time");
                checkAutocompleteSorted(acIDSel);
            }
            else {
                cy.get(acIDSel + " .popupContainer").should("be.visible");
                checkExactlyOneItem(acIDSel, null, "antigravity");
                checkExactlyOneItem(acIDSel, null, "array");
                checkExactlyOneItem(acIDSel, null, "signal");
                checkExactlyOneItem(acIDSel, null, "webbrowser");
                checkNoItems(acIDSel, "microbit");
                // Once we type "a", should show things beginning with A but not the others:
                cy.get("body").type("a");
                cy.wait(500);
                checkExactlyOneItem(acIDSel, null, "antigravity");
                checkExactlyOneItem(acIDSel, null, "array");
                checkNoItems(acIDSel, "signal");
                checkNoItems(acIDSel, "webbrowser");
                checkAutocompleteSorted(acIDSel);
                // Once we type "r", should show things beginning with AR but not the others:
                cy.get("body").type("r");
                checkNoItems(acIDSel, "antigravity");
                checkExactlyOneItem(acIDSel, null, "array");
                checkNoItems(acIDSel, "signal");
                checkNoItems(acIDSel, "webbrowser");
                checkAutocompleteSorted(acIDSel);
            }
        });
    });

    it("Offers auto-complete in RHS of from...import frames", () => {
        focusEditorAC();

        const target = Cypress.env("mode") == "microbit" ? "ticks_add" : "gmtime";
        const targetParams = Cypress.env("mode") == "microbit" ? "(ticks, delta)" : "()";
        const nonAvailable = Cypress.env("mode") == "microbit" ? "gmtime" : "ticks_add";
        const targetDoc = Cypress.env("mode") == "microbit" ? "Offset ticks value by a given number, which can be either positive or negative." : "Convert seconds since the Epoch to a time tuple expressing UTC";
        
        // Go up to imports, add one, then trigger auto-complete:
        cy.get("body").type("{uparrow}{uparrow}f");
        cy.wait(500);
        // Fill in time in the LHS then go across to the RHS:
        cy.get("body").type("time{rightarrow}");
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            checkExactlyOneItem(acIDSel, null, "*");
            checkExactlyOneItem(acIDSel, null, target);
            checkNoItems(acIDSel, target + targetParams); // Shouldn't show brackets in import, even though it is a function
            checkNoItems(acIDSel, nonAvailable);
            // Once we type first character, should be the same:
            cy.get("body").type(target.at(0) || "");
            cy.wait(500);
            checkExactlyOneItem(acIDSel, null, target);
            checkNoItems(acIDSel, nonAvailable);
            checkNoItems(acIDSel, "*");
            checkAutocompleteSorted(acIDSel);
            cy.get(acIDSel).contains(targetDoc);
            // Type rest of target then enter a comma:
            cy.get("body").type(target.substring(1) + ",");
            cy.wait(500);
            // That should have dismissed the autocomplete and put us in a new slot:
            cy.get(acIDSel).should("not.exist");
        });
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        // We can check same item again; we don't deduplicate based on what is already imported:
        withAC((acIDSel) => {
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            checkExactlyOneItem(acIDSel, null, "*");
            checkExactlyOneItem(acIDSel, null, target);
            checkNoItems(acIDSel, nonAvailable);
            // Once we type first character, should be the same:
            cy.get("body").type(target.at(0) || "");
            cy.wait(500);
            checkExactlyOneItem(acIDSel, null, target);
            checkNoItems(acIDSel, nonAvailable);
            checkNoItems(acIDSel, "*");
            checkAutocompleteSorted(acIDSel);
            cy.get(acIDSel).contains(targetDoc);
            // Remove character and comma, to make it import just the one valid item:
            cy.get("body").type("{backspace}{backspace}");
        });
        // Now check in the body for docs on the autocomplete:
        cy.get("body").type("{rightarrow}{downarrow}{downarrow}");
        cy.get("body").type(" {ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            checkExactlyOneItem(acIDSel, "time", target + targetParams);
            checkNoItems(acIDSel, nonAvailable);
            // Once we type first character, should be the same:
            cy.get("body").type(target);
            cy.wait(500);
            checkExactlyOneItem(acIDSel, "time", target + targetParams);
            checkNoItems(acIDSel, nonAvailable);
            checkNoItems(acIDSel, "*");
            checkAutocompleteSorted(acIDSel);
            // Check documentation is showing for it:
            cy.get(acIDSel).contains(targetDoc);
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
            const target = Cypress.env("mode") == "microbit" ? "ticks_add(ticks, delta)" : "gmtime()";
            const nonAvailable = Cypress.env("mode") == "microbit" ? "gmtime()" : "ticks_add(ticks, delta)";
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            // Should have time related queries, but not the standard completions:
            checkExactlyOneItem(acIDSel, "time", target);
            checkNoItems(acIDSel, nonAvailable);
            checkExactlyOneItem(acIDSel, "time", "sleep()");
            checkNoItems(acIDSel, "abs");
            checkNoItems(acIDSel, "AssertionError");
            // Type first letter of the target:
            cy.get("body").type(target.at(0) || "");
            checkExactlyOneItem(acIDSel, "time", target);
            checkNoItems(acIDSel, "sleep");
            checkNoItems(acIDSel, "abs");
            checkNoItems(acIDSel, "AssertionError");
            checkAutocompleteSorted(acIDSel);
        });
    });

    it("Offers auto-completion for imported modules with a from import *", () => {
        focusEditorAC();
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
            const target = Cypress.env("mode") == "microbit" ? "ticks_add(ticks, delta)" : "gmtime()";
            const nonAvailable = Cypress.env("mode") == "microbit" ? "gmtime" : "ticks_add";
            const sleepCall = Cypress.env("mode") == "microbit" ? "sleep_ms(ms)" : "sleep()";
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            // Should have time related queries, but not the standard completions:
            checkExactlyOneItem(acIDSel, "time", target);
            checkNoItems(acIDSel, nonAvailable);
            checkNoItems(acIDSel, "__name__");
            checkExactlyOneItem(acIDSel, "time", sleepCall);
            checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
            checkExactlyOneItem(acIDSel, BUILTIN, "AssertionError()");
            cy.get("body").type(target.at(0) || "");
            checkExactlyOneItem(acIDSel, "time", target);
            checkNoItems(acIDSel, sleepCall);
            checkNoItems(acIDSel, "abs", true);
            checkNoItems(acIDSel, "AssertionError");
            checkAutocompleteSorted(acIDSel);
        });
    });
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
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            checkExactlyOneItem(acIDSel, MYFUNCS, "foo()");
            cy.get("body").type("foo{enter}");
            assertState(frameId, "foo($)");
        });
    });

    it("Offers auto-complete for user-defined variables", () => {
        focusEditorAC();
        // Make an assignment frame that says "myVar=23", then make a function call frame beneath:
        cy.get("body").type("=myVar=23{enter} ");
        cy.wait(500);
        // Trigger auto-completion:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            checkExactlyOneItem(acIDSel, MYVARS, "myVar");
            // Not a function, so shouldn't show brackets:
            checkNoItems(acIDSel, "myVar()");
        });
    });

    it("Offers auto-complete for user-defined function parameters", () => {
        focusEditorAC();
        // Make a function frame with "foo(myParam)" 
        // then make a function call frame inside:
        cy.get("body").type("{uparrow}ffoo(myParam{rightarrow} ");
        // Trigger auto-completion:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            checkExactlyOneItem(acIDSel, MYVARS, "myParam");
            // Go out of this call and into the main body:
            cy.get("body").type("{backspace}");
            cy.wait(500);
            cy.get("body").type("{downarrow}{downarrow}");
        });
        // Make a function call and check myParam doesn't show there:
        cy.get("body").type(" {ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            checkNoItems(acIDSel, "myParam", true);
        });
    });

    it("Offers auto-complete for for-loop iterating variables", () => {
        focusEditorAC();
        // Make a for loop:
        cy.get("body").type("fmyIterator{rightarrow}imaginaryList{rightarrow}");
        // Trigger auto-completion in a new function call frame:
        cy.get("body").type(" {ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            checkExactlyOneItem(acIDSel, MYVARS, "myIterator");
            checkNoItems(acIDSel, "imaginaryList");
            // Go out of this call and beneath the loop:
            cy.get("body").type("{backspace}");
            cy.wait(500);
            cy.get("body").type("{downarrow}");
        });
        // Make a function call and check myIterator shows there -- Python semantics
        // are that the loop variable is available after the loop:
        cy.get("body").type(" {ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            checkExactlyOneItem(acIDSel, MYVARS, "myIterator");
            checkNoItems(acIDSel, "imaginaryList");
        });
    });

    it("Offers auto-complete for items on user-defined variables", () => {
        focusEditorAC();
        // Make an assignment frame myVar="hi" then add a function call frame beneath with "myVar."
        cy.get("body").type("=myVar=\"hi{enter} myVar.");
        cy.wait(500);
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            checkExactlyOneItem(acIDSel, "myVar", "lower()");
            checkExactlyOneItem(acIDSel, "myVar", "upper()");
            checkNoItems(acIDSel, "divmod");
            cy.get("body").type("u");
            checkNoItems(acIDSel, "lower");
            checkExactlyOneItem(acIDSel, "myVar", "upper()");
            checkNoItems(acIDSel, "divmod");
            checkAutocompleteSorted(acIDSel);
            // Check docs show:
            cy.get("body").type("pper");
            cy.get(acIDSel).contains("Return a copy of the string converted to uppercase.");
        });
    });

    it("Offers auto-complete for user-defined variables but not before declaration", () => {
        focusEditorAC();
        // Make an assignment frame with myVar=23, then go before it and add a function call frame:
        cy.get("body").type("=myVar=23{enter}{uparrow} ");
        cy.wait(500);
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
            checkNoItems(acIDSel, "myVar");
        });
    });
});

describe("Versions", () => {
    if (Cypress.env("mode") == "microbit") {
        it("Shows versions for relevant modules on function autocomplete", () => {
            focusEditorAC();
            // Add a function frame and trigger auto-complete:
            cy.get("body").type(" ");
            cy.wait(500);
            cy.get("body").type("{ctrl} ");
            withAC((acIDSel) => {
                cy.get(acIDSel).should("be.visible");
                checkExactlyOneItem(acIDSel, null, "compass");
                checkExactlyOneItem(acIDSel, null, "speaker");
                cy.get(acIDSel + " li:contains('compass') > .api-item-version:contains('v2')").should("not.exist");
                cy.get(acIDSel + " li:contains('speaker') > .api-item-version:contains('v2')").should("exist");
            });
        });
    }
});

describe("Nested modules", () => {
    // Technically, microbit.accelerometer is a nested object not a nested module, but I think
    // in terms of the autocomplete tests here, it should function in exactly the same way: 
    const targetModule = Cypress.env("mode") == "microbit" ? "microbit.accelerometer" : "urllib.request";
    const targetFunction = Cypress.env("mode") == "microbit" ? "get_x" : "urlopen";
    const targetFunctionWithParam = Cypress.env("mode") == "microbit" ? "get_x()" : "urlopen(url)";
    
    it("Offers auto-completion for modules with names a.b when imported as a.b", () => {
        if (Cypress.env("mode") == "microbit") {
            // This doesn't work on microbit because we can't dynamically ask
            // Skulpt for the members of accelerometer.
            return;
        }
        focusEditorAC();
        // Go up to imports and add an import frame:
        cy.get("body").type("{uparrow}{uparrow}i");
        cy.wait(500);
        // Type whole module as one item:
        cy.get("body").type(targetModule);
        cy.get("body").type("{rightarrow}");
        // Back down to main body, add a function frame and type "<submodule>." then trigger auto-complete:
        cy.get("body").type("{downarrow}{downarrow}");
        cy.get("body").type(" " + targetModule + ".{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            // Because it's fetched dynamically, we won't know parameter names:
            checkExactlyOneItem(acIDSel, targetModule, targetFunction + "()");
            checkNoItems(acIDSel, "abs");
        });
    });

    it("Offers auto-completion for modules with names a.b when imported as a.b.* with from", () => {
        focusEditorAC();
        // Go up to imports and add a from import frame:
        cy.get("body").type("{uparrow}{uparrow}f");
        cy.wait(500);
        // Type whole module as one item:
        cy.get("body").type(targetModule);
        cy.get("body").type("{rightarrow}*{rightarrow}");
        // Back down to main body, add a function frame and type "<submodule>." then trigger auto-complete:
        cy.get("body").type("{downarrow}{downarrow}");
        cy.get("body").type(" {ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            checkExactlyOneItem(acIDSel, targetModule, targetFunctionWithParam);
            checkExactlyOneItem(acIDSel, null, "abs(x)");
        });
    });

    it("Offers auto-completion for modules with names a.b when imported as a.b.func with from", () => {
        focusEditorAC();
        // Go up to imports and add a from import frame:
        cy.get("body").type("{uparrow}{uparrow}f");
        cy.wait(500);
        // Type whole module as one item:
        cy.get("body").type(targetModule);
        cy.get("body").type("{rightarrow}" + targetFunction + "{rightarrow}");
        // Back down to main body, add a function frame and type "<submodule>." then trigger auto-complete:
        cy.get("body").type("{downarrow}{downarrow}");
        cy.get("body").type(" {ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " .popupContainer").should("be.visible");
            checkExactlyOneItem(acIDSel, targetModule, targetFunctionWithParam);
            checkExactlyOneItem(acIDSel, null, "abs(x)");
        });
    });

    it("Deals with different microbit items correctly", () => {
        if (Cypress.env("mode") == "microbit") {
            // In microbit, compass is a module microbit.compass, but it is also reexported by the microbit
            // module.  So if you do "from microbit import *" as we do by default, you should see compass.
            // Whereas button_a is an object in that module, but that should also be visible with the default import:
            focusEditorAC();
            // Add a function frame and trigger auto-complete:
            cy.get("body").type(" ");
            cy.wait(500);
            cy.get("body").type("{ctrl} ");
            withAC((acIDSel) => {
                cy.get(acIDSel).should("be.visible");
                checkExactlyOneItem(acIDSel, "microbit", "button_a");
                checkExactlyOneItem(acIDSel, "microbit", "compass");
                checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
            });
            // Now let's delete the import and check they both vanish:
            cy.get("body").type("{leftarrow}{uparrow}{uparrow}{backspace}{downarrow}{downarrow}");
            // Enter frame again:
            cy.get("body").type(" ");
            cy.wait(500);
            cy.get("body").type("{ctrl} ");
            withAC((acIDSel) => {
                cy.get(acIDSel).should("be.visible");
                checkNoItems(acIDSel, "button_a");
                checkNoItems(acIDSel, "compass");
                checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
            });
        }
    });
});

describe("Underscore handling", () => {
    const importFunc = Cypress.env("mode") === "microbit" ? "__import__(name)" : "__import__()";
    
    it("Does not offer underscore items at top-level until typed", () => {
        focusEditorAC();
        // Add a function frame and trigger auto-complete:
        cy.get("body").type(" ");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel).should("be.visible");
            checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
            checkExactlyOneItem(acIDSel, BUILTIN, "AssertionError()");
            checkNoItems(acIDSel, "__doc__");
            checkNoItems(acIDSel, "__import__");
            checkNoItems(acIDSel, "__name__");
            // Once we type "_", should show things beginning with _ but not the others:
            cy.get("body").type("_");
            checkNoItems(acIDSel, "abs(x)");
            checkNoItems(acIDSel, "AssertionError");
            checkExactlyOneItem(acIDSel, BUILTIN, importFunc);
            checkAutocompleteSorted(acIDSel);
            // Check docs are showing for built-in function:
            cy.get(acIDSel).contains("Import a module.");
        });
    });
    // Python rules say we never import anything with underscores from modules with import *:
    it("Does not offer underscore items on modules at all", () => {
        // Go up to imports and add a from time import *
        cy.get("body").type("{uparrow}{uparrow}ftime{rightarrow}*{rightarrow}");
        cy.get("body").type("{downarrow}{downarrow}");
        
        focusEditorAC();
        // Add a function frame and trigger auto-complete:
        cy.get("body").type(" {ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel).should("be.visible");
            checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
            checkExactlyOneItem(acIDSel, BUILTIN, "AssertionError()");
            checkExactlyOneItem(acIDSel, "time", Cypress.env("mode") == "microbit" ? "ticks_add(ticks, delta)" : "gmtime()");
            checkNoItems(acIDSel, "__doc__");
            checkNoItems(acIDSel, "__import__");
            checkNoItems(acIDSel, "__name__");
            // Once we type "_", should show things beginning with _ but not the others:
            cy.get("body").type("_");
            checkNoItems(acIDSel, "abs(x)");
            checkNoItems(acIDSel, "AssertionError");
            checkNoItems(acIDSel, "gmtime");
            checkNoItems(acIDSel, "ticks_add");
            checkExactlyOneItem(acIDSel, BUILTIN, importFunc);
            checkNoItems(acIDSel, "__doc__");
            checkNoItems(acIDSel, "__name__");
            checkAutocompleteSorted(acIDSel);
            // Now cancel this:
            cy.get("body").type("{backspace}{backspace}");
        });
    });
    it("Does not offer underscore items on object until typed", () => {
        focusEditorAC();
        // Add a string variable named myVar:
        cy.get("body").type("=myVar=\"hi{enter}");
        // Add a function frame and trigger auto-complete on myVar.:
        cy.get("body").type(" myVar.");
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel).should("be.visible");
            checkExactlyOneItem(acIDSel, "myVar", "upper()");
            checkNoItems(acIDSel, "__doc__");
            checkNoItems(acIDSel, "__import__");
            checkNoItems(acIDSel, "__name__");
            // Once we type "_", should show things beginning with _ but not the others:
            cy.get("body").type("_");
            checkNoItems(acIDSel, "upper");
            checkExactlyOneItem(acIDSel, "myVar", "__doc__");
            checkNoItems(acIDSel, "__doc__()"); // Not a function, so shouldn't be a bracket
            checkExactlyOneItem(acIDSel, "myVar", "__dir__()");
            checkExactlyOneItem(acIDSel, "myVar", "__class__()");
            cy.get("body").type("_dir");
            checkAutocompleteSorted(acIDSel);
            // Check docs are showing for built-in function:
            cy.get(acIDSel).contains("Default dir() implementation.");
        });
    });
    it("Offers user's own definitions, even if they start with underscores", () => {
        focusEditorAC();
        // Go up to functions section, add a function named "__myFunction" then come back down:
        cy.get("body").type("{uparrow}f__myFunction{rightarrow}myParam{downarrow}{downarrow}{downarrow}");
        // Make a variable called __myVar:
        cy.get("body").type("=__myVar=42{enter}");
        // Add a function frame and trigger auto-complete:
        cy.get("body").type(" {ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel).should("be.visible");
            checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
            checkNoItems(acIDSel, "__doc__");
            checkNoItems(acIDSel, "__import__");
            checkNoItems(acIDSel, "__name__");
            checkExactlyOneItem(acIDSel, MYFUNCS,"__myFunction(myParam)");
            checkExactlyOneItem(acIDSel, MYVARS, "__myVar");
            checkNoItems(acIDSel, "__myVar()");
            // Once we type "_", should show things beginning with _ but not the others:
            cy.get("body").type("_");
            checkNoItems(acIDSel, "abs(x)");
            checkExactlyOneItem(acIDSel, BUILTIN, importFunc);
            checkExactlyOneItem(acIDSel, MYFUNCS, "__myFunction(myParam)");
            checkExactlyOneItem(acIDSel, MYVARS, "__myVar");
            checkAutocompleteSorted(acIDSel);
        });
    });
});

describe("Parameter prompts", () => {
    // m for microbit:
    const m = Cypress.env("mode") === "microbit"; 
    // Each item is a pair: the function name, the list of param names
    const funcs : [string, string[]][] = [
        ["abs", ["x"]],
        ["delattr", ["obj", "name"]],
        ["dir", m ? ["o"] : []],
        ["globals", []],
        ["setattr", ["obj, name, value"]],
    ];
    // TODO add qualified functions
    for (const func of funcs) {
        it("Shows prompts after manually writing function name and brackets for " + func, () => {
            focusEditorAC();
            cy.get("body").type(" " + func[0] + "(");
            withFrameId((frameId) => assertState(frameId, func[0] + "($)", func[0] + "(" + func[1].join(", ") + ")"));
        });
        it("Shows prompts after manually writing function name and brackets AND commas for " + func, () => {
            focusEditorAC();
            cy.get("body").type(" " + func[0] + "(");
            // Type commas for num params minus 1:
            for (let i = 0; i < func[1].length; i++) {
                if (i > 0) {
                    cy.get("body").type(",");
                }
                withFrameId((frameId) => assertState(frameId, 
                    func[0] + "(" + ",".repeat(i) + "$)", 
                    func[0] + "(" + func[1].slice(0, i).join(",") + (i > 0 ? "," : "") + func[1].slice(i).join(", ") + ")"));
            }
            
        });
        it("Shows prompts after using AC for " + func, () => {
            focusEditorAC();
            cy.get("body").type(" " + func[0]);
            cy.get("body").type("{ctrl} ");
            // There is a bug which only seems to happen in cypress where the selection
            // pings back to the start of the slot; I don't see this in a real browser
            // We compensate by moving the cursor back to the end:
            for (let i = 0; i < func[0].length; i++) {
                cy.get("body").type("{rightarrow}");
            }
            cy.get("body").type("{enter}");
            withFrameId((frameId) => assertState(frameId, func[0] + "($)", func[0] + "(" + func[1].join(", ") + ")"));
        });
    }
});
