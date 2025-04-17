// eslint-disable-next-line @typescript-eslint/no-var-requires
require("cypress-terminal-report/src/installLogsCollector")();
import { WINDOW_STRYPE_HTMLIDS_PROPNAME, WINDOW_STRYPE_SCSSVARS_PROPNAME } from "../../../src/helpers/sharedIdCssWithTests";
import "@testing-library/cypress/add-commands";

// Needed for the "be.sorted" assertion:
// eslint-disable-next-line @typescript-eslint/no-var-requires
chai.use(require("chai-sorted"));
import failOnConsoleError from "cypress-fail-on-console-error";
failOnConsoleError();

chai.Assertion.addMethod("beLocaleSorted", function () {
    const $element = this._obj;

    new chai.Assertion($element).to.be.exist;
    
    const actual = [...$element] as string[];
    // Important to spread again to make a copy, as sort sorts in-place:
    const expected = [...actual].sort((a, b) => a.localeCompare(b));
    expect(actual).to.deep.equal(expected);
});

// Must clear all local storage between tests to reset the state,
// and also retrieve the shared CSS and HTML elements IDs exposed
// by Strype via the Window object of the app.
let scssVars: {[varName: string]: string};
let strypeElIds: {[varName: string]: (...args: any[]) => string};
beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit("/",  {onBeforeLoad: (win) => {
        win.localStorage.clear();
        win.sessionStorage.clear();
    }}).then(() => {       
        // Only need to get the global variables if we haven't done so
        if(scssVars == undefined){
            cy.window().then((win) => {
                scssVars = (win as any)[WINDOW_STRYPE_SCSSVARS_PROPNAME];
                strypeElIds = (win as any)[WINDOW_STRYPE_HTMLIDS_PROPNAME];
            });
        }
        
        // Wait for code initialisation
        cy.wait(2000);
    });
});

function withAC(inner : (acIDSel : string, frameId: number) => void, isInFuncCallFrame:boolean, skipSortedCheck?: boolean) : void {
    // We need a delay to make sure last DOM update has occurred:
    cy.wait(600);
    cy.get("#" + strypeElIds.getEditorID()).then((eds) => {
        const ed = eds.get()[0];
        // Find the auto-complete corresponding to the currently focused slot:
        // Must escape any commas in the ID because they can confuse CSS selectors:
        const acIDSel = "#" + ed.getAttribute("data-slot-focus-id")?.replace(",", "\\,") + "_AutoCompletion";
        // Should always be sorted:
        if (!skipSortedCheck) {
            checkAutocompleteSorted(acIDSel, isInFuncCallFrame);
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const frameId = parseInt(new RegExp("input_frame_(\\d+)").exec(acIDSel)[1]);
        // Call the inner function:
        inner(acIDSel, frameId);
    });
}

function focusEditorAC(): void {
    // Not totally sure why this hack is necessary, I think it's to give focus into the webpage via an initial click:
    // (on the main code container frame -- would be better to retrieve it properly but the file won't compile if we use Apps.ts and/or the store)
    cy.get("#" + strypeElIds.getFrameUID(-3)).focus();
}

function withSelection(inner : (arg0: { id: string, cursorPos : number }) => void) : void {
    // We need a delay to make sure last DOM update has occurred:
    cy.wait(200);
    cy.get("#" + strypeElIds.getEditorID()).then((eds) => {
        const ed = eds.get()[0];
        inner({id : ed.getAttribute("data-slot-focus-id") || "", cursorPos : parseInt(ed.getAttribute("data-slot-cursor") || "-2")});
    });
}


// Given a selector for the auto-complete and text for an item, checks that exactly one item with that text
// exists in the autocomplete
function checkExactlyOneItem(acIDSel : string, category: string | null, text : string) : void {
    cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName + (category == null ? "" : " div[data-title='" + category + "']")).within(() => {
        // Logging; useful in case of failure but we don't want it on by default:
        // cy.findAllByText(text, { exact: true}).each(x => cy.log(x.get()[0].id));
        cy.findAllByText(text, { exact: true}).should("have.length", 1);
    });
}

// Given a selector for the auto-complete and text for an item, checks that no items with that text
// exists in the autocomplete
function checkNoItems(acIDSel : string, text : string, exact? : boolean) : void {
    cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).within(() => cy.findAllByText(text, { exact: exact ?? false}).should("not.exist"));
}

function checkNoneAvailable(acIDSel : string) {
    cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).within(() => {
        cy.findAllByText("No completion available", { exact: true}).should("have.length", 1);
    });
}

const MYVARS = "My variables";
const MYFUNCS = "My functions";
const BUILTIN = "Python";


// Checks all sections in the autocomplete are internally sorted (i.e. that the items
// within that section are in alphabetical order).  Also checks that the sections
// themselves are in the correct order.
function checkAutocompleteSorted(acIDSel: string, isInFuncCallFrame: boolean) : void {
    // The autocomplete only updates after 500ms:
    cy.wait(1000);
    // Other items (like the names of variables when you do var.) will come out as -1,
    // which works nicely because they should be first 
    // (if we are in a function call definition (isInFuncCallFrame true) "My Functions"
    // comes before "My Variables", and the other way around if not):
    const intendedOrder = [
        ...(isInFuncCallFrame ? [MYFUNCS, MYVARS] : [MYVARS, MYFUNCS]),
        "microbit",
        "microbit.accelerometer",
        "time",
        BUILTIN,
    ];
    cy.get(acIDSel + " div.module:not(." + scssVars.acEmptyResultsContainerClassName + ") > em")
        .then((items) => [...items].map((item) => intendedOrder.indexOf(item.innerText.trim())))
        .should("be.sorted");

    cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName + " ul > div").each((section) => {
        cy.wrap(section).find("li.ac-popup-item")
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
        cy.get("#" + strypeElIds.getFrameHeaderUID(frameId) + " #" + strypeElIds.getFrameLabelSlotsStructureUID(frameId, 0) + " ." + scssVars.labelSlotInputClassName).then((parts) => {
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

describe("Modules", () => {
    it("Offers auto-complete in import frames", () => {
        focusEditorAC();
        // Go up to imports, add one, then trigger auto-complete:
        cy.get("body").type("{uparrow}{uparrow}i");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            if (Cypress.env("mode") == "microbit") {
                cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
                checkExactlyOneItem(acIDSel, null, "machine");
                checkExactlyOneItem(acIDSel, null, "microbit");
                checkExactlyOneItem(acIDSel, null, "random");
                checkExactlyOneItem(acIDSel, null, "time");
                checkNoItems(acIDSel, "signal");
                // Once we type "m", should show things beginning with M but not the others:
                cy.get("body").type("m");
                cy.wait(600);
                checkExactlyOneItem(acIDSel, null, "machine");
                checkExactlyOneItem(acIDSel, null, "microbit");
                checkNoItems(acIDSel, "random");
                checkNoItems(acIDSel, "time");
                checkAutocompleteSorted(acIDSel, false);
                // Once we type "i", should show things beginning with MI but not the others:
                cy.get("body").type("i");
                cy.wait(600);
                checkNoItems(acIDSel, "machine");
                checkExactlyOneItem(acIDSel, null, "microbit");
                checkNoItems(acIDSel, "random");
                checkNoItems(acIDSel, "time");
                checkAutocompleteSorted(acIDSel, false);
                cy.get(acIDSel).contains("Pins, images, sounds, temperature and volume.");
            }
            else {
                cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
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
                checkAutocompleteSorted(acIDSel, false);
                // Once we type "r", should show things beginning with AR but not the others:
                cy.get("body").type("r");
                checkNoItems(acIDSel, "antigravity");
                checkExactlyOneItem(acIDSel, null, "array");
                checkNoItems(acIDSel, "signal");
                checkNoItems(acIDSel, "webbrowser");
                checkAutocompleteSorted(acIDSel, false);
                cy.get(acIDSel).contains("Efficient arrays of numeric values.");
            }
        }, false);
    });

    it("Offers auto-complete in LHS of from...import frames", () => {
        focusEditorAC();
        // Go up to imports, add one, then trigger auto-complete:
        cy.get("body").type("{uparrow}{uparrow}f");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            if (Cypress.env("mode") == "microbit") {
                cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
                checkExactlyOneItem(acIDSel, null, "machine");
                checkExactlyOneItem(acIDSel, null, "microbit");
                checkExactlyOneItem(acIDSel, null, "random");
                checkExactlyOneItem(acIDSel, null, "time");
                checkNoItems(acIDSel, "signal");
                // Once we type "m", should show things beginning with M but not the others:
                cy.get("body").type("m");
                cy.wait(600);
                checkExactlyOneItem(acIDSel, null, "machine");
                checkExactlyOneItem(acIDSel, null, "microbit");
                checkNoItems(acIDSel, "random");
                checkNoItems(acIDSel, "time");
                checkAutocompleteSorted(acIDSel, false);
                // Once we type "i", should show things beginning with MI but not the others:
                cy.get("body").type("i");
                cy.wait(600);
                checkNoItems(acIDSel, "machine");
                checkExactlyOneItem(acIDSel, null, "microbit");
                checkNoItems(acIDSel, "random");
                checkNoItems(acIDSel, "time");
                checkAutocompleteSorted(acIDSel, false);
            }
            else {
                cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
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
                checkAutocompleteSorted(acIDSel, false);
                // Once we type "r", should show things beginning with AR but not the others:
                cy.get("body").type("r");
                checkNoItems(acIDSel, "antigravity");
                checkExactlyOneItem(acIDSel, null, "array");
                checkNoItems(acIDSel, "signal");
                checkNoItems(acIDSel, "webbrowser");
                checkAutocompleteSorted(acIDSel, false);
            }
        }, false);
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
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "*");
            checkExactlyOneItem(acIDSel, null, target);
            checkNoItems(acIDSel, target + targetParams); // Shouldn't show brackets in import, even though it is a function
            checkNoItems(acIDSel, nonAvailable);
            // Once we type first character, should be the same:
            cy.get("body").type(target.at(0) || "");
            cy.wait(600);
            checkExactlyOneItem(acIDSel, null, target);
            checkNoItems(acIDSel, nonAvailable);
            checkNoItems(acIDSel, "*");
            checkAutocompleteSorted(acIDSel, false);
            cy.get(acIDSel).contains(targetDoc);
            // Type rest of target then enter a comma:
            cy.get("body").type(target.substring(1) + ",");
            cy.wait(500);
            // That should have dismissed the autocomplete and put us in a new slot:
            cy.get(acIDSel).should("not.be.visible");
        }, false);
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        // We can check same item again; we don't deduplicate based on what is already imported:
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "*");
            checkExactlyOneItem(acIDSel, null, target);
            checkNoItems(acIDSel, nonAvailable);
            // Once we type first character, should be the same:
            cy.get("body").type(target.at(0) || "");
            cy.wait(600);
            checkExactlyOneItem(acIDSel, null, target);
            checkNoItems(acIDSel, nonAvailable);
            checkNoItems(acIDSel, "*");
            checkAutocompleteSorted(acIDSel, false);
            cy.get(acIDSel).contains(targetDoc);
            // Remove character and comma, to make it import just the one valid item:
            cy.get("body").type("{backspace}{backspace}");
        }, false);
        // Now check in the body for docs on the autocomplete (we should be in a function call frame):
        cy.get("body").type("{rightarrow}{downarrow}{downarrow}");
        cy.get("body").type(" {ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, "time", target + targetParams);
            checkNoItems(acIDSel, nonAvailable);
            // Once we type first character, should be the same:
            cy.get("body").type(target);
            cy.wait(600);
            checkExactlyOneItem(acIDSel, "time", target + targetParams);
            checkNoItems(acIDSel, nonAvailable);
            checkNoItems(acIDSel, "*");
            checkAutocompleteSorted(acIDSel, true);
            // Check documentation is showing for it:
            cy.get(acIDSel).contains(targetDoc);
        }, true);
    });
    
    it("Offers auto-completion for imported modules", () => {
        // This works on microbit without using Skulpt because we have special cases to look up microbit in our precalculated JSON        
        focusEditorAC();
        // Go up to imports and add an import frame:
        cy.get("body").type("{uparrow}{uparrow}i");
        cy.wait(500);
        // Trigger autocomplete, type "tim" then press enter to complete and right arrow to leave frame:
        cy.get("body").type("{ctrl} ");
        cy.get("body").type("tim");
        cy.wait(600);
        cy.get("body").type("{enter}{rightarrow}");
        // Back down to main body, add a function frame and type "time." then trigger auto-complete:
        cy.get("body").type("{downarrow}{downarrow}");
        cy.get("body").type(" time.{ctrl} ");
        withAC((acIDSel) => {
            // Microbit and Python have different items in the time module, so pick accordingly:
            const target = Cypress.env("mode") == "microbit" ? "ticks_add(ticks, delta)" : "gmtime()";
            const nonAvailable = Cypress.env("mode") == "microbit" ? "gmtime()" : "ticks_add(ticks, delta)";
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            // Should have time related queries, but not the standard completions:
            checkExactlyOneItem(acIDSel, "time", target);
            checkNoItems(acIDSel, nonAvailable);
            checkExactlyOneItem(acIDSel, "time", Cypress.env("mode") === "microbit" ? "sleep(seconds)" : "sleep()");
            checkNoItems(acIDSel, "abs");
            checkNoItems(acIDSel, "AssertionError");
            // Type first letter of the target:
            cy.get("body").type(target.at(0) || "");
            cy.wait(600);
            checkExactlyOneItem(acIDSel, "time", target);
            checkNoItems(acIDSel, "sleep");
            checkNoItems(acIDSel, "abs");
            checkNoItems(acIDSel, "AssertionError");
            checkAutocompleteSorted(acIDSel, true);
        }, true);
    });

    it("Offers auto-completion for imported modules with a from import *", () => {
        focusEditorAC();
        // Go up to the imports and add a "from..import.." frame
        cy.get("body").type("{uparrow}{uparrow}f");
        cy.wait(500);
        // Trigger autocomplete (in first section), type "tim" and hit enter to auto-complete, then right arrow to go across to the second part of the frame:
        cy.get("body").type("{ctrl} ");
        cy.get("body").type("tim");
        cy.wait(600);
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
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            // Should have time related queries, but not the standard completions:
            checkExactlyOneItem(acIDSel, "time", target);
            checkNoItems(acIDSel, nonAvailable);
            checkNoItems(acIDSel, "__name__");
            checkExactlyOneItem(acIDSel, "time", sleepCall);
            checkExactlyOneItem(acIDSel, BUILTIN, "abs(x)");
            checkExactlyOneItem(acIDSel, BUILTIN, "AssertionError()");
            cy.get("body").type(target.at(0) || "");
            cy.wait(600);
            checkExactlyOneItem(acIDSel, "time", target);
            checkNoItems(acIDSel, sleepCall);
            checkNoItems(acIDSel, "abs", true);
            checkNoItems(acIDSel, "AssertionError");
            checkAutocompleteSorted(acIDSel, true);
        }, true);
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
            }, true);
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
        // This works on microbit without using Skulpt because we have special cases to look up microbit in our precalculated JSON
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
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            // The modules we are retrieving are generated in our API files (see changes of commit 3073c074090c68dfb5cfc633686aa3916e55f0ca),
            // therefore, we will have the parameters in the autocompletion data.
            checkExactlyOneItem(acIDSel, targetModule, targetFunctionWithParam);
            checkNoItems(acIDSel, "abs");
        }, true);
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
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, targetModule, targetFunctionWithParam);
            checkExactlyOneItem(acIDSel, null, "abs(x)");
        }, true);
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
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, targetModule, targetFunctionWithParam);
            checkExactlyOneItem(acIDSel, null, "abs(x)");
        }, true);
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
            }, true);
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
            }, true);
        }
    });
});

describe("Imported items", () => {
    const targetModule = "time";
    const targetFunction = Cypress.env("mode") == "microbit" ? "ticks_add(ticks, delta)" : "gmtime()";

    it("Doesn't offer auto-complete when module is not imported", () => {
        focusEditorAC();
        cy.get("body").type(" " + targetModule + ".{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            // Should show nothing available if we haven't imported the module:
            checkNoneAvailable(acIDSel);
            checkNoItems(acIDSel, targetFunction);
        }, true, true);
    });

    it("Offers auto-complete when module is imported", () => {
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
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            // Should show because it's imported:
            checkExactlyOneItem(acIDSel, targetModule, targetFunction);
            checkNoItems(acIDSel, "abs");
        }, true);
    });

    it("Doesn't offer auto-complete on original name when module is imported using as", () => {
        focusEditorAC();
        // Go up to imports and add an import frame:
        cy.get("body").type("{uparrow}{uparrow}i");
        cy.wait(500);
        // Space bar alone should give us the "as", so this imports as "t":
        cy.get("body").type(targetModule + " t{rightarrow}");
        // Back down to main body, add a function frame and type "<module>." then trigger auto-complete:
        cy.get("body").type("{downarrow}{downarrow}");
        cy.get("body").type(" " + targetModule + ".{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            // Should show nothing available if we haven't imported the module itself, only used a from:
            checkNoneAvailable(acIDSel);
            checkNoItems(acIDSel, targetFunction);
        }, true, true);
        // Then if we delete back to "t" and type ".":
        cy.get("body").type("{backspace}{backspace}{backspace}{backspace}.{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            // Should show because we're using the correct alias now:
            checkExactlyOneItem(acIDSel, "t", targetFunction);
            checkNoItems(acIDSel, "abs");
        }, true);
    });
});

describe("Underscore handling", () => {
    const importFunc = Cypress.env("mode") === "microbit" ? "__import__(name)" : "__import__(name)";
    
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
            cy.wait(600);
            checkNoItems(acIDSel, "abs(x)");
            checkNoItems(acIDSel, "AssertionError");
            checkExactlyOneItem(acIDSel, BUILTIN, importFunc);
            checkAutocompleteSorted(acIDSel, true);
            // Check docs are showing for built-in function:
            cy.get(acIDSel).contains("Import a module.");
        }, true);
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
            cy.wait(600);
            checkNoItems(acIDSel, "abs(x)");
            checkNoItems(acIDSel, "AssertionError");
            checkNoItems(acIDSel, "gmtime");
            checkNoItems(acIDSel, "ticks_add");
            checkExactlyOneItem(acIDSel, BUILTIN, importFunc);
            checkNoItems(acIDSel, "__doc__");
            checkNoItems(acIDSel, "__name__");
            checkAutocompleteSorted(acIDSel, true);
            // Now cancel this:
            cy.get("body").type("{backspace}{backspace}");
        }, true);
    });
    /* TODO restore once TigerPython supports these items:
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
            cy.wait(600);
            checkAutocompleteSorted(acIDSel, true);
            // Check docs are showing for built-in function:
            cy.get(acIDSel).contains("Default dir() implementation.");
        }, true);
    });
     */
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
            cy.wait(600);
            checkNoItems(acIDSel, "abs(x)");
            checkExactlyOneItem(acIDSel, BUILTIN, importFunc);
            checkExactlyOneItem(acIDSel, MYFUNCS, "__myFunction(myParam)");
            checkExactlyOneItem(acIDSel, MYVARS, "__myVar");
            checkAutocompleteSorted(acIDSel, true);
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
