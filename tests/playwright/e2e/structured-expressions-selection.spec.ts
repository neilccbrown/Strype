import {Page, test, expect} from "@playwright/test";

let scssVars: {[varName: string]: string};
//let strypeElIds: {[varName: string]: (...args: any[]) => string};
test.beforeEach(async ({ page }) => {
    // The domcontentloaded does not wait for async/defer, which is our Google scripts, but we
    // don't need them for this test.  In fact, save time by blocking that domain:
    await page.route("**/*", (route) => {
        const url = route.request().url();
        if (url.includes("google.com")) {
            route.abort(); // prevent loading
        }
        else {
            route.continue(); // allow others
        }
    });
    await page.goto("./", {waitUntil: "domcontentloaded"});
    await page.waitForSelector("body");
    scssVars = await page.evaluate(() => (window as any)["StrypeSCSSVarsGlobals"]);
    //strypeElIds = await page.evaluate(() => (window as any)["StrypeHTMLELementsIDsGlobals"]);
    // Make browser's console.log output visible in our logs (useful for debugging):
    page.on("console", (msg) => {
        console.log("Browser log:", msg.text());
    });
});

async function typeIndividually(page: Page, content: string) {
    for (let i = 0; i < content.length; i++) {
        await page.keyboard.type(content[i]);
        await page.waitForTimeout(50);
    }
}

async function getSelection(page: Page) : Promise<{ id: string, cursorPos : number }> {
    // We need a delay to make sure last DOM update has occurred:
    await page.waitForSelector("#editor");
    return page.locator("#editor").evaluate((ed) => {
        return {id : ed.getAttribute("data-slot-focus-id") || "", cursorPos : parseInt(ed.getAttribute("data-slot-cursor") || "-2")};
    });
}

async function assertState(page: Page, expectedState : string) : Promise<void> {
    const info = await getSelection(page);
    const s = await page.locator("#frameContainer_-3" + " ." + scssVars.frameHeaderClassName).first().locator("." + scssVars.labelSlotInputClassName + ", ." + scssVars.frameColouredLabelClassName).evaluateAll((parts, info: { id: string, cursorPos : number }) => {
        let s = "";
        if (!parts) {
            // Try to debug an occasional seemingly impossible failure:
            console.log("Parts is null which I'm sure shouldn't happen");
        }
        // Since we're in an if frame, we ignore the first and last part:
        for (let i = 1; i < parts.length - 1; i++) {
            const p: any = parts[i];

            let text = (p.value || p.textContent || "").replace("\u200B", "");

            // If we're the focused slot, put a dollar sign in to indicate the current cursor position:
            if (info.id === p.getAttribute("id") && info.cursorPos >= 0) {
                text = text.substring(0, info.cursorPos) + "$" + text.substring(info.cursorPos);
            }
            // Don't put curly brackets around strings, operators or brackets:
            if (!p.classList.contains((window as any)["StrypeSCSSVarsGlobals"].frameStringSlotClassName) && !p.classList.contains((window as any)["StrypeSCSSVarsGlobals"].frameOperatorSlotClassName) && !/[([)\]$]/.exec(p.textContent)) {
                text = "{" + text + "}";
            }
            s += text;
        }
        return s;
    }, info);
    // There is no correspondence for _ (indicating a null operator) in the Strype interface so just ignore that:
    expect(s).toEqual(expectedState.replaceAll("_", ""));
}

function testSelection(code : string, startIndex: number, endIndex: number, secondEntry : string | ((page: Page) => Promise<void>), expectedAfter : string) : void {
    test("Tests selecting in " + code + " from " + startIndex + " to " + endIndex + " then " + secondEntry, async ({page}) => {
        await page.keyboard.press("Backspace");
        await page.keyboard.press("Backspace");
        await page.keyboard.type("i");
        await page.waitForTimeout(100);
        await assertState(page, "{$}");
        await typeIndividually(page, code);
        await page.keyboard.press("Home");
        for (let i = 0; i < startIndex; i++) {
            await page.keyboard.press("ArrowRight");
        }
        while (startIndex < endIndex) {
            await page.keyboard.press("Shift+ArrowRight");
            startIndex += 1;
        }
        while (endIndex < startIndex) {
            await page.keyboard.press("Shift+ArrowLeft");
            startIndex -= 1;
        }
        await page.waitForTimeout(100);
        if (typeof secondEntry == "string") {
            await typeIndividually(page, secondEntry);
        }
        else {
            await secondEntry(page);
        }
        await page.waitForTimeout(500);
        await assertState(page, expectedAfter);
    });
}

function testSelectionThenDelete(code : string, doSelectKeys: (page: Page) => Promise<void>, expectedAfterDeletion : string) : void {
    test("Tests selecting and deleting in " + code, async ({page}) => {
        await page.keyboard.press("Backspace");
        await page.keyboard.press("Backspace");
        await page.keyboard.type("i");
        await page.waitForTimeout(100);
        await assertState(page, "{$}");
        await typeIndividually(page, code);
        await doSelectKeys(page);
        await page.keyboard.press("Delete");
        await assertState(page, expectedAfterDeletion);
    });
}

function testSelectionBoth(code: string, startIndex: number, endIndex: number, thenType: string | ((page: Page) => Promise<void>), expectedAfter : string) : void {
    // Test selecting from start to end:
    testSelection(code, startIndex, endIndex, thenType, expectedAfter);
    // Then end to start (if it's not exactly the same):
    if (startIndex != endIndex) {
        testSelection(code, endIndex, startIndex, thenType, expectedAfter);
    }
}

enum CUT_COPY_TEST { CUT_ONLY, COPY_ONLY, CUT_REPASTE }

function testCutCopy(code : string, startIndex: number, endIndex: number, expectedClipboard : string, expectedAfter : string, kind: CUT_COPY_TEST) : void {
    test(`Tests selecting then ${CUT_COPY_TEST[kind]} in ${code} from ${startIndex} to ${endIndex}`, async ({page}) => {
        await page.keyboard.press("Backspace");
        await page.keyboard.press("Backspace");
        await page.keyboard.type("i");
        await page.waitForTimeout(100);
        await assertState(page, "{$}");
        await typeIndividually(page, code);
        await page.keyboard.press("Home");
        for (let i = 0; i < startIndex; i++) {
            await page.keyboard.press("ArrowRight");
        }
        while (startIndex < endIndex) {
            await page.keyboard.press("Shift+ArrowRight");
            startIndex += 1;
        }
        while (endIndex < startIndex) {
            await page.keyboard.press("Shift+ArrowLeft");
            startIndex -= 1;
        }
        await page.waitForTimeout(100);
        page.keyboard.press(kind == CUT_COPY_TEST.COPY_ONLY ? "ControlOrMeta+c" : "ControlOrMeta+x");
        const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardContent).toEqual(expectedClipboard);
        if (kind == CUT_COPY_TEST.CUT_REPASTE) {
            // No need to alter clipboard because we should still have the right content on there:
            page.keyboard.press("ControlOrMeta+v");
        }
        await assertState(page, expectedAfter);
    });
}

function testCutCopyBothWays(code: string, startIndex: number, endIndex: number, expectedClipboard: string, expectedAfterCut : string, expectedAfterCopy: string) : void {
    // Test cutting from start to end then end to start:
    testCutCopy(code, startIndex, endIndex, expectedClipboard, expectedAfterCut, CUT_COPY_TEST.CUT_ONLY);
    testCutCopy(code, endIndex, startIndex, expectedClipboard, expectedAfterCut, CUT_COPY_TEST.CUT_ONLY);
    // Copying is similar, but state should be unchanged:
    // Only thing is, because selection remains, cursor pos is different each way,
    // so we label with | and $ and remove/swap accordingly:
    testCutCopy(code, startIndex, endIndex, expectedClipboard, expectedAfterCopy.replace("|", ""), CUT_COPY_TEST.COPY_ONLY);
    testCutCopy(code, endIndex, startIndex, expectedClipboard, expectedAfterCopy.replace("$", "").replace("|", "$"), CUT_COPY_TEST.COPY_ONLY);
    
    // Now, test cutting followed by pasting.  Note that state after is the unmodified one,
    // so it's actually expectedAfterCopy even though we are cutting and pasting.
    // But the cursor will always be at the end, never at the beginning:
    testCutCopy(code, startIndex, endIndex, expectedClipboard, expectedAfterCopy.replace("|", ""), CUT_COPY_TEST.CUT_REPASTE);
    testCutCopy(code, endIndex, startIndex, expectedClipboard, expectedAfterCopy.replace("|", ""), CUT_COPY_TEST.CUT_REPASTE);
}

function testNavigation(code: string, navigate: (page: Page) => Promise<void>, expectedAfter: string) : void {
    test(code, async ({page}) => {
        await page.keyboard.press("Backspace");
        await page.keyboard.press("Backspace");
        await page.keyboard.type("i");
        await page.waitForTimeout(100);
        await assertState(page, "{$}");
        await typeIndividually(page, code);
        await navigate(page);
        await page.waitForTimeout(100);
        await assertState(page, expectedAfter);
    });
}

function pressN(key: string, n : number) : ((page: Page) => Promise<void>) {
    return async (page) => {
        for (let i = 0; i < n; i++) {
            await page.keyboard.press(key); 
        }
    };
}

test.describe("Home goes to start of current level", () => {
    testNavigation("123", pressN("Home", 1), "{$123}");
    // Extra presses shouldn't matter:
    testNavigation("456", pressN("Home", 2), "{$456}");
    testNavigation("123.456", pressN("Home", 1), "{$123.456}");
    // Check we end up where we expect to without home:
    testNavigation("foo(bar)", async () => {}, "{foo}_({bar})_{$}");
    testNavigation("foo(bar", async () => {}, "{foo}_({bar$})_{}");
    // Then test home:
    testNavigation("fax(neighbour1)", pressN("Home", 1), "{$fax}_({neighbour1})_{}");
    testNavigation("fax(neighbour2", pressN("Home", 1), "{fax}_({$neighbour2})_{}");
    // Multiple presses ignored:
    testNavigation("fax(neighbour2b", pressN("Home", 2), "{fax}_({$neighbour2b})_{}");
    testNavigation("fax(neighbour3", async (page) => {
        await pressN("Home", 1)(page);
        await pressN("ArrowLeft", 1)(page);
        await pressN("Home", 1)(page);
    }, "{$fax}_({neighbour3})_{}");
});

test.describe("Shift-Home selects to the beginning", () => {
    // Note: testSelectionThenDelete needs unique code to make a unique test name
    testSelectionThenDelete("a+b",async (page) => {
        await page.keyboard.press("End");
        await page.keyboard.press("Shift+Home");
    }, "{$}");
    testSelectionThenDelete("a+c",async (page) => {
        await page.keyboard.press("End");
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("Shift+Home");
    }, "{$c}");

    testSelectionThenDelete("a+math.sin(b)",async (page) => {
        await page.keyboard.press("End");
        await page.keyboard.press("Shift+Home");
    }, "{$}");
    testSelectionThenDelete("a+max(b,c)",async (page) => {
        await page.keyboard.press("End");
        await page.keyboard.press("Shift+Home");
    }, "{$}");
});

test.describe("Shift-End selects to the end", () => {
    // Note: testSelectionThenDelete needs unique code to make a unique test name
    testSelectionThenDelete("a+b",async (page) => {
        await page.keyboard.press("Home");
        await page.keyboard.press("Shift+End");
    }, "{$}");
    testSelectionThenDelete("a+c",async (page) => {
        await page.keyboard.press("Home");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Shift+End");
    }, "{a$}");

    testSelectionThenDelete("abcdef",async (page) => {
        await page.keyboard.press("Home");
        await page.keyboard.press("Shift+ArrowRight");
        await page.keyboard.press("Shift+ArrowRight");
    }, "{$cdef}");

    testSelectionThenDelete("a+abs(b)",async (page) => {
        await page.keyboard.press("Home");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Shift+End");
    }, "{a$}");
    testSelectionThenDelete("a+math.sin(b)",async (page) => {
        await page.keyboard.press("Home");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Shift+End");
    }, "{a$}");
    testSelectionThenDelete("a+max(b,c)",async (page) => {
        await page.keyboard.press("Home");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Shift+End");
    }, "{a$}");
});

test.describe("Selecting then typing in one slot", () => {
    // Words mainly chosen to avoid having duplicate characters, to help
    // see more easily if something went wrong, and what:
    testSelectionBoth("neighbour", 2, 5, "fax", "{nefax$bour}");
    testSelectionBoth("neighbour", 2, 5, " ", "{ne $bour}");
    // Invalid entry but should still delete the selection, and replace with nothing:
    testSelectionBoth("neighbour", 2, 5, ")", "{ne$bour}");

    // Replace with operator:
    testSelectionBoth("neighbour", 2, 5, "+", "{ne}+{$bour}");
    testSelectionBoth("neighbour", 2, 5, ".", "{ne}.{$bour}");

    // Surround with brackets:
    testSelectionBoth("neighbour", 5, 9, "(", "{neigh}_({$bour})_{}");
    testSelectionBoth("neighbour(xyz)", 5, 9, "(", "{neigh}_({$bour})_{}_({xyz})_{}");
    
    // Multidim brackets by closing with selection should replace the content but otherwise do nothing:
    testSelectionBoth("fax(neighbour)", 6, 9, ")", "{fax}_({ne$bour})_{}");
    testSelectionBoth("fax(neighbour)", 1, 3, ")", "{f$}_({neighbour})_{}");
    // Not a selection but may as well test while we're here, that closing brackets do as we intended:
    testSelectionBoth("fax(neighbour)", 9, 9, ")", "{fax}_({neigh})_{}_({$bour})_{}");
    testSelectionBoth("fax(neighbour)", 3, 3, ")", "{fax}_({$})_{}_({neighbour})_{}");

    // Numbers:
    testSelectionBoth("123456", 2, 4, "+", "{12}+{$56}");
    testSelectionBoth("123456", 2, 4, "-", "{12}-{$56}");
    testSelectionBoth("123456", 2, 4, "e", "{12e$56}");
    testSelectionBoth("123456", 2, 4, ".", "{12.$56}");

    // Turn into a number slot by replacement:
    testSelectionBoth("abc123", 0, 3, "+", "{+$123}");
    testSelectionBoth("abc123", 0, 3, "-", "{-$123}");
    testSelectionBoth("abc123", 0, 3, "*", "{}*{$123}");
});

test.describe("Selecting then typing in multiple slots", () => {
    // Note that because of Cypress not being able to send shift-left/right in a way
    // that the browser handles to move selection, we are moving our own selection.
    // Thus some selections are possible (e.g. across brackets) for us to set
    // that would not be allowed in Strype (e.g. selecting across multiple bracketing levels)
    // So we just don't make those selections; we can't test that those are banned
    // programmatically.
    testSelectionBoth("123+456", 2,5, "0", "{120$56}");
    testSelectionBoth("123+456", 2,5, ".", "{12.$56}");
    testSelectionBoth("123+456", 2,5, "*", "{12}*{$56}");
    
    testSelectionBoth("123+456", 2,5, "(", "{12}_({$3}+{4})_{56}");
});

test.describe("Selecting then deleting in multiple slots", () => {
    testSelectionBoth("123+456", 2,5, (page) => page.keyboard.press("Delete"), "{12$56}");
    testSelectionBoth("123+456", 2,5, (page) => page.keyboard.press("Backspace"), "{12$56}");
});

test.describe("Selecting then cutting/copying", () => {
    testCutCopyBothWays("123456", 2,4, "34", "{12$56}", "{12|34$56}");
    testCutCopyBothWays("123+456", 2,5, "3+4", "{12$56}", "{12|3}+{4$56}");

    testCutCopyBothWays("123+(456*789)-0", 2,14, "3+(456*789)-", "{12$0}", "{12|3}+{}_({456}*{789})_{}-{$0}");
    
    // Check we don't see zero-width spaces:
    testCutCopyBothWays("fax()", 2,5, "x()", "{fa$}", "{fa|x}_({})_{$}");
});

