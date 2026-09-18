import { test, expect, Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import en from "../../../src/localisation/en/en_main.json";
import { setupStrypeTest } from "../support/general";
import { startRunning, runButtonShowsRun, runToFinish } from "../support/execution";
import { enterCode } from "../support/editor";

test.beforeEach(async ({ page, browserName }, testInfo) => {
    // Needs a real Pyodide worker (listing/reading "/data" goes via it -- see fileSystemTabIO.ts),
    // and some tests below also Run code, so this mirrors console-execution.spec.ts's budget
    // rather than the shorter default:
    await setupStrypeTest(page, browserName, testInfo, {timeoutMs: 180000});
});

async function openFilesTab(page: Page): Promise<void> {
    await page.click("#filesPEATab");
    // The pane fetches "/data" and "/local" from the worker on mount (FileSystemPane.vue's
    // mounted() -> refresh()) -- wait for the loading placeholder to be gone rather than for a
    // fixed delay. Generous timeout: this is a Comlink round-trip to the Pyodide worker (mounting
    // "/data"'s lazy-fetch FS on first use), seen to genuinely need more than the default 5s under
    // Firefox/CI contention (matching the same "worker RPC can be slow on a loaded runner" pattern
    // documented in execution.ts's startRunning()/runButtonShowsRun()):
    await expect(page.locator(".file-system-pane-loading")).toHaveCount(0, {timeout: 30000});
}

function localUploadInput(page: Page) {
    // Only "/local" ever renders an upload button/input (see FileSystemTree.vue's allow-upload
    // prop) -- "/data" is read-only, so this is unambiguous as long as no subfolder has been
    // created under "/local" (none of these tests do):
    return page.locator(".file-system-tree-upload-input");
}

test.describe("File system tab -- /data (read-only bundled assets)", () => {
    test("lists the bundled data files", async ({ page }) => {
        await openFilesTab(page);
        const dataSection = page.locator(".file-system-pane-root", { hasText: en.fileSystemTab.data });
        await expect(dataSection).toContainText("london-temperature-2025.txt");
        await expect(dataSection).toContainText("word_counts.txt");
    });

    test("does not offer an upload button", async ({ page }) => {
        await openFilesTab(page);
        const dataSection = page.locator(".file-system-pane-root", { hasText: en.fileSystemTab.data });
        await expect(dataSection.locator(".file-system-tree-upload-btn")).toHaveCount(0);
    });

    test("downloading a file produces its real content", async ({ page }) => {
        await openFilesTab(page);
        const row = page.locator(".file-system-tree-file", { hasText: "london-temperature-2025.txt" });
        const [download] = await Promise.all([
            page.waitForEvent("download"),
            row.locator(".file-system-tree-download-btn").click(),
        ]);
        const downloadedPath = await download.path();
        expect(downloadedPath).not.toBeNull();
        const actual = readFileSync(downloadedPath as string, "utf8");
        const expected = readFileSync(
            path.join(__dirname, "..", "..", "..", "src", "assetsFilesystem", "data", "london-temperature-2025.txt"),
            "utf8"
        );
        expect(actual).toEqual(expected);
    });
});

test.describe("File system tab -- /local (writeable scratch area)", () => {
    test("starts empty", async ({ page }) => {
        await openFilesTab(page);
        const localSection = page.locator(".file-system-pane-root", { hasText: en.fileSystemTab.local });
        await expect(localSection).toContainText(en.fileSystemTab.emptyFolder);
    });

    test("uploading a file makes it appear, and downloading it round-trips the content", async ({ page }) => {
        await openFilesTab(page);
        const content = "hello from the file system tab test\n";
        const filePath = testFixturePath(test.info().outputDir, "upload-test.txt", content);

        await localUploadInput(page).setInputFiles(filePath);

        const localSection = page.locator(".file-system-pane-root", { hasText: en.fileSystemTab.local });
        await expect(localSection).toContainText("upload-test.txt");

        const row = page.locator(".file-system-tree-file", { hasText: "upload-test.txt" });
        const [download] = await Promise.all([
            page.waitForEvent("download"),
            row.locator(".file-system-tree-download-btn").click(),
        ]);
        const downloadedPath = await download.path();
        expect(downloadedPath).not.toBeNull();
        expect(readFileSync(downloadedPath as string, "utf8")).toEqual(content);
    });

    test("an uploaded file survives Run restarting the Pyodide worker", async ({ page }) => {
        // Regression test: "/local" used to be wiped on every run because
        // terminateAndRestartPyodide() fully discards and recreates the worker -- see
        // localFsCache.ts and main_thread_python_handler.ts's snapshot/restore around that call.
        await openFilesTab(page);
        const content = "should survive a run\n";
        const filePath = testFixturePath(test.info().outputDir, "survives-run.txt", content);
        await localUploadInput(page).setInputFiles(filePath);
        const localSection = page.locator(".file-system-pane-root", { hasText: en.fileSystemTab.local });
        await expect(localSection).toContainText("survives-run.txt");

        await runToFinish(page);

        // Re-open the tab (it's unmounted/remounted per tab switch -- see PythonExecutionArea's
        // v-if in Commands.vue -- so this also re-fetches from the cache):
        await page.click("#addFramePEATab");
        await openFilesTab(page);
        await expect(localSection).toContainText("survives-run.txt");
    });

    test("upload is disabled while Python is executing", async ({ page }) => {
        await enterCode(page, ["import time", "", "while True:\n    time.sleep(0.1)\n"]);
        const runButton = await startRunning(page);
        await openFilesTab(page);

        await expect(page.locator(".file-system-pane-running-note")).toHaveText(en.fileSystemTab.programRunning);
        await expect(page.locator(".file-system-tree-upload-btn")).toBeDisabled();

        // Clean up: stop the program so it doesn't bleed into the next test:
        await runButton.click();
        await runButtonShowsRun(runButton);
    });
});

test.describe("File system tab -- /cloud", () => {
    // Uploading/downloading through a real connected Google Drive/OneDrive needs live OAuth, which
    // isn't available in this test environment (no existing suite mocks cloudDriveHandlerComponentAPI
    // either -- see cloudFileIO.ts) -- so this only covers the part that's genuinely testable without
    // one: a fresh, unsaved project has no cloud drive connected, and the section must not appear at
    // all in that state (see FileSystemPane.vue's isCloudMounted() check).
    test("is not shown when the project isn't saved to a cloud drive", async ({ page }) => {
        await openFilesTab(page);
        await expect(page.locator(".file-system-pane-root", { hasText: en.fileSystemTab.cloud })).toHaveCount(0);
    });
});

// Writes fixture content to a fresh file under outputDir and returns its path, for use with
// locator.setInputFiles() (which needs a real file on disk).
function testFixturePath(outputDir: string, fileName: string, content: string): string {
    mkdirSync(outputDir, { recursive: true });
    const filePath = path.join(outputDir, fileName);
    writeFileSync(filePath, content);
    return filePath;
}
