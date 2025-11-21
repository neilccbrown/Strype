import {Page} from "@playwright/test";

export async function addFakeClipboard(page: Page) : Promise<void> {
    // We must use a fake clipboard object to avoid issues with browser clipboard permissions:
    await page.addInitScript(() => {
        let mockTextContent = "<empty>";
        let mockItems: ClipboardItem[] = [];
        const mockClipboard = {
            write: async (items: ClipboardItem[]) => {
                mockItems = items;
                for (const item of items) {
                    try {
                        const b = await item.getType("text/plain");
                        mockTextContent = await b.text();
                    }
                    catch (e) {
                        // Ignore
                    }
                }
            },
            read: async () => {
                return mockItems;
            },
            writeText: async (text: string) => {
                mockTextContent = text;
                mockItems = [{
                    types: ["text/plain"], getType: (type) => {
                        // We use readText so we don't need to return the real content:
                        return Promise.reject("");
                    },
                }];
            },
            readText: async () => mockTextContent,
        };

        // override the native clipboard API
        Object.defineProperty(window.navigator, "clipboard", {
            value: mockClipboard,
            writable: true,
            enumerable: true,
            configurable: true,
        });
    });
}
