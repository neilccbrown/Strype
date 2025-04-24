import {Page, test, expect} from "@playwright/test";
import path from "path";

let scssVars: {[varName: string]: string};
//let strypeElIds: {[varName: string]: (...args: any[]) => string};
test.beforeEach(async ({ page }) => {
    // Save time by blocking the google scripts:
    await page.route("**/*", (route) => {
        const url = route.request().url();
        if (url.includes("google.com")) {
            route.abort(); // prevent loading
        }
        else {
            route.continue(); // allow others
        }
    });
    await page.goto("./", {waitUntil: "load"});
    await page.waitForSelector("body");
    scssVars = await page.evaluate(() => (window as any)["StrypeSCSSVarsGlobals"]);
    //strypeElIds = await page.evaluate(() => (window as any)["StrypeHTMLELementsIDsGlobals"]);
    await page.evaluate(() => {
        (window as any).Playwright = true;
    });
    // Make browser's console.log output visible in our logs (useful for debugging):
    page.on("console", (msg) => {
        console.log("Browser log:", msg.text());
    });
});

async function checkFrameXorTextCursor(page: Page) {
    // Check exactly one caret visible or focused input field:
    const result = await page.evaluate(() => {
        const scssVars = (window as any)["StrypeSCSSVarsGlobals"];
        const visibleFrameCursorElements = document.querySelectorAll("."+ scssVars.caretClassName + ":not(." + scssVars.invisibleClassName +")");
        if (document?.getSelection()?.focusNode == null) {
            return visibleFrameCursorElements.length == 1;
        }
        else {
            return visibleFrameCursorElements.length == 0;
        }
    });
    expect(result).toEqual(true);
}

async function clickId(page: Page, getIdClientSide: () => void) {
    const id = await page.evaluate(getIdClientSide);
    await page.click("#" + id);
}

async function loadPY(page: Page, filepath: string) {
    await clickId(page, () => (window as any)["StrypeHTMLELementsIDsGlobals"].getEditorMenuUID());
    await clickId(page, () => (window as any)["StrypeHTMLELementsIDsGlobals"].getLoadProjectLinkId());
    // The "button" for the target selection is now a div element.
    await page.locator("." + scssVars.editorFileInputClassName).setInputFiles(path.join(__dirname, filepath));
    await clickId(page, () => (window as any)["StrypeHTMLELementsIDsGlobals"].getLoadFromFSStrypeButtonId());
    // Wait for everything to settle:
    await page.waitForTimeout(2000);
    
    // Get to the top, and may as well sanity check as we go:
    for (let i = 0; i < 200; i++) {
        await checkFrameXorTextCursor(page);
        await page.keyboard.press("ArrowUp");
        await page.waitForTimeout(75);
    }
}

test.describe("Check navigation", async () => {
    test("Starts valid", async ({page}) => {
        await checkFrameXorTextCursor(page);
    });
    test("Right arrow through a file", async ({page}) => {
        test.setTimeout(180_000);        
        await loadPY(page, "../../cypress/fixtures/python-code.py");
        for (let i = 0; i < 4000; i++) {
            await checkFrameXorTextCursor(page);
            await page.keyboard.press("ArrowRight");
        }
    });
    // Down by itself won't go into slots, so we do down-down-left which should get to the end.
    test("Down-down-left arrow through a file", async ({page}) => {
        test.setTimeout(720_000);
        await loadPY(page, "../../cypress/fixtures/python-code.py");
        for (let i = 0; i < 200; i++) {
            await checkFrameXorTextCursor(page);
            await page.keyboard.press("ArrowDown");
            await checkFrameXorTextCursor(page);
            await page.keyboard.press("ArrowDown");
            await checkFrameXorTextCursor(page);
            await page.keyboard.press("ArrowLeft");
        }
    });
    test("Tab through a file", async ({page}) => {
        test.setTimeout(180_000);
        await loadPY(page, "../../cypress/fixtures/python-code.py");
        for (let i = 0; i < 1000; i++) {
            await checkFrameXorTextCursor(page);
            await page.keyboard.press("Tab");
        }
    });
    test("Down-down-shift-tab through a file", async ({page}) => {
        test.setTimeout(720_000);
        await loadPY(page, "../../cypress/fixtures/python-code.py");
        for (let i = 0; i < 200; i++) {
            await checkFrameXorTextCursor(page);
            await page.keyboard.press("ArrowDown");
            await checkFrameXorTextCursor(page);
            await page.keyboard.press("ArrowDown");
            await checkFrameXorTextCursor(page);
            await page.keyboard.press("Shift+Tab");
        }
    });
    test("Tab through two empty assignments", async ({page}) => {
        await page.keyboard.press("=");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("=");
        await page.keyboard.press("ArrowUp");
        await page.keyboard.press("ArrowUp");
        for (let i = 0; i < 5; i++) {
            await checkFrameXorTextCursor(page);
            await page.keyboard.press("Tab");
            await page.waitForTimeout(75);
        }
    });
});
