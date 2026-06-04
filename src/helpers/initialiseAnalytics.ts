import { settingsStore } from "@/store/store";
import { startSessionTracking } from "@/helpers/sessionTracker";
import { Analytics_batch_flush_ms } from "@/helpers/analyticsConstants";
import {
    analyticsState,
    enqueueAnalyticsEvent,
    flushAnalyticsQueue,
    initAnalyticsCountry,
    initAnalyticsPlatform,
    initAnalyticsSession,
    initAnalyticsUserId,
    trackAnalyticsLocaleChange,
} from "@/store/analytics";

export function initialiseAnalytics(): void {
    initAnalyticsUserId();
    initAnalyticsSession();
    initAnalyticsPlatform();
    startSessionTracking();
    void initAnalyticsCountry();

    settingsStore().$subscribe((_mutation, state) => {
        if (typeof state.locale === "string" && state.locale.length > 0) {
            trackAnalyticsLocaleChange(state.locale);
        }
    });

    enqueueAnalyticsEvent("session_start", {locale: analyticsState.locale});

    setInterval(() => flushAnalyticsQueue("interval"), Analytics_batch_flush_ms);

    const unloadFlush = () => flushAnalyticsQueue("unload");
    window.addEventListener("beforeunload", unloadFlush);
    window.addEventListener("pagehide", unloadFlush);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            unloadFlush();
        }
    });
}
