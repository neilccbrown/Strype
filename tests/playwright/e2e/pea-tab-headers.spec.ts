import { test, expect, Page } from "@playwright/test";
import en from "../../../src/localisation/en/en_main.json";
import { setupStrypeTest } from "../support/general";

test.beforeEach(async ({ page, browserName }, testInfo) => {
    await setupStrypeTest(page, browserName, testInfo, {skipPyodide: true});
});

// The four layout buttons (tabs collapsed/expanded, split collapsed/expanded) only appear when the
// PEA's content is hovered:
async function chooseLayout(page: Page, nthButton: number): Promise<void> {
    await page.locator("#peaTabContentContainerDiv").hover();
    await page.click(`.pea-toggle-layout-buttons-container > div:nth-child(${nthButton})`);
}

test.describe("Python execution area tab headers", () => {
    test("tabs layout has separate Graphics, Console and Files headers", async ({ page }) => {
        await expect(page.locator("#graphicsPEATab")).toBeVisible();
        await expect(page.locator("#consolePEATab")).toBeVisible();
        await expect(page.locator("#consolePEATab")).toContainText(en.PEA.console);
        await expect(page.locator("#filesPEATab")).toBeVisible();
        await expect(page.locator("#consolePEATab .pea-turtle-img")).toHaveCount(0);
    });

    for (const [name, nthButton] of [["split collapsed", 3], ["split expanded", 4]] as const) {
        test(`${name} layout merges Graphics and Console into one Output header`, async ({ page }) => {
            await chooseLayout(page, nthButton);
            await expect(page.locator("#graphicsPEATab")).toBeHidden();
            const output = page.locator("#consolePEATab");
            await expect(output).toBeVisible();
            await expect(output).toContainText(en.PEA.output);
            await expect(output).not.toContainText(en.PEA.console);
            // Both icons: the turtle image, then the console glyph:
            await expect(output.locator(".pea-turtle-img")).toBeVisible();
            await expect(output).toContainText("❱⎽");
            await expect(page.locator("#filesPEATab")).toBeVisible();
            // Output is the selected header, and the console and graphics areas are showing together:
            await expect(output).toHaveClass(/active/);
            await expect(page.locator("#peaConsole")).toBeVisible();
            await expect(page.locator("#peaGraphicsContainerDiv")).toBeVisible();

            // Files replaces both, and Output brings both back:
            await page.click("#filesPEATab");
            await expect(page.locator("#filesPEATab")).toHaveClass(/active/);
            await expect(page.locator(".file-system-pane")).toBeVisible();
            await expect(page.locator("#peaConsole")).toBeHidden();
            await page.click("#consolePEATab");
            await expect(output).toHaveClass(/active/);
            await expect(page.locator("#peaConsole")).toBeVisible();
            await expect(page.locator("#peaGraphicsContainerDiv")).toBeVisible();
        });
    }

    test("going from the Graphics tab to a split layout leaves Output selected", async ({ page }) => {
        await page.click("#graphicsPEATab");
        await expect(page.locator("#graphicsPEATab")).toHaveClass(/active/);
        await chooseLayout(page, 3);
        await expect(page.locator("#consolePEATab")).toHaveClass(/active/);
    });
});
