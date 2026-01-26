/// <reference lib="webworker" />
import { serviceWorkerFetchListener } from "sync-message";

// Note: this worker is automatically registered and updated by Vita PWA (see vite.config.mjs)

declare let self: ServiceWorkerGlobalScope;

self.addEventListener("activate", (event) => {
    // Required for InjectManifest (see vite.config.js), even though we don't actually do precaching
    // because it complains otherwise during build.  We need to actually make use of self.__WB_MANIFEST
    // because otherwise Typescript optimises out the variable and the build fails.  So we inspect it in
    // a needless way, but one which can't be optimised out.
    // We don't want the alternative config of generateSW because that would be a default service worker
    // without the message relaying provided by serviceWorkerFetchListener from sync-message.

    const WB_MANIFEST = self.__WB_MANIFEST;
    if (!WB_MANIFEST) {
        console.log("No such manifest");
    }
    // Claim clients immediately so pages are controlled without reload
    event.waitUntil(self.clients.claim());
});

const syncMessageFetchListener = serviceWorkerFetchListener();

self.addEventListener("fetch", (e) => {
    if (e instanceof FetchEvent) {
        syncMessageFetchListener(e);
    }
});
