import { Page, expect, Locator, test } from "@playwright/test";

export async function startRunning(page: Page) : Promise<Locator> {
    // It should not be running:
    const button = page.locator("#runButton");
    // It can take a while for Pyodide to load up:
    await expect(button).toHaveText("Run", {timeout: 60000});
    // Click it:
    await page.click("#runButton");
    return button;
}

export async function runButtonShowsRun(button: Locator) : Promise<void> {
    // Firefox is incredibly slow to reinitialise on CI, so we have a huge timeout:
    await expect(button).toHaveText("Run", {timeout: 60000});
}


export async function runToFinish(page: Page) : Promise<void> {
    const button = await startRunning(page);
    // Then it should not be running again, because it has finished:
    await runButtonShowsRun(button);
}

export async function checkConsoleContent(page: Page, expectedContent : string | RegExp) : Promise<void> {
    const actual = await page.locator("#peaConsole").inputValue();
    if (typeof expectedContent === "string") {
        expect(actual).toEqual(expectedContent);
    }
    else {
        expect(actual).toMatch(expectedContent);
    }
}
