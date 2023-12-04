
// Test that the translation is working properly
import i18n from "@/i18n";
import {expect} from "chai";

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

// Must clear all local storage between tests to reset the state:
beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit("/",  {onBeforeLoad: (win) => {
        win.localStorage.clear();
        win.sessionStorage.clear();
    }});
});

describe("Translation tests", () => {
    it("Translates correctly", () => {
        // Starts as English:
        cy.get(".frame-container-label-span").should((hs) => checkTextEquals(hs, [i18n.t("appMessage.importsContainer") as string, i18n.t("appMessage.funcDefsContainer") as string, i18n.t("appMessage.mainContainer") as string]));
        cy.get("select#appLangSelect").should("have.value", "en");

        // Swap to French and check it worked:
        cy.get("button#showHideMenu").click();
        cy.get("select#appLangSelect").select("fr");
        cy.get("select#appLangSelect").should("have.value", "fr");

        // Check that the sections are present and translated:
        cy.get(".frame-container-label-span").should((hs) => checkTextEquals(hs, [i18n.t("appMessage.importsContainer", "fr") as string, i18n.t("appMessage.funcDefsContainer", "fr") as string, i18n.t("appMessage.mainContainer", "fr") as string]));

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
        expAuto.push("Python", i18n.t("autoCompletion.invalidState", "fr") as string);
        cy.get("div.module > em").should((hs) => checkTextEquals(hs, expAuto));
    });
    it("Resets translation properly", () => {
        // Should be back to English:
        cy.get(".frame-container-label-span").should((hs) => checkTextEquals(hs, [i18n.t("appMessage.importsContainer") as string, i18n.t("appMessage.funcDefsContainer") as string, i18n.t("appMessage.mainContainer") as string]));
        cy.get("select#appLangSelect").should("have.value", "en");
    });
});
