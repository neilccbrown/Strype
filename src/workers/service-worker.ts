/// <reference lib="webworker" />
import { serviceWorkerFetchListener } from "sync-message";

// Note: this worker is automatically registered and updated by Vita PWA (see vite.config.js)

declare let self: ServiceWorkerGlobalScope;

// Required for InjectManifest (see vite.config.js), even though we don't actually use the variable
// because it complains otherwise during build.
// We don't want the alternative config of generateSW because that would be a default service worker
// without the message relaying provided by serviceWorkerFetchListener from sync-message.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const unused = self.__WB_MANIFEST || [];


self.addEventListener("activate", (event) => {
    // Claim clients immediately so pages are controlled without reload
    event.waitUntil(self.clients.claim());
});

const syncMessageFetchListener = serviceWorkerFetchListener();

self.addEventListener("fetch", (e) => {
    if (e instanceof FetchEvent) {
        syncMessageFetchListener(e);
    }
});
