import {Page, test, expect} from "@playwright/test";
import {load, save} from "../support/loading-saving";
import fs from "fs";
import en from "@/localisation/en/en_main.json";

// The tests in this file can't run in parallel because they download
// to the same filenames, so need to run one at a time.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page, browserName }, testInfo) => {
    if (browserName === "webkit" && process.platform === "win32") {
        // On Windows+Webkit it just can't seem to load the page for some reason:
        testInfo.skip(true, "Skipping on Windows + WebKit due to unknown problems");
    }
    // These tests can take longer than the default 30 seconds:
    testInfo.setTimeout(90000); // 90 seconds

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
    const path = "tests/cypress/downloads/toload.spy";
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

// We have some functions and classes:
const testInput =
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
    def __init__ (self,x ) :
        self.x  = x 
    def get_x (self, ) :
        return x 
    def set_x (self,x ) :
        self.x  = x 
def top2 ( ) :
    return 64 
#(=> Section:Main
#(=> Section:End
`;

test.describe("Saves collapsed state after icon clicks", () => {
    test("Basic round trip", async ({page}) => {
        await loadContent(page, testInput);
        await saveAndCheck(page, testInput);
    });
    test("Fold the function once", async ({page}) => {
        await loadContent(page, testInput);
        await clickFoldFor(page, "top1");
        await saveAndCheck(page, `#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
#(=> FrameState:FoldToDocumentation
def top1 ( ) :
    return 6 
class Alpha  :
    some_constant  = 5 
    def __init__ (self, ) :
        self.x  = 7 
class Beta  :
    def __init__ (self,x ) :
        self.x  = x 
    def get_x (self, ) :
        return x 
    def set_x (self,x ) :
        self.x  = x 
def top2 ( ) :
    return 64 
#(=> Section:Main
#(=> Section:End
`);
    });
    test("Fold the function twice and the other once", async ({page}) => {
        await loadContent(page, testInput);
        await clickFoldFor(page, "top1");
        await clickFoldFor(page, "top1");
        await clickFoldFor(page, "top2");
        await saveAndCheck(page, `#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
#(=> FrameState:FoldToHeader
def top1 ( ) :
    return 6 
class Alpha  :
    some_constant  = 5 
    def __init__ (self, ) :
        self.x  = 7 
class Beta  :
    def __init__ (self,x ) :
        self.x  = x 
    def get_x (self, ) :
        return x 
    def set_x (self,x ) :
        self.x  = x 
#(=> FrameState:FoldToDocumentation
def top2 ( ) :
    return 64 
#(=> Section:Main
#(=> Section:End
`);
    });
    test("Fold the member functions too", async ({page}) => {
        await loadContent(page, testInput);
        await clickFoldFor(page, "top1");
        await clickFoldFor(page, "top1");
        await clickFoldFor(page, "top2");
        await clickFoldFor(page, "get_x");
        await clickFoldFor(page, "get_x");
        await clickFoldFor(page, "set_x");
        await saveAndCheck(page, `#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
#(=> FrameState:FoldToHeader
def top1 ( ) :
    return 6 
class Alpha  :
    some_constant  = 5 
    def __init__ (self, ) :
        self.x  = 7 
class Beta  :
    def __init__ (self,x ) :
        self.x  = x 
    #(=> FrameState:FoldToHeader
    def get_x (self, ) :
        return x 
    #(=> FrameState:FoldToDocumentation
    def set_x (self,x ) :
        self.x  = x 
#(=> FrameState:FoldToDocumentation
def top2 ( ) :
    return 64 
#(=> Section:Main
#(=> Section:End
`);
    });
    test("Fold the Alpha member function using joint control", async ({page}) => {
        await loadContent(page, testInput);
        await clickFoldChildrenFor(page, "Alpha");
        await saveAndCheck(page, `#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
def top1 ( ) :
    return 6 
class Alpha  :
    some_constant  = 5 
    #(=> FrameState:FoldToDocumentation
    def __init__ (self, ) :
        self.x  = 7 
class Beta  :
    def __init__ (self,x ) :
        self.x  = x 
    def get_x (self, ) :
        return x 
    def set_x (self,x ) :
        self.x  = x 
def top2 ( ) :
    return 64 
#(=> Section:Main
#(=> Section:End
`);
    });
    test("Fold the Beta member functions using joint control", async ({page}) => {
        await loadContent(page, testInput);
        await clickFoldChildrenFor(page, "Beta");
        await saveAndCheck(page, `#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
def top1 ( ) :
    return 6 
class Alpha  :
    some_constant  = 5 
    def __init__ (self, ) :
        self.x  = 7 
class Beta  :
    #(=> FrameState:FoldToDocumentation
    def __init__ (self,x ) :
        self.x  = x 
    #(=> FrameState:FoldToDocumentation
    def get_x (self, ) :
        return x 
    #(=> FrameState:FoldToDocumentation
    def set_x (self,x ) :
        self.x  = x 
def top2 ( ) :
    return 64 
#(=> Section:Main
#(=> Section:End
`);
    });

    test("Freeze Alpha unfolded", async ({page}) => {
        await loadContent(page, testInput);
        await makeFrozen(page, "Alpha");
        await saveAndCheck(page, `#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
def top1 ( ) :
    return 6 
#(=> FrameState:Frozen
class Alpha  :
    some_constant  = 5 
    #(=> FrameState:FoldToDocumentation
    def __init__ (self, ) :
        self.x  = 7 
class Beta  :
    def __init__ (self,x ) :
        self.x  = x 
    def get_x (self, ) :
        return x 
    def set_x (self,x ) :
        self.x  = x 
def top2 ( ) :
    return 64 
#(=> Section:Main
#(=> Section:End
`);
    });

    test("Freeze Beta unfolded", async ({page}) => {
        await loadContent(page, testInput);
        await clickFoldFor(page, "set_x");
        await clickFoldFor(page, "set_x");
        await makeFrozen(page, "Beta");
        // Freezing Beta should automatically fold in its children that are not already folded: 
        await saveAndCheck(page, `#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
def top1 ( ) :
    return 6 
class Alpha  :
    some_constant  = 5 
    def __init__ (self, ) :
        self.x  = 7 
#(=> FrameState:Frozen
class Beta  :
    #(=> FrameState:FoldToDocumentation
    def __init__ (self,x ) :
        self.x  = x 
    #(=> FrameState:FoldToDocumentation
    def get_x (self, ) :
        return x 
    #(=> FrameState:FoldToHeader
    def set_x (self,x ) :
        self.x  = x 
def top2 ( ) :
    return 64 
#(=> Section:Main
#(=> Section:End
`);
    });

    test("Attempt to freeze member function", async ({page}) => {
        await loadContent(page, testInput);
        // Will Timeout when it doesn't find the menu item:
        await expect(makeFrozen(page, "set_x")).rejects.toThrow(/Timeout/i);
    });
});


