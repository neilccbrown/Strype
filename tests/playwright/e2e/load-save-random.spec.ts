// We want to stress test loading and saving, so we pick a random frame
// and fill the slots with blanks or random content then see if it
// saves or not.

import {allFrameCommandsDefs, FuncDefIdentifiers, getFrameDefType, CommentFrameTypesIdentifier, JointFrameIdentifiers, ImportFrameTypesIdentifiers, StandardFrameTypesIdentifiers} from "../../cypress/support/frame-types";
import seedrandom from "seedrandom";
import en from "../../../src/localisation/en/en_main.json";

import {WINDOW_STRYPE_HTMLIDS_PROPNAME, WINDOW_STRYPE_SCSSVARS_PROPNAME} from "../../../src/helpers/sharedIdCssWithTests";
import {Page, test, expect, ElementHandle, JSHandle} from "@playwright/test";
import path from "path";
import {checkFrameXorTextCursor, typeIndividually} from "../support/editor";

function createBrowserProxy(page: Page, objectName: string) : any {
    return new Proxy({}, {
        get(_, prop: string) {
            return async (...args: any[]) => {
                return page.evaluate(
                    ([objectName, method, args]) =>
                        (window as any)[objectName as string][method as string](...args),
                    [objectName, prop, args]
                );
            };
        },
    });
}

let scssVars: {[varName: string]: string};
let strypeElIds: {[varName: string]: (...args: any[]) => string};
test.beforeEach(async ({ page }) => {
    scssVars = createBrowserProxy(page, WINDOW_STRYPE_SCSSVARS_PROPNAME);
    strypeElIds = createBrowserProxy(page, WINDOW_STRYPE_HTMLIDS_PROPNAME);
    await page.goto("./", {waitUntil: "load"});
    await page.waitForSelector("body");
    scssVars = await page.evaluate(() => (window as any)["StrypeSCSSVarsGlobals"]);
    //strypeElIds = await page.evaluate(() => (window as any)["StrypeHTMLELementsIDsGlobals"]);
    await page.evaluate(() => {
        (window as any).Playwright = true;
    });
    // Make browser's console.log output visible in our logs (useful for debugging):
    page.on("console", (msg) => {
        console.log("Browser log:", msg.text());
    });
});


type FrameEntry = {
    frameType: string;
    slotContent: string[];
    body: FrameEntry[] | undefined;
    // TODO joint frames
};

let rng = () => 0;

const framesBySection = [Object.values(ImportFrameTypesIdentifiers),
    [... Object.values(FuncDefIdentifiers), ...Object.values(CommentFrameTypesIdentifier)],
    // TODO put back try once joint frames are supported
    Object.values(StandardFrameTypesIdentifiers).filter((id) => id != "try" && id != "global" && id != "return" && id != "continue" && id != "break" && !Object.values(JointFrameIdentifiers).includes(id))];

function getRandomInt(n: number): number {
    // Get number into range of 0 to (n-1) inclusive:
    return ((rng() % n) + n) % n;
}
function pick<T>(ts: T[]): T {
    return ts[getRandomInt(ts.length)];
}

function genRandomString() : string {
    return "foo";
}

function genRandomFrame(fromFrames: string[]): FrameEntry {
    const id = pick(fromFrames);
    const def = getFrameDefType(id);
    return {frameType: id, slotContent: def.labels.filter((l) => l.showSlots ?? true).map((_) => genRandomString()), body: def.allowChildren ? [/*TODO*/] : undefined};
}

async function enterFrame(page: Page, frame : FrameEntry) : Promise<void> {
    const shortcut = Array.prototype.concat.apply([], Object.values(allFrameCommandsDefs)).find((d) => d.type.type === frame.frameType)?.shortcuts?.[0];
    if (shortcut) {
        if (shortcut == "\x13") {
            await page.keyboard.press("Enter");
        }
        else {
            await page.keyboard.type(shortcut);
        }
        await page.waitForTimeout(400);
    }
    else {
        return;
    }
    if (frame.frameType == "funccall") {
        // Have to remove default brackets:
        await page.keyboard.press("Delete");
        await page.waitForTimeout(100);
    }
    
    for (const s of frame.slotContent) {
        await checkFrameXorTextCursor(page, false, "Slot of frame " + frame.frameType);
        await typeIndividually(page, s);
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(100);
    }
    if (frame.body !== undefined) {
        for (const s of frame.body) {
            await checkFrameXorTextCursor(page, true, "Body of frame " + frame.frameType);
            await enterFrame(page, s);
        }
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(100);
    }
    await checkFrameXorTextCursor(page, true, "After frame " + frame.frameType);
}

async function fetchAll(arrayHandle : JSHandle<HTMLElement[]>) : Promise<ElementHandle<HTMLElement>[]> {
    // Get individual JSHandle<HTMLElement> for each item
    const elementCount = await arrayHandle.evaluate((arr) => arr.length);

    const handles: JSHandle<HTMLElement>[] = await Promise.all(
        Array.from({ length: elementCount }).map((_, i) => {
            return arrayHandle.evaluateHandle((arr, i) => arr[i], i);
        })
    );
    
    return handles.map((h) => h.asElement());
}

function visibleTextContent(elementHandle : JSHandle<HTMLElement>) : Promise<string> {
    return elementHandle.evaluate((el) => {
        function getVisibleText(node: Node): string {
            if (node.nodeType === Node.TEXT_NODE) {
                const parent = node.parentElement;
                const style = parent && window.getComputedStyle(parent);
                const hidden = !style || style.display === "none" || style.visibility === "hidden";
                return hidden ? "" : node.textContent || "";
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                const style = window.getComputedStyle(node as Element);
                if (style.display === "none" || style.visibility === "hidden") {
                    return "";
                }

                return Array.from(node.childNodes).map(getVisibleText).join("");
            }

            return "";
        }

        return getVisibleText(el);
    });
}

async function getAllFrames(container : ElementHandle<HTMLElement>) : Promise<FrameEntry[]> {
    // Now find all frames within those:
    const frameDivSelector = "." + scssVars.frameDivClassName;
    // Get all the frame divs
    const outermostFramesArr = await container.evaluateHandle((root, selector) => {
        const matches = Array.from((root as HTMLElement).querySelectorAll(selector as string)) as HTMLElement[];
        return matches.filter((el) => !el.closest(`${selector} ${selector}`));
    }, frameDivSelector);

    const outermostFrames = await fetchAll(outermostFramesArr);
    
    const frameEntries = [] as FrameEntry[];
    for (const el of outermostFrames) {
        
        const body : undefined | FrameEntry[] = await el.$$(":scope > .frame-body-container").then((bodyContainers) => {
            if (bodyContainers.length == 0) {
                return Promise.resolve(undefined as undefined | FrameEntry[]);
            }
            else {
                return getAllFrames(bodyContainers[0] as ElementHandle<HTMLElement>) as Promise<FrameEntry[] | undefined>;
            }
        });
        const slotEls = await el.$$(".label-slot-structure");
        const slots = await Promise.all(slotEls.map( (el) => visibleTextContent(el as ElementHandle<HTMLElement>)));
        const frameType = await el.getAttribute("data-frameType");
        frameEntries.push({
            frameType: frameType ?? "<unknown>",
            slotContent: slots.map((s) => s.trim().replace(/\u200B/g, "") ?? ""),
            body: body,
        });
    }
    return frameEntries;
}

async function getFramesFromDOM(page: Page) : Promise<FrameEntry[][]> {
    const containers = await page.$$(".container-frames");
    return Promise.all(containers.map((container) => getAllFrames(container as ElementHandle<HTMLElement>)));
}


const filename = "My project.spy";

function load() : void {
    const downloadsFolder = Cypress.config("downloadsFolder");
    const filepath = path.join(downloadsFolder, filename);
    
    cy.get("#" + strypeElIds.getEditorMenuUID()).click();
    cy.get("#" + strypeElIds.getLoadProjectLinkId()).click();
    // If the current state of the project is modified,
    // we first need to discard the changes (we check the button is available)
    cy.get("button").contains(en.buttonLabel.discardChanges).should("exist").click();
    cy.wait(2000);
    // The "button" for the target selection is now a div element.
    cy.get("#" + strypeElIds.getLoadFromFSStrypeButtonId()).click();
    // Must force because the <input> is hidden:
    cy.get("." + scssVars.editorFileInputClassName).selectFile(filepath, {force : true});
    cy.wait(2000);
}

function save(firstSave = true) : void {
    const downloadsFolder = Cypress.config("downloadsFolder");
    const destFile = path.join(downloadsFolder, filename);
    cy.task("deleteFile", destFile);
    // Save is located in the menu, so we need to open it first, then find the link and click on it
    // Force these because sometimes cypress gives false alarm about webpack overlay being on top:
    cy.get("button#" + strypeElIds.getEditorMenuUID()).click({force: true});
    cy.contains(en.appMenu.saveProject).click({force: true});
    if (firstSave) {
        // For testing, we always want to save to this device:
        cy.contains(en.appMessage.targetFS).click({force: true});
        cy.contains(en.buttonLabel.ok).click({force: true});
    }
}

function newProject() : void {
    cy.get("#" + strypeElIds.getNewProjectLinkId()).click();
    cy.wait(2000);
}

test.describe("Enters, saves and loads random frame", () => {
    for (let i = 0; i < 2/*20*/; i++) {
        test("Tests random entry #" + i, async ({page}, testInfo) => {
            // With regards to Chromium: several of these tests fail on Chromium in Playwright on Mac and
            // I can't figure out why.  I've tried them manually in Chrome and Chromium on the same
            // machine and it works fine, but I see in the video that the test fails in Playwright
            // (pressing right out of a comment frame puts the cursor at the beginning and makes a frame cursor).
            // Since it works in the real browsers, and on Webkit and Firefox, we just skip the tests in Chromium
            if (testInfo.project.name === "chromium") {
                test.skip(); // See comment above
            }
            
            await page.keyboard.press("Delete");
            await page.keyboard.press("Delete");
            await page.keyboard.press("ArrowUp");
            await page.keyboard.press("ArrowUp");

            const seed = Math.random().toString();
            rng = seedrandom(seed).int32;
            const frames = [[], [], []] as FrameEntry[][];
            for (let section = 0; section < 3; section++) {
                const numFrames = 5;
                for (let j = 0; j < numFrames; j++) {
                    const f = genRandomFrame(framesBySection[section]);
                    await enterFrame(page, f);
                    frames[section].push(f);
                }
                await page.waitForTimeout(2000); // TEMP
                await page.keyboard.press("ArrowDown");
                await page.waitForTimeout(100);
            }
            const dom = await getFramesFromDOM(page);
            expect(dom, seed).toEqual(frames);
            /*
            save();
            newProject();
            load();
            getFramesFromDOM().then((dom) => expect(dom).to.deep.equal(frames, seed));
             */
        });
    }
});
