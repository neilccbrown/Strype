import {Page, test, expect} from "@playwright/test";
import {load, save} from "../support/loading-saving";
import fs from "fs";
import en from "@/localisation/en/en_main.json";
import { CollapsedState } from "../../cypress/support/frame-types";
import { randomUUID } from "node:crypto";

test.beforeEach(async ({ page, browserName }, testInfo) => {
    if (browserName === "webkit" && process.platform === "win32") {
        // On Windows+Webkit it just can't seem to load the page for some reason:
        testInfo.skip(true, "Skipping on Windows + WebKit due to unknown problems");
    }
    // These tests can take longer than the default 30 seconds:
    testInfo.setTimeout(120_000); // 120 seconds

    await page.goto("./", {waitUntil: "load"});
    await page.waitForSelector("body");
    
    await page.evaluate(() => {
        (window as any).Playwright = true;
    });
    // Make browser's console.log output visible in our logs (useful for debugging):
    page.on("console", (msg) => {
        console.log("Browser log:", msg.text());
    });
});


async function loadContent(page: Page, spyToLoad: string) : Promise<void> {
    // The recursive option stops it failing if the dir exists:
    fs.mkdirSync("tests/cypress/downloads/", { recursive: true });
    const path = `tests/cypress/downloads/toload-${randomUUID()}.spy`;
    fs.writeFileSync(path, spyToLoad);
    await load(page, path);
}

async function saveAndCheck(page: Page, expectedSPY: string) {
    const path = await save(page, false);
    const saved = fs.readFileSync(path, "utf8");
    expect(saved).toEqual(expectedSPY);
}

async function clickFoldFor(page: Page, identifyingText: string) : Promise<void> {
    // Find the span with text "top1"
    const header = page.locator("span", { hasText: identifyingText });
    // Find its frame header ancestor:
    const ancestor = header.locator("xpath=ancestor::*[contains(@class, \"frame-header-div-line\")]");
    const control = ancestor.locator(":scope > .folding-control");
    await control.hover();
    expect(await control.evaluate((el) => getComputedStyle(el).cursor)).toEqual("pointer");
    await control.click();
}

async function clickFoldChildrenFor(page: Page, identifyingText: string) : Promise<void> {
    // Find the span with text "top1"
    const header = page.locator("span", { hasText: identifyingText });
    // Find its frame header ancestor:
    const ancestor = header.locator("xpath=ancestor::*[contains(@class, \"frame-header\")]");
    const control = ancestor.locator(":scope > .frame-header-div-line > .fold-children-control");
    await control.hover();
    expect(await control.evaluate((el) => getComputedStyle(el).cursor)).toEqual("pointer");
    await control.click();
}

async function makeFrozen(page: Page, identifyingText: string) : Promise<void> {
    const ancestor = page.locator(".frame-header:has(span:has-text('" + identifyingText + "'))");
    await ancestor.click({button: "right"});
    await page.getByRole("menuitem", {name: en.contextMenu.freeze}).click({timeout: 2000});
}

async function foldViaMenu(page: Page, identifyingText: string, foldTo: CollapsedState) : Promise<void> {
    const ancestor = page.locator(".frame-header:has(span:has-text('" + identifyingText + "'))");
    await ancestor.click({button: "right"});
    let name : string;
    switch (foldTo) {
    case CollapsedState.FULLY_VISIBLE:
        name = en.contextMenu.collapseFull;
        break;
    case CollapsedState.HEADER_AND_DOC_VISIBLE:
        name = en.contextMenu.collapseDocumentation;
        break;
    case CollapsedState.ONLY_HEADER_VISIBLE:
        name = en.contextMenu.collapseHeader;
        break;
    }
    await page.getByRole("menuitem", {name}).click({timeout: 2000});
}

// We have some functions and classes, and have a function to allow setting the states for any identifier:
function testState (states: Record<string, string> = {}) {
    const original =
        `#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
def top1 ( ) :
    return 6 
class Alpha  :
    some_constant  = 5 
    def __init__ (self, ) :
        self.x  = 7 
class Beta  :
    def set_double (self,x ) :
        self.x  = x*2 
    def get_x (self, ) :
        return x 
    def set_x (self,x ) :
        self.x  = x 
def top2 ( ) :
    return 64 
#(=> Section:Main
#(=> Section:End
`;
    let lines = original.split(/\r?\n/);

    for (const [key, value] of Object.entries(states)) {
        let found = false;
        const newLines: string[] = [];

        for (const line of lines) {
            if (line.includes(key)) {
                found = true;
                const indentMatch = line.match(/^(\s*)/);
                const indent = indentMatch ? indentMatch[1] : "";
                newLines.push(indent + "#(=> FrameState:" + value); // insert before the matching line
                newLines.push(line);
            }
            else {
                newLines.push(line);
            }
        }

        if (!found) {
            throw new Error(`Key "${key}" not found in text.`);
        }

        lines = newLines;
    }

    return lines.join("\n");
}

test.describe("Saves collapsed state after icon clicks", () => {
    test("Basic round trip", async ({page}) => {
        await loadContent(page, testState());
        await saveAndCheck(page, testState());
    });
    test("Fold the function once", async ({page}) => {
        await loadContent(page, testState());
        await clickFoldFor(page, "top1");
        await saveAndCheck(page, testState({"top1": "FoldToDocumentation"}));
    });
    test("Fold the function twice and the other once", async ({page}) => {
        await loadContent(page, testState());
        await clickFoldFor(page, "top1");
        await clickFoldFor(page, "top1");
        await clickFoldFor(page, "top2");
        await saveAndCheck(page, testState({"top1": "FoldToHeader", "top2": "FoldToDocumentation"}));
    });
    test("Fold the member functions too", async ({page}) => {
        await loadContent(page, testState());
        await clickFoldFor(page, "top1");
        await clickFoldFor(page, "top1");
        await clickFoldFor(page, "top2");
        await clickFoldFor(page, "get_x");
        await clickFoldFor(page, "get_x");
        await clickFoldFor(page, "set_x");
        await saveAndCheck(page, testState({"get_x": "FoldToHeader", "set_x": "FoldToDocumentation", "top1": "FoldToHeader", "top2": "FoldToDocumentation"}));
    });
    test("Fold the Alpha member function using joint control", async ({page}) => {
        await loadContent(page, testState());
        await clickFoldChildrenFor(page, "Alpha");
        await saveAndCheck(page, testState({"__init__": "FoldToDocumentation"}));
    });
    test("Fold the Beta member functions using joint control", async ({page}) => {
        await loadContent(page, testState());
        await clickFoldChildrenFor(page, "Beta");
        await saveAndCheck(page, testState({"set_double": "FoldToDocumentation", "get_x": "FoldToDocumentation", "set_x": "FoldToDocumentation"}));
    });
    test("Freeze Alpha unfolded", async ({page}) => {
        await loadContent(page, testState());
        await makeFrozen(page, "Alpha");
        await saveAndCheck(page, testState({"Alpha": "Frozen", "__init__": "FoldToDocumentation"}));
    });

    test("Freeze Beta part-folded", async ({page}) => {
        await loadContent(page, testState());
        await clickFoldFor(page, "set_x");
        await clickFoldFor(page, "set_x");
        await makeFrozen(page, "Beta");
        // Freezing Beta should automatically fold in its children that are not already folded: 
        await saveAndCheck(page, testState({"Beta": "Frozen", "set_double": "FoldToDocumentation", "get_x": "FoldToDocumentation", "set_x": "FoldToHeader"}));
    });

    test("Freeze Alpha and Beta and top_2 in one go", async ({page}) => {
        await loadContent(page, testState());
        // Go to bottom of the definitions:
        await page.keyboard.press("ArrowUp");
        // Shift-control-up three times:
        for (let i = 0; i < 3; i++) {
            await page.keyboard.press((process.platform == "darwin" ? "Meta" : "Control") + "+Shift+ArrowUp");
        }
        // Then do contect menu and freeze:
        await makeFrozen(page, "Beta"); 
        await saveAndCheck(page, testState({"Alpha": "Frozen", "__init__": "FoldToDocumentation", "Beta": "Frozen", "set_double": "FoldToDocumentation", "get_x": "FoldToDocumentation", "set_x": "FoldToDocumentation", "top2": "FoldToDocumentation;Frozen"}));
    });

    test("Attempt to freeze member function", async ({page}) => {
        await loadContent(page, testState());
        // Will Timeout when it doesn't find the menu item:
        await expect(makeFrozen(page, "set_x")).rejects.toThrow(/Timeout/i);
    });
    
    test("Freeze Beta then cycle its visibility", async ({page}) => {
        await loadContent(page, testState());
        await makeFrozen(page, "Beta");
        // Freezing Beta should automatically fold in its children that are not already folded:
        await saveAndCheck(page, testState({"Beta": "Frozen", "set_double": "FoldToDocumentation", "get_x": "FoldToDocumentation", "set_x": "FoldToDocumentation"}));
        // You should be able to freely toggle frozen class visibility between fully visible (although its members are not visible)
        // and folded:
        await clickFoldFor(page, "Beta");
        await saveAndCheck(page, testState({"Beta": "FoldToHeader;Frozen", "set_double": "FoldToDocumentation", "get_x": "FoldToDocumentation", "set_x": "FoldToDocumentation"}));
        await clickFoldFor(page, "Beta");
        await saveAndCheck(page, testState({"Beta": "Frozen", "set_double": "FoldToDocumentation", "get_x": "FoldToDocumentation", "set_x": "FoldToDocumentation"}));
        // However, you should only be able to toggle the children between the two folded states:
        await clickFoldChildrenFor(page, "Beta");
        await saveAndCheck(page, testState({"Beta": "Frozen", "set_double": "FoldToHeader", "get_x": "FoldToHeader", "set_x": "FoldToHeader"}));
        await clickFoldChildrenFor(page, "Beta");
        await saveAndCheck(page, testState({"Beta": "Frozen", "set_double": "FoldToDocumentation", "get_x": "FoldToDocumentation", "set_x": "FoldToDocumentation"}));
        // Ditto when done individually:
        await clickFoldFor(page, "set_x");
        await saveAndCheck(page, testState({"Beta": "Frozen", "set_double": "FoldToDocumentation", "get_x": "FoldToDocumentation", "set_x": "FoldToHeader"}));
        await clickFoldFor(page, "set_x");
        await saveAndCheck(page, testState({"Beta": "Frozen", "set_double": "FoldToDocumentation", "get_x": "FoldToDocumentation", "set_x": "FoldToDocumentation"}));
    });
    test("Load frozen Alpha then try to cycle child visibility with key", async ({page}) => {
        await loadContent(page, testState({"Alpha": "Frozen", "__init__": "FoldToHeader"}));
        // We should start at top of the body, so we need to go up once into functions, then thrice more to be above Alpha:
        await page.keyboard.press("ArrowUp");
        for (let i = 0; i < 3; i++) {
            await page.keyboard.press((process.platform == "darwin" ? "Meta" : "Control") + "+ArrowUp");
        }
        // Then we go down to be inside, and down again past the top field:
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("ArrowDown");
        // Now we actually press the dot!  Would normally go back to fully visible but it should skip that and go to folded-doc:
        await page.keyboard.type(".");
        await saveAndCheck(page, testState({"Alpha": "Frozen", "__init__": "FoldToDocumentation"}));
        // Use menu to change to fully folded:
        await foldViaMenu(page, "__init__", CollapsedState.ONLY_HEADER_VISIBLE);
        await saveAndCheck(page, testState({"Alpha": "Frozen", "__init__": "FoldToHeader"}));
        // Now check the menu item for fully visible is missing:
        await expect(foldViaMenu(page, "__init__", CollapsedState.FULLY_VISIBLE)).rejects.toThrow(/Timeout/i);
    });
    test("Freeze top1 then cycle its visibility with toggle", async ({page}) => {
        await loadContent(page, testState());
        await makeFrozen(page, "top1");
        await saveAndCheck(page, testState({"top1": "FoldToDocumentation;Frozen"}));
        // You should be able to freely toggle frozen function visibility between folded to header and folded to doc, but not fully visible:
        await clickFoldFor(page, "top1");
        await saveAndCheck(page, testState({"top1": "FoldToHeader;Frozen"}));
        await clickFoldFor(page, "top1");
        await saveAndCheck(page, testState({"top1": "FoldToDocumentation;Frozen"}));
    });
});


