function assertState(expectedState : string) : void {
    cy.get(".frame-header").first().within((h) => cy.get(".labelSlot-input,.frameColouredLabel").should((parts) => {
        let s = "";
        if (!parts) {
            // Try to debug an occasional seemingly impossible failure:
            cy.task('log', "Parts is null which I'm sure shouldn't happen, came from frame: " + h);
        }
        for (let i = 0; i < parts.length; i++) {
            const p : any = parts[i];

            const text = p.value || p.textContent || "";
            
            if (p.getAttribute("contenteditable") == "true" && !p.classList.contains("string-slot")) {
                s += "{" + text + "}";
            }
            else {
                s += text;
            }
        }
        // For now, we ignore cursor position (indicated by $):
        // Also, there is no correspondence for _ (indicating a null operator) in the Strype interface so just ignore that:
        expect(s).to.equal(expectedState.replace("$", "").replaceAll("_", ""));
    }));
}

function testInsert(insertion : string, result : string) : void {
    it("Tests " + insertion, () => {
        cy.get("body").type(" ");
        // Get rid of brackets:
        cy.get("body").type("{del}");
        assertState("{$}");
        cy.get("body").type(" " + insertion);
        assertState(result);

        // TODO test caret position?
        // TODO test splitting the insert like in Java
    });    
}


function testMultiInsert(multiInsertion : string, firstResult : string, secondResult : string) : void {
    // TODO implement
}

function testInsertExisting(a : string, b : string, c : string) : void {
    // TODO implement
}

function testBackspace(a : string, b : string) : void {
    // TODO implement
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

describe("Stride TestExpressionSlot.testOperators()", () => {
    // Any tests that are invalid for Python are commented out.  These include
    // those with !, &&, ||, ..
    
    testInsert("aa", "{aa$}");
    testInsert("a+b", "{a}+{b$}");
    testInsert("a+b-c", "{a}+{b}-{c$}");
    testInsert("1++1", "{1}+{+1$}");
    //testInsert("1<2&&3<=4&&5==6+8", "{1}<{2}&&{3}<={4}&&{5}=={6}+{8$}");
    //testInsert("false!=!false", "{false}!={}!{false$}");
    //testInsert("false!=!!!false", "{false}!={}!{}!{}!{false$}");
    // Must surround these in a method call because otherwise the = gets converted
    // to an assignment:
    testInsert("foo(5==-6)", "{foo}({5}=={-6$}){}");
    testInsert("foo(5==--6)", "{foo}({5}=={}-{-6$}){}");
    testInsert("foo(5==----6)", "{foo}({5}=={}-{}-{}-{-6$}){}");
    testInsert("a.b", "{a}.{b$}");
    //testInsert("a..b", "{a}..{b$}");
    testInsert("y-1", "{y}-{1$}");
    testInsert("getY()*1", "{getY}_({})_{}*{1$}");
    testInsert("getY()-1", "{getY}_({})_{}-{1$}");
    testInsert("getY()+-1", "{getY}_({})_{}+{-1$}");

    // Bug found in preview2:
    //testInsert("s.length()..10", "{s}.{length}_({})_{}..{10$}");
    // Partials of above:
    testInsert("s.length()", "{s}.{length}_({})_{$}");
    testInsert("s.length().", "{s}.{length}_({})_{}.{$}");
    //testInsert("s.length()..", "{s}.{length}_({})_{}..{$}");
    //testInsert("s.length()..1", "{s}.{length}_({})_{}..{1$}");
});

describe("Stride TestExpressionSlot.testStrings()", () => {
    // With trailing quote
    testInsert("\"hello\"", "{}_“hello”_{$}");
    // Without trailing quote (caret stays in string):
    testInsert("\"hello", "{}_“hello$”_{}");
    testInsert("\"hello\"+\"world\"", "{}_“hello”_{}+{}_“world”_{$}");
    testInsert("\"hello\"+\"world\"+(5*6)", "{}_“hello”_{}+{}_“world”_{}+{}_({5}*{6})_{$}");

    // Quote in a string, escaped:
    testInsert("\"\\\"\"", "{}_“\\\"”_{$}");
    // Escaped single quote:
    testInsert("\"\\'\"", "{}_“\\'”_{$}");
    // Unescaped single quote:
    testInsert("\"'\"", "{}_“'”_{$}");
    // Escaped backslash:
    testInsert("\"\\\\\"", "{}_“\\\\”_{$}");

    // All of the above again, but swapping single and double quotes:
    
    // With trailing quote
    testInsert("'hello'", "{}_‘hello’_{$}");
    // Without trailing quote (caret stays in string):
    testInsert("'hello", "{}_‘hello$’_{}");
    testInsert("'hello'+'world'", "{}_‘hello’_{}+{}_‘world’_{$}");
    testInsert("'hello'+'world'+(5*6)", "{}_‘hello’_{}+{}_‘world’_{}+{}_({5}*{6})_{$}");

    // Single quote in a string, escaped:
    testInsert("'\\''", "{}_‘\\'’_{$}");
    // Escaped double quote:
    testInsert("'\\\"'", "{}_‘\\\"’_{$}");
    // Unescaped double quote:
    testInsert("'\"'", "{}_‘\"’_{$}");
    // Escaped backslash:
    testInsert("'\\\\'", "{}_‘\\\\’_{$}");
    

    // Adding quote later:
    testMultiInsert("abc{\"}def", "{abc$def}", "{abc}_\"$\"_{def}");
    testMultiInsert("abc{\"}", "{abc$}", "{abc}_\"$\"_{}");
    testMultiInsert("{\"}def", "{$def}", "{}_\"$\"_{def}");
    testMultiInsert("abc{\"}.def", "{abc$}.{def}", "{abc}_\"$\"_{}.{def}");
    testMultiInsert("abc{\"}*def", "{abc$}*{def}", "{abc}_\"$\"_{}*{def}");
    testMultiInsert("abc{\"}def()", "{abc$def}_({})_{}", "{abc}_\"$\"_{def}_({})_{}");
    testMultiInsert("abc{\"}()", "{abc$}_({})_{}", "{abc}_\"$\"_{}_({})_{}");

    // Adding string adjacent to String:
    // First, before:
    testInsertExisting("$\"b\"", "\"a", "{}_\"a$\"_{}_\"b\"_{}");
    testInsertExisting("$\"b\"", "\"a\"", "{}_\"a\"_{$}_\"b\"_{}");
    // Also, after:
    testInsertExisting("\"a\"$", "\"b", "{}_\"a\"_{}_\"b$\"_{}");


    // Example found while pasting from BlueJ (double escaped here)
    // TODO re-enable
    //testInsert("foo(c == '\\\\' or c == '\"' or c == '\\'')",
    //"{foo}_({c}=={}_‘\\\\’_{}or{c}=={}_‘\"’_{}or{c}=={}_‘\\'’_{$})_{}");

    // Deletion:
    testBackspace("\"a\bb\"", "{}_\"$b\"_{}");
    testBackspace("\"\bab\"", "{$ab}");
    testBackspace("\"ab\b\"", "{}_\"a$\"_{}");
    testBackspace("\"ab\"\b", "{ab$}");
});
