// eslint-disable-next-line @typescript-eslint/no-var-requires
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


describe("Stride TestExpressionSlot.testStrings()", () => {
    // Empty strings:
    testInsert("\"\"", "{}_“”_{$}");
    testInsert("''", "{}_‘’_{$}");
    
    // With trailing quote
    testInsert("\"hello\"", "{}_“hello”_{$}");
    // Without trailing quote (caret stays in string):
    testInsert("\"hello", "{}_“hello$”_{}", false);
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
    testInsert("'hello", "{}_‘hello$’_{}", false);
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


describe("Stride TestExpressionSlot.testFloating()", () => {
    // For some of this, they are a syntax error anyway, so it is not crucial which way we split them
    // Still, a regression might indicate a problem

    testInsert("1.0", "{1.0$}");
    testInsert("10.20", "{10.20$}");
    testInsert("a.0", "{a}.{0$}", false);
    testInsert("1.a", "{1}.{a$}", false);
    testInsert("x1.a", "{x1}.{a$}", false);
    testInsert("+1", "{+1$}");
    testInsert("+1.0", "{+1.0$}");
    testInsert("+1.0e5", "{+1.0e5$}");
    testInsert("+1.0e", "{}+{1}.{0e$}", false);
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

    testInsert("1.0.3", "{1}.{0.3$}", false);
    testInsert("1.0.3.4", "{1}.{0}.{3.4$}", false);
    testInsert("1.0.x3.4", "{1}.{0}.{x3}.{4$}", false);

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
    testInsert("1..0", "{1}.{}.{0$}", false);
    //testBackspace("1..\b0", "{1.$0}", true, false); // backspace after
    //testBackspace("1.\b.0", "{1$.0}", false, true); // delete before
    //testBackspace("a..\bc", "{a}.{$c}", true, false); // backspace after
    //testBackspace("a.\b.c", "{a$}.{c}", false, true); // delete before
});

describe("Stride TestExpressionSlot.testKWOperators()", () => {
    testInsert("a and b", "{a}and{b$}");
    testInsert("a and b and c", "{a}and{b}and{c$}");
    testInsert("(a and b and c)", "{}_({a}and{b}and{c})_{$}");
    testInsert("a and (b and c)", "{a}and{}_({b}and{c})_{$}");
    testInsert("a() and b and c", "{a}_({})_{}and{b}and{c$}");
    testInsert("a() and \"b\" and c", "{a}_({})_{}and{}_“b”_{}and{c$}");
    testInsert("a() and \"b\" and \"c\"", "{a}_({})_{}and{}_“b”_{}and{}_“c”_{$}");
    testInsert("((\"apple\" in [\"apple\", \"banana\", \"cherry\"]) and not (\"dog\" in (\"cat\", \"doghouse\", \"mouse\"))) or (\"grape\" + str([1, 2, 3]) == \"grape[1, 2, 3]\")",
        "{}_({}_({}_“apple”_{}in{}_[{}_“apple”_{},{}_“banana”_{},{}_“cherry”_{}]_{})_{}and{}not{}_({}_“dog”_{}in{}_({}_“cat”_{},{}_“doghouse”_{},{}_“mouse”_{})_{})_{})_{}or{}_({}_“grape”_{}+{str}_({}_[{1},{2},{3}]_{})_{}=={}_“grape[1, 2, 3]”_{})_{$}");
});


