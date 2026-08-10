import { test, expect } from "@playwright/test";
import Parser from "web-tree-sitter";
import path from "path";
import { getBlockItems } from "@/helpers/pythonToFramesBlockWalk";

// NOTE: this is really a *unit* test for the pure getBlockItems() function (see
// src/helpers/pythonToFramesBlockWalk.ts) -- see python-to-frames-expr.spec.ts in this same
// directory for why this is a Playwright spec rather than a Vitest one.

let parser: Parser;

test.beforeAll(async () => {
    await Parser.init();
    const lang = await Parser.Language.load(
        path.resolve(__dirname, "../../../node_modules/tree-sitter-wasms/out/tree-sitter-python.wasm")
    );
    parser = new Parser();
    parser.setLanguage(lang);
});

function summarise(src: string, afterRow: number, beforeRow?: number) {
    const tree = parser.parse(src);
    const module = tree.rootNode;
    return getBlockItems(module, afterRow, beforeRow).map((item) =>
        item.kind === "blank" ? `blank(${item.count})` : item.node.type + ":" + item.node.text.replace(/\n/g, "\\n"));
}

test.describe("getBlockItems", () => {
    test("no blanks, no comments", () => {
        expect(summarise("a = 1\nb = 2\n", -1)).toEqual([
            "expression_statement:a = 1",
            "expression_statement:b = 2",
        ]);
    });

    test("a single blank line between two statements", () => {
        expect(summarise("a = 1\n\nb = 2\n", -1)).toEqual([
            "expression_statement:a = 1",
            "blank(1)",
            "expression_statement:b = 2",
        ]);
    });

    test("multiple consecutive blank lines are counted", () => {
        expect(summarise("a = 1\n\n\n\nb = 2\n", -1)).toEqual([
            "expression_statement:a = 1",
            "blank(3)",
            "expression_statement:b = 2",
        ]);
    });

    test("a leading blank line (before the first statement) is detected via afterRow", () => {
        // afterRow = -1 means "row -1 is the last row before content starts" i.e. row 0 is the
        // first possible content row -- so a blank line 0 followed by content on row 1 is a gap:
        expect(summarise("\na = 1\n", -1)).toEqual([
            "blank(1)",
            "expression_statement:a = 1",
        ]);
    });

    test("no leading blank reported when content starts immediately", () => {
        expect(summarise("a = 1\n", -1)).toEqual(["expression_statement:a = 1"]);
    });

    test("comments appear as ordinary items, interleaved in source order", () => {
        expect(summarise("a = 1\n# hello\nb = 2\n", -1)).toEqual([
            "expression_statement:a = 1",
            "comment:# hello",
            "expression_statement:b = 2",
        ]);
    });

    test("a blank line between a statement and a following comment", () => {
        expect(summarise("a = 1\n\n# hello\nb = 2\n", -1)).toEqual([
            "expression_statement:a = 1",
            "blank(1)",
            "comment:# hello",
            "expression_statement:b = 2",
        ]);
    });

    test("trailing blank before a following joint continuation, via beforeRow", () => {
        // "a = 1" is on row 0; row 1 is blank; the following "elif"/"else" clause is simulated as
        // starting on row 2 (passed in as beforeRow), so the gap is exactly the one blank row 1:
        expect(summarise("a = 1\n\n", -1, 2)).toEqual([
            "expression_statement:a = 1",
            "blank(1)",
        ]);
    });

    test("no trailing blank reported when beforeRow is immediately after the last statement", () => {
        expect(summarise("a = 1\n", -1, 1)).toEqual(["expression_statement:a = 1"]);
    });
});
