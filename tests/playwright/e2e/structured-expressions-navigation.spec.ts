import {Page, test, expect} from "@playwright/test";
import path from "path";
import {checkFrameXorTextCursor} from "../support/editor";

let scssVars: {[varName: string]: string};
//let strypeElIds: {[varName: string]: (...args: any[]) => string};
test.beforeEach(async ({ page }) => {
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
    // Check it actually loaded:
    const count = await page.getByText("BUILDINGS_TO_RECIPES").count();
    expect(count).toEqual(5);
    
    // Get to the top, and may as well sanity check as we go:
    for (let i = 0; i < 200; i++) {
        await checkFrameXorTextCursor(page);
        await page.keyboard.press("ArrowUp");
        await page.waitForTimeout(75);
    }
}

// With regards to Chromium: several of these tests fail on Chromium in Playwright on Mac and
// I can't figure out why.  I've tried them manually in Chrome and Chromium on the same
// machine and it works fine, but I see in the video that the test fails in Playwright
// (pressing right out of a comment frame puts the cursor at the beginning and makes a frame cursor).
// Since it works in the real browsers, and on Webkit and Firefox, we just skip the tests in Chromium
test.describe("Check navigation", async () => {
    test("Starts valid", async ({page}) => {
        await checkFrameXorTextCursor(page);
    });
    test("Right arrow through a file", async ({page}, testInfo) => {
        test.setTimeout(180_000);
        if (testInfo.project.name === "chromium") {
            test.skip(); // See comment above
        }
        await loadPY(page, "../../cypress/fixtures/python-code.py");
        for (let i = 0; i < 500; i++) {
            await checkFrameXorTextCursor(page);
            await page.keyboard.press("ArrowRight");
        }
    });
    // Down by itself won't go into slots, so we do down-down-left which should get to the end.
    test("Down-down-left arrow through a file", async ({page}, testInfo) => {
        if (testInfo.project.name === "chromium") {
            test.skip(); // See comment above
        }
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
    test("Tab through a file", async ({page}, testInfo) => {
        if (testInfo.project.name === "chromium") {
            test.skip(); // See comment above
        }
        test.setTimeout(720_000);
        await loadPY(page, "../../cypress/fixtures/python-code.py");
        for (let i = 0; i < 1000; i++) {
            await checkFrameXorTextCursor(page);
            await page.keyboard.press("Tab");
        }
    });
    test("Down-down-shift-tab through a file", async ({page}, testInfo) => {
        if (testInfo.project.name === "chromium") {
            test.skip(); // See comment above
        }
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
    test("Tab through two empty assignments", async ({page}, testInfo) => {
        if (testInfo.project.name === "chromium") {
            test.skip(); // See comment above
        }
        await page.keyboard.press("Delete");
        await page.keyboard.press("Delete");
        await page.keyboard.press("=");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("=");
        await page.keyboard.press("ArrowUp");
        await page.keyboard.press("ArrowUp");
        // We had a bug where tab needed to be pressed twice after coming out of the frame, so
        // we check explicitly here the ordering of text and frame.  Essentially, we start on frame cursor,
        // tab through both empty text slots then back to frame cursor.  Tab again at the end shouldn't change things:
        const expectedFrameCursor = [true, false, false, true, false, false, true, true];
        for (let i = 0; i < expectedFrameCursor.length; i++) {
            await checkFrameXorTextCursor(page, expectedFrameCursor[i]);
            await page.keyboard.press("Tab");
            await page.waitForTimeout(75);
        }
    });
});
