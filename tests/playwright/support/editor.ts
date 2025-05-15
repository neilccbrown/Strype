import {Page, expect} from "@playwright/test";

// If the last param is given, we check for frame cursor (true) or text (false)
// If it's not given, no specific check, just check only one or the other is visible
export async function checkFrameXorTextCursor(page: Page, specificFrameCursor?: boolean, message?: string) : Promise<void> {
    // Check exactly one caret visible or focused input field:
    const hasTextCursor = await page.evaluate(() => {
        return document?.getSelection()?.focusNode != null;
    });
    const numFrameCursors = await page.evaluate(() => {
        const scssVars = (window as any)["StrypeSCSSVarsGlobals"];
        const visibleFrameCursorElements = document.querySelectorAll("."+ scssVars.caretClassName + ":not(." + scssVars.invisibleClassName +")");
        return visibleFrameCursorElements.length;
    });
    expect(numFrameCursors, message).toEqual(hasTextCursor ? 0 : 1);
    if (specificFrameCursor !== undefined) {
        if (specificFrameCursor == true) {
            expect(numFrameCursors, message).toEqual(1);
        }
        else {
            expect(hasTextCursor, message).toEqual(true);
        }
    }
}

export async function typeIndividually(page: Page, content: string, timeout = 75) : Promise<void> {
    for (let i = 0; i < content.length; i++) {
        await page.keyboard.type(content[i]);
        await page.waitForTimeout(timeout);
    }
}
