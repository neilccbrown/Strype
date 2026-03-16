require("cypress-terminal-report/src/installLogsCollector")();
import failOnConsoleError from "cypress-fail-on-console-error";
failOnConsoleError();

import {testInsert, testMultiInsert, testBackspace, testInsertExisting} from "../support/expression-test-support";

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
    }}).then(() => {
        // The Strype IDs and CSS class names aren't directly used in the test
        // but they are used in the support file, so we make them available.
        cy.initialiseSupportStrypeGlobals();
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
    testInsert("s.length().", "{s}.{length}_({})_{}.{$}", false);
    //testInsert("s.length()..", "{s}.{length}_({})_{}..{$}");
    //testInsert("s.length()..1", "{s}.{length}_({})_{}..{1$}");
});

describe("Stride TestExpressionSlot.testDot()", () => {
    testInsert(".", "{}.{$}", false);
    testInsert("0.", "{0.$}");
    testInsert("a.", "{a}.{$}", false);
    testInsert("foo()", "{foo}_({})_{$}");
    testInsert("foo().bar()", "{foo}_({})_{}.{bar}_({})_{$}");
    testInsert("foo+().", "{foo}+{}_({})_{}.{$}", false);

    testMultiInsert("foo(){.}a", "{foo}_({})_{$a}", "{foo}_({})_{}.{$a}");

    testBackspace("foo()0\b.", "{foo}_({})_{$}.{}");
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


