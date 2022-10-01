import * as path from "path";
/**
 * Given an array of wrappers and an array of expected string content,
 * checks that the arrays are the same size and that the text() of each wrapper matches the
 * corresponding expected string content.
 */
function checkTextEquals(ws: JQuery, expecteds : string[]) : void {
    expect(ws.length).to.equal(expecteds.length)
    for (let i = 0; i < ws.length; i++) {
        expect(ws.eq(i).text()).to.equal(expecteds[i])
    }
}

/**
 * Gets all the text from the labels and fields in a frame and glues
 * it together into one string.
 * @param w A wrapper representing a .frameDiv element
 */
function matchFrameText(matchNext : (line: string) => void) : void {
    cy.get(".frame-header").first().get("input,.frameColouredLabel").should((parts) => {
        let s = ""
        for (let i = 0; i < parts.length; i++) {
            const p : any = parts[i]

            const text = p.value || p.textContent || "" //String(typeof p) + String(p) + "#" + () + ":"
            
            if (s.length == 0) {
                s = text
            }
            else {
                s = s.trimEnd() + " " + text
            }
        }
        matchNext(s.trimEnd())
    })
}

/**
 * Sanity check the state of the editor (e.g. only one caret visible)
 */
function sanityCheck() : void {
    // Check exactly one caret visible or focused input field:
    cy.get(".caret:not(.invisible),input:focus").should("have.length", 1)
}

/**
 * Check if a list of actual strings matches a list of expected strings or regexes.
 */
function expectMatchRegex(actual: string[], expected: (string | RegExp)[]) {
    // Deliberate double escape, use \n to separate lines but have it all appear on one line:
    expect(actual.length, "Actual: " + actual.join("\\n")).to.equal(expected.length)
    for (let i = 0; i < actual.length; i++) {
        if (expected[i] instanceof RegExp) {
            expect(actual[i]).to.match(expected[i] as RegExp)
        }
        else {
            expect(actual[i]).to.equal(expected[i])
        }
    }
}

/**
 * Check that the code is equal to the given lines, by checking the visuals and the underlying Python
 * conversion.  codeLines should be a list of lines of code, how they appear *visually*
 * (so equality should be ⇐, not =).
 */
function checkCodeEquals(codeLines : (string | RegExp)[]) : void {
    sanityCheck()
    cy.get(".frameDiv").each((f, i) => cy.wrap(f).within((f2) => matchFrameText((s) => expectMatchRegex([s], [codeLines[i]]))))
    const downloadsFolder = Cypress.config("downloadsFolder")
    cy.task("deleteFile", path.join(downloadsFolder, "main.py"))
    cy.contains("Convert to Python file").click()
    
    cy.readFile(path.join(downloadsFolder, "main.py")).then((p : string) => {
        expectMatchRegex(p.split("\n").map((l) => l.trimEnd()),
            codeLines.concat([/\s*/]))
    })
}

let defaultImports : (string | RegExp)[]
let defaultMyCode : (string | RegExp)[]
let initialStateName : string
if (Cypress.env("mode") == "microbit") {
    defaultImports = [
        "from microbit import *",
    ]

    defaultMyCode = [
        /myString\s+[⇐=]\s+"Hello micro:bit!"/,
        "display.scroll(myString)",
    ]
    initialStateName = "initialMicrobitState"
}
else {
    defaultImports = [
    ]

    defaultMyCode  = [
        /myString\s+[⇐=]\s+"Hello from Python!"/,
        "print(myString)",
    ]
    initialStateName = "initialPythonState"
}


beforeEach(() => {
    cy.clearLocalStorage()
    cy.visit("/",  {onBeforeLoad: (win) => {
        win.localStorage.clear();
        win.sessionStorage.clear();
    }})
})
describe("Translation", () => {
    it("Translates correctly", () => {
        // Starts as English:
        cy.get(".frame-container-label-span").should((hs) => checkTextEquals(hs, ["Imports:", "Function definitions:", "My code:"]))
        cy.get("select#appLangSelect").should("have.value", "en")

        // Swap to French and check it worked:
        cy.get("button#showHideMenu").click()
        cy.get("select#appLangSelect").select("fr")
        cy.get("select#appLangSelect").should("have.value", "fr")

        // check that the sections are present and translated:
        cy.get(".frame-container-label-span").should((hs) => checkTextEquals(hs, ["Imports :", "Définitions de fonctions :", "Mon code :"]))
    })
    it("Resets translation properly", () => {
        // Should be back to English:
        cy.get(".frame-container-label-span").should((hs) => checkTextEquals(hs, ["Imports:", "Function definitions:", "My code:"]))
        cy.get("select#appLangSelect").should("have.value", "en")
    })
})
describe("Adding frames", () => {
    it("Lets you add a frame", () => {
        checkCodeEquals(defaultImports.concat(defaultMyCode))
        cy.get("body").type(" foo(")
        checkCodeEquals(defaultImports.concat([
            "foo()",
        ]).concat(defaultMyCode))
    })
    it("Lets you add multiple frames", () => {
        checkCodeEquals(defaultImports.concat(defaultMyCode))
        cy.get("body").type(" foo({enter} bar(3")
        checkCodeEquals(defaultImports.concat([
            "foo()",
            "bar(3)",
        ]).concat(defaultMyCode))
    })
})
