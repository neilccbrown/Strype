import {Page, test, expect} from "@playwright/test";
import { loadContent, save } from "../support/loading-saving";
import { readFileSync } from "node:fs";
import { skipPyodideLoading } from "../support/general";
import {addFakeClipboard} from "../support/clipboard";
import {doPagePaste} from "../support/editor";

test.beforeEach(async ({ page, browserName }, testInfo) => {
    if (browserName === "webkit" && (process.platform === "win32" || process.platform === "linux")) {
        // On Windows+Webkit it just can't seem to load the page for some reason,
        // and on Ubuntu+Webkit the paste doesn't seem to work (while it's fine on MacOS):
        testInfo.skip(true, "Skipping on Windows/Ubuntu + WebKit due to various problems");
    }

    // These tests can take longer than the default 30 seconds:
    testInfo.setTimeout(90000); // 90 seconds

    // Make browser's console.log output visible in our logs (useful for debugging):
    page.on("console", (msg) => {
        console.log("Browser log:", msg.text());
    });
    await skipPyodideLoading(page);
    await addFakeClipboard(page);
    await page.goto("./", {waitUntil: "load"});
    await page.waitForSelector("body");
    await page.evaluate(() => {
        (window as any).Playwright = true;
    });
});

async function testBeforeAfterPaste(page: Page, before :string, selectionKeys: string[], operation: "cut" | "copy" | "delete" | "duplicate" | "duplicate2", moveToDestKeys: string[], afterPaste :string) {
    // Load:
    await loadContent(page, before);
    for (const k of selectionKeys) {
        await page.keyboard.press(process.platform == "darwin" ? k.replaceAll("Control", "Meta") : k);
    }
    await page.waitForTimeout(500);
    // Now cut/copy:
    if (operation.startsWith("duplicate")) {
        await page.keyboard.press("ControlOrMeta+d");
        if (operation === "duplicate2") {
            // Do it again:
            await page.keyboard.press("ControlOrMeta+d");
        }
    }
    else if (operation === "cut") {
        await page.keyboard.press("ControlOrMeta+x");
    }
    else {
        await page.keyboard.press("ControlOrMeta+c");
    }
    await page.waitForTimeout(500);
    // Then move:
    for (const k of moveToDestKeys) {
        await page.keyboard.press(process.platform == "darwin" ? k.replaceAll("Control", "Meta") : k);
    }
    await page.waitForTimeout(500);
    // Paste and check:
    if (operation == "delete") {
        await page.keyboard.press("Backspace");
    }
    else if (!operation.startsWith("duplicate")) {
        await doPagePaste(page, await page.evaluate(() => window.navigator.clipboard.readText()));
    }
    await page.waitForTimeout(500);
    expect(readFileSync(await save(page, false), "utf-8")).toEqual(afterPaste);
}

async function testDuplicateViaMenu(page: Page, before: string, targetText: string, after: string) {
    // Load:
    await loadContent(page, before);
    await page.waitForTimeout(500);
    // Find the innermost frame containing that text:
    const frameDiv = page
        .getByText(targetText, { exact: true })
        .locator("xpath=ancestor::*[contains(@class, \"frame-div\")][1]");

    await frameDiv.click({ button: "right" , position: {x: 5, y: 5}});
    await page.getByText("Duplicate").hover();
    await page.waitForTimeout(500);
    await page.getByText("Duplicate").click();
    
    await page.waitForTimeout(500);
    
    expect(readFileSync(await save(page, false), "utf-8")).toEqual(after);
}

test.describe("Test duplicating via menu", () => {
    test("Duplicate function call", async ({page}) => {
        await testDuplicateViaMenu(page, "print('A')\nlen(None)\n", "print", `#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
print('A') 
print('A') 
len(None) 
#(=> Section:End
`);
    });

    test("Duplicate if with else", async ({page}) => {
        await testDuplicateViaMenu(page, `if x > 0:
    return x
else:
    return y
`, "if", `#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
if x>0  :
    return x 
else :
    return y 
if x>0  :
    return x 
else :
    return y 
#(=> Section:End
`);
    });

    test("Duplicate elif without else", async ({page}) => {
        await testDuplicateViaMenu(page, `if x > 0:
    return x
elif y > 0:
    return y
`, "elif", `#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
if x>0  :
    return x 
elif y>0  :
    return y 
elif y>0  :
    return y 
#(=> Section:End
`);
    });
    test("Duplicate elif with else", async ({page}) => {
        await testDuplicateViaMenu(page, `if x > 0:
    return x
elif y > 0:
    return y
else:
    return z
`, "elif", `#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
if x>0  :
    return x 
elif y>0  :
    return y 
elif y>0  :
    return y 
else :
    return z 
#(=> Section:End
`);
    });
    
});

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

    test("Duplicate a simple frame using selection", async ({page}) => {
        await testBeforeAfterPaste(page, "print('A')\nprint('B')\n", ["End", "Shift+ArrowUp"], "duplicate", [],`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
print('A') 
print('B') 
print('B') 
#(=> Section:End
`);
    });
    
    test("Duplicate two simple frames", async ({page}) => {
        await testBeforeAfterPaste(page, "print('A')\nprint('B')\n", ["End", "Shift+ArrowUp", "Shift+ArrowUp"], "duplicate", [],`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
print('A') 
print('B') 
print('A') 
print('B') 
#(=> Section:End
`);
    });

    test("Duplicate two simple frames, twice", async ({page}) => {
        await testBeforeAfterPaste(page, "print('A')\nprint('B')\n", ["End", "Shift+ArrowUp", "Shift+ArrowUp"], "duplicate2", [],`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
print('A') 
print('B') 
print('A') 
print('B') 
print('A') 
print('B') 
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

    test("Test Ctrl-A three times in a function selects all functions", async ({page}) => {
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
    
    const rep = <T>(n: number, x: T) => Array(n).fill(x);

    const classTestInput = `class Dest:
    dest_member = 0
    def dest(self):
        print('0')
class Src: 
    src_member_1 = 0
    def src(self):
        print('A')
        if x > 0:
            print('B')
        print('C')
    def src2():
        print('D')
`;
    test("Test Ctrl-A once in a class function selects whole function content", async ({page}) => {
        // Transfers content from src to dest functions: 
        await testBeforeAfterPaste(page,classTestInput, /* We get below print('B'): */ ["End", ...rep(8, "ArrowUp"), ...rep(1, "Control+a")], "cut", ["Home", "ArrowDown", "ArrowDown", "ArrowDown"],`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
class Dest  :
    dest_member  = 0 
    def dest (self, ) :
        print('A') 
        if x>0  :
            print('B') 
        print('C') 
        print('0') 
class Src  :
    src_member_1  = 0 
    def src (self, ) :
        pass
    def src2 (self, ) :
        print('D') 
#(=> Section:Main
#(=> Section:End
`);
    });

    test("Test Ctrl-A twice in a class function selects whole function", async ({page}) => {
        // Transfers src function to Dest class: 
        await testBeforeAfterPaste(page, classTestInput, /* We get below print('B'): */ ["End", ...rep(8, "ArrowUp"), ...rep(2, "Control+a")], "cut", ["Home", "ArrowDown", "ArrowDown"],`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
class Dest  :
    dest_member  = 0 
    def src (self, ) :
        print('A') 
        if x>0  :
            print('B') 
        print('C') 
    def dest (self, ) :
        print('0') 
class Src  :
    src_member_1  = 0 
    def src2 (self, ) :
        print('D') 
#(=> Section:Main
#(=> Section:End
`);
    });

    test("Test Ctrl-A three times in a class function selects whole class content", async ({page}) => {
        // Transfers all class content from Src to Dest: 
        await testBeforeAfterPaste(page, classTestInput, /* We get below print('B'): */ ["End", ...rep(8, "ArrowUp"), ...rep(3, "Control+a")], "cut", ["Home", "ArrowDown", "ArrowDown"],`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
class Dest  :
    dest_member  = 0 
    src_member_1  = 0 
    def src (self, ) :
        print('A') 
        if x>0  :
            print('B') 
        print('C') 
    def src2 (self, ) :
        print('D') 
    def dest (self, ) :
        print('0') 
class Src  :
    pass
#(=> Section:Main
#(=> Section:End
`);
    });

    test("Test Ctrl-A four times in a class function selects whole class", async ({page}) => {
        // Moves Src class above dest: 
        await testBeforeAfterPaste(page, classTestInput, /* We get below print('B'): */ ["End", ...rep(8, "ArrowUp"), ...rep(4, "Control+a")], "cut", ["Home"],`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
class Src  :
    src_member_1  = 0 
    def src (self, ) :
        print('A') 
        if x>0  :
            print('B') 
        print('C') 
    def src2 (self, ) :
        print('D') 
class Dest  :
    dest_member  = 0 
    def dest (self, ) :
        print('0') 
#(=> Section:Main
#(=> Section:End
`);
    });

    test("Test Ctrl-A five times in a class function selects all definitions", async ({page}) => {
        // Basically does nothing because everything ends where it began: 
        await testBeforeAfterPaste(page, classTestInput, /* We get below print('B'): */ ["End", ...rep(8, "ArrowUp"), ...rep(5, "Control+a")], "cut", ["Home"],`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
class Dest  :
    dest_member  = 0 
    def dest (self, ) :
        print('0') 
class Src  :
    src_member_1  = 0 
    def src (self, ) :
        print('A') 
        if x>0  :
            print('B') 
        print('C') 
    def src2 (self, ) :
        print('D') 
#(=> Section:Main
#(=> Section:End
`);
    });
    
    const classTestInput2 = `class OneFunc:
    def theOneFunc():
        return 42
class OneVar:
    theOneVar = 43
`;

    test("Test Ctrl-A twice below solitary function in class selects whole class", async ({page}) => {
        // Should move whole class: 
        await testBeforeAfterPaste(page, classTestInput2, /* We get into the class: */ ["End", ...rep(5, "ArrowUp"), ...rep(2, "Control+a")], "cut", ["End"],`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
class OneVar  :
    theOneVar  = 43 
class OneFunc  :
    def theOneFunc (self, ) :
        return 42 
#(=> Section:Main
#(=> Section:End
`);
    });
    test("Test Ctrl-A twice below solitary var in class selects whole class", async ({page}) => {
        // Should move whole class: 
        await testBeforeAfterPaste(page, classTestInput2, /* We get into the class: */ ["End", ...rep(2, "ArrowUp"), ...rep(2, "Control+a")], "cut", ["Home"],`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
class OneVar  :
    theOneVar  = 43 
class OneFunc  :
    def theOneFunc (self, ) :
        return 42 
#(=> Section:Main
#(=> Section:End
`);
    });

    test("Test Ctrl-A below var in definitions selects whole section", async ({page}) => {
        // Should move whole class: 
        await testBeforeAfterPaste(page, `#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
def foo():
    return 42
x = 43
#(=> Section:Main
#(=> Section:End
`, /* We get into defs: */ ["End", ...rep(1, "ArrowUp"), ...rep(1, "Control+a")], "delete", [],`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
#(=> Section:End
`);
    });

    test("Test Ctrl-A below solitary var in definitions selects whole section", async ({page}) => {
        // Should move whole class: 
        await testBeforeAfterPaste(page, `#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
x = 43
#(=> Section:Main
#(=> Section:End
`, /* We get into defs: */ ["End", ...rep(1, "ArrowUp"), ...rep(1, "Control+a")], "cut", ["ArrowDown"],`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
x  = 43 
#(=> Section:End
`);
    });
});
