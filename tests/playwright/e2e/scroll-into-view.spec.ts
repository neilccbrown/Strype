import {ElementHandle, expect, JSHandle, Page, test} from "@playwright/test";
import {checkConsoleContent, runToFinish} from "../support/execution";
import {checkFrameXorTextCursor, doPagePaste} from "../support/editor";
import {save} from "../support/loading-saving";
import {readFileSync} from "node:fs";

test.beforeEach(async ({ page, browserName }, testInfo) => {
    if (browserName === "webkit" && process.platform === "win32") {
        // On Windows+Webkit it just can't seem to load the page for some reason:
        testInfo.skip(true, "Skipping on Windows + WebKit due to unknown problems");
    }
    testInfo.setTimeout(120000);
    await page.goto("./", {waitUntil: "load"});
    await expect(page.locator(".frame-div")).toHaveCount(2);
    await page.evaluate(() => {
        (window as any).Playwright = true;
    });
    // Make browser's console.log output visible in our logs (useful for debugging):
    page.on("console", (msg) => {
        console.log("Browser log:", msg.text());
    });
});

async function scrollToFraction(page : Page, fraction: number) {
    await page.evaluate((frac) => {
        const doc = document.documentElement;
        const maxScroll = doc.scrollHeight - window.innerHeight;
        window.scrollTo(0, maxScroll * frac);
    }, fraction);
}

// Checks an element is inside visible viewport, and not within margin of the edges
async function expectWellInsideViewport(item: ElementHandle<Element>, margin = 100) {
    const result = await item.evaluate((el, margin) => {
        const r = el.getBoundingClientRect();

        return (
            r.top >= margin &&
            r.left >= margin &&
            r.bottom <= window.innerHeight - margin &&
            r.right <= window.innerWidth - margin
        );
    }, margin);

    expect(result).toBe(true);
}


async function toParentElementHandle(nodeHandle: ElementHandle<Node>): Promise<ElementHandle<Element> | null> {
    let current: ElementHandle<Node> | null = nodeHandle;

    while (current) {
        const isElement = await current.evaluate((node) => node instanceof Element);

        if (isElement) {
            return current as ElementHandle<Element>;
        }

        const parent : JSHandle<ParentNode | null> = await current.evaluateHandle((node) => node.parentNode);

        const parentAsElement = parent.asElement();

        if (!parentAsElement) {
            return null;
        }

        current = parentAsElement;
    }

    return null;
}

async function typeWithKeys(page: Page, input: string) {
    const regex = /\{([^}]+)\}/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
        const text = input.slice(lastIndex, match.index);
        const key = match[1];

        if (text) {
            await page.keyboard.type(text);
        }

        await page.keyboard.press(key);

        lastIndex = match.index + match[0].length;
    }

    // remaining text after last token
    const remaining = input.slice(lastIndex);
    if (remaining) {
        await page.keyboard.type(remaining);
    }
}

test.describe("Runtime errors scroll into view", () => {
    for (let fraction = 0; fraction <= 1; fraction += 0.125) {
        test(`Runtime errors scroll into view, starting at ${fraction}`, async ({page}) => {
            // Enter 40 blanks then print(len(None)) then 40 blanks:
            for (let b = 0; b < 40; b++) {
                await page.keyboard.press("Enter");
                await page.waitForTimeout(50);
            }
            await page.keyboard.type("plen(None)");
            await page.keyboard.press("Enter");
            for (let b = 0; b < 40; b++) {
                await page.keyboard.press("Enter");
                await page.waitForTimeout(50);
            }
            await scrollToFraction(page, fraction);
            // "Finish" here is an exception
            await runToFinish(page);
            await checkConsoleContent(page, "< TypeError: object of type 'NoneType' has no len() >\n  From the highlighted call in your code");
            // Now check its scroll position:
            await expectWellInsideViewport(await page.locator("i.fa-exclamation-triangle").elementHandle() as ElementHandle<Element>);
        });
    }
});

test.describe("Undo scrolls location into view", () => {
    // We setup a long file with 100 print statements: print("Hello #1") to print("Hello #100")
    // Then we make some edits which are described as:
    // - going to a frame cursor (0 to 101 in the main body)
    // - then typing a sequence of keys, which corresponds to one undoable edit
    // Then we scroll to an given location, undo each, and check the cursor is in view
    const undoTests : [[number, string][], number][] = [
        // Enter some blanks:
        [[[0, "{Enter}"], [50, "{Enter}"]], 1.0],
        // Edit some content:
        [[[5, "{ArrowLeft}{ArrowLeft}a"], [30, "{ArrowRight}s"], [80, "{ArrowLeft}{ArrowLeft}b"]], 0.5],
    ];
    for (let testIndex = 0; testIndex < undoTests.length; testIndex++) {
        test(`Undo test #${testIndex}`, async ({page}) => {
            await page.keyboard.press("Delete");
            await page.keyboard.press("Delete");
            await doPagePaste(page, Array.from({ length: 100 }, (_, i) => `print("Hello #${i + 1}")`).join("\n"));
            const [actions, scrollTo] = undoTests[testIndex];
            const states = [readFileSync(await save(page, true), "utf-8")];
            for (const [cursorIndex, toType] of actions) {
                await page.keyboard.press("Home");
                for (let i = 0; i < cursorIndex; i++) {
                    await page.waitForTimeout(10);
                    await page.keyboard.press("ArrowDown");
                }
                await typeWithKeys(page, toType);
                states.push(readFileSync(await save(page, false), "utf-8"));
            }
            await scrollToFraction(page, scrollTo);
            
            // Now undo:
            for (let i = states.length - 1; i >= 0; i--) {
                // Semi-arbitrary pick of ctrl-z or clicking undo button:
                if (i + testIndex % 2 == 0) {
                    await page.keyboard.press("ControlOrMeta+z");
                }
                else {
                    await page.locator("input[title='Undo']").click();
                }
                // Check focus is in view:
                const parent = await toParentElementHandle(await checkFrameXorTextCursor(page));
                if (parent != null) {
                    await expectWellInsideViewport(parent, -3);
                }
                else {
                    expect(parent).not.toBeNull();
                }
                // Check undo actually works:
                expect(readFileSync(await save(page, false), "utf-8")).toEqual(states[i]);
            }
        });
        
    }
});
