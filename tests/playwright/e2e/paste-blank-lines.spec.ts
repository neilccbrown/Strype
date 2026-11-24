import {test, expect, Page} from "@playwright/test";
import {enterCode, doPagePaste} from "../support/editor";
import {setupStrypeTest} from "../support/general";

test.beforeEach(async ({ page, browserName }, testInfo) => {
    await setupStrypeTest(page, browserName, testInfo, {skipPyodide: true, fakeClipboard: true});
});

// Blank lines in pasted Python should become blank frames: no matter where they are in the
// text (leading, between leading assignments, between other statements, trailing).

// Returns the types of all the frames in the editor, in order (including nested ones), abbreviated
// so that expectations are easy to read: "blank" -> "_", "varassign" -> "=", "funccall" -> "call".
// (The default project is cleared first, so everything is from the paste.)
async function getFrameTypes(page: Page) : Promise<string[]> {
    return await page.evaluate(() => Array.from(document.querySelectorAll("[data-frameType]"))
        .map((e) => (e as HTMLElement).dataset.frametype as string)
        .map((t) => t == "blank" ? "_" : t == "varassign" ? "=" : t == "funccall" ? "call" : t));
}

async function checkPaste(page: Page, code: string, expected: string[]) : Promise<void> {
    // Paste into the Main section (leading assignments pasted into Definitions lose their blanks, as that section can't hold them):
    await enterCode(page, ["", "", code]);
    expect(await getFrameTypes(page)).toEqual(expected);
}

test.describe("Pasting leading blank lines", () => {
    test("Keeps leading blanks before a statement", ({page}) => checkPaste(page, "\n\nprint(1)\nprint(2)", ["_", "_", "call", "call"]));
    test("Keeps leading blanks before an assignment", ({page}) => checkPaste(page, "\n\nx = 1\ny = 2", ["_", "_", "=", "="]));
    test("Keeps leading blanks before a compound statement", ({page}) => checkPaste(page, "\nif x:\n    print(1)", ["_", "if", "call"]));
    test("Treats whitespace-only leading lines as blank", ({page}) => checkPaste(page, "  \n\t\nprint(1)", ["_", "_", "call"]));
});

test.describe("Pasting blank lines between assignments", () => {
    test("Keeps a blank between two assignments", ({page}) => checkPaste(page, "x = 1\n\ny = 2", ["=", "_", "="]));
    test("Keeps several blanks between two assignments", ({page}) => checkPaste(page, "x = 1\n\n\ny = 2", ["=", "_", "_", "="]));
    test("Keeps a blank between an assignment and a following statement", ({page}) => checkPaste(page, "x = 1\n\nprint(2)", ["=", "_", "call"]));
    test("Keeps blanks between assignments with a statement later", ({page}) => checkPaste(page, "x = 1\n\ny = 2\n\nprint(3)", ["=", "_", "=", "_", "call"]));
    test("Keeps leading and interior blanks together", ({page}) => checkPaste(page, "\nx = 1\n\ny = 2", ["_", "=", "_", "="]));
});

test.describe("Pasting blank lines elsewhere still works", () => {
    test("Between statements", ({page}) => checkPaste(page, "print(1)\n\nprint(2)", ["call", "_", "call"]));
    test("After a compound statement", ({page}) => checkPaste(page, "if x:\n    print(1)\n\n\nprint(2)", ["if", "call", "_", "_", "call"]));
    test("Inside a function", ({page}) => checkPaste(page, "def f():\n    x = 1\n\n    y = 2\nf()\n\nf()", ["funcdef", "=", "_", "=", "call", "_", "call"]));
});

// A single final newline just ends the last line, it isn't a blank line itself:
test.describe("Pasting trailing blank lines", () => {
    test("Ignores a single final newline", ({page}) => checkPaste(page, "print(1)\nprint(2)\n", ["call", "call"]));
    test("Keeps one blank for two final newlines", ({page}) => checkPaste(page, "print(1)\nprint(2)\n\n", ["call", "call", "_"]));
    test("Keeps two blanks for three final newlines", ({page}) => checkPaste(page, "print(1)\nprint(2)\n\n\n", ["call", "call", "_", "_"]));
    test("Keeps trailing blanks without any final newline after them being a further blank", ({page}) => checkPaste(page, "print(1)\n\n\nprint(2)\n\n", ["call", "_", "_", "call", "_"]));
    test("Keeps trailing blanks after assignments", ({page}) => checkPaste(page, "x = 1\ny = 2\n\n\n", ["=", "=", "_", "_"]));
    test("Keeps trailing blanks after a compound statement", ({page}) => checkPaste(page, "if x:\n    print(1)\n\n", ["if", "call", "_"]));
    test("Keeps trailing blanks after a statement in a function", ({page}) => checkPaste(page, "def f():\n    print(1)\nprint(2)\n\n", ["funcdef", "call", "call", "_"]));
    test("Keeps both leading and trailing blanks", ({page}) => checkPaste(page, "\n\nprint(1)\n\n\n", ["_", "_", "call", "_", "_"]));
    test("Handles Windows line endings", ({page}) => checkPaste(page, "\r\nprint(1)\r\n\r\nprint(2)\r\n\r\n", ["_", "call", "_", "call", "_"]));
    test("Pasting only blank lines pastes nothing", ({page}) => checkPaste(page, "\n\n\n", []));
});

// Copying frames from Strype, including blank frames at the start, middle and end, and pasting them back should give the same frames:
test.describe("Copying and pasting blank frames within Strype", () => {
    test("Round-trips blank frames", async ({page}) => {
        const original = ["_", "call", "_", "_", "call", "_"];
        await enterCode(page, ["", "", "\nprint(1)\n\n\nprint(2)\n\n"]);
        expect(await getFrameTypes(page)).toEqual(original);
        // Select all six frames and copy:
        await page.keyboard.press("End");
        for (let i = 0; i < original.length; i++) {
            await page.keyboard.press("Shift+ArrowUp");
        }
        await page.keyboard.press("ControlOrMeta+c");
        await page.keyboard.press("End");
        await doPagePaste(page, await page.evaluate(() => window.navigator.clipboard.readText()));
        expect(await getFrameTypes(page)).toEqual([...original, ...original]);
    });
});

// Returns the frame types as in getFrameTypes(), but each prefixed by a dot per level of nesting
// (a joint frame like "else" is nested inside its "if", as it is in the DOM), joined into one string.
async function getFrameTree(page: Page) : Promise<string> {
    return await page.evaluate(() => Array.from(document.querySelectorAll("[data-frameType]")).map((e) => {
        let depth = 0;
        for (let p = e.parentElement; p; p = p.parentElement) {
            if (p.hasAttribute("data-frameType")) {
                depth++;
            }
        }
        const t = (e as HTMLElement).dataset.frametype as string;
        return ".".repeat(depth) + (t == "blank" ? "_" : t == "varassign" ? "=" : t == "funccall" ? "call" : t);
    }).join(" "));
}

// Pastes the code, checks the resulting frame tree, then copies all those frames, pastes them again
// at the end and checks that the tree is now two copies of the original.
async function checkRoundTrip(page: Page, code: string, expectedTree: string) : Promise<void> {
    await enterCode(page, ["", "", code]);
    expect(await getFrameTree(page)).toEqual(expectedTree);
    const frameCount = expectedTree.split(" ").length;
    await page.keyboard.press("End");
    // More presses than there are top-level frames is fine, it stops at the top:
    for (let i = 0; i < frameCount; i++) {
        await page.keyboard.press("Shift+ArrowUp");
    }
    await page.keyboard.press("ControlOrMeta+c");
    await page.keyboard.press("End");
    await doPagePaste(page, await page.evaluate(() => window.navigator.clipboard.readText()));
    expect(await getFrameTree(page)).toEqual(expectedTree + " " + expectedTree);
}

// Note: a body with nothing but blanks (and comments) is written out with a "pass" at the start (which doesn't become a frame).
test.describe("Round-tripping control flow with only blank frames in the body", () => {
    test("if", ({page}) => checkRoundTrip(page, "if x:\n    pass\n    \n    \n", "if ._ ._"));
    test("while", ({page}) => checkRoundTrip(page, "while x:\n    pass\n    \n    \n", "while ._ ._"));
    test("for", ({page}) => checkRoundTrip(page, "for i in y:\n    pass\n    \n", "for ._"));
    test("try/except", ({page}) => checkRoundTrip(page, "try:\n    pass\n    \nexcept:\n    pass\n    \n    \n", "try ._ .except .._ .._"));
    test("if/elif/else", ({page}) => checkRoundTrip(page, "if x:\n    pass\n    \nelif y:\n    pass\n    \n    \nelse:\n    pass\n    \n", "if ._ .elif .._ .._ .else .._"));
    test("Blanks after the construct are kept outside it", ({page}) => checkRoundTrip(page, "if x:\n    pass\n    \n\n\nprint(1)\n", "if ._ _ _ call"));
});

test.describe("Round-tripping control flow with blanks before, between and after assignments", () => {
    test("while", ({page}) => checkRoundTrip(page, "while x:\n    \n    a = 1\n    \n    \n    b = 2\n    \n", "while ._ .= ._ ._ .= ._"));
    test("for, with no blanks at the ends", ({page}) => checkRoundTrip(page, "for i in y:\n    a = 1\n    \n    b = 2\n", "for .= ._ .="));
    test("try/except/finally", ({page}) => checkRoundTrip(page, "try:\n    \n    a = 1\n    \n    b = 2\n    \nexcept:\n    \n    c = 3\n    \n    d = 4\n    \nfinally:\n    e = 5\n    \n", "try ._ .= ._ .= ._ .except .._ ..= .._ ..= .._ .finally ..= .._"));
    test("if/elif/else", ({page}) => checkRoundTrip(page, "if x:\n    \n    a = 1\n    \n    b = 2\n    \nelif y:\n    \n    c = 3\n    \nelse:\n    \n    d = 4\n    \n", "if ._ .= ._ .= ._ .elif .._ ..= .._ .else .._ ..= .._"));
    test("Nested, with blanks at the end of both bodies", ({page}) => checkRoundTrip(page, "if x:\n    if y:\n        \n        a = 1\n        \n        b = 2\n        \n    \n    \n", "if .if .._ ..= .._ ..= .._ ._ ._"));
});
