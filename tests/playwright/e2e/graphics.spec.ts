// Note: there are more tests for graphics in the Cypress part.
// This test here is for things Playwright is handy at:
//  - screenshotting arbitrary elements (to check Strype graphics vs Turtle)
//  - sending real keyboard events (ditto)
import {Page, test, expect} from "@playwright/test";
import {PNG} from "pngjs";
import fs from "fs";
import {doPagePaste} from "../support/editor";

test.beforeEach(async ({ page, browserName }, testInfo) => {
    if (browserName === "webkit" && process.platform === "win32") {
        // On Windows+Webkit it just can't seem to load the page for some reason:
        testInfo.skip(true, "Skipping on Windows + WebKit due to unknown problems");
    }

    testInfo.setTimeout(90000); // 90 seconds
    
    await page.goto("./", {waitUntil: "load"});
    await page.waitForSelector("body");
    await page.evaluate(() => {
        (window as any).Playwright = true;
    });
    // Make browser's console.log output visible in our logs (useful for debugging):
    page.on("console", (msg) => {
        console.log("Browser log:", msg.text());
    });
});

async function enterCode(page: Page, codeSections : string[]) : Promise<void> {
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(500);
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    for (const codeSection of codeSections) {
        await doPagePaste(page, codeSection);
        await page.waitForTimeout(1000);
        await page.keyboard.press("ArrowDown");
    }
}

enum ImageComparison {
    COMPARE_TO_EXISTING,
    // If we want to set a new expected image after a change in the code, you can pass
    // this value but you should not commit this because it effectively stops the test
    // from ever being able to fail.  So if you see a committed use of this as a parameter,
    // reject the commit!
    WRITE_NEW_EXPECTED_DO_NOT_COMMIT_USE_OF_THIS
}

async function checkImageMatch(expectedImageFileName: string, actual : PNG, comparison: ImageComparison) {
    if (comparison == ImageComparison.COMPARE_TO_EXISTING) {
        const pixelmatch = (await import("pixelmatch")).default;
        const expectedData = fs.readFileSync(`tests/cypress/expected-screenshots/baseline/${expectedImageFileName}.png`, "base64");
        // load both pictures
        const expected = PNG.sync.read(Buffer.from(expectedData, "base64"));
        fs.writeFileSync(`tests/cypress/expected-screenshots/comparison/${expectedImageFileName}.png`, PNG.sync.write(actual));

        const {width, height} = expected;
        const diff = new PNG({width, height});

        // calling pixelmatch return how many pixels are different
        const numDiffPixels = pixelmatch(expected.data, actual.data, diff.data, width, height, {threshold: 0.05});

        fs.writeFileSync(`tests/cypress/expected-screenshots/diff/${expectedImageFileName}.png`, PNG.sync.write(diff));

        // calculating a percent diff
        const diffPercent = (numDiffPixels / (width * height) * 100);

        expect(diffPercent).toBeLessThanOrEqual(10);
    }
    else {
        // Just save to expected:
        fs.writeFileSync(`tests/cypress/expected-screenshots/baseline/${expectedImageFileName}.png`, PNG.sync.write(actual));
    }
}


async function checkGraphicsAreaContent(page: Page, expectedImageFileName : string, comparison = ImageComparison.COMPARE_TO_EXISTING) {
    const screenshotBuffer = await page.locator("#peaGraphicsContainerDiv").screenshot();
    const screenshot = PNG.sync.read(screenshotBuffer);
    await checkImageMatch(expectedImageFileName, screenshot, comparison);
    // Make sure we don't leave in the screenshot creation by making the tests fail:
    if (comparison == ImageComparison.WRITE_NEW_EXPECTED_DO_NOT_COMMIT_USE_OF_THIS) {
        throw new Error("Tests writing new screenshot; did you leave in WRITE_NEW_EXPECTED_DO_NOT_COMMIT_USE_OF_THIS ?");
    }
}

// x and y are from 0 to 1
async function clickProportionalPos(page: Page, x: number, y: number) : Promise<void> {
    const box = await page.locator("#peaGraphicsContainerDiv").boundingBox();
    if (box) {
        const clickX = box.x + box.width * x;
        const clickY = box.y + box.height * y;
        console.log("Clicking at ", clickX, clickY);
        await page.mouse.click(clickX, clickY);
    }
    else {
        throw Error("Could not find graphics container to click on");
    }
}

test.describe("Check turtle works when shared with graphics", () => {
    test("Check turtle square shows", async ({page}) => {
        await enterCode(page, ["import turtle\n", "", `
            t = turtle.Turtle()

            for _ in range(4):
                t.forward(100)
                t.right(90)        
        `]);
        await page.click("#graphicsPEATab");
        await page.click("#runButton");
        // Turtle takes a moment to actually animate:
        await page.waitForTimeout(4000);
        await checkGraphicsAreaContent(page, "turtle-graphics-square");
    });
    test("Check turtle keyboard input", async ({page}) => {
        await enterCode(page, ["import turtle\n", `
            def up():
                for _ in range(3):
                    t.forward(100)
                    t.left(120)
        `, `
            t = turtle.Turtle()
            turtle.listen()
            turtle.onkey(up, "Up")
            turtle.mainloop()        
        `]);
        await page.click("#graphicsPEATab");
        await page.click("#runButton");
        await page.waitForTimeout(1000);
        await checkGraphicsAreaContent(page, "turtle-graphics-blank");
        await page.keyboard.press("ArrowUp");
        // Turtle takes a moment to actually animate:
        await page.waitForTimeout(4000);        
        await checkGraphicsAreaContent(page, "turtle-graphics-triangle-up");
    });

    test("Check turtle mouse input", async ({page}) => {
        await enterCode(page, ["import turtle\n", `
            def clicked_at(x, y):
                # Will draw a line as it goes:
                t.goto(x, y)
        `, `
            t = turtle.Turtle()
            turtle.listen()
            turtle.onscreenclick(clicked_at)
            t.forward(20);
            turtle.mainloop()
        `]);
        await page.click("#graphicsPEATab");
        await page.click("#runButton");
        await page.waitForTimeout(2000);
        await clickProportionalPos(page, 0.2, 0.2);
        await page.waitForTimeout(2000);
        await clickProportionalPos(page, 0.8, 0.5);
        await page.waitForTimeout(2000);
        await clickProportionalPos(page, 0.4, 0.7);
        await page.waitForTimeout(2000);
        await checkGraphicsAreaContent(page, "turtle-graphics-triangle-mouse-follow");
    });
});

test.describe("Check graphics works when shared with turtle", () => {
    test("Check graphics example shows", async ({page}) => {
        await enterCode(page, ["from strype.graphics import *\n", "", `
            set_background("cat-test.jpg")
            Actor("mouse-test.jpg")
            pause(1)        
        `]);
        await page.click("#graphicsPEATab");
        await page.click("#runButton");
        // Give it time to run:
        await page.waitForTimeout(3000);
        await checkGraphicsAreaContent(page, "shared-graphics-background-1");
    });

    test("Check graphics example responds to keyboard", async ({page}) => {
        await enterCode(page, ["from strype.graphics import *\n", "", `
            set_background("cat-test.jpg")
            mouse = Actor("mouse-test.jpg")
            while True:
                if key_pressed("up"):
                    mouse.set_location(-200, -200)
                pace(20)        
        `]);
        await page.click("#graphicsPEATab");
        await page.click("#runButton");
        await page.waitForTimeout(2000);
        // Check the mouse starts in the right place (same image as test above):
        await checkGraphicsAreaContent(page, "shared-graphics-background-1");
        // Need a delay to make sure it is registered during a frame:
        await page.keyboard.press("ArrowUp", {delay: 200});
        await page.waitForTimeout(500);
        // Check the mouse has moved because it registered the keypress:
        await checkGraphicsAreaContent(page, "shared-graphics-background-2");
    });

    test("Check graphics example responds to mouse", async ({page}) => {
        await enterCode(page, ["from strype.graphics import *\n", "", `
            set_background("cat-test.jpg")
            while True:
                c = get_mouse_click()
                if c:
                    mouse = Actor(load_image("mouse-test.jpg").clone(0.25), c.x, c.y)
                pace(20)        
        `]);
        await page.click("#graphicsPEATab");
        await page.click("#runButton");
        await page.waitForTimeout(2000);
        await clickProportionalPos(page, 0.2, 0.2);
        await page.waitForTimeout(2000);
        await clickProportionalPos(page, 0.8, 0.5);
        await page.waitForTimeout(2000);
        await clickProportionalPos(page, 0.4, 0.7);
        await page.waitForTimeout(2000);
        await checkGraphicsAreaContent(page, "shared-graphics-mouse-at-mouse-click");
    });
});
