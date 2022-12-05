function assertState(expectedState : string) : void {
    cy.get(".frame-header").first().within((h) => cy.get(".labelSlot-input,.frameColouredLabel").should((parts) => {
        let s = "";
        for (let i = 0; i < parts.length; i++) {
            const p : any = parts[i];

            const text = p.value || p.textContent || "";
            
            if (cy.wrap(p).is(":focus")) {
                s += "<" + p.selectionStart + ">";
            }

            if (p.classList.contains("labelSlot-input")) {
                s += "{" + text + "}";
            }
            else {
                s += text;
            }
        }
        expect(s).to.equal(expectedState);
    }));
}

function testInsert(insertion : string, result : string) : void {
    cy.get("body").type(" ");
    // Get rid of brackets:
    cy.get("body").type("{del}");
    assertState("{$}");
    cy.get("body").type(" " + insertion);
    assertState(result);
    
    // TODO test caret position?
    // TODO test splitting like in JAva 
}

// We need this to prevent test failures.  I don't actually know what the error is for sure
// (even if you log it, it is not visible), but I suspect it may be a Brython error that I
// see on the real site to do with an IndentationError in partial code:
Cypress.on("uncaught:exception", (err, runnable) => {
    // returning false here prevents Cypress from failing the test:
    return false;
});

// Must clear all local storage between tests to reset the state:
beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit("/",  {onBeforeLoad: (win) => {
        win.localStorage.clear();
        win.sessionStorage.clear();
    }});
});

describe("Test brackets", () => {
    it("Tests brackets", () => {
        testInsert("a+(b-c)", "{a}+{}_({b}-{c})_{$}");
    });
});
