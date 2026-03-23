/// <reference lib="webworker" />
import { serviceWorkerFetchListener } from "sync-message";
// Note: this worker is built before development run and production build and placed into
// public/compiled-service-worker.js.  Should you edit this file (which should be rare),
// you will need to restart the development server to see the changes.

declare let self: ServiceWorkerGlobalScope;

self.addEventListener("install", () => {
    self.skipWaiting(); // activate immediately
});

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
