import { test, expect } from "@playwright/test";
import { enterCode } from "../support/editor";
import { checkConsoleContent, checkFrameErrorCount, runToFinish } from "../support/execution";
import { setupStrypeTest } from "../support/general";

// Simulates the real-world bug this spec guards against: some browsers (notably WebKit, after the
// tab/app has been backgrounded) can leave an AudioContext dead -- reporting a "closed"-like state
// where it can no longer play anything. We can't reliably force a real browser into that state (or
// into the "running but its clock has stopped" variant, which additionally needs wall-clock time to
// pass before our detection kicks in) from Playwright, so instead we replace window.AudioContext
// (before the app loads) with a wrapper whose first instance always reports state "closed" -- the
// most deterministic way to exercise the same recovery path in src/helpers/audioContext.ts -- and
// count how many real AudioContexts get constructed. If recovery works, playing a sound should
// transparently create a replacement context (real count becomes 2) rather than hanging or erroring.
async function installDeadFirstAudioContext(page: import("@playwright/test").Page) : Promise<void> {
    await page.addInitScript(() => {
        const RealAudioContext = window.AudioContext;
        (window as unknown as { __realAudioContextCount: number }).__realAudioContextCount = 0;
        window.AudioContext = new Proxy(RealAudioContext, {
            construct(target, args) {
                const w = window as unknown as { __realAudioContextCount: number };
                w.__realAudioContextCount++;
                const real = Reflect.construct(target, args) as AudioContext;
                if (w.__realAudioContextCount > 1) {
                    // Second and subsequent contexts (i.e. the recovered one) behave normally:
                    return real;
                }
                // The first context: always reports "closed", mimicking a dead AudioContext.
                // All other members pass through untouched. Note: the receiver passed to
                // Reflect.get() must be the real target, not this proxy -- native accessors
                // like currentTime are WebIDL getters that require `this` to be a genuine
                // AudioContext instance, and invoking them with the proxy as `this` throws
                // "TypeError: Illegal invocation" in Chromium.
                return new Proxy(real, {
                    get(t, prop) {
                        if (prop === "state") {
                            return "closed";
                        }
                        const value = Reflect.get(t, prop, t);
                        return typeof value === "function" ? value.bind(t) : value;
                    },
                });
            },
        }) as unknown as typeof AudioContext;
    });
}

test.beforeEach(async ({ page, browserName }, testInfo) => {
    if (browserName === "firefox") {
        // Same headless-sound limitation noted in console-execution.spec.ts's sound tests.
        testInfo.skip(true, "Playing sound headless doesn't work in Firefox");
    }
    await installDeadFirstAudioContext(page);
    await setupStrypeTest(page, browserName, testInfo, {timeoutMs: 120000});
});

test.describe("Sound context recovery", () => {
    test("Recovers and plays sound when the AudioContext is dead", async ({page}) => {
        await enterCode(page, ["from strype.sound import *", "", `
s = Sound([-1, 0, 1])
s.play_and_wait()
print("done")`]);
        // If recovery didn't work, play_and_wait() would hang against a dead context and this
        // would time out rather than the run button returning to "Run":
        await runToFinish(page, true);
        await checkConsoleContent(page, "done\n");
        await checkFrameErrorCount(page, 0);

        const realAudioContextCount = await page.evaluate(() =>
            (window as unknown as { __realAudioContextCount: number }).__realAudioContextCount);
        // One for the initial (frozen/stuck) context, one for the recovered replacement:
        expect(realAudioContextCount).toBeGreaterThanOrEqual(2);
    });
});
