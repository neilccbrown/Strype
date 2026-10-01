import { test, expect } from "@playwright/test";
import { pressFrameShortcut, waitForEditorSettled } from "../support/editor";
import { checkFrameErrorCount } from "../support/execution";
import { setupStrypeTest } from "../support/general";

test.beforeEach(async ({ page, browserName }, testInfo) => {
    // Pyodide readiness (including pytest, which is loaded on the first test run) can be slow
    // under CI worker contention -- see console-execution.spec.ts for the same reasoning:
    await setupStrypeTest(page, browserName, testInfo, {timeoutMs: 180000});
});

test.describe("Testing section", () => {
    test("Starts folded and can be expanded", async ({page}) => {
        const testsContainer = page.locator("#frameContainer_-4");
        await expect(testsContainer).toHaveCount(1);
        // Folded: the inner frames container is hidden (display: none):
        await expect(testsContainer.locator(".container-frames")).toBeHidden();
        await testsContainer.locator(".frame-container-btn-collapse").click();
        await waitForEditorSettled(page);
        await expect(testsContainer.locator(".container-frames")).toBeVisible();
    });

    test("Running tests reports a failure and highlights the offending frame, without affecting normal Run", async ({page}) => {
        await page.locator("#frameContainer_-4 .frame-container-btn-collapse").click();
        await waitForEditorSettled(page);

        // Clicking the collapse toggle above leaves DOM focus on that button, which breaks the
        // keyboard-driven frame navigation used below -- reclaim proper editor focus by clicking
        // into the default project's last slot (the "myString" argument to print in My code) and
        // escaping out of it to a frame caret there, the same way commands-pane.spec.ts does:
        await page.locator(".label-slot-input", {hasText: /^myString$/}).last().click();
        await waitForEditorSettled(page);
        await page.keyboard.press("Escape");
        await waitForEditorSettled(page);
        // That's the last frame in My code -- one more Down crosses into Testing's (now expanded,
        // empty) body:
        await page.keyboard.press("ArrowDown");
        await waitForEditorSettled(page);

        // Build: def test_fail():\n    int("x")
        await pressFrameShortcut(page, "d");
        await waitForEditorSettled(page);
        await page.keyboard.type("test_fail");
        await waitForEditorSettled(page);
        await page.keyboard.press("ArrowDown"); // name -> function description
        await waitForEditorSettled(page);
        await page.keyboard.press("ArrowDown"); // function description -> body
        await waitForEditorSettled(page);
        await pressFrameShortcut(page, "c");
        await waitForEditorSettled(page);
        await page.keyboard.type("int(\"x\")");
        await waitForEditorSettled(page);

        // Sanity check the above actually landed inside Testing and not elsewhere (e.g. Definitions
        // -- an earlier version of this test silently mis-navigated there):
        await expect(page.locator("#frameContainer_-4 span", {hasText: /^int$/})).toHaveCount(1);

        const runTestsButton = page.locator("#runTestsButton");
        await expect(runTestsButton).toBeEnabled({timeout: 120000});
        await runTestsButton.click();

        const consoleLoc = page.locator("#peaConsole");
        await expect.poll(async () => await consoleLoc.inputValue(), {timeout: 120000}).toContain("0 passed, 1 failed");
        const consoleContent = await consoleLoc.inputValue();
        expect(consoleContent).toContain("FAILED test_strype_user_tests.py::test_fail");
        expect(consoleContent).toContain("ValueError: invalid literal for int()");

        // The failing test's int("x") call should be highlighted in the editor, the same way a
        // normal Run's runtime error is (see highlightTestFailures() in PythonExecutionArea.vue).
        // Mirrors expectHasVisibleErrorIcon() in check-error-locations.spec.ts: the label text lives
        // in a <span>, and the error icon is shown on the nearest enclosing frame header. Matches on
        // the exact label text (not a substring) since "int" is also a substring of "print":
        await checkFrameErrorCount(page, 1);
        const scssVars = await page.evaluate(() => (window as any)["StrypeSCSSVarsGlobals"]);
        const intSpan = page.locator("#frameContainer_-4 span", {hasText: /^int$/});
        const failingFrameHeader = intSpan.locator(
            `xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' ${scssVars.frameHeaderClassName} ')][1]`
        );
        await expect(failingFrameHeader).toHaveCount(1);
        await expect(failingFrameHeader.locator(".err-icon:visible")).toHaveCount(1);

        // Normal Run must still only run Imports/Definitions/My code -- the Testing section's
        // code (including the deliberately-failing test_fail) must never execute as part of it:
        const runButton = page.locator("#runButton");
        await expect(runButton).toHaveText("Run", {timeout: 120000});
        await runButton.click();
        await expect(runButton).toHaveText("Run", {timeout: 120000});
        await expect(consoleLoc).toHaveValue("Hello from Strype\n");
    });
});
