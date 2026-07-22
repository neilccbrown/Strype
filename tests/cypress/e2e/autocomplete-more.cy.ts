import { scssVars } from "../support/standard-setup";
import { clearDefaultImports } from "../support/test-support";

require("cypress-terminal-report/src/installLogsCollector")();
import "@testing-library/cypress/add-commands";
// Get all the beforeEach parts:
import "../support/autocomplete-test-support";
import {checkExactlyOneItem, checkNoItems, checkNoneAvailable, focusEditorAC, MYVARS, withAC} from "../support/autocomplete-test-support";

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
        }, false);
    });
});

describe("Loop vars", () => {
    it("Offers both loop vars in for loop", () => {
        focusEditorAC();
        // Go down and enter for index, val in enumerate(myString), then function call in body:
        cy.get("body").type("{downarrow}findex,val{rightarrow}enumerate(myString){rightarrow} ");
        cy.wait(500);
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkNoItems(acIDSel, "<any>");
            checkExactlyOneItem(acIDSel, MYVARS, "index");
            checkExactlyOneItem(acIDSel, MYVARS, "val");
        }, true);
    });
});

describe("Function params", () => {
    it("Shows function param in if", () => {
        focusEditorAC();
        // Go up to functions section, add a function named "foo", a description "bar", then go into body:
        cy.get("body").type("{uparrow}fgetGuess{rightarrow}alreadyGuessed{rightarrow}{downarrow}");
        cy.get("body").type("=guess=input('Guess a letter:'){downarrow}");
        cy.get("body").type("i");
        cy.wait(500);
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkNoItems(acIDSel, "<any>");
            checkExactlyOneItem(acIDSel, MYVARS, "guess");
            checkExactlyOneItem(acIDSel, MYVARS, "alreadyGuessed");
        }, false);
    });
    it("Shows function param in elif", () => {
        focusEditorAC();
        // Go up to functions section, add a function named "foo", a description "bar", then go into body:
        cy.get("body").type("{uparrow}fgetGuess{rightarrow}alreadyGuessed{rightarrow}{downarrow}");
        cy.get("body").type("=guess=input('Guess a letter:'){downarrow}");
        cy.get("body").type("iguess==''{downarrow}l");
        cy.wait(500);
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkNoItems(acIDSel, "<any>");
            checkExactlyOneItem(acIDSel, MYVARS, "guess");
            checkExactlyOneItem(acIDSel, MYVARS, "alreadyGuessed");
        }, false);
    });
});

describe("Function params: types inferred from callers", () => {
    // TigerPython can infer the type of an untyped function/method parameter by looking at
    // the arguments used at its call sites elsewhere in the code, so member completion inside
    // the body can work even though the parameter has no annotation or default value.
    it("Shows string members for a top-level function param, inferred from a caller", () => {
        focusEditorAC();
        // A caller elsewhere in "My code" gives evidence that s is a string:
        cy.get("body").type(" foo(\"hi\"){enter}");
        // Go up to functions section and define foo(s):
        cy.get("body").type("{uparrow}{uparrow}ffoo{rightarrow}s{rightarrow}{downarrow}");
        cy.get("body").type(" s.");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "lower()");
            checkExactlyOneItem(acIDSel, null, "upper()");
        }, false, true);
    });

    it("Shows int members (not string members) for a top-level function param, inferred from a caller", () => {
        focusEditorAC();
        cy.get("body").type(" foo(5){enter}");
        cy.get("body").type("{uparrow}{uparrow}ffoo{rightarrow}n{rightarrow}{downarrow}");
        cy.get("body").type(" n.");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "bit_length()");
            checkNoItems(acIDSel, "lower()");
            checkNoItems(acIDSel, "upper()");
        }, false, true);
    });

    it("Shows no completions for a top-level function param called with mixed types", () => {
        focusEditorAC();
        // Two callers give conflicting evidence (str and int), which share no members:
        cy.get("body").type(" foo(\"hi\"){enter}");
        cy.get("body").type(" foo(5){enter}");
        cy.get("body").type("{uparrow}{uparrow}{uparrow}ffoo{rightarrow}s{rightarrow}{downarrow}");
        cy.get("body").type(" s.");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkNoneAvailable(acIDSel);
        }, false, true);
    });

    // For class methods, TigerPython currently only picks up call-site evidence from calls made
    // elsewhere within the same class (e.g. a sibling method calling this one) -- not from an
    // external caller in "My code". So these tests use a sibling method as the caller instead of a
    // caller in "My code". (This may be related to the separate, more precisely diagnosed limitation
    // covered below, in "Function params: types inferred from callers (Actor, multiple params)":
    // TigerPython can't resolve the type of a call argument that is itself a "My code" variable
    // assigned after the point where "Definitions" -- which is generated in the same order it appears
    // in the editor -- uses it, even though it can forward-reference a plain variable's own type.)
    it("Shows string members for a class method param, inferred from a sibling method caller", () => {
        focusEditorAC();
        // Make a class frame "foo" (default __init__(self, bar)), a "helper" method calling
        // myF with a string, then myF(self, s) itself:
        cy.get("body").type("{uparrow}cfoo{downarrow}{downarrow}{downarrow}{leftarrow}{leftarrow}bar{rightarrow}{rightarrow}{downarrow}fhelper{rightarrow}{rightarrow}{downarrow}");
        cy.get("body").type(" self.myF(\"hi\"){enter}");
        cy.get("body").type("{downarrow}fmyF{rightarrow}s{rightarrow}{rightarrow}");
        cy.get("body").type(" s.");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "lower()");
            checkExactlyOneItem(acIDSel, null, "upper()");
        }, false, true);
    });

    it("Shows int members (not string members) for a class method param, inferred from a sibling method caller", () => {
        focusEditorAC();
        cy.get("body").type("{uparrow}cfoo{downarrow}{downarrow}{downarrow}{leftarrow}{leftarrow}bar{rightarrow}{rightarrow}{downarrow}fhelper{rightarrow}{rightarrow}{downarrow}");
        cy.get("body").type(" self.myF(5){enter}");
        cy.get("body").type("{downarrow}fmyF{rightarrow}n{rightarrow}{rightarrow}");
        cy.get("body").type(" n.");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "bit_length()");
            checkNoItems(acIDSel, "lower()");
        }, false, true);
    });

    it("Shows no completions for a class method param called with mixed types", () => {
        focusEditorAC();
        cy.get("body").type("{uparrow}cfoo{downarrow}{downarrow}{downarrow}{leftarrow}{leftarrow}bar{rightarrow}{rightarrow}{downarrow}fhelper{rightarrow}{rightarrow}{downarrow}");
        cy.get("body").type(" self.myF(\"hi\"){enter}");
        cy.get("body").type(" self.myF(5){enter}");
        cy.get("body").type("{downarrow}fmyF{rightarrow}s{rightarrow}{rightarrow}");
        cy.get("body").type(" s.");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkNoneAvailable(acIDSel);
        }, false, true);
    });
});

describe("Function params: types inferred from callers (Actor, multiple params)", () => {
    if (Cypress.env("mode") === "microbit") {
        // Actor is part of strype.graphics, not available in microbit mode:
        return;
    }

    it("Shows Actor members for a top-level function param, inferred from a caller", () => {
        focusEditorAC();
        clearDefaultImports();
        cy.get("body").type("fstrype.graphics{rightarrow}*{rightarrow}{downarrow}{downarrow}");
        cy.get("body").type("=myActor=Actor(\"cat-test.jpg\",0,0,\"t\"){enter}");
        cy.get("body").type(" foo(myActor){enter}");
        cy.get("body").type("{uparrow}{uparrow}{uparrow}ffoo{rightarrow}a{rightarrow}{downarrow}");
        cy.get("body").type(" a.");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "is_at_edge(distance)");
            checkExactlyOneItem(acIDSel, null, "move(distance)");
        }, false, true);
    });

    it("Infers 3+ top-level function params independently from a single caller", () => {
        focusEditorAC();
        clearDefaultImports();
        cy.get("body").type("fstrype.graphics{rightarrow}*{rightarrow}{downarrow}{downarrow}");
        cy.get("body").type("=myActor=Actor(\"cat-test.jpg\",0,0,\"t\"){enter}");
        // One caller gives evidence for all 3 params at once (string, int, Actor):
        cy.get("body").type(" foo(\"hi\",5,myActor){enter}");
        cy.get("body").type("{uparrow}{uparrow}{uparrow}ffoo{rightarrow}s,n,a{rightarrow}{downarrow}");
        cy.get("body").type(" s.");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "lower()");
        }, false, true);
        // Close the popup and move to the next parameter's check on the next line:
        cy.get("body").type("{esc}");
        cy.get("body").type("{downarrow}");
        cy.get("body").type(" n.");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "bit_length()");
            checkNoItems(acIDSel, "lower()");
        }, false, true);
        cy.get("body").type("{esc}");
        cy.get("body").type("{downarrow}");
        cy.get("body").type(" a.");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "is_at_edge(distance)");
            checkExactlyOneItem(acIDSel, null, "move(distance)");
        }, false, true);
    });

    it("Shows no completions for a class method param whose sibling-caller evidence is a 'My code' variable", () => {
        // myActor is assigned in "My code", which -- matching the editor's actual section order -- is
        // generated after "Definitions". TigerPython can forward-reference a plain variable's own type
        // (see "Global variable type inference inside functions" below), but not the type of a variable
        // passed as a call argument when inferring the callee's parameter type from that call site: the
        // argument's assignment has to come first. See getCodeWithoutErrors() in parser.ts.
        focusEditorAC();
        clearDefaultImports();
        cy.get("body").type("fstrype.graphics{rightarrow}*{rightarrow}{downarrow}{downarrow}");
        cy.get("body").type("=myActor=Actor(\"cat-test.jpg\",0,0,\"t\"){enter}");
        cy.get("body").type("{uparrow}{uparrow}cfoo{downarrow}{downarrow}{downarrow}{leftarrow}{leftarrow}bar{rightarrow}{rightarrow}{downarrow}fhelper{rightarrow}{rightarrow}{downarrow}");
        cy.get("body").type(" self.myF(myActor){enter}");
        cy.get("body").type("{downarrow}fmyF{rightarrow}a{rightarrow}{rightarrow}");
        cy.get("body").type(" a.");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkNoneAvailable(acIDSel);
        }, false, true);
    });

    it("Infers 3+ class method params independently from a single sibling method caller", () => {
        focusEditorAC();
        clearDefaultImports();
        cy.get("body").type("fstrype.graphics{rightarrow}*{rightarrow}{downarrow}{downarrow}");
        cy.get("body").type("=myActor=Actor(\"cat-test.jpg\",0,0,\"t\"){enter}");
        cy.get("body").type("{uparrow}{uparrow}cfoo{downarrow}{downarrow}{downarrow}{leftarrow}{leftarrow}bar{rightarrow}{rightarrow}{downarrow}fhelper{rightarrow}{rightarrow}{downarrow}");
        cy.get("body").type(" self.myF(\"hi\",5,myActor){enter}");
        cy.get("body").type("{downarrow}fmyF{rightarrow}s,n,a{rightarrow}{rightarrow}");
        cy.get("body").type(" s.");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "lower()");
        }, false, true);
        cy.get("body").type("{esc}");
        cy.get("body").type("{downarrow}");
        cy.get("body").type(" n.");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "bit_length()");
            checkNoItems(acIDSel, "lower()");
        }, false, true);
        cy.get("body").type("{esc}");
        cy.get("body").type("{downarrow}");
        cy.get("body").type(" a.");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        // Unlike s and n above (literal call-site arguments), myActor is a "My code" variable -- see the
        // "Shows no completions for a class method param whose sibling-caller evidence is a 'My code'
        // variable" test above for why this specific combination doesn't currently work.
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkNoneAvailable(acIDSel);
        }, false, true);
    });
});

describe("Global variable type inference inside functions", () => {
    // Code is generated for autocomplete in the same section order it appears in the editor (imports,
    // then Definitions, then "My code"), yet a function can still see the type of a variable assigned
    // later in "My code": TigerPython forward-references a plain variable's own assignment regardless
    // of which direction it's textually offset in. (This is unlike the narrower case in "Function
    // params: types inferred from callers (Actor, multiple params)" above, where the variable isn't
    // looked up directly but is instead passed as a call argument used to infer a callee's parameter
    // type -- that specific, more indirect kind of forward reference isn't resolved by TigerPython.)
    // These two tests check the direct case: one with the variable declared "global" in the function
    // first (as real Python requires if you want to *assign* to it), one without (valid Python too,
    // since merely *reading* a global from inside a function never requires the "global" keyword --
    // it's only needed for assignment).
    it("Shows string members for a variable declared 'global' in a function, assigned in My code", () => {
        focusEditorAC();
        // Assign a = "hi" in "My code":
        cy.get("body").type("=a=\"hi\"{enter}");
        // Go up to Definitions and make a function foo() with body: global a / a.<dot>
        cy.get("body").type("{uparrow}{uparrow}ffoo{rightarrow}{rightarrow}{downarrow}");
        cy.get("body").type("ga{enter}");
        cy.get("body").type(" a.");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "lower()");
            checkExactlyOneItem(acIDSel, null, "upper()");
        }, false, true);
    });

    it("Shows string members for a variable used without 'global' in a function, assigned in My code", () => {
        focusEditorAC();
        // Assign b = "bye" in "My code":
        cy.get("body").type("=b=\"bye\"{enter}");
        // Go up to Definitions and make a function bar() with body: b.<dot> (no "global" needed to read b):
        cy.get("body").type("{uparrow}{uparrow}fbar{rightarrow}{rightarrow}{downarrow}");
        cy.get("body").type(" b.");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "lower()");
            checkExactlyOneItem(acIDSel, null, "upper()");
        }, false, true);
    });
});

describe("Overlapping imports", () => {
    it("Offers all imports from module even where is overlapping from import:", () => {
        focusEditorAC();
        // Add two imports: import math, and from math import sin, cos
        clearDefaultImports();
        cy.get("body").type("imath{downarrow}fmath{rightarrow}sin,cos{downarrow}{downarrow}{downarrow}");
        // Now we're back in main body, make a function call with math.:
        cy.get("body").type(" math.");
        cy.wait(500);
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkNoItems(acIDSel, "<any>");
            checkExactlyOneItem(acIDSel, "math", "sin(x)");
            checkExactlyOneItem(acIDSel, "math", "cos(x)");
            checkExactlyOneItem(acIDSel, "math", "tan(x)");
        }, true);
    });
});

describe("Import of structured items", () => {
    if (Cypress.env("mode") === "microbit") {
        return;
    }
    it("Shows today in fully qualified date", () => {
        focusEditorAC();
        // Add import: from datetime import date
        clearDefaultImports();
        cy.get("body").type("fdatetime{rightarrow}date{downarrow}{downarrow}{downarrow}");
        // Now we're back in main body, make a function call with math.:
        cy.get("body").type(" ");
        cy.wait(500);
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkNoItems(acIDSel, "<any>");
            checkExactlyOneItem(acIDSel, "datetime", "date.today()");
        }, true);
    });
    it("Shows today in after date.", () => {
        focusEditorAC();
        // Add import: from datetime import date
        clearDefaultImports();
        cy.get("body").type("fdatetime{rightarrow}date{downarrow}{downarrow}{downarrow}");
        // Now we're back in main body, make a function call with math.:
        cy.get("body").type(" date.");
        cy.wait(500);
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkNoItems(acIDSel, "<any>");
            checkExactlyOneItem(acIDSel, "date", "today()");
        }, true);
    });
});

describe("Asset files", () => {
    it("Offers auto-complete in string literal for assets", () => {
        focusEditorAC();
        // Make a print and open a string:
        cy.get("body").type("p\"");
        cy.wait(500);
        // Trigger auto-complete:
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel + " ." + scssVars.acPopupContainerClassName).should("be.visible");
            checkNoItems(acIDSel, "len");
            checkExactlyOneItem(acIDSel, null, "/books/three-men-in-a-boat.txt");
            checkNoItems(acIDSel, "cat-test");
        }, false);
    });
});
