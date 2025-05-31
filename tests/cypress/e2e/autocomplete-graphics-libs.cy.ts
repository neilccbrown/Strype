// eslint-disable-next-line @typescript-eslint/no-var-requires
require("cypress-terminal-report/src/installLogsCollector")();
import { WINDOW_STRYPE_HTMLIDS_PROPNAME, WINDOW_STRYPE_SCSSVARS_PROPNAME } from "../../../src/helpers/sharedIdCssWithTests";
import "@testing-library/cypress/add-commands";
import "../support/autocomplete-test-support";
import {checkExactlyOneItem, checkNoItems, focusEditorAC, withAC} from "../support/autocomplete-test-support";

// Needed for the "be.sorted" assertion:
// eslint-disable-next-line @typescript-eslint/no-var-requires
chai.use(require("chai-sorted"));
import failOnConsoleError from "cypress-fail-on-console-error";
failOnConsoleError();


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


describe("Graphics library", () => {
    if (Cypress.env("mode") == "microbit") {
        // No graphics support in microbit mode:
        return;
    }
    it("Shows completions for graphics standalone functions", () => {
        focusEditorAC();
        // Add graphics import:
        cy.get("body").type("{uparrow}{uparrow}fstrype.graphics{rightarrow}*{rightarrow}{downarrow}{downarrow}");
        // Add a function frame and trigger auto-complete:
        cy.get("body").type(" ");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel).should("be.visible");
            checkExactlyOneItem(acIDSel, "strype.graphics", "load_image(filename)");
            checkExactlyOneItem(acIDSel, "strype.graphics", "stop()");
            checkExactlyOneItem(acIDSel, "strype.graphics", "pause()");
            checkNoItems(acIDSel, "__name__");
            // Shouldn't show methods from Actor at top-level:
            checkNoItems(acIDSel, "is_at_edge()");
            checkNoItems(acIDSel, "remove()");
        }, false);
    });

    it("Shows completions for object constructor", () => {
        focusEditorAC();
        // Add graphics import:
        cy.get("body").type("{uparrow}{uparrow}fstrype.graphics{rightarrow}*{rightarrow}{downarrow}{downarrow}");
        // Add a function frame and trigger auto-complete:
        cy.get("body").type(" ");
        cy.wait(500);
        cy.get("body").type("{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel).should("be.visible");
            checkExactlyOneItem(acIDSel, "strype.graphics", "Actor(image_or_filename)");
        }, false);
    });

    it("Shows completions for return of graphics load_image", () => {
        focusEditorAC();
        // Add graphics import:
        cy.get("body").type("{uparrow}{uparrow}fstrype.graphics{rightarrow}*{rightarrow}{downarrow}{downarrow}");
        // Add a function frame and trigger auto-complete:
        cy.get("body").type(" ");
        cy.wait(500);
        cy.get("body").type("load_image('a').{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "get_width()");
        }, false);
    });

    it("Shows completions for Actor methods", () => {
        focusEditorAC();
        // Add graphics import:
        cy.get("body").type("{uparrow}{uparrow}fstrype.graphics{rightarrow}*{rightarrow}{downarrow}{downarrow}");
        // Make an actor:
        cy.get("body").type("=a=Actor('cat-test.jpg'){rightarrow}");
        // Add a function frame and trigger auto-complete:
        cy.get("body").type(" ");
        cy.wait(500);
        cy.get("body").type("a.{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "is_at_edge()");
            checkExactlyOneItem(acIDSel, null, "move(distance)");
            checkExactlyOneItem(acIDSel, null, "get_all_touching()");
            checkExactlyOneItem(acIDSel, null, "set_location(x, y)");
            checkNoItems(acIDSel, "__name__");
            // Shouldn't show methods from top-level:
            checkNoItems(acIDSel, "stop()");
            checkNoItems(acIDSel, "pause()");
        }, false);
    });

    it("Shows completions for Image methods", () => {
        focusEditorAC();
        // Add graphics import:
        cy.get("body").type("{uparrow}{uparrow}fstrype.graphics{rightarrow}*{rightarrow}{downarrow}{downarrow}");
        // Make an image:
        cy.get("body").type("=e=Image(100, 100){rightarrow}");
        // Add a function frame and trigger auto-complete:
        cy.get("body").type(" ");
        cy.wait(500);
        cy.get("body").type("e.{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "get_width()");
            checkExactlyOneItem(acIDSel, null, "fill()");
            // Shouldn't show methods from top-level:
            checkNoItems(acIDSel, "stop()");
            checkNoItems(acIDSel, "pause()");
        }, false);
    });

    it("Shows completions for Image methods on clone()", () => {
        focusEditorAC();
        // Add graphics import:
        cy.get("body").type("{uparrow}{uparrow}fstrype.graphics{rightarrow}*{rightarrow}{downarrow}{downarrow}");
        // Make an image:
        cy.get("body").type("=e=Image(100, 100){rightarrow}");
        // Add a function frame and trigger auto-complete:
        cy.get("body").type(" ");
        cy.wait(500);
        cy.get("body").type("e.clone().{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "get_width()");
            checkExactlyOneItem(acIDSel, null, "fill()");
            // Shouldn't show methods from top-level:
            checkNoItems(acIDSel, "stop()");
            checkNoItems(acIDSel, "pause()");
        }, false);
    });

    it("Shows completions for Image methods on Actor.get_image()", () => {
        focusEditorAC();
        // Add graphics import:
        cy.get("body").type("{uparrow}{uparrow}fstrype.graphics{rightarrow}*{rightarrow}{downarrow}{downarrow}");
        // Make an image:
        cy.get("body").type("=a=Actor('blah'){rightarrow}");
        // Add a function frame and trigger auto-complete:
        cy.get("body").type(" ");
        cy.wait(500);
        cy.get("body").type("a.get_image().{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "get_width()");
            checkExactlyOneItem(acIDSel, null, "fill()");
            // Shouldn't show methods from top-level:
            checkNoItems(acIDSel, "stop()");
            checkNoItems(acIDSel, "pause()");
        }, false);
    });
});
