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

test.describe("Test basic operation", () => {
    test("Test initial fresh load", async ({page}) => {
        await page.goto("./", {waitUntil: "load"});
        await page.waitForSelector(".frame-container");
        await assertStartingProject(page);
    });

    test("Test reload on fresh page", async ({page}) => {
        await page.goto("./", {waitUntil: "load"});
        await page.waitForSelector(".frame-container");
        await assertStartingProject(page);
        await page.reload();
        await page.waitForSelector(".frame-container");
        await assertStartingProject(page);
    });
});
