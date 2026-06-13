import {expect, Locator, Page, test} from "@playwright/test";
import {checkConsoleContent, runToFinish} from "../support/execution";

test.beforeEach(async ({ page, browserName }, testInfo) => {
    if (browserName === "webkit" && process.platform === "win32") {
        // On Windows+Webkit it just can't seem to load the page for some reason:
        testInfo.skip(true, "Skipping on Windows + WebKit due to unknown problems");
    }
    testInfo.setTimeout(120000);
    await page.goto("./", {waitUntil: "load"});
    await expect(page.locator(".frame-div")).toHaveCount(2);
    await page.evaluate(() => {
        (window as any).Playwright = true;
    });
    // Make browser's console.log output visible in our logs (useful for debugging):
    page.on("console", (msg) => {
        console.log("Browser log:", msg.text());
    });
});

async function scrollToFraction(page : Page, fraction: number) {
    await page.evaluate((frac) => {
        const doc = document.documentElement;
        const maxScroll = doc.scrollHeight - window.innerHeight;
        window.scrollTo(0, maxScroll * frac);
    }, fraction);
}

// Checks an element is inside visible viewport, and not within margin of the edges
async function expectWellInsideViewport(locator: Locator, margin = 100) {
    const result = await locator.evaluate((el, margin) => {
        const r = el.getBoundingClientRect();

        return (
            r.top >= margin &&
            r.left >= margin &&
            r.bottom <= window.innerHeight - margin &&
            r.right <= window.innerWidth - margin
        );
    }, margin);

    expect(result).toBe(true);
}

test.describe("Runtime errors scroll into view", () => {
    for (let fraction = 0; fraction <= 1; fraction += 0.125) {
        test(`Runtime errors scroll into view, starting at ${fraction}`, async ({page}) => {
            // Enter 40 blanks then print(len(None)) then 40 blanks:
            for (let b = 0; b < 40; b++) {
                await page.keyboard.press("Enter");
                await page.waitForTimeout(50);
            }
            await page.keyboard.type("plen(None)");
            await page.keyboard.press("Enter");
            for (let b = 0; b < 40; b++) {
                await page.keyboard.press("Enter");
                await page.waitForTimeout(50);
            }
            await scrollToFraction(page, fraction);
            // "Finish" here is an exception
            await runToFinish(page);
            await checkConsoleContent(page, "< TypeError: object of type 'NoneType' has no len() >\n  From the highlighted call in your code");
            // Now check its scroll position:
            await expectWellInsideViewport(page.locator("i.fa-exclamation-triangle"));
        });
    }
});
