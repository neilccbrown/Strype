import type { Pinia } from "pinia";
import { settingsStore, useStore } from "@/store/store";
import { startSessionTracking } from "@/helpers/sessionTracker";
import { Analytics_batch_flush_ms } from "@/helpers/analyticsConstants";

export async function bootstrapApp(pinia: Pinia): Promise<void> {
    const store = useStore(pinia);
    if (import.meta.env.DEV) {
        (window as unknown as {useStore: () => typeof store}).useStore = () => store;
    }
    store.initAnalyticsUserId();
    store.initAnalyticsSession();
    store.initAnalyticsPlatform();
    startSessionTracking(store);
    await store.initAnalyticsCountry();

    const settings = settingsStore(pinia);
    settings.$subscribe((_mutation, state) => {
        if (typeof state.locale === "string" && state.locale.length > 0) {
            store.trackAnalyticsLocaleChange(state.locale);
        }
    });

    store.enqueueAnalyticsEvent("session_start", {locale: store.analyticsLocale});

    setInterval(() => store.flushAnalyticsQueue("interval"), Analytics_batch_flush_ms);

    const unloadFlush = () => store.flushAnalyticsQueue("unload");
    window.addEventListener("beforeunload", unloadFlush);
    window.addEventListener("pagehide", unloadFlush);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            unloadFlush();
        }
    });
}
