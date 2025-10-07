import {Page, test, expect} from "@playwright/test";
import path from "path";
import {checkFrameXorTextCursor, doPagePaste} from "../support/editor";
import fs from "fs";
import {WINDOW_STRYPE_HTMLIDS_PROPNAME} from "@/helpers/sharedIdCssWithTests";
import {createBrowserProxy} from "../support/proxy";
import en from "@/localisation/en/en_main.json";
import {readFileSync} from "node:fs";
import {save} from "../support/loading-saving";

// The tests in this file can't run in parallel because they download
// to the same filenames, so need to run one at a time.
test.describe.configure({ mode: "serial" });

let scssVars: {[varName: string]: string};
let strypeElIds: {[varName: string]: (...args: any[]) => string};
test.beforeEach(async ({ page, browserName }, testInfo) => {
    if (browserName === "webkit" && process.platform === "win32") {
        // On Windows+Webkit it just can't seem to load the page for some reason:
        testInfo.skip(true, "Skipping on Windows + WebKit due to unknown problems");
    }
    
    await page.goto("./", {waitUntil: "load"});
    await page.waitForSelector("body");
    scssVars = await page.evaluate(() => (window as any)["StrypeSCSSVarsGlobals"]);
    strypeElIds = createBrowserProxy(page, WINDOW_STRYPE_HTMLIDS_PROPNAME);
    await page.evaluate(() => {
        (window as any).Playwright = true;
    });
    // Make browser's console.log output visible in our logs (useful for debugging):
    page.on("console", (msg) => {
        console.log("Browser log:", msg.text());
    });
});

test.describe("Project description selection", () => {
    test("Starts valid", async ({page}) => {
        await checkFrameXorTextCursor(page);
    });
    test("Enter project description by typing", async ({page}, testInfo) => {
        test.setTimeout(500_000);
        await page.keyboard.press("Home");
        await page.keyboard.press("ArrowUp");
        await page.keyboard.press("ArrowUp");
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.type("A project description");
        expect(readFileSync(await save(page), "utf-8")).toEqual(`
#(=> Strype:1:std
'''A project description'''
#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
myString  = "Hello from Python!" 
print(myString) 
#(=> Section:End
`.trimStart());
    });
    
    for (const selectAll of [["End", "Shift+Home"], ["Home", "Shift+End"], [process.platform == "darwin" ? "Meta+A" : "Control+A"]]) {
        for (const deleteCommand of [["Backspace"], ["Delete"], [/*no press, just overtype*/]]) {
            test("Replace project description via " + JSON.stringify(selectAll) + " then " + JSON.stringify(deleteCommand), async ({page}, testInfo) => {
                test.setTimeout(500_000);
                await page.keyboard.press("Home");
                await page.keyboard.press("ArrowUp");
                await page.keyboard.press("ArrowUp");
                await page.keyboard.press("ArrowLeft");
                await page.keyboard.type("Initial project description");
                for (const key of selectAll) {
                    await page.keyboard.press(key);
                }
                await page.waitForTimeout(200);
                for (const key of deleteCommand) {
                    await page.keyboard.press(key);
                }
                await page.waitForTimeout(200);
                await page.keyboard.type("The replacement");
                expect(readFileSync(await save(page), "utf-8")).toEqual(`
#(=> Strype:1:std
'''The replacement'''
#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
myString  = "Hello from Python!" 
print(myString) 
#(=> Section:End
`.trimStart());
            });
        }
    }
});
