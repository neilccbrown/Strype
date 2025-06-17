import {Page} from "@playwright/test";
import {WINDOW_STRYPE_HTMLIDS_PROPNAME} from "@/helpers/sharedIdCssWithTests";

export function createBrowserProxy(page: Page, objectName: string) : any {
    return new Proxy({}, {
        get(_, prop: string) {
            return async (...args: any[]) => {
                return await page.evaluate(
                    ([objectName, method, args]) =>
                        (window as any)[objectName as string][method as string](...args),
                    [objectName, prop, args]
                );
            };
        },
    });
}

// Since the proxy is just a tiny wrapper, it's fine to recreate it every time we need it:
export function strypeElIds(page: Page): {[varName: string]: (...args: any[]) => Promise<string>} {
    return createBrowserProxy(page, WINDOW_STRYPE_HTMLIDS_PROPNAME);
}
