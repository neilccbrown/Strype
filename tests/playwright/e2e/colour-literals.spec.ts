import { test, expect, Page } from "@playwright/test";
import { setupStrypeTest } from "../support/general";
import { pressFrameShortcut, waitForEditorSettled, typeIndividually, pressN } from "../support/editor";
import { checkFrameErrorCount } from "../support/execution";

// Covers the auto-conversion mechanic (colour-literals plan §4): a plain string whose content
// matches a hex colour (e.g. "#aabbcc") converts to a colour literal (rendered the same way as
// image/sound media literals -- see media-recording.spec.ts) once the cursor leaves the string,
// but not while still typing/partway through it. Picker-driven insertion/replacement (Ctrl-Shift-Y)
// is covered separately in colour-picker.spec.ts.
test.beforeEach(async ({ page, browserName }, testInfo) => {
    await setupStrypeTest(page, browserName, testInfo, {timeoutMs: 60000, skipPyodide: true});
});

async function openIfFrame(page: Page) {
    await pressFrameShortcut(page, "i");
    await waitForEditorSettled(page);
}

// Types the given hex string as a plain string literal's content, then moves the caret out past
// the closing quote (arrow-out), which is what triggers the blur-conversion check (mere cursor
// movement doesn't fire onInput, see LabelSlot.vue's onLoseCaret) -- same pattern
// structured-expressions-navigation.spec.ts uses to move past a string's full width.
async function typeStringThenLeaveIt(page: Page, hex: string) {
    await typeIndividually(page, "\"" + hex);
    await waitForEditorSettled(page);
    await pressN("ArrowRight", 1 + hex.length, true)(page);
}

function colourSwatch(page: Page) {
    return page.locator("img[data-mediatype='colour']");
}

test.describe("Auto-conversion of typed hex strings to colour literals", () => {
    test("Typing a hex colour then moving out of the string converts it to a colour literal", async ({page}) => {
        await openIfFrame(page);
        await typeStringThenLeaveIt(page, "#aabbcc");
        await expect(colourSwatch(page)).toHaveAttribute("data-code", "\"#aabbcc\"");
        await checkFrameErrorCount(page, 0);
    });

    test("Uppercase/mixed-case hex is normalised to lowercase on conversion", async ({page}) => {
        await openIfFrame(page);
        await typeStringThenLeaveIt(page, "#AaBbCc");
        await expect(colourSwatch(page)).toHaveAttribute("data-code", "\"#aabbcc\"");
    });

    test("Single-quoted strings convert too, preserving the quote character", async ({page}) => {
        await openIfFrame(page);
        await typeIndividually(page, "'#aabbcc");
        await waitForEditorSettled(page);
        await pressN("ArrowRight", 1 + "#aabbcc".length, true)(page);
        await expect(colourSwatch(page)).toHaveAttribute("data-code", "'#aabbcc'");
    });

    test("Does not convert while the cursor is still inside the string", async ({page}) => {
        await openIfFrame(page);
        await typeIndividually(page, "\"#aabbcc");
        await waitForEditorSettled(page);
        // Deliberately not moving the cursor out -- still inside/at the end of the string content:
        await expect(colourSwatch(page)).toHaveCount(0);
    });

    test("f-prefixed strings never auto-convert", async ({page}) => {
        await openIfFrame(page);
        await typeIndividually(page, "f\"#aabbcc");
        await waitForEditorSettled(page);
        await pressN("ArrowRight", 1 + "#aabbcc".length, true)(page);
        await expect(colourSwatch(page)).toHaveCount(0);
    });

    test("r-prefixed strings never auto-convert", async ({page}) => {
        await openIfFrame(page);
        await typeIndividually(page, "r\"#aabbcc");
        await waitForEditorSettled(page);
        await pressN("ArrowRight", 1 + "#aabbcc".length, true)(page);
        await expect(colourSwatch(page)).toHaveCount(0);
    });

    test("Content that doesn't match a hex colour is left as a plain string", async ({page}) => {
        await openIfFrame(page);
        await typeStringThenLeaveIt(page, "not a colour");
        await expect(colourSwatch(page)).toHaveCount(0);
    });

    test("Undo after auto-conversion restores the original plain string", async ({page}) => {
        await openIfFrame(page);
        await typeStringThenLeaveIt(page, "#aabbcc");
        await expect(colourSwatch(page)).toHaveAttribute("data-code", "\"#aabbcc\"");

        await page.keyboard.press("ControlOrMeta+Z");
        await waitForEditorSettled(page);
        await expect(colourSwatch(page)).toHaveCount(0);
    });
});
