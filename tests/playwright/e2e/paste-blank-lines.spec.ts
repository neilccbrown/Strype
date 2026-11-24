import {test, expect, Page} from "@playwright/test";
import {enterCode} from "../support/editor";
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
