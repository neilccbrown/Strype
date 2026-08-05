import {test, expect} from "@playwright/test";
import {load, save} from "../support/loading-saving";
import {readFileSync, readdirSync} from "node:fs";
import {join} from "node:path";
import {setupStrypeTest} from "../support/general";

// Every .spy file under public/book_projects and public/demos should be valid Python that
// round-trips cleanly through load-then-save: loading it in and saving straight back out
// should reproduce the file byte-for-byte. If it doesn't, that's a sign the file itself
// contains something Strype can't represent losslessly (e.g. a ___strype_blank placeholder
// that crept in because of a save-side bug -- see the unary-minus and "and not" fixes this
// spec was added alongside), rather than a bug worth chasing in the test itself.
// (Deliberately uses load(), not paste: pasting doesn't carry over the source file's saved
// pane-layout headers, e.g. editorCommandsSplitterPane2Size, which would make otherwise-fine
// files fail a byte-for-byte comparison for reasons unrelated to what this test is checking.)
function findSpyFiles(dir: string): string[] {
    const result: string[] = [];
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            result.push(...findSpyFiles(fullPath));
        }
        else if (entry.name.endsWith(".spy")) {
            result.push(fullPath);
        }
    }
    return result;
}

const spyFiles = [
    ...findSpyFiles("public/book_projects"),
    ...findSpyFiles("public/demos"),
];

test.describe("Book and demo projects round-trip", () => {
    test.beforeEach(async ({ page, browserName }, testInfo) => {
        await setupStrypeTest(page, browserName, testInfo, {timeoutMs: 240000, skipPyodide: true});
    });

    for (const spyFile of spyFiles) {
        test(`Round-trips ${spyFile}`, async ({page}) => {
            const original = readFileSync(spyFile, "utf8").replace(/\r\n/g, "\n");
            await load(page, spyFile, 120000);
            // firstSave=false: quick-save straight back to the file we just loaded, rather than
            // opening the "Save As" location-choice dialog (see testPlaywrightRoundTripImportAndDownload):
            const output = readFileSync(await save(page, false), "utf8").replace(/\r\n/g, "\n");
            expect(output).toEqual(original);
        });
    }
});
