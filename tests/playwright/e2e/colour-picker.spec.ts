import { test, expect, Page } from "@playwright/test";
import { setupStrypeTest } from "../support/general";
import { pressFrameShortcut, waitForEditorSettled, checkTextSlotCursorPos, typeIndividually } from "../support/editor";
import { checkFrameErrorCount, checkConsoleContent, runToFinish } from "../support/execution";

test.beforeEach(async ({ page, browserName }, testInfo) => {
    // One test in this file (the U+200B regression test below) actually runs the program, so
    // Pyodide can't be skipped for the whole file the way most dialog-only tests here otherwise
    // would want -- matches check-error-locations.spec.ts's convention for the same reason.
    await setupStrypeTest(page, browserName, testInfo, {timeoutMs: 90000});
});

// Opens an "if" frame and leaves the caret in its (empty) expression slot -- same helper as
// media-recording.spec.ts uses for its own shortcut-gating/insertion tests.
async function openIfFrame(page: Page) {
    await pressFrameShortcut(page, "i");
    await waitForEditorSettled(page);
}

// Reads the raw (unstripped -- deliberately keeping any stray U+200B placeholder rather than
// filtering it out like editor.ts's assertStateOfIfFrame helper does) text of the first new
// top-level frame's header. A fresh page's default insertion caret sits above the default
// project's own content, so as long as a test's very first action inserts exactly one new frame
// (as openIfFrame/pressFrameShortcut do here), "#frameContainer_-3" always refers to that new
// frame -- the same assumption editor.ts's assertStateOfIfFrame/assertStateOfVarAssignFrame make.
async function getRawFrameHeaderText(page: Page): Promise<string> {
    const scssVars = await page.evaluate(() => (window as any)["StrypeSCSSVarsGlobals"]);
    return page.locator("#frameContainer_-3 ." + scssVars.frameHeaderClassName).first()
        .locator(`.${scssVars.labelSlotInputClassName}, .${scssVars.frameColouredLabelClassName}`)
        .evaluateAll((parts) => parts.map((p) => (p as any).value || p.textContent || "").join(""));
}

async function getGraphicsCenterPixel(page: Page): Promise<[number, number, number, number]> {
    return page.evaluate(() => {
        const canvas = document.getElementById("pythonGraphicsCanvas") as HTMLCanvasElement;
        const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
        const {width, height} = canvas;
        const d = ctx.getImageData(Math.floor(width / 2), Math.floor(height / 2), 1, 1).data;
        return [d[0], d[1], d[2], d[3]];
    });
}

function visibleCancelButton(page: Page) {
    return page.locator(".btn.btn-secondary", {hasText: "Cancel"}).filter({visible: true});
}

function visibleOKButton(page: Page) {
    return page.locator(".btn.btn-primary", {hasText: "OK"}).filter({visible: true});
}

// ColourPickerDlg.vue's own hexText seeding (onShownModalDlg) runs on bootstrap-vue's async
// "shown" modal event, which fires strictly after the dialog is already visible/interactable --
// there's no DOM signal available to poll for it directly. Filling the hex input immediately after
// opening (skipping the "Spectrum" button click, which happens when editing an
// existing colour jumps straight there) races that handler: it can fire *after* the fill and
// silently overwrite it back to the seeded value. A toHaveValue() check right after opening isn't
// a reliable guard either -- the input can still be showing a stale leftover value from before the
// dialog opened that happens to equal the correctly-seeded one, passing the check without the
// handler having actually run yet (this is exactly what caused a real, reproducible CI failure).
// Matches the same kind of buffer used elsewhere in this codebase for an async-settle race that
// has no better observable signal (see media-recording.spec.ts's waitForImageCropperReady).
async function waitForColourPickerSeeded(page: Page) {
    await page.waitForTimeout(500);
}

test.describe("Colour picker shortcut gating", () => {
    test("Ctrl-Shift-Y does nothing inside a comment frame", async ({page}) => {
        await page.keyboard.press("#");
        await waitForEditorSettled(page);
        await page.keyboard.type("hello");
        await waitForEditorSettled(page);
        await page.keyboard.press("ControlOrMeta+Shift+Y");
        // No good positive signal for "nothing happened", so just give it a moment then assert
        // absence -- the dialog stays mounted (but hidden) in the DOM even when "closed", so we
        // must check visibility, not mere presence (same pattern as media-recording.spec.ts):
        await page.waitForTimeout(300);
        await expect(page.locator("#colourPickerDlg")).not.toBeVisible();
    });

    test("Ctrl-Shift-Y opens the dialog in a plain expression slot", async ({page}) => {
        await openIfFrame(page);
        await page.keyboard.press("ControlOrMeta+Shift+Y");
        await expect(page.locator("#colourPickerDlg")).toBeVisible();
        await visibleCancelButton(page).click();
    });

    test("Ctrl-Shift-Y opens the dialog inside a string slot too, unlike the media-recording shortcuts", async ({page}) => {
        await openIfFrame(page);
        await page.keyboard.type("\"notacolour");
        await waitForEditorSettled(page);
        await page.keyboard.press("ControlOrMeta+Shift+Y");
        await expect(page.locator("#colourPickerDlg")).toBeVisible();
        await visibleCancelButton(page).click();
    });
});

test.describe("Family grid / tinker view / fine-grained selector navigation", () => {
    test("Selecting a family switches to the tinker view with hue chips and a shade grid", async ({page}) => {
        await openIfFrame(page);
        await page.keyboard.press("ControlOrMeta+Shift+Y");
        await page.locator(".ColourPickerDlg-family-btn", {hasText: "Green"}).click();
        await expect(page.locator(".ColourPickerDlg-chip").first()).toBeVisible();
        await expect(page.locator(".ColourPickerDlg-shade-cell").first()).toBeVisible();
        await visibleCancelButton(page).click();
    });

    test("Spectrum shows the hue slider, SV square and hex input, and Tiles returns to the grid", async ({page}) => {
        await openIfFrame(page);
        await page.keyboard.press("ControlOrMeta+Shift+Y");
        await page.locator("button", {hasText: "Spectrum"}).click();
        await expect(page.locator(".ColourPickerDlg-hue-slider")).toBeVisible();
        await expect(page.locator(".ColourPickerDlg-sv-square")).toBeVisible();
        await expect(page.locator("#ColourPickerDlg-hex-input")).toBeVisible();

        // Fresh insert (no family was picked first) -- toggling away from the fine-grained
        // selector goes back to the family grid, not the tinker view:
        await page.locator("button", {hasText: "Tiles"}).click();
        await expect(page.locator(".ColourPickerDlg-family-btn").first()).toBeVisible();
        await visibleCancelButton(page).click();
    });
});

test.describe("Alpha slider", () => {
    test("Hidden on the family grid, shown on the tile and spectrum views", async ({page}) => {
        await openIfFrame(page);
        await page.keyboard.press("ControlOrMeta+Shift+Y");
        await expect(page.locator(".ColourPickerDlg-alpha-col")).not.toBeVisible();

        await page.locator(".ColourPickerDlg-family-btn", {hasText: "Green"}).click();
        await expect(page.locator(".ColourPickerDlg-alpha-col")).toBeVisible();

        await page.locator("button", {hasText: "Spectrum"}).click();
        await expect(page.locator(".ColourPickerDlg-alpha-col")).toBeVisible();

        // "Tiles" from the spectrum view returns to the tinker view here (a family -- Green -- was
        // already picked above), not the family grid -- see toggleFineGrained in ColourPickerDlg.vue
        // -- so the alpha slider is still expected to be visible:
        await page.locator("button", {hasText: "Tiles"}).click();
        await expect(page.locator(".ColourPickerDlg-alpha-col")).toBeVisible();

        // The "‹ Main colours" button is the one that actually goes back to the family grid:
        await page.locator("button", {hasText: "Main colours"}).click();
        await expect(page.locator(".ColourPickerDlg-alpha-col")).not.toBeVisible();

        await visibleCancelButton(page).click();
    });

    test("Typing an 8-digit hex value positions the slider and previews a tinted (not flat opaque) colour", async ({page}) => {
        await openIfFrame(page);
        await page.keyboard.press("ControlOrMeta+Shift+Y");
        await page.locator("button", {hasText: "Spectrum"}).click();
        await page.locator("#ColourPickerDlg-hex-input").fill("#3366cc80");
        // The preview is now a checkerboard tinted by the colour at its alpha (see
        // showGraphicsColourPreview in ColourPickerDlg.vue), not a flat opaque fill -- so at 0x80
        // alpha the composited centre pixel should read noticeably different from the raw opaque hex:
        await expect.poll(async () => {
            const px = await getGraphicsCenterPixel(page);
            const opaque = [0x33, 0x66, 0xcc, 255];
            return px.some((v, i) => Math.abs(v - opaque[i]) > 15);
        }).toBe(true);

        const cursorTop = await page.locator(".ColourPickerDlg-alpha-cursor").evaluate((el) => el.style.top);
        // 0x80/0xff is just over half way down from the fully-opaque top:
        expect(parseFloat(cursorTop)).toBeGreaterThan(45);
        expect(parseFloat(cursorTop)).toBeLessThan(55);

        await visibleCancelButton(page).click();
    });

    test("Dragging the alpha slider updates the hex field, and OK records 8 digits only when not fully opaque", async ({page}) => {
        await openIfFrame(page);
        await page.keyboard.press("ControlOrMeta+Shift+Y");
        await page.locator("button", {hasText: "Spectrum"}).click();
        await waitForColourPickerSeeded(page);
        await page.locator("#ColourPickerDlg-hex-input").fill("#00ff00");

        const slider = page.locator(".ColourPickerDlg-alpha-slider");
        const box = await slider.boundingBox();
        if (!box) {
            throw new Error("Alpha slider has no bounding box");
        }
        // Drag to roughly the bottom of the slider (near-transparent, but not exactly 0 -- avoids
        // relying on an exact pixel landing on alpha 0):
        await page.mouse.move(box.x + box.width / 2, box.y + 5);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height - 5);
        await page.mouse.up();

        const hexValue = await page.locator("#ColourPickerDlg-hex-input").inputValue();
        expect(hexValue).toMatch(/^#00ff00[0-9a-f]{2}$/i);
        expect(hexValue.toLowerCase()).not.toBe("#00ff00ff");

        await visibleOKButton(page).click();
        await waitForEditorSettled(page);
        const text = await getRawFrameHeaderText(page);
        expect(text).toContain(hexValue);
    });

    test("A fully-opaque (ff) alpha is dropped from the recorded string, an explicit non-ff alpha is kept", async ({page}) => {
        await openIfFrame(page);
        await page.keyboard.press("ControlOrMeta+Shift+Y");
        await page.locator("button", {hasText: "Spectrum"}).click();
        await waitForColourPickerSeeded(page);

        await page.locator("#ColourPickerDlg-hex-input").fill("#3366ccff");
        await visibleOKButton(page).click();
        await waitForEditorSettled(page);
        // "ff" alpha must be dropped -- assert on the hex code itself (rather than toContain, which
        // would also pass if a stray "#3366ccff" were present) since the quote character that
        // follows it in the DOM isn't a plain ASCII quote:
        const opaqueMatch = /#3366cc([0-9a-f]*)/i.exec(await getRawFrameHeaderText(page));
        expect(opaqueMatch?.[1]).toBe("");

        // Re-open on the string just inserted and give it a genuine alpha this time:
        await page.keyboard.press("ControlOrMeta+Shift+Y");
        await expect(page.locator("#colourPickerDlg")).toBeVisible();
        await page.locator("#ColourPickerDlg-hex-input").fill("#3366cc80");
        await visibleOKButton(page).click();
        await waitForEditorSettled(page);
        expect(await getRawFrameHeaderText(page)).toContain("#3366cc80");
    });

    test("The Previous swatch restores both the colour and the alpha it was opened with", async ({page}) => {
        await openIfFrame(page);
        await page.keyboard.type("\"#3366cc80");
        await waitForEditorSettled(page);
        await page.keyboard.press("ControlOrMeta+Shift+Y");
        await expect(page.locator("#colourPickerDlg")).toBeVisible();

        // Change to a different colour/alpha first, then click Previous to restore the original:
        await page.locator("#ColourPickerDlg-hex-input").fill("#00ff0040");
        await page.locator(".ColourPickerDlg-swatch-btn").click();

        const hexValue = await page.locator("#ColourPickerDlg-hex-input").inputValue();
        expect(hexValue.toLowerCase()).toBe("#3366cc80");
    });
});

test.describe("Graphics preview", () => {
    test("Does not flood-fill until a colour is actually picked, then reflects the choice", async ({page}) => {
        await openIfFrame(page);
        const before = await getGraphicsCenterPixel(page);

        await page.keyboard.press("ControlOrMeta+Shift+Y");
        await expect(page.locator("#colourPickerDlg")).toBeVisible();
        // Fresh insert, family grid showing, nothing picked yet -- the graphics area must be
        // untouched (this is the bug that was reported: a default red flood-fill appeared here
        // before any colour had been chosen):
        await page.waitForTimeout(300);
        expect(await getGraphicsCenterPixel(page)).toEqual(before);

        await page.locator(".ColourPickerDlg-family-btn", {hasText: "Green"}).click();
        await expect.poll(() => getGraphicsCenterPixel(page)).not.toEqual(before);

        await visibleCancelButton(page).click();
    });

    test("Typing an exact hex value in the fine-grained selector previews that exact colour", async ({page}) => {
        await openIfFrame(page);
        await page.keyboard.press("ControlOrMeta+Shift+Y");
        await page.locator("button", {hasText: "Spectrum"}).click();
        await waitForColourPickerSeeded(page);
        await page.locator("#ColourPickerDlg-hex-input").fill("#3366cc");
        await expect.poll(() => getGraphicsCenterPixel(page)).toEqual([0x33, 0x66, 0xcc, 255]);
        await visibleCancelButton(page).click();
    });
});

test.describe("Inserting and editing colour string literals", () => {
    // Since the colour-literals feature (see colour-literals.spec.ts), confirming the picker no
    // longer inserts/replaces a plain string -- it produces a colour MediaSlot, rendered as an
    // <img class="...labelSlotMediaClassName..." data-mediatype="colour" data-code='"#hex"'>,
    // the same way image/sound literals are (media-recording.spec.ts), so we assert via that
    // element's data-code attribute rather than the raw frame header text (which no longer
    // contains the hex as visible text).
    test("Typing a hex value and confirming inserts a colour literal into an empty expression slot", async ({page}) => {
        await openIfFrame(page);
        await page.keyboard.press("ControlOrMeta+Shift+Y");
        await page.locator("button", {hasText: "Spectrum"}).click();
        await waitForColourPickerSeeded(page);
        await page.locator("#ColourPickerDlg-hex-input").fill("#3366cc");
        await visibleOKButton(page).click();
        await waitForEditorSettled(page);

        await expect(page.locator("img[data-mediatype='colour']")).toHaveAttribute("data-code", "\"#3366cc\"");
        // A bare condition consisting of just a colour literal is valid Python (truthy check), so
        // this should never show a syntax error:
        await checkFrameErrorCount(page, 0);
    });

    test("Invoking the picker inside an existing string replaces the whole string with a colour literal", async ({page}) => {
        await openIfFrame(page);
        await page.keyboard.type("\"notacolour");
        await waitForEditorSettled(page);
        await page.keyboard.press("ControlOrMeta+Shift+Y");
        await expect(page.locator("#colourPickerDlg")).toBeVisible();
        // Editing existing (invalid) string content jumps straight into the fine-grained selector
        // (see onShownModalDlg in ColourPickerDlg.vue), so the "Spectrum" toggle
        // button isn't shown here -- only click it if we're not already there:
        if (!(await page.locator("#ColourPickerDlg-hex-input").isVisible())) {
            await page.locator("button", {hasText: "Spectrum"}).click();
        }
        await waitForColourPickerSeeded(page);
        await page.locator("#ColourPickerDlg-hex-input").fill("#996633");
        await visibleOKButton(page).click();
        await waitForEditorSettled(page);

        await expect(page.locator("img[data-mediatype='colour']")).toHaveAttribute("data-code", "\"#996633\"");
        const text = await getRawFrameHeaderText(page);
        expect(text).not.toContain("notacolour");
        await checkFrameErrorCount(page, 0);
    });

    // Regression test for the original "invalid input character" bug: a zero-width-space
    // placeholder character (U+200B) -- used internally as the empty-slot DOM placeholder, and
    // legitimately present cosmetically all over a frame's raw DOM text (e.g. around brackets/
    // labels, confirmed empirically while writing this test) -- was being captured un-stripped
    // into the actual generated code whenever the colour picker's target field was otherwise
    // empty and had a structural sibling immediately after it (most easily reproduced on a
    // function call's own empty argument slot, immediately followed by its closing bracket). The
    // bug was a broken regex (missing the \u escape) in LabelSlot.vue that matched the literal
    // text "200B" instead of the actual placeholder character, so it was never actually being
    // stripped -- Skulpt's tokenizer then choked on the leftover character at run time with a
    // cryptic "invalid input character" error. Since the placeholder is harmless in the DOM by
    // itself, the only way to genuinely tell the fixed and broken behaviour apart is to actually
    // run the result: the fixed version prints a clean hex string, the broken one crashes.
    test("Replacing an empty argument slot never leaves a stray placeholder that breaks execution", async ({page}) => {
        // Typing "print(" directly at the top-level "insert new frame" caret starts a func-call
        // frame named "print" (see "Typing a character at the bare frame caret starts a func-call
        // frame" in editor.ts), then leaves the caret in its own (empty) argument slot, immediately
        // followed by the call's closing-bracket sibling field -- the same shape as the original bug:
        await page.keyboard.type("print(");
        await waitForEditorSettled(page);

        await page.keyboard.press("ControlOrMeta+Shift+Y");
        await expect(page.locator("#colourPickerDlg")).toBeVisible();
        await page.locator(".ColourPickerDlg-family-btn", {hasText: "Blue"}).click();
        await page.locator(".ColourPickerDlg-shade-cell").first().dblclick();
        await waitForEditorSettled(page);

        await checkFrameErrorCount(page, 0);
        await runToFinish(page, true);
        // Our new print(...) is inserted above the default project's own "print(myString)" line,
        // so its output comes first, followed by the pre-existing "Hello from Strype" -- the key
        // thing being tested is that a clean hex string appears at all, rather than a crash:
        await checkConsoleContent(page, /^#[0-9a-f]{6}\nHello from Strype\s*$/i);
    });
});

test.describe("Cursor placement after picker-driven insertion/conversion", () => {
    // §3 of the plan: both the not-in-string (fresh insert) and in-string (convert-in-place)
    // branches place the cursor in the empty sibling field right after the now-atomic colour
    // literal, rather than leaving it "inside" the swatch (which has no text content to be inside
    // of). Confirmed two ways: checkTextSlotCursorPos (position 0 of whichever field is now
    // focused) and that subsequently typed text lands as a plain sibling, not merged into the swatch.
    test("Ctrl-Shift-Y outside a string places the cursor in the empty field right after the new swatch", async ({page}) => {
        await openIfFrame(page);
        await page.keyboard.press("ControlOrMeta+Shift+Y");
        await page.locator(".ColourPickerDlg-family-btn", {hasText: "Blue"}).click();
        await page.locator(".ColourPickerDlg-shade-cell").first().dblclick();
        await waitForEditorSettled(page);

        await expect(page.locator("img[data-mediatype='colour']")).toHaveCount(1);
        await checkTextSlotCursorPos(page, 0);

        await typeIndividually(page, "9");
        // The swatch itself must be untouched, and the "9" must land as separate sibling text --
        // not merged into (or replacing) the media literal:
        await expect(page.locator("img[data-mediatype='colour']")).toHaveCount(1);
        const text = await getRawFrameHeaderText(page);
        expect(text).toContain("9");
    });

    test("Ctrl-Shift-Y inside a string places the cursor in the empty field right after the converted swatch", async ({page}) => {
        await openIfFrame(page);
        await page.keyboard.type("\"notacolour");
        await waitForEditorSettled(page);
        await page.keyboard.press("ControlOrMeta+Shift+Y");
        if (!(await page.locator("#ColourPickerDlg-hex-input").isVisible())) {
            await page.locator("button", {hasText: "Spectrum"}).click();
        }
        await waitForColourPickerSeeded(page);
        await page.locator("#ColourPickerDlg-hex-input").fill("#112233");
        await visibleOKButton(page).click();
        await waitForEditorSettled(page);

        await expect(page.locator("img[data-mediatype='colour']")).toHaveAttribute("data-code", "\"#112233\"");
        await checkTextSlotCursorPos(page, 0);

        await typeIndividually(page, "9");
        await expect(page.locator("img[data-mediatype='colour']")).toHaveAttribute("data-code", "\"#112233\"");
        const text = await getRawFrameHeaderText(page);
        expect(text).toContain("9");
    });
});

test.describe("Hover preview popup and edit round-trip", () => {
    // §5 of the plan: hovering the swatch shows a filled-rectangle preview with the hex as the
    // header text (not the image dimensions text used for actual images/sounds), the
    // Preview/Download buttons are hidden (colour literals have neither a sensible world-preview
    // nor a downloadable file), and Edit reopens the colour picker seeded with the current hex.
    test("Hovering a colour swatch shows the hex as the popup header, with Preview/Download hidden", async ({page}) => {
        await openIfFrame(page);
        await page.keyboard.press("ControlOrMeta+Shift+Y");
        await page.locator(".ColourPickerDlg-family-btn", {hasText: "Green"}).click();
        await page.locator(".ColourPickerDlg-shade-cell").first().dblclick();
        await waitForEditorSettled(page);
        const dataCode = await page.locator("img[data-mediatype='colour']").getAttribute("data-code");
        const hex = (dataCode as string).replace(/"/g, "");

        await page.locator("img[data-mediatype='colour']").hover();
        await expect(page.locator(".MediaPreviewPopup-header-text")).toHaveText(hex);
        await expect(page.locator(".MediaPreviewPopup-header-preview-button")).not.toBeVisible();
        await expect(page.locator(".MediaPreviewPopup-header-download-button")).not.toBeVisible();
        await expect(page.locator(".MediaPreviewPopup-header-edit-button")).toBeVisible();
    });

    test("Edit from the hover popup reopens the picker seeded with the current hex and updates the swatch on OK", async ({page}) => {
        await openIfFrame(page);
        await page.keyboard.press("ControlOrMeta+Shift+Y");
        await page.locator("button", {hasText: "Spectrum"}).click();
        await waitForColourPickerSeeded(page);
        await page.locator("#ColourPickerDlg-hex-input").fill("#445566");
        await visibleOKButton(page).click();
        await waitForEditorSettled(page);
        await expect(page.locator("img[data-mediatype='colour']")).toHaveAttribute("data-code", "\"#445566\"");

        await page.locator("img[data-mediatype='colour']").hover();
        await page.locator(".MediaPreviewPopup-header-edit-button").click();
        await expect(page.locator("#colourPickerDlg")).toBeVisible();
        await waitForColourPickerSeeded(page);
        // Editing an existing colour literal jumps straight into the fine-grained selector, seeded
        // with its current hex (same as editing an in-progress string, see onShownModalDlg):
        await expect(page.locator("#ColourPickerDlg-hex-input")).toHaveValue("#445566");

        await page.locator("#ColourPickerDlg-hex-input").fill("#778899");
        await visibleOKButton(page).click();
        await waitForEditorSettled(page);
        await expect(page.locator("img[data-mediatype='colour']")).toHaveAttribute("data-code", "\"#778899\"");
        await checkFrameErrorCount(page, 0);
    });
});
