import {test, expect} from "@playwright/test";
import {typeIndividually, doPagePaste, doTextHomeEndKeyPress, assertStateOfIfFrame} from "../support/editor";
import fs from "fs";
import {addFakeClipboard} from "../support/clipboard";

test.beforeEach(async ({ page, browserName }, testInfo) => {
    if (process.platform === "win32" && browserName === "webkit") {
        testInfo.skip(true, "Skipping on WebKit + Windows due to clipboard permission issues.");
    }
    await addFakeClipboard(page);
    await page.goto("./", {waitUntil: "domcontentloaded"});
    await page.waitForSelector("body");
    //strypeElIds = await page.evaluate(() => (window as any)["StrypeHTMLELementsIDsGlobals"]);
    // Make browser's console.log output visible in our logs (useful for debugging):
    page.on("console", (msg) => {
        console.log("Browser log:", msg.text());
    });
});

test.describe("Media literal copying", () => {
    test("Test copying text with a media literal", async ({page}) => {
        await page.keyboard.press("Backspace");
        await page.keyboard.press("Backspace");
        await page.keyboard.type("i");
        await page.waitForTimeout(100);
        await assertStateOfIfFrame(page, "{$}");
        await typeIndividually(page, "set_background(");
        const image = fs.readFileSync("public/graphics_images/cat-test.jpg").toString("base64");
        await doPagePaste(page, image, "image/jpeg");
        await typeIndividually(page, ")");
        let startIndex = 0;
        const endIndex = "set_background(X)".length;
        await doTextHomeEndKeyPress(page, false, false); // equivalent to "Home", see method for details
        for (let i = 0; i < startIndex; i++) {
            await page.keyboard.press("ArrowRight");
            await page.waitForTimeout(75);
        }
        while (startIndex < endIndex) {
            await page.keyboard.press("Shift+ArrowRight");
            await page.waitForTimeout(75);
            startIndex += 1;
        }
        await page.waitForTimeout(200);
        await page.keyboard.press("ControlOrMeta+c");
        await page.waitForTimeout(300);
        const clipboardContent : string = await page.evaluate("navigator.clipboard.readText()");
        expect(clipboardContent).toEqual("set_background(load_image(\"data:image/jpeg;base64," + image + "\"))");
        const clipboardItemCount : string = await page.evaluate("navigator.clipboard.read().then((items) => items.length)");
        expect(clipboardItemCount).toEqual(1);
    });
    test("Test copying only image literal puts an image on clipboard", async ({page}, testInfo) => {
        await page.keyboard.press("Backspace");
        await page.keyboard.press("Backspace");
        await page.keyboard.type("i");
        await page.waitForTimeout(100);
        await assertStateOfIfFrame(page, "{$}");
        await typeIndividually(page, "set_background(");
        const image = fs.readFileSync("public/graphics_images/cat-test.jpg").toString("base64");
        await doPagePaste(page, image, "image/jpeg");
        await typeIndividually(page, ")");
        let startIndex = "set_background(".length;
        const endIndex = startIndex + 1;
        await doTextHomeEndKeyPress(page, false, false); // equivalent to "Home", see method for details
        await page.waitForTimeout(1000);
        for (let i = 0; i < startIndex; i++) {
            await page.keyboard.press("ArrowRight");
            await page.waitForTimeout(1000);
        }
        while (startIndex < endIndex) {
            await page.keyboard.press("Shift+ArrowRight");
            await page.waitForTimeout(75);
            startIndex += 1;
        }
        await page.waitForTimeout(200);
        await page.keyboard.press("ControlOrMeta+c");
        await page.waitForTimeout(300);
        const clipboardContent : string = await page.evaluate("navigator.clipboard.readText()");
        expect(clipboardContent).toEqual("load_image(\"data:image/jpeg;base64," + image + "\")");
        const clipboardItemCount : string = await page.evaluate("navigator.clipboard.read().then((items) => items.length)");
        expect(clipboardItemCount).toEqual(2);
        const clipboardImage : string = await page.evaluate(`
            navigator.clipboard.read().then(async (items) => {
                for (const item of items) {
                      for (const type of item.types) {
                            if (type.startsWith("image/")) {
                              const blob = await item.getType(type);
                    
                              // Convert Blob to base64
                              const base64 = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result);
                                reader.onerror = reject;
                                reader.readAsDataURL(blob); // Data URL includes base64-encoded image
                              });
                    
                              return base64;
                            }
                      }
                }
            });
`);
        expect(clipboardImage).toEqual("data:image/jpeg;base64," + image);
    });
});
