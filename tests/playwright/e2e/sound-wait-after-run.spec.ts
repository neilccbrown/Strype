import { test, expect } from "@playwright/test";
import { enterCode } from "../support/editor";
import { checkConsoleContent, checkFrameErrorCount, startRunning } from "../support/execution";
import { setupStrypeTest } from "../support/general";

// Covers the behaviour added to PythonExecutionArea.vue/sound_manager.ts: when the user's code
// finishes normally (no uncaught error, not stopped by the user) while a sound started with
// play() is still going, execution should behave as if there were an invisible
// wait_for_all_sounds_to_finish() at the very end of the program -- the run button keeps showing
// "Stop" until the sound finishes on its own, and clicking Stop during that wait immediately stops
// the sound and ends the run, rather than waiting for the timeout below.
test.beforeEach(async ({ page, browserName }, testInfo) => {
    if (browserName === "firefox") {
        // Same headless-sound limitation noted in console-execution.spec.ts's sound tests.
        testInfo.skip(true, "Playing sound headless doesn't work in Firefox");
    }
    // 180s, not 120s: startRunning() can itself wait up to 120s for Pyodide to be ready (see
    // tests/playwright/support/execution.ts) -- see check-error-locations.spec.ts for the CI
    // failure this fixes:
    await setupStrypeTest(page, browserName, testInfo, {timeoutMs: 180000});
});

test.describe("Waiting for sounds after normal completion", () => {
    test("Keeps showing Stop until a still-playing sound finishes, then returns to Run", async ({page}) => {
        // ~0.5s of silence at the default 44100 sample rate; the code finishes almost immediately
        // after starting it, well before the sound itself is done:
        await enterCode(page, ["from strype.sound import *", "", `
s = Sound([0] * 22050)
s.play()
print("done")`]);
        const button = await startRunning(page);
        await checkConsoleContent(page, "done\n");

        // The code has finished, but the sound is still playing, so the button must still say
        // Stop rather than having already flipped back to Run:
        await expect(button).toHaveText(/Stop/);

        // Once the sound finishes on its own, the run should end without any further user action:
        await expect(button).toHaveText("Run", {timeout: 5000});
        await checkFrameErrorCount(page, 0);
    });

    test("Clicking Stop while waiting for a sound stops it immediately", async ({page}) => {
        // A much longer sound (~10s) than we're willing to wait for in the test, so the run only
        // ending quickly demonstrates that Stop interrupted the wait rather than the sound just
        // happening to finish on its own:
        await enterCode(page, ["from strype.sound import *", "", `
s = Sound([0] * (44100 * 10))
s.play()
print("done")`]);
        const button = await startRunning(page);
        await checkConsoleContent(page, "done\n");
        await expect(button).toHaveText(/Stop/);

        // Click Stop while we're still in the "waiting for sound" phase:
        await button.click();

        // Should return to Run promptly, not after anything like the sound's 10s duration:
        await expect(button).toHaveText("Run", {timeout: 5000});
        await checkFrameErrorCount(page, 0);
    });

    test("strype.graphics.stop() still waits for a still-playing sound to finish", async ({page}) => {
        // stop() ends the program early by raising SystemExit -- this must be treated like a normal
        // completion for sound-waiting purposes (not like an uncaught error, and not like the user's
        // own Stop button click), so the run should still wait for the ~0.5s sound below rather than
        // cutting it off immediately:
        await enterCode(page, ["from strype.sound import *\nfrom strype.graphics import stop", "", `
s = Sound([0] * 22050)
s.play()
print("done")
stop()
print("never printed")`]);
        const button = await startRunning(page);
        await checkConsoleContent(page, "done\n");

        // The program has ended via stop(), but the sound is still playing, so the button must
        // still say Stop rather than having already flipped back to Run:
        await expect(button).toHaveText(/Stop/);

        // Once the sound finishes on its own, the run should end without any further user action:
        await expect(button).toHaveText("Run", {timeout: 5000});
        // stop() must not be reported as a runtime error:
        await checkFrameErrorCount(page, 0);
        // Nothing after stop() should have run:
        await checkConsoleContent(page, "done\n");
    });
});
