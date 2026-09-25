import { test, expect, Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import en from "../../../src/localisation/en/en_main.json";
import { setupStrypeTest } from "../support/general";
import { startRunning, runButtonShowsRun, runToFinish, checkConsoleContent } from "../support/execution";
import { enterCode } from "../support/editor";

test.beforeEach(async ({ page, browserName }, testInfo) => {
    // Needs a real Pyodide worker (downloading an asset file goes via it -- see
    // fileSystemTabIO.ts/python-execution.ts's readFsFile), and some tests below also Run code, so
    // this mirrors console-execution.spec.ts's budget rather than the shorter default:
    await setupStrypeTest(page, browserName, testInfo, {timeoutMs: 180000});
});

async function openFilesTab(page: Page): Promise<void> {
    await page.click("#filesPEATab");
    // The pane builds the asset-root and "/local" trees on the main thread (FileSystemPane.vue's
    // mounted() -> refresh() -- see fileSystemTabIO.ts's listFsRootTree()), no worker round trip
    // involved, but still wait for the loading placeholder to be gone rather than for a fixed delay:
    await expect(page.locator(".file-system-pane-loading")).toHaveCount(0, {timeout: 30000});
}

function localUploadInput(page: Page) {
    // Only "/local" ever renders an upload button/input (see FileSystemTree.vue's allow-upload
    // prop) -- the asset roots are read-only, so this is unambiguous as long as no subfolder has
    // been created under "/local" (none of these tests do):
    return page.locator(".file-system-tree-upload-input");
}

test.describe("File system tab -- /data (read-only bundled assets)", () => {
    test("lists the bundled data files", async ({ page }) => {
        await openFilesTab(page);
        const dataSection = page.locator(".file-system-pane-root", { hasText: en.fileSystemTab.assetRoot.replace("{path}", "/data/") });
        await expect(dataSection).toContainText("london-temperature-2025.txt");
        await expect(dataSection).toContainText("word_counts.txt");
    });

    test("does not offer an upload button", async ({ page }) => {
        await openFilesTab(page);
        const dataSection = page.locator(".file-system-pane-root", { hasText: en.fileSystemTab.assetRoot.replace("{path}", "/data/") });
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

    test("a freshly uploaded file is visible to the very next Run", async ({ page }) => {
        // Regression test: localFsCache (the main-thread mirror behind "/local") was only ever
        // pushed into a live Pyodide worker's real "/local" on a worker swap, which happens after
        // a run/stop finishes rather than before the next run starts -- see restoreLocalFs()'s call
        // site in PythonExecutionArea.vue's execPythonCode(). A file uploaded since the last swap
        // (i.e. before any run has happened at all in this session) was therefore invisible to the
        // very first Run to look for it, only appearing from the run after that.
        await openFilesTab(page);
        const content = "visible on the first run\n";
        const filePath = testFixturePath(test.info().outputDir, "first-run.txt", content);
        await localUploadInput(page).setInputFiles(filePath);
        const localSection = page.locator(".file-system-pane-root", { hasText: en.fileSystemTab.local });
        await expect(localSection).toContainText("first-run.txt");

        await enterCode(page, ["print(open(\"first-run.txt\").read())"]);
        await runToFinish(page);

        await checkConsoleContent(page, content + "\n");
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

test.describe("File system tab -- uploading an archive to /local", () => {
    test("shows the keep-as-zip/unzip dialog, naming the uploaded file", async ({ page }) => {
        await openFilesTab(page);
        const zipPath = await testZipFixturePath(test.info().outputDir, "archive-test.zip", {
            "root.txt": "root content\n",
        });
        await localUploadInput(page).setInputFiles(zipPath);

        await expect(page.getByRole("heading", { name: en.fileSystemTab.archiveDialogTitle })).toBeVisible();
        // ModalDlg.vue (see its own template) ids the body "<dlgId>-body" -- every other modal in
        // the app is also permanently mounted (just hidden) alongside this one, so a plain
        // ".modal-body" locator matches all of them; scope to this dialog specifically:
        await expect(page.locator("#fileSystemArchiveImportDlg-body")).toContainText("archive-test.zip");
    });

    test("Cancel uploads nothing", async ({ page }) => {
        await openFilesTab(page);
        const zipPath = await testZipFixturePath(test.info().outputDir, "cancelled.zip", {
            "root.txt": "root content\n",
        });
        await localUploadInput(page).setInputFiles(zipPath);
        await page.getByRole("button", { name: en.buttonLabel.cancel, exact: true }).click();

        const localSection = page.locator(".file-system-pane-root", { hasText: en.fileSystemTab.local });
        await expect(localSection).toContainText(en.fileSystemTab.emptyFolder);
        await expect(localSection).not.toContainText("cancelled.zip");
    });

    test("\"Keep as zip\" stores the archive itself, byte-identical", async ({ page }) => {
        await openFilesTab(page);
        const zipPath = await testZipFixturePath(test.info().outputDir, "keep-me.zip", {
            "root.txt": "root content\n",
        });
        await localUploadInput(page).setInputFiles(zipPath);
        await page.getByRole("button", { name: en.fileSystemTab.keepAsZip }).click();

        const localSection = page.locator(".file-system-pane-root", { hasText: en.fileSystemTab.local });
        await expect(localSection).toContainText("keep-me.zip");
        // The unzipped entry must NOT also appear -- this upload chose to keep the archive as-is:
        await expect(localSection).not.toContainText("root.txt");

        const row = page.locator(".file-system-tree-file", { hasText: "keep-me.zip" });
        const [download] = await Promise.all([
            page.waitForEvent("download"),
            row.locator(".file-system-tree-download-btn").click(),
        ]);
        const downloadedPath = await download.path();
        expect(downloadedPath).not.toBeNull();
        expect(readFileSync(downloadedPath as string)).toEqual(readFileSync(zipPath));
    });

    test("\"Unzip contents\" extracts every entry, preserving subfolder structure", async ({ page }) => {
        await openFilesTab(page);
        const zipPath = await testZipFixturePath(test.info().outputDir, "unzip-me.zip", {
            "root.txt": "root content\n",
            "sub/nested.txt": "nested content\n",
        });
        await localUploadInput(page).setInputFiles(zipPath);
        await page.getByRole("button", { name: en.fileSystemTab.unzipContents }).click();

        const localSection = page.locator(".file-system-pane-root", { hasText: en.fileSystemTab.local });
        // The archive itself must NOT appear -- this upload chose to unzip, not keep it:
        await expect(localSection).not.toContainText("unzip-me.zip");
        await expect(localSection).toContainText("root.txt");
        await expect(localSection).toContainText("sub");
        // "sub" is a nested directory, collapsed by default -- expand it to reveal nested.txt:
        await localSection.locator(".file-system-tree-label", { hasText: "sub" }).click();
        await expect(localSection).toContainText("nested.txt");

        const rootRow = page.locator(".file-system-tree-file", { hasText: "root.txt" });
        const [rootDownload] = await Promise.all([
            page.waitForEvent("download"),
            rootRow.locator(".file-system-tree-download-btn").click(),
        ]);
        expect(readFileSync((await rootDownload.path()) as string, "utf8")).toEqual("root content\n");

        const nestedRow = page.locator(".file-system-tree-file", { hasText: "nested.txt" });
        const [nestedDownload] = await Promise.all([
            page.waitForEvent("download"),
            nestedRow.locator(".file-system-tree-download-btn").click(),
        ]);
        expect(readFileSync((await nestedDownload.path()) as string, "utf8")).toEqual("nested content\n");
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

// Builds a real .zip fixture (using the same "jszip" package the app itself uses -- see
// archive.ts) from a {entryPath: content} map, writes it under outputDir, and returns its path.
async function testZipFixturePath(outputDir: string, fileName: string, entries: Record<string, string>): Promise<string> {
    const zip = new JSZip();
    for (const [entryPath, content] of Object.entries(entries)) {
        zip.file(entryPath, content);
    }
    const data = await zip.generateAsync({ type: "nodebuffer" });
    mkdirSync(outputDir, { recursive: true });
    const filePath = path.join(outputDir, fileName);
    writeFileSync(filePath, data);
    return filePath;
}
