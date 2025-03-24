// Test that the translation is working properly
import i18n from "@/i18n";
import {expect} from "chai";
import failOnConsoleError from "cypress-fail-on-console-error";
failOnConsoleError();
import { WINDOW_STRYPE_HTMLIDS_PROPNAME, WINDOW_STRYPE_SCSSVARS_PROPNAME } from "../../../src/helpers/sharedIdCssWithTests";

/**
 * Given a JQuery with multiple results and an array of expected string content,
 * checks that the two are the same size and that the text() of each JQuery result matches the
 * corresponding expected string content.
 */
function checkTextEquals(ws: JQuery, expecteds : string[]) : void {
    expect(ws.length).to.equal(expecteds.length);
    for (let i = 0; i < ws.length; i++) {
        expect(ws.eq(i).text()).to.equal(expecteds[i]);
    }
}

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
    });
});

describe("Translation tests", () => {
    it("Translates correctly", () => {
        // Starts as English:
        cy.get("." + scssVars.frameContainerLabelSpanClassName).should((hs) => checkTextEquals(hs, [i18n.t("appMessage.importsContainer") as string, i18n.t("appMessage.funcDefsContainer") as string, i18n.t("appMessage.mainContainer") as string]));
        cy.get("select#" + strypeElIds.getAppLangSelectId()).should("have.value", "en");

        // Swap to French and check it worked:
        cy.get("button#" + strypeElIds.getEditorMenuUID()).click();
        cy.get("select#" + strypeElIds.getAppLangSelectId()).select("fr");
        cy.get("select#" + strypeElIds.getAppLangSelectId()).should("have.value", "fr");

        // Check that the sections are present and translated:
        cy.get("."+ scssVars.frameContainerLabelSpanClassName).should((hs) => checkTextEquals(hs, [i18n.t("appMessage.importsContainer", "fr") as string, i18n.t("appMessage.funcDefsContainer", "fr") as string, i18n.t("appMessage.mainContainer", "fr") as string]));

        // Close the menu:
        cy.get("body").type("{esc}");
        cy.wait(1000);
        
        // Check that sections in the autocomplete are translated:
        // Add a function:
        cy.get("body").type("{uparrow}ffoo{downarrow}{downarrow}");
        // And a variable:
        cy.get("body").type("{downarrow}=bar=3{rightarrow}");
        // Then trigger autocomplete:
        cy.get("body").type(" {ctrl} ");
        // And check the sections:
        const expAuto = [i18n.t("autoCompletion.myVariables", "fr") as string, i18n.t("autoCompletion.myFunctions", "fr") as string];
        if (Cypress.env("mode") === "microbit") {
            expAuto.push("microbit");
        }
    });
    it("Resets translation properly", () => {
        // Should be back to English:
        cy.get("." + scssVars.frameContainerLabelSpanClassName).should((hs) => checkTextEquals(hs, [i18n.t("appMessage.importsContainer") as string, i18n.t("appMessage.funcDefsContainer") as string, i18n.t("appMessage.mainContainer") as string]));
        cy.get("select#" + strypeElIds.getAppLangSelectId()).should("have.value", "en");
    });
});
