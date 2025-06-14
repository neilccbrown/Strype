import {Page} from "@playwright/test";

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
