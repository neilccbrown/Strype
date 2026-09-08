import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { doPagePaste, pressFrameShortcut } from "../support/editor";
import { setupStrypeTest } from "../support/general";
import { createGradientPngBase64 } from "../support/media";

test.beforeEach(async ({ page, browserName }, testInfo) => {
    await setupStrypeTest(page, browserName, testInfo, {timeoutMs: 60000, skipPyodide: true});
});

test.describe("Media image rotate", async () => {
    // We previously had a bug where rotating a non-square image in the edit dialog cropped
    // the content instead of keeping the whole (now swapped-dimension) image, because the
    // crop stencil kept its pre-rotation size after rotate() was called. A solid-colour or
    // few-block test image wouldn't catch a rotate that scrambles/skews pixels while still
    // reporting plausible-looking dimensions/colours, so this uses a genuine two-axis colour
    // gradient and checks several sampled points against the exact expected colour for a
    // correct 90-degree rotation, not just a handful of solid regions.
    test("Rotating a non-square image keeps the full content, correctly rotated", async ({page}) => {
        const srcX = 200;
        const srcY = 100;
        // Red increases left-to-right, green increases top-to-bottom.
        const srcImage = createGradientPngBase64(srcX, srcY);

        await pressFrameShortcut(page, "p");
        await doPagePaste(page, srcImage, "image/png");

        const before = await page.locator("img.label-slot-media").getAttribute("src");

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
        const beforeText = await span.textContent() as string;
        const [, beforeWidth, beforeHeight] = beforeText.match(previewSizeRegex) as RegExpMatchArray;
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

        await page.locator(".btn.btn-primary", {hasText: "OK"}).filter({visible: true}).click();
        // Wait for the src= to update by polling:
        await expect.poll(
            async () => await page.locator("img.label-slot-media").getAttribute("src"),
            { timeout: 15000 }
        ).not.toBe(before);

        const after = await page.locator("img.label-slot-media").getAttribute("src") as string;
        const afterBase64 = after.substring(after.indexOf(",") + 1);
        const png = PNG.sync.read(Buffer.from(afterBase64, "base64"));
        expect(png.width).toBe(srcY);
        expect(png.height).toBe(srcX);

        // A 90-degree clockwise rotation maps original (x, y) to (newX, newY) = ((srcY - 1) - y, x).
        // Inverting that: a pixel at (newX, newY) in the rotated image should carry the colour
        // that the original gradient had at (x, y) = (newY, (srcY - 1) - newX).
        const margin = 10;
        const samplePoints = [
            [margin, margin], [png.width - margin, margin],
            [margin, png.height - margin], [png.width - margin, png.height - margin],
            [Math.floor(png.width / 2), Math.floor(png.height / 2)],
            [margin, Math.floor(png.height / 2)], [png.width - margin, Math.floor(png.height / 2)],
        ];
        for (const [newX, newY] of samplePoints) {
            const srcXAt = newY;
            const srcYAt = (srcY - 1) - newX;
            const expectedR = Math.round(255 * srcXAt / (srcX - 1));
            const expectedG = Math.round(255 * srcYAt / (srcY - 1));

            const idx = (png.width * newY + newX) << 2;
            const actualR = png.data[idx];
            const actualG = png.data[idx + 1];

            // Allow a little tolerance: the image round-trips through canvas drawing/PNG
            // re-encoding, which can shift channel values by a few units.
            expect(actualR, `red at (${newX},${newY})`).toBeGreaterThanOrEqual(expectedR - 12);
            expect(actualR, `red at (${newX},${newY})`).toBeLessThanOrEqual(expectedR + 12);
            expect(actualG, `green at (${newX},${newY})`).toBeGreaterThanOrEqual(expectedG - 12);
            expect(actualG, `green at (${newX},${newY})`).toBeLessThanOrEqual(expectedG + 12);
        }
    });
});
