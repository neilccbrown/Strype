import { Disposable, Page } from "@playwright/test";

// This stops Pyodide loading on the page.  Must be called before page.goto.
// Useful for tests which don't actually execute the code at all.
export function skipPyodideLoading(page: Page) : Promise<Disposable> {
    return page.addInitScript(() => {
        (window as any).TestingNoPyodide = true;
    });
}
