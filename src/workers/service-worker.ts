/// <reference lib="webworker" />
import { serviceWorkerFetchListener } from "sync-message";

declare let self: ServiceWorkerGlobalScope;

// Required for InjectManifest
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
    //console.log("Servicing event: " + e.type);
    if (e instanceof FetchEvent) {
        /*
        const req = e.request.clone();
        console.log("URL:", req.url);
        console.log("Method:", req.method);
        console.log("Mode:", req.mode);
        console.log("Credentials:", req.credentials);
        console.log("Cache:", req.cache);
        console.log("Redirect:", req.redirect);
        console.log("Referrer:", req.referrer);
        console.log("Headers:");
        for (const [k, v] of req.headers.entries()) {
            console.log(`  ${k}: ${v}`);
        }
        */
        syncMessageFetchListener(e);
    }
});
