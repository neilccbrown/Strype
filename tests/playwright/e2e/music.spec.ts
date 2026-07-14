import { test, expect } from "@playwright/test";
import { enterCode } from "../support/editor";
import { checkConsoleContent, checkFrameErrorCount, runToFinish } from "../support/execution";

test.beforeEach(async ({ page, browserName }, testInfo) => {
    if (browserName === "webkit" && process.platform === "win32") {
        // On Windows+Webkit it just can't seem to load the page for some reason:
        testInfo.skip(true, "Skipping on Windows + WebKit due to unknown problems");
    }

    // These tests can take longer than the default 30 seconds:
    testInfo.setTimeout(90000); // 90 seconds

    await page.goto("./", {waitUntil: "load"});
    // Wait for content to load:
    await expect(page.locator(".frame-div")).toHaveCount(2);
    await page.evaluate(() => {
        (window as any).Playwright = true;
    });
});

test.describe("strype.sound make_music()", () => {
    test("Ode to Joy renders audio spread across the whole piece", async ({page}) => {
        // We don't actually play the audio here (no play_and_wait()); instead we render the tune
        // and check that sound energy is present throughout, not just in the first note. This is
        // a regression test for a bug where smplr's default note scheduler silently dropped every
        // note beyond its ~200ms real-time lookahead window when used with an OfflineAudioContext.
        const odeToJoy = `
from strype.sound import *

BEAT = 0.35  # seconds per beat

# Note names have no octave number, so they all use the default octave:
melody =    ["E","E","F","G", "G","F","E","D", "C","C","D","E", "E","D","D"]
beat_lengths = [1,1,1,1, 1,1,1,1, 1,1,1,1, 1.5,0.5,2]

notes = [(note, beats * BEAT) for note, beats in zip(melody, beat_lengths)]

tune = make_music(notes)

# Check RMS-ish energy in 1-second windows across the whole buffer, to confirm notes
# throughout the piece produced sound (not just the first one):
mono = tune.copy_to_mono()
samples = mono.get_samples()
sr = mono.get_sample_rate()
window = int(sr * 1.0)
i = 0
nonsilent_windows = 0
total_windows = 0
while i < len(samples):
    chunk = samples[i:i+window]
    energy = sum(abs(x) for x in chunk) / max(1, len(chunk))
    total_windows = total_windows + 1
    if energy > 0.001:
        nonsilent_windows = nonsilent_windows + 1
    i = i + window
print("non-silent windows: " + str(nonsilent_windows) + " / " + str(total_windows))
`;
        await enterCode(page, ["", "", odeToJoy]);
        await runToFinish(page, true);
        await checkFrameErrorCount(page, 0);
        await checkConsoleContent(page, "non-silent windows: 6 / 9\n");
    });
});
