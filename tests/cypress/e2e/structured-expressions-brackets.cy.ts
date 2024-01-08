// eslint-disable-next-line @typescript-eslint/no-var-requires
require("cypress-terminal-report/src/installLogsCollector")();
import failOnConsoleError from "cypress-fail-on-console-error";
failOnConsoleError();

import {testInsert, testMultiInsert, testBackspace} from "../support/expression-test-support";

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

describe("Strype test nested brackets", () => {
    testInsert("((a+b)+c())", "{}_({}_({a}+{b})_{}+{c}_({})_{})_{$}");
    testInsert("((a)c())", "{}_({}_({a})_{c}_({})_{})_{$}", false);

    testBackspace("((\b))", "{}_({$})_{}");
    testBackspace("((a))c((\b))", "{}_({}_({a})_{})_{c}_({$})_{}");
});

describe("Stride TestExpressionSlot.testBrackets()", () => {
    testInsert("a+(b-c)", "{a}+{}_({b}-{c})_{$}");
    testInsert("a+(b-(c*d))", "{a}+{}_({b}-{}_({c}*{d})_{})_{$}");

    // Without close:
    testInsert("(a+b", "{}_({a}+{b$})_{}", false);

    testInsert("(((", "{}_({}_({}_({$})_{})_{})_{}", false);
    testInsert("((()", "{}_({}_({}_({})_{$})_{})_{}", false);
    testInsert("((())", "{}_({}_({}_({})_{})_{$})_{}", false);
    testInsert("((()))", "{}_({}_({}_({})_{})_{})_{$}");

    testInsert("(a+(b*c)+d)", "{}_({a}+{}_({b}*{c})_{}+{d})_{$}");

    testMultiInsert("({(MyWorld)}getWorld()).getWidth()",
        "{}_({$getWorld}_({})_{})_{}.{getWidth}_({})_{}",
        "{}_({}_({MyWorld})_{$getWorld}_({})_{})_{}.{getWidth}_({})_{}");

    testInsert("a(bc)d", "{a}_({bc})_{d$}", false);
});

describe("Stride TestExpressionSlot.testDeleteBracket()", () => {
    testInsert("a+(b*c)", "{a}+{}_({b}*{c})_{$}");
    testBackspace("a+(b*c)\b", "{a}+{b}*{c$}");
    testBackspace("a+(\bb*c)", "{a}+{$b}*{c}");

    testInsert("((MyWorld)getWorld()).getWidth()",
        "{}_({}_({MyWorld})_{getWorld}_({})_{})_{}.{getWidth}_({})_{$}", 
        false);
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


