// These tests test what happens when you open, close and refresh Strype tabs,
// specifically around storing and restoring the state from browser storage.

import { Page, expect, test } from "@playwright/test";

// Note we don't visit a page in the beforeEach; that is left to individual tests.

test.beforeEach(async ({ page, browserName }, testInfo) => {
    if (browserName === "webkit" && process.platform === "win32") {
        // On Windows+Webkit it just can't seem to load the page for some reason:
        testInfo.skip(true, "Skipping on Windows + WebKit due to unknown problems");
    }

    // These tests can take longer than the default 30 seconds:
    testInfo.setTimeout(120000); // 120 seconds

    // Make browser's console.log output visible in our logs (useful for debugging):
    page.on("console", (msg) => {
        console.log("Browser log:", msg.text());
    });
});

async function assertStartingProject(page: Page)  {
    // Checks the starting project is showing:
    await expect(page.locator(".frame-div")).toHaveCount(2);
    await expect(page.locator("span", {hasText: "Hello from Strype"})).toHaveCount(1);
    await expect(page.locator("span", {hasText: "This is the default Strype starter project"})).toHaveCount(1);
}

async function assertStartingPlus(page: Page, paramContent: string) {
    await expect(page.locator(".frame-div")).toHaveCount(3);
    await expect(page.locator("span", {hasText: "Hello from Strype"})).toHaveCount(1);
    await expect(page.locator("span", {hasText: "This is the default Strype starter project"})).toHaveCount(1);
    await expect(page.locator("span", {hasText: paramContent})).toHaveCount(1);
}

// Helper function for changing the page content with a custom string
async function appendContent(page: Page, paramContent: string) {
    await page.keyboard.press("End");
    await page.keyboard.type("p\"" + paramContent);
    await page.keyboard.press("Enter");
    // Sanity check it actually appeared:
    await assertStartingPlus(page, paramContent);
}

async function loadAndWaitForEditor(page: Page) {
    await page.goto("./", {waitUntil: "load"});
    await page.waitForSelector(".frame-container");
}

test.describe("Test basic operation", () => {
    test("Test initial fresh load", async ({page}) => {
        await loadAndWaitForEditor(page);
        await assertStartingProject(page);
    });

    test("Test reload on fresh page", async ({page}) => {
        await loadAndWaitForEditor(page);
        await assertStartingProject(page);
        await page.reload();
        await page.waitForSelector(".frame-container");
        await assertStartingProject(page);
    });

    // Under the new model, a reload should automatically re-use the latest content
    // without asking.
    test("Test reload preserves content", async ({page}) => {
        await loadAndWaitForEditor(page);
        await assertStartingProject(page);
        const str = "Going to do a reload #1";
        await appendContent(page, str);
        await assertStartingPlus(page, str);
        await page.reload();
        await page.waitForSelector(".frame-container");
        await assertStartingPlus(page, str);
    });
});

// Note: it's important in all these tests to use a shared context.  If you call
// browser.newPage() they each get their own context which means they each get
// their own local storage, and the test is no longer valid for testing the scenario
// of opening multiple tabs/windows in the same browser.
test.describe("Test multi-page operation", () => {
    // The issue with this test is that the first project might not have been auto-saved,
    // but still worth testing:
    test("Second tab shows empty project", async ({browser}) => {
        const context = await browser.newContext();
        const page1 = await context.newPage();
        await loadAndWaitForEditor(page1);
        await assertStartingProject(page1);
        const str = "Going to open a second page #1";
        await appendContent(page1, str);
        await assertStartingPlus(page1, str);
        // Now open the second page, which should be the starting project still:
        const page2 = await context.newPage();
        await loadAndWaitForEditor(page2);
        await assertStartingProject(page2);
    });
    // To force an autosave, we refresh first tab before opening second:
    test("Second tab shows empty project after refreshing first", async ({browser}) => {
        const context = await browser.newContext();
        const page1 = await context.newPage();
        await loadAndWaitForEditor(page1);
        await assertStartingProject(page1);
        const str = "Going to open a second page #2";
        await appendContent(page1, str);
        await assertStartingPlus(page1, str);
        await page1.reload();
        await page1.waitForSelector(".frame-container");
        await assertStartingPlus(page1, str);
        // Now open the second page, which should be the starting project still:
        const page2 = await context.newPage();
        await loadAndWaitForEditor(page2);
        await assertStartingProject(page2);
    });
});
