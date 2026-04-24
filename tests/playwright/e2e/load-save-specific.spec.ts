import {test, expect, Page} from "@playwright/test";
import {loadContent, save} from "../support/loading-saving";
import {readFileSync} from "node:fs";
import {skipPyodideLoading} from "../support/general";
import {createBrowserProxy} from "../support/proxy";
import {WINDOW_STRYPE_HTMLIDS_PROPNAME} from "@/helpers/sharedIdCssWithTests";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let strypeElIds: {[varName: string]: (...args: any[]) => Promise<string>};
test.beforeEach(async ({ page, browserName }, testInfo) => {
    if (browserName === "webkit" && process.platform === "win32") {
        // On Windows+Webkit it just can't seem to load the page for some reason:
        testInfo.skip(true, "Skipping on Windows + WebKit due to unknown problems");
    }

    // Make browser's console.log output visible in our logs (useful for debugging):
    page.on("console", (msg) => {
        console.log("Browser log:", msg.text());
    });
    await skipPyodideLoading(page);
    strypeElIds = createBrowserProxy(page, WINDOW_STRYPE_HTMLIDS_PROPNAME);
    await page.goto("./", {waitUntil: "load"});
    await page.waitForSelector("body");
    //scssVars = await page.evaluate(() => (window as any)["StrypeSCSSVarsGlobals"]);
    await page.evaluate(() => {
        (window as any).Playwright = true;
    });
});

test.describe("Load/save near empty files", () => {
    test("Load and save a completely empty file", async ({page}) => {
        await loadContent(page, "");
        // It should output a near-blank SPY:
        const output = readFileSync(await save(page, false), "utf8").replace(/\r\n/g, "\n");
        expect(output).toEqual(`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
#(=> Section:End
`);
    });
    test("Load and save a file with a single newline", async ({page}) => {
        await loadContent(page, "\n");
        // It should output a near-blank SPY with a single blank line:
        const output = readFileSync(await save(page, false), "utf8").replace(/\r\n/g, "\n");
        expect(output).toEqual(`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
#(=> Section:End
`);
    });
    test("Load and save a file with a single space", async ({page}) => {
        await loadContent(page, "");
        // It should output a near-blank SPY:
        const output = readFileSync(await save(page, false), "utf8").replace(/\r\n/g, "\n");
        expect(output).toEqual(`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
#(=> Section:End
`);
    });
});

async function testLoadSaveMainLines(page: Page, content: string) {
    await loadContent(page, content + "\n");
    const output = readFileSync(await save(page, false), "utf8").replace(/\r\n/g, "\n");
    expect(output).toEqual(`#(=> Strype:1:std
#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
${content}
#(=> Section:End
`);
}

test.describe("Load/save unusual operators", () => {
    test("Load and save slices", async ({page}) => {
        await testLoadSaveMainLines(page, `
a[1:5] 
b[:6] 
c[2:] 
d[:] 
e[::9] 
f[4:10:3] 
g[::-1] 
h[:7:] 
i[::] 
j[8::] `.trimStart());
    });
    test("Load and save slices (assignment variant)", async ({page}) => {
        await testLoadSaveMainLines(page, `
a[1:5]  = b[:6] 
c[2:]  = d[:] 
e[::9]  = f[4:10:3] 
g[::-1]  = h[:7:] 
i[::]  = j[8::] `.trimStart());
    });
});
