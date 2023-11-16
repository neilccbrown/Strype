function assertState(expectedState : string) : void {
    withSelection((info) => {
        cy.get("#FrameContainer_-3 .frame-header").first().within((h) => cy.get(".labelSlot-input,.frameColouredLabel").then((parts) => {
            let s = "";
            if (!parts) {
                // Try to debug an occasional seemingly impossible failure:
                cy.task("log", "Parts is null which I'm sure shouldn't happen, came from frame: " + h);
            }
            // Since we're in an if frame, we ignore the first and last part:
            for (let i = 1; i < parts.length - 1; i++) {
                const p : any = parts[i];
    
                let text = p.value || p.textContent || "";
                
                // If we're the focused slot, put a dollar sign in to indicate the current cursor position:
                if (info.id === p.getAttribute("id") && info.cursorPos >= 0) {
                    text = text.substring(0, info.cursorPos) + "$" + text.substring(info.cursorPos);
                }
                // Don't put curly brackets around strings, operators or brackets:
                if (!p.classList.contains("string-slot") && !p.classList.contains("operator-slot") && !/[([)\]$]/.exec(p.textContent)) {
                    text = "{" + text + "}";
                }
                s += text;
            }
            // There is no correspondence for _ (indicating a null operator) in the Strype interface so just ignore that:
            expect(s).to.equal(expectedState.replaceAll("_", ""));
        }));
    });
}

function withSelection(inner : (arg0: { id: string, cursorPos : number }) => void) : void {
    // We need a delay to make sure last DOM update has occurred:
    cy.wait(200);
    cy.get("#editor").then((eds) => {
        const ed = eds.get()[0];
        inner({id : ed.getAttribute("data-slot-focus-id") || "", cursorPos : parseInt(ed.getAttribute("data-slot-cursor") || "-2")});
    });
}

function testInsert(insertion : string, result : string) : void {
    it("Tests " + insertion, () => {
        focusEditor();
        cy.get("body").type("i");
        assertState("{$}");
        cy.get("body").type(" " + insertion);
        assertState(result);

        // TODO test caret position mapping?
        // TODO test splitting the insert like in Java
    });    
}

// Moves until the position within the slot is the given cursor pos, then executes the given function
function moveToPositionThen(cursorPos: number, runAfterPositionReached: () => void) {
    // This is awkward, but cypress doesn't let us set or query the cursor position directly so we have to
    // use withSelection to query, then press left/right until is the one we want:
    withSelection((cur) => {
        if (cur.cursorPos == cursorPos) {
            // We've arrived:
            runAfterPositionReached();
        }
        else if (cur.cursorPos > cursorPos) {
            cy.get("body").type("{leftarrow}");
            moveToPositionThen(cursorPos, runAfterPositionReached);
        }
        else {
            cy.get("body").type("{rightarrow}");
            moveToPositionThen(cursorPos, runAfterPositionReached);
        }
    });
}

// Reaches the targeted slot *within the slots of a frame label*.
// targetSlotSpanID is the HTML ID of the slot
// goLeft indicates if we reach the slot going leftwards (i.e. left arrow); false if going rightwards
// The method returns true if we could reached the targeted slot 
//      (false indicate that lost focus on slots, meaning we activated the blue caret, or that we are not in the same frame label structure anymore)
function reachFrameLabelSlot(targetSlotSpanID: string, goLeft: boolean): boolean{
    // First we extract the parts we are interested in: the frame label structure ID (the begining of the ID before "_slot_") and the slot ID (e.g. "2,0,4")
    // (the editable slot ID is expected to be formatted as "input_frame_<frameId>_label_<labelId>_slot_<type>_<slotID>")
    const targetFrameLabelIDPart = targetSlotSpanID.substring(0, targetSlotSpanID.indexOf("_slot_"));
    const targetSlotID = targetSlotSpanID.substring(targetSlotSpanID.lastIndexOf("_") + 1);
    // Move to the start [resp. end] of the slot and then move to the previous [resp. next] editable slot if going leftwards [resp. rightwards]
    const keyArrow = (goLeft) ? "{leftarrow}" : "{rightarrow}";
    let reachedTarget = false;
    withSelection((curPos) => {
        // As commas are special tokens in HTML selectors syntax, we need to parse them so the selector matches the element id correctly (our slot IDs may have commas).
        cy.get("#"+curPos.id.replaceAll(",","\\,")).then((el) => {
            const moveToPosCursorPos = (goLeft) ? 0 :  el.text().length;
            moveToPositionThen(moveToPosCursorPos, () => {
                cy.get("body").type(keyArrow).then(() => {
                    withSelection((neighbourPos) => {
                        // If at this stage we are no longer in the same frame label structure than the target, we do not continue
                        if(!neighbourPos.id.startsWith(targetFrameLabelIDPart)) {
                            return;
                        }

                        if(neighbourPos.id.substring(neighbourPos.id.lastIndexOf("_") + 1) != targetSlotID){
                            // We are on a slot of this frame label, but not the one we wanted, we move again:
                            reachFrameLabelSlot(targetSlotSpanID, goLeft);
                        }
                        else{
                            // We reached the target
                            reachedTarget = true;
                        }
                    });            
                });            
            });
        });
    });
    return reachedTarget;
}

function focusEditor(): void {
    // Not totally sure why this hack is necessary, I think it's to give focus into the webpage via an initial click:
    // (on the main code container frame -- would be better to retrieve it properly but the file won't compile if we use Apps.ts and/or the store)
    cy.get("#frame_id_-3").focus();
}

function testMultiInsert(multiInsertion : string, firstResult : string, secondResult : string) : void {
    it("Tests " + multiInsertion, () => {
        focusEditor();
        
        const startNest = multiInsertion.indexOf("{");
        const endNest = multiInsertion.indexOf("}", startNest);
        expect(startNest).to.not.equal(-1);
        expect(endNest).to.not.equal(-1);
        const before = multiInsertion.substring(0, startNest);
        const nest = multiInsertion.substring(startNest + 1, endNest);
        const after = multiInsertion.substring(endNest + 1);

        cy.get("body").type("i");
        assertState("{$}");
        if (before.length > 0) {
            cy.get("body").type(before);
        }
        withSelection((posToInsertNest) => {
            if (after.length > 0) {
                cy.get("body").type(after);
            }
            // Focus doesn't work, instead let's move the caret until we are in the right slot
            withSelection((newPosToInsert) => {
                if(newPosToInsert.id != posToInsertNest.id){
                    reachFrameLabelSlot( posToInsertNest.id, true);
                }
            });

            moveToPositionThen(posToInsertNest.cursorPos, () => {
                assertState(firstResult);
                cy.get("body").type(nest);
                assertState(secondResult);
            });
        });
    });
}

function testInsertExisting(original : string, toInsert : string, expectedResult : string) : void {
    it("Tests " + original, () => {
        focusEditor();
        
        const cursorIndex = original.indexOf("$");
        expect(cursorIndex).to.not.equal(-1);
        const before = original.substring(0, cursorIndex);
        const after = original.substring(cursorIndex + 1);

        cy.get("body").type("i");
        assertState("{$}");
        if (before.length > 0) {
            cy.get("body").type(before);
        }
        withSelection((posToInsert) => {
            if (after.length > 0) {
                cy.get("body").type(after);
            }
            // Focus doesn't work, instead let's move the caret until we are in the right slot
            withSelection((newPosToInsert) => {
                if(newPosToInsert.id != posToInsert.id){
                    reachFrameLabelSlot( posToInsert.id, true);
                }
            });
            
            moveToPositionThen(posToInsert.cursorPos, () => {
                cy.get("body").type(toInsert);
                assertState(expectedResult);
            });
        });
    });
}

function testBackspace(originalInclBksp : string, expectedResult : string, testBackspace = true, testDelete = true) : void {
    const bkspIndex = originalInclBksp.indexOf("\b");
    if (testBackspace) {
        it("Tests Backspace " + originalInclBksp.replace("\b", "\\b"), () => {
            focusEditor();
            
            expect(bkspIndex).to.not.equal(-1);
            const before = originalInclBksp.substring(0, bkspIndex);
            const after = originalInclBksp.substring(bkspIndex + 1);

            cy.get("body").type("i");
            assertState("{$}");
            if (before.length > 0) {
                cy.get("body").type(before);
            }
            withSelection((posToInsert) => {
                if (after.length > 0) {
                    cy.get("body").type(after);
                }

                // Focus doesn't work, instead let's move the caret until we are in the right slot
                withSelection((newPosToInsert) => {
                    if(newPosToInsert.id != posToInsert.id){
                        reachFrameLabelSlot( posToInsert.id, true);
                    }
                });
                
                // We are somewhere in the slot we wanted to be, just make sure we now get to the right position
                moveToPositionThen(posToInsert.cursorPos, () => {
                    cy.get("body").type("{backspace}");
                    assertState(expectedResult);
                });
            });
        });
    }
    if (bkspIndex > 0 && testDelete) {
        it("Tests Delete " + originalInclBksp.replace("\b", "\\b"), () => {
            focusEditor();
            
            const before = originalInclBksp.substring(0, bkspIndex - 1);
            const after = originalInclBksp.substring(bkspIndex - 1, bkspIndex) + originalInclBksp.substring(bkspIndex + 1);

            cy.get("body").type("i");
            assertState("{$}");
            if (before.length > 0) {
                cy.get("body").type(before);
            }
            withSelection((posToInsert) => {
                if (after.length > 0) {
                    cy.get("body").type(after);
                }

                // Focus doesn't work, instead let's move the caret until we are in the right slot
                withSelection((newPosToInsert) => {
                    if(newPosToInsert.id != posToInsert.id){
                        reachFrameLabelSlot( posToInsert.id, true);
                    }
                });

                // We are now somewhere in the slot we want to be, we just make sure that's at the right position
                moveToPositionThen(posToInsert.cursorPos, () => {
                    cy.get("body").type("{del}");
                    assertState(expectedResult);
                });
            });
        });
    }
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
        focusEditor();
        
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
    testInsert("foo(5==-6)", "{foo}({5}=={-6}){$}");
    testInsert("foo(5==--6)", "{foo}({5}=={}-{-6}){$}");
    testInsert("foo(5==----6)", "{foo}({5}=={}-{}-{}-{-6}){$}");
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

describe("Stride TestExpressionSlot.testDot()", () => {
    testInsert(".", "{}.{$}");
    testInsert("0.", "{0.$}");
    testInsert("a.", "{a}.{$}");
    testInsert("foo()", "{foo}_({})_{$}");
    testInsert("foo().bar()", "{foo}_({})_{}.{bar}_({})_{$}");
    testInsert("foo+().", "{foo}+{}_({})_{}.{$}");

    testMultiInsert("foo(){.}a", "{foo}_({})_{$a}", "{foo}_({})_{}.{$a}");

    testBackspace("foo()0\b.", "{foo}_({})_{$}.{}");
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
    testMultiInsert("abc{\"}def", "{abc$def}", "{abc}_“$”_{def}");
    testMultiInsert("abc{\"}", "{abc$}", "{abc}_“$”_{}");
    testMultiInsert("{\"}def", "{$def}", "{}_“$”_{def}");
    testMultiInsert("abc{\"}.def", "{abc$}.{def}", "{abc}_“$”_{}.{def}");
    testMultiInsert("abc{\"}*def", "{abc$}*{def}", "{abc}_“$”_{}*{def}");
    testMultiInsert("abc{\"}def()", "{abc$def}_({})_{}", "{abc}_“$”_{def}_({})_{}");
    testMultiInsert("abc{\"}()", "{abc$}_({})_{}", "{abc}_“$”_{}_({})_{}");

    // Adding string adjacent to String:
    // First, before:
    testInsertExisting("$\"b\"", "\"a", "{}_“a$”_{}_“b”_{}");
    testInsertExisting("$\"b\"", "\"a\"", "{}_“a”_{$}_“b”_{}");
    // Also, after:
    testInsertExisting("\"a\"$", "\"b", "{}_“a”_{}_“b$”_{}");


    // Example found while pasting from BlueJ (double escaped here)
    testInsert("foo(c=='\\\\' or c=='\"' or c=='\\'')",
        "{foo}_({c}=={}_‘\\\\’_{}or{c}=={}_‘\"’_{}or{c}=={}_‘\\'’_{})_{$}");

    // Deletion:
    testBackspace("\"a\bb\"", "{}_“$b”_{}");
    testBackspace("\"\bab\"", "{$ab}");
    testBackspace("\"ab\b\"", "{}_“a$”_{}");
    testBackspace("\"ab\"\b", "{ab$}");
});

describe("Stride TestExpressionSlot.testOvertype()", () => {
    testInsertExisting("$()", "move", "{move$}_({})_{}");
    testInsertExisting("move$()", "(",  "{move}_({$})_{}");

    testInsertExisting("$\"bye\"", "\"hi\"+", "{}_“hi”_{}+{$}_“bye”_{}");
    testInsertExisting("\"hi$\"", "\"",  "{}_“hi”_{$}");

    // Most operators, like +, don't overtype:
    testInsertExisting("a$+z", "+", "{a}+{$}+{z}");
    testInsertExisting("a$+z", "+b", "{a}+{b$}+{z}");
});

describe("Stride TestExpressionSlot.testBackspace()", () => {
    testBackspace("\bxyz", "{$xyz}");
    testBackspace("x\byz", "{$yz}");
    testBackspace("xy\bz", "{x$z}");
    testBackspace("xyz\b", "{xy$}");

    testBackspace("xy\b+ab", "{x$}+{ab}");
    testBackspace("xy+\bab", "{xy$ab}");
    testBackspace("xy+a\bb", "{xy}+{$b}");

    // TODO convert these to Strype equivalent:
    //testBackspace("new t\bon", "{}new {$on}");
    // This one isn't possible using delete, but is by using backspace:
    //testBackspace("new \bton", "{new$ton}", true, false);
    // This one isn't possible using backspace, but is by using delete:
    //testBackspace("n\bew ton", "{$ewton}", false, true);

    testBackspace("move(\b)", "{move$}");
    testBackspace("(\b)", "{$}");
});

describe("Strype test nested brackets", () => {
    testInsert("((a+b)+c())", "{}_({}_({a}+{b})_{}+{c}_({})_{})_{$}");
    testInsert("((a)c())", "{}_({}_({a})_{c}_({})_{})_{$}");

    testBackspace("((\b))", "{}_({$})_{}");
    testBackspace("((a))c((\b))", "{}_({}_({a})_{})_{c}_({$})_{}");
});

describe("Stride TestExpressionSlot.testFloating()", () => {
    // For some of this, they are a syntax error anyway, so it is not crucial which way we split them
    // Still, a regression might indicate a problem

    testInsert("1.0", "{1.0$}");
    testInsert("10.20", "{10.20$}");
    testInsert("a.0", "{a}.{0$}");
    testInsert("1.a", "{1}.{a$}");
    testInsert("x1.a", "{x1}.{a$}");
    testInsert("+1", "{+1$}");
    testInsert("+1.0", "{+1.0$}");
    testInsert("+1.0e5", "{+1.0e5$}");
    testInsert("+1.0e", "{}+{1}.{0e$}");
    testInsert("+1.0e+5", "{+1.0e+5$}");
    testInsert("+1.0e+5+6", "{+1.0e+5}+{6$}");
    testInsert("3+1", "{3}+{1$}");
    testInsert("3+1.0", "{3}+{1.0$}");
    testInsert("3+1.0e5", "{3}+{1.0e5$}");
    testInsert("3+1.0e+5", "{3}+{1.0e+5$}");
    testInsert("3+1.0e+5+6", "{3}+{1.0e+5}+{6$}");
    
    testInsert("+1+2+3", "{+1}+{2}+{3$}");
    testInsert("+1++2", "{+1}+{+2$}");
    testInsert("+1++2+3", "{+1}+{+2}+{3$}");
    testInsert("+1++2++3", "{+1}+{+2}+{+3$}");
    testInsert("++1++2++3", "{}+{+1}+{+2}+{+3$}");
    testMultiInsert("+{1}", "{}+{$}", "{+1$}");
    testMultiInsert("+{+1}", "{}+{$}", "{}+{+1$}");
    testMultiInsert("1++{2}", "{1}+{}+{$}", "{1}+{+2$}");
    testInsert("-1-2-3", "{-1}-{2}-{3$}");
    testInsert("-1--2", "{-1}-{-2$}");
    testInsert("-1--2-3", "{-1}-{-2}-{3$}");
    testInsert("-1--2--3", "{-1}-{-2}-{-3$}");
    testInsert("--1--2--3", "{}-{-1}-{-2}-{-3$}");
    testMultiInsert("-{1}", "{}-{$}", "{-1$}");
    testMultiInsert("-{-1}", "{}-{$}", "{}-{-1$}");
    testMultiInsert("1--{2}", "{1}-{}-{$}", "{1}-{-2$}");

    testInsert("1e6", "{1e6$}");
    testInsert("1e-6", "{1e-6$}");
    testInsert("10e20", "{10e20$}");
    testInsert("10e+20", "{10e+20$}");
    testInsert("10e-20", "{10e-20$}");

    testInsert("1.0.3", "{1}.{0}.{3$}");
    testInsert("1.0.3.4", "{1}.{0}.{3}.{4$}");
    testInsert("1.0.x3.4", "{1}.{0}.{x3}.{4$}");

    // The problem here is that + is first an operator, then merged back in,
    // so when we preserve the position after plus, it becomes invalid, so we
    // can't easily test that the right thing happens deleting the plus:
    //testBackspace("+\b1.0e-5", "{$1.0e-5}", false, true);
    //testBackspace("+1\b.0e-5", "{}+{$}.{0e-5}", true, false);
    testBackspace("+1.\b0e-5", "{+1$0e-5}");
    testBackspace("+1.0\be-5", "{+1.$e-5}");
    //testBackspace("+1.0e\b-5", "{+1.0$}-{5}");
    //testBackspace("+1.0e-\b5", "{+1.0e$5}");
    //testBackspace("+1.0e-5\b", "{}+{1}.{0e}-{$}");

    testMultiInsert("{1}e-6", "{$e}-{6}", "{1$e-6}");
    testMultiInsert("1{e}-6", "{1$}-{6}", "{1e$-6}");
    testMultiInsert("1e{-}6", "{1e$6}", "{1e-$6}");
    testMultiInsert("1e-{6}", "{1e}-{$}", "{1e-6$}");

    testMultiInsert("{x}1e-6", "{$1e-6}", "{x$1e}-{6}");
    testMultiInsert("1{x}e-6", "{1$e-6}", "{1x$e}-{6}");
    testMultiInsert("1e{x}-6", "{1e$-6}", "{1ex$}-{6}");
    //testMultiInsert("1e-{x}6", "{1e-$6}", "{1e-x$6}");

    testInsert("1.0", "{1.0$}");
    testInsert("1..0", "{1}.{}.{0$}");
    //testBackspace("1..\b0", "{1.$0}", true, false); // backspace after
    //testBackspace("1.\b.0", "{1$.0}", false, true); // delete before
    //testBackspace("a..\bc", "{a}.{$c}", true, false); // backspace after
    //testBackspace("a.\b.c", "{a$}.{c}", false, true); // delete before
});

describe("Stride TestExpressionSlot.testBrackets()", () => {
    testInsert("a+(b-c)", "{a}+{}_({b}-{c})_{$}");
    testInsert("a+(b-(c*d))", "{a}+{}_({b}-{}_({c}*{d})_{})_{$}");

    // Without close:
    testInsert("(a+b", "{}_({a}+{b$})_{}");

    testInsert("(((", "{}_({}_({}_({$})_{})_{})_{}");
    testInsert("((()", "{}_({}_({}_({})_{$})_{})_{}");
    testInsert("((())", "{}_({}_({}_({})_{})_{$})_{}");
    testInsert("((()))", "{}_({}_({}_({})_{})_{})_{$}");

    testInsert("(a+(b*c)+d)", "{}_({a}+{}_({b}*{c})_{}+{d})_{$}");

    testMultiInsert("({(MyWorld)}getWorld()).getWidth()",
        "{}_({$getWorld}_({})_{})_{}.{getWidth}_({})_{}",
        "{}_({}_({MyWorld})_{$getWorld}_({})_{})_{}.{getWidth}_({})_{}");

    testInsert("a(bc)d", "{a}_({bc})_{d$}");
});

describe("Stride TestExpressionSlot.testDeleteBracket()", () => {
    testInsert("a+(b*c)", "{a}+{}_({b}*{c})_{$}");
    testBackspace("a+(b*c)\b", "{a}+{b}*{c$}");
    testBackspace("a+(\bb*c)", "{a}+{$b}*{c}");

    testInsert("((MyWorld)getWorld()).getWidth()",
        "{}_({}_({MyWorld})_{getWorld}_({})_{})_{}.{getWidth}_({})_{$}");
    testBackspace("((MyWorld)getWorld()).getWidth()\b",
        "{}_({}_({MyWorld})_{getWorld}_({})_{})_{}.{getWidth$}");
    testBackspace("((MyWorld)getWorld()).\bgetWidth()",
        "{}_({}_({MyWorld})_{getWorld}_({})_{})_{$getWidth}_({})_{}");
    testBackspace("((MyWorld)getWorld())\b.getWidth()",
        "{}_({MyWorld})_{getWorld}_({})_{$}.{getWidth}_({})_{}");
    testBackspace("((MyWorld)getWorld(\b)).getWidth()",
        "{}_({}_({MyWorld})_{getWorld$})_{}.{getWidth}_({})_{}");
    testBackspace("((MyWorld)\bgetWorld()).getWidth()",
        "{}_({MyWorld$getWorld}_({})_{})_{}.{getWidth}_({})_{}");
    testBackspace("((\bMyWorld)getWorld()).getWidth()",
        "{}_({$MyWorldgetWorld}_({})_{})_{}.{getWidth}_({})_{}");
    testBackspace("(\b(MyWorld)getWorld()).getWidth()",
        "{$}_({MyWorld})_{getWorld}_({})_{}.{getWidth}_({})_{}"); 
});

describe("Test word operators", () => {
    testInsert("a or ", "{a}or{$}");
    testInsert("a or b", "{a}or{b$}");
    testInsert("or b", "{}or{b$}");
    testInsert("orb", "{orb$}");
    testInsert("not a", "{}not{a$}");
    testInsert("orc or ork", "{orc}or{ork$}");
    testInsert("notand or nand", "{notand}or{nand$}");
    testInsert("nor or neither", "{nor}or{neither$}");
    testInsert("öor or oör", "{öor}or{oör$}");
    testInsert("a is b", "{a}is{b$}");
    testInsert("a is not b", "{a}is not{b$}");
    testInsert("a or not b", "{a}or{}not{b$}");
    testInsert("a and or in b", "{a}and{}or{}in{b$}");
    
    testMultiInsert("a is {not }b", "{a}is{$b}", "{a}is not{$b}");
    testMultiInsert("a or {not }b", "{a}or{$b}", "{a}or{}not{$b}");
   
    testBackspace("a or \bb", "{a$b}", true, false);
    testBackspace("a is not \bb", "{a}is{$b}", true, false);    
    testBackspace("a \bis not b", "{a$}not{b}", false, true);    
    testBackspace("a or not \bb", "{a}or{$b}", true, false);
    testBackspace("a or \bnot b", "{a$}not{b}", true, false);

    testInsert("1or 2", "{1or 2$}");
    testInsert("1 or 2", "{1}or{2$}");
    testInsert("1 or2", "{1 or2$}");
    
    testInsert("ab and cd and ef", "{ab}and{cd}and{ef$}");
    testMultiInsert("ab{ and cd} and ef", "{ab$}and{ef}", "{ab}and{cd$}and{ef}");
    testMultiInsert("ab{ } and ef", "{ab$}and{ef}", "{ab $}and{ef}");
    testMultiInsert("ab{+cd} and ef", "{ab$}and{ef}", "{ab}+{cd$}and{ef}");
    testMultiInsert("ab{ andor} and (ef)", "{ab$}and{}_({ef})_{}", "{ab}and{}or{$}and{}_({ef})_{}");
    testMultiInsert("ab{ andcd} and (ef)", "{ab$}and{}_({ef})_{}", "{ab}and{cd$}and{}_({ef})_{}");
    testMultiInsert("ab{ and cd} and (ef)", "{ab$}and{}_({ef})_{}", "{ab}and{cd$}and{}_({ef})_{}");
    testMultiInsert("pre or (ab{ and cd} and ef) or post", "{pre}or{}_({ab$}and{ef})_{}or{post}", "{pre}or{}_({ab}and{cd$}and{ef})_{}or{post}");
    testMultiInsert("(a0) or ab{ and cd} and ef", "{}_({a0})_{}or{ab$}and{ef}", "{}_({a0})_{}or{ab}and{cd$}and{ef}");
    testInsert("(a+b)or c", "{}_({a}+{b})_{}or{c$}");
    testInsert("(a+b)or (c-d)", "{}_({a}+{b})_{}or{}_({c}-{d})_{$}");
    testInsert("(a and b)or (c and d)", "{}_({a}and{b})_{}or{}_({c}and{d})_{$}");
});

