import {Page, test, expect} from "@playwright/test";
import { loadContent, save } from "../support/loading-saving";
import { readFileSync } from "node:fs";

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

async function testBeforeAfterPaste(page: Page, before :string, selectionKeys: string[], operation: "cut" | "copy", moveToDestKeys: string[], afterPaste :string) {
    // Load:
    await loadContent(page, before);
    for (const k of selectionKeys) {
        await page.keyboard.press(process.platform == "darwin" ? k.replaceAll("Control", "Meta") : k);
    }
    // Now cut/copy:
    if (operation === "cut") {
        await page.keyboard.press(process.platform == "darwin" ? "Meta+x" : "Control+x");
    }
    else {
        await page.keyboard.press(process.platform == "darwin" ? "Meta+c" : "Control+c");
    }
    // Then move:
    for (const k of moveToDestKeys) {
        await page.keyboard.press(process.platform == "darwin" ? k.replaceAll("Control", "Meta") : k);
    }
    // Paste and check:
    await page.keyboard.press(process.platform == "darwin" ? "Meta+v" : "Control+v");
    expect(readFileSync(await save(page, false), "utf-8")).toEqual(afterPaste);
}

test.describe(() => {
    test("Cut and paste a simple frame", async ({page}) => {
        await testBeforeAfterPaste(page, "print('A')\nprint('B')\n", ["End", "Shift+ArrowUp"], "cut", ["End", "ArrowUp"],`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
print('B') 
print('A') 
#(=> Section:End
`);
    });

    test("Test Ctrl-A in main code", async ({page}) => {
        await testBeforeAfterPaste(page,`def foo():
   pass
print('A')
print('B')
`, ["End", "Control+a"], "cut", ["Home", "ArrowUp", "ArrowUp"],`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
def foo ( ) :
    print('A') 
    print('B') 
#(=> Section:Main
#(=> Section:End
`);
    });

    test("Test Ctrl-A once in a function selects whole function content", async ({page}) => {
        // Transfers content from src to dest: 
        await testBeforeAfterPaste(page,`def dest():
   pass
def src():
    print('A')
    if x > 0:
        print('B')
    print('C')
`, /* We get below print('B'): */ ["End", "ArrowUp", "ArrowUp", "ArrowUp", "ArrowUp", "Control+a"], "cut", ["Home", "ArrowDown"],`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
def dest ( ) :
    print('A') 
    if x>0  :
        print('B') 
    print('C') 
def src ( ) :
    pass
#(=> Section:Main
#(=> Section:End
`);
    });

    test("Test Ctrl-A twice in a function selects function including header", async ({page}) => {
        // Moves second above first: 
        await testBeforeAfterPaste(page,`def first():
   pass
def second():
    print('A')
    if x > 0:
        print('B')
    print('C')
`, /* We get below print('B'): */ ["End", "ArrowUp", "ArrowUp", "ArrowUp", "ArrowUp", "Control+a", "Control+a"], "cut", ["Home"],`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
def second ( ) :
    print('A') 
    if x>0  :
        print('B') 
    print('C') 
def first ( ) :
    pass
#(=> Section:Main
#(=> Section:End
`);
    });

    test("Test Ctrl-A thrice in a function selects all functions", async ({page}) => {
        // So the paste will end up cutting all functions and pasting them back, so it looks like no change:
        await testBeforeAfterPaste(page,`def first():
   print('0') 
def second():
    print('A')
    if x > 0:
        print('B')
    print('C')
`, /* We get below print('B'): */ ["End", "ArrowUp", "ArrowUp", "ArrowUp", "ArrowUp", "Control+a", "Control+a", "Control+a"], "cut", ["Home"],`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
def first ( ) :
    print('0') 
def second ( ) :
    print('A') 
    if x>0  :
        print('B') 
    print('C') 
#(=> Section:Main
#(=> Section:End
`);
    });
});
