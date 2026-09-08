import { test, expect } from "@playwright/test";
import { doPagePaste, pressFrameShortcut } from "../support/editor";
import { setupStrypeTest } from "../support/general";
import { createBlackPngBase64 } from "../support/media";

test.beforeEach(async ({ page, browserName }, testInfo) => {
    await setupStrypeTest(page, browserName, testInfo, {timeoutMs: 60000, skipPyodide: true});
});

test.describe("Media image rotate", async () => {
    // We previously had a bug where rotating a non-square image in the edit dialog cropped
    // the content instead of keeping the whole (now swapped-dimension) image, because the
    // crop stencil kept its pre-rotation size after rotate() was called.
    test("Rotating a non-square image keeps the full content", async ({page}) => {
        const srcX = 200;
        const srcY = 100;
        const srcImage = createBlackPngBase64(srcX, srcY);

        await pressFrameShortcut(page, "p");
        await doPagePaste(page, srcImage, "image/png");

        await page.locator("img.label-slot-media").hover();
        await page.locator(".MediaPreviewPopup-header-edit-button").click();

        // Wait for the dialog to finish loading the image:
        const spans = page.locator("span.EditImageDlg-sizeInfo");
        const count = await spans.count();
        for (let i = 0; i < count; i++) {
            await expect(spans.nth(i)).not.toContainText("Loading", {timeout: 5000});
        }

        const previewSizeRegex = /Changed[^0-9]+([0-9]+)[^0-9]+([0-9]+)/;
        const span = page.locator("span").filter({ hasText: previewSizeRegex }).first();

        // Sanity check: before rotating, the size should match the original (non-square) image.
        let text = await span.textContent() as string;
        let [, beforeWidth, beforeHeight] = text.match(previewSizeRegex) as RegExpMatchArray;
        expect(Number(beforeWidth)).toBe(srcX);
        expect(Number(beforeHeight)).toBe(srcY);

        await page.locator(".EditImageDlg-rotate-button").click();

        // After a 90 degree rotation the whole image should still be present, just with
        // width/height swapped -- not cropped down towards a square.
        await expect.poll(async () => {
            const t = await span.textContent() as string;
            const m = t.match(previewSizeRegex) as RegExpMatchArray;
            return [Number(m[1]), Number(m[2])];
        }, {timeout: 5000}).toEqual([srcY, srcX]);
    });
});
