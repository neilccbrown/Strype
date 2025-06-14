import {Page, test, expect} from "@playwright/test";
import {load, save} from "../support/loading-saving";
import fs from "fs";

test.beforeEach(async ({ page, browserName }, testInfo) => {

    await page.goto("./", {waitUntil: "load"});
    await page.waitForSelector("body");
    //scssVars = await page.evaluate(() => (window as any)["StrypeSCSSVarsGlobals"]);
    //strypeElIds = await page.evaluate(() => (window as any)["StrypeHTMLELementsIDsGlobals"]);
    await page.evaluate(() => {
        (window as any).Playwright = true;
    });
    // Make browser's console.log output visible in our logs (useful for debugging):
    page.on("console", (msg) => {
        console.log("Browser log:", msg.text());
    });
});


async function loadCode(page: Page, spyToLoad: string) : Promise<void> {
    const path = "tests/cypress/downloads/toload.spy";
    fs.writeFileSync(path, spyToLoad);
    await load(page, path);
}

async function getSplitterPos(page: Page, locator: string) {
    const splitter = await page.locator(locator);
    const box = await splitter.boundingBox({timeout: 5000});
    if (!box) {
        throw new Error("Could not get splitter position");
    }
    return box;
}

async function dragDividerTo(page: Page, locator: string, x: number, y: number) : Promise<void> {
    const box = await getSplitterPos(page, locator);

    const currentX = box.x + box.width / 2;
    const currentY = box.y + box.height / 2;
    
    await page.mouse.move(currentX, currentY);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 100 });
    await page.mouse.up();

}

test.describe("Divider states", () => {
    test("Saves main divider state", async ({page}) => {
        await page.waitForTimeout(10 * 1000);
        await dragDividerTo(page, ".strype-split-theme.splitpanes.splitpanes--vertical > .splitpanes__splitter", 10, 300);
        const path = await save(page);
        const saved = fs.readFileSync(path, "utf8");
        expect(saved).toEqual(`
#(=> Strype:1:std
#(=> editorCommandsSplitterPane2Size:{"tabsCollapsed":67}
#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
myString  = "Hello from Python!" 
print(myString) 
#(=> Section:End
`.trimStart());
        
    });
    test("Loads main divider state", async ({page}) => {
        loadCode(page, `
#(=> Strype:1:std
#(=> editorCommandsSplitterPane2Size:{"tabsCollapsed":50}
#(=> peaLayoutMode:tabsCollapsed
#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
#(=> Section:End
`.trimStart());
        await page.waitForTimeout(10 * 1000);
        // Now check divider is in right position:
        const pos = await getSplitterPos(page, ".strype-split-theme.splitpanes.splitpanes--vertical > .splitpanes__splitter");
        const viewport = page.viewportSize();
        expect(Math.abs((viewport?.width ?? 9999) / 2 - pos.x)).toBeLessThanOrEqual(5);
    });
});
