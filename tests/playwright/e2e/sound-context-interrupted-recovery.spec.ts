import { test, expect } from "@playwright/test";
import { enterCode } from "../support/editor";
import { checkConsoleContent, checkFrameErrorCount, runToFinish } from "../support/execution";
import { setupStrypeTest } from "../support/general";

// Simulates the real-world bug this spec guards against: Safari can put an AudioContext into a
// third state, "interrupted" (distinct from "suspended"), when something outside the page's
// control pauses it -- backgrounding, an incoming call, Siri, another app taking audio focus, etc.
// Unlike "suspended", the page didn't ask for this, and unlike "closed" it's recoverable -- Apple's
// guidance is simply to call resume() once the interruption ends. We can't force a real browser
// into "interrupted" from Playwright, so instead we replace window.AudioContext (before the app
// loads) with a wrapper whose first instance reports state "interrupted" until resume() is called
// on it, then behaves normally -- the most deterministic way to exercise the same recovery path in
// src/helpers/audioContext.ts. Unlike the dead/"closed" recovery case, this should resume the
// *existing* context rather than replacing it, so we also assert only one real AudioContext ever
// gets constructed.
async function installInterruptedFirstAudioContext(page: import("@playwright/test").Page) : Promise<void> {
    await page.addInitScript(() => {
        const RealAudioContext = window.AudioContext;
        const w = window as unknown as { __realAudioContextCount: number, __resumeCalled: boolean };
        w.__realAudioContextCount = 0;
        w.__resumeCalled = false;
        window.AudioContext = new Proxy(RealAudioContext, {
            construct(target, args) {
                w.__realAudioContextCount++;
                const real = Reflect.construct(target, args) as AudioContext;
                if (w.__realAudioContextCount > 1) {
                    // Should never happen for this bug -- recovering from "interrupted" must
                    // reuse the existing context, not construct a replacement:
                    return real;
                }
                let resumeCalled = false;
                // The first (and, if recovery works, only) context: reports "interrupted" until
                // resume() is called on it, then passes state through untouched. Note: the
                // receiver passed to Reflect.get() must be the real target, not this proxy --
                // native accessors are WebIDL getters that require `this` to be a genuine
                // AudioContext instance, and invoking them with the proxy as `this` throws
                // "TypeError: Illegal invocation" in Chromium.
                return new Proxy(real, {
                    get(t, prop) {
                        if (prop === "state") {
                            return resumeCalled ? Reflect.get(t, "state", t) : "interrupted";
                        }
                        if (prop === "resume") {
                            return () => {
                                resumeCalled = true;
                                w.__resumeCalled = true;
                                return t.resume();
                            };
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
    await installInterruptedFirstAudioContext(page);
    // 180s, not 120s: runToFinish() can itself wait up to 120s for Pyodide to be ready (see
    // tests/playwright/support/execution.ts) -- see check-error-locations.spec.ts for the CI
    // failure this fixes:
    await setupStrypeTest(page, browserName, testInfo, {timeoutMs: 180000});
});

test.describe("Sound context interrupted recovery", () => {
    test("Recovers and plays sound when the AudioContext is interrupted", async ({page}) => {
        await enterCode(page, ["from strype.sound import *", "", `
s = Sound([-1, 0, 1])
s.play_and_wait()
print("done")`]);
        // If recovery didn't work, play_and_wait() would hang against an interrupted context and
        // this would time out rather than the run button returning to "Run":
        await runToFinish(page, true);
        await checkConsoleContent(page, "done\n");
        await checkFrameErrorCount(page, 0);

        const {resumeCalled, realAudioContextCount} = await page.evaluate(() => {
            const w = window as unknown as { __realAudioContextCount: number, __resumeCalled: boolean };
            return {resumeCalled: w.__resumeCalled, realAudioContextCount: w.__realAudioContextCount};
        });
        expect(resumeCalled).toBe(true);
        // Recovering from "interrupted" should resume the existing context, not replace it:
        expect(realAudioContextCount).toBe(1);
    });
});
