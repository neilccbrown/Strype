// eslint-disable-next-line @typescript-eslint/no-var-requires
require("cypress-terminal-report/src/installLogsCollector")();
import "@testing-library/cypress/add-commands";
import "../support/autocomplete-test-support";
import {BUILTIN, checkAutocompleteSorted, checkExactlyOneItem, checkNoItems, focusEditorAC, withAC, scssVars} from "../support/autocomplete-test-support";

// Needed for the "be.sorted" assertion:
// eslint-disable-next-line @typescript-eslint/no-var-requires
chai.use(require("chai-sorted"));
import failOnConsoleError from "cypress-fail-on-console-error";
failOnConsoleError();


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
        // Add a function call frame and trigger auto-complete:
        cy.get("body").type(" ");
        cy.wait(500);
        cy.get("body").type("load_image('a').{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "get_width()");
        }, false);
    });

    it("Shows completions for return of sound load_sound", () => {
        focusEditorAC();
        // Add graphics import:
        cy.get("body").type("{uparrow}{uparrow}fstrype.sound{rightarrow}*{rightarrow}{downarrow}{downarrow}");
        // Add a function call frame and trigger auto-complete:
        cy.get("body").type(" ");
        cy.wait(500);
        cy.get("body").type("load_sound('a').{ctrl} ");
        withAC((acIDSel, frameId) => {
            cy.get(acIDSel).should("be.visible");
            checkExactlyOneItem(acIDSel, null, "get_samples()");
        }, false);
    });

    it("Shows completions for image literal", () => {
        cy.readFile("public/graphics_images/cat-test.jpg", null).then((catJPEG) => {
            focusEditorAC();
            // Add graphics import:
            cy.get("body").type("{uparrow}{uparrow}fstrype.graphics{rightarrow}*{rightarrow}{downarrow}{downarrow}");
            // Add a function call frame and trigger auto-complete:
            cy.get("body").type(" {del}");
            cy.wait(500);
            (cy.focused() as any).paste(catJPEG, "image/jpeg");
            cy.wait(500);
            cy.get("body").type(".");
            cy.wait(300);
            cy.get("body").type("{ctrl} ");
            cy.wait(1000);
            withAC((acIDSel, frameId) => {
                cy.get(acIDSel).should("be.visible");
                checkExactlyOneItem(acIDSel, null, "get_width()");
            }, false);
        });
    });

    it("Shows completions for audio literal", () => {
        cy.readFile("public/sounds/cat-test-meow.wav", null).then((catWAV) => {
            focusEditorAC();
            // Add graphics import:
            cy.get("body").type("{uparrow}{uparrow}fstrype.sound{rightarrow}*{rightarrow}{downarrow}{downarrow}");
            // Add a function call frame and trigger auto-complete:
            cy.get("body").type(" {del}");
            cy.wait(500);
            (cy.focused() as any).paste(catWAV, "audio/wav");
            cy.wait(500);
            cy.get("body").type(".");
            cy.wait(300);
            cy.get("body").type("{ctrl} ");
            cy.wait(1000);
            withAC((acIDSel, frameId) => {
                cy.get(acIDSel).should("be.visible");
                checkExactlyOneItem(acIDSel, null, "get_samples()");
            }, false);
        });
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
