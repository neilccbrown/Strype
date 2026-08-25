import { settingsStore } from "@/store/store";
import { onAnalyticsPageHidden, onAnalyticsPageUnload, startSessionTracking } from "@/helpers/sessionTracker";
import { Analytics_batch_flush_ms } from "@/helpers/analyticsConstants";
import {
    analyticsState,
    enqueueAnalyticsEvent,
    flushAnalyticsQueue,
    initAnalyticsCountry,
    initAnalyticsPlatform,
    initAnalyticsSession,
    initAnalyticsUserAgent,
    initAnalyticsUserId,
    trackAnalyticsLocaleChange,
} from "@/store/analytics";

export function initialiseAnalytics(): void {
    initAnalyticsUserId();
    initAnalyticsSession();
    initAnalyticsPlatform();
    initAnalyticsUserAgent();
    startSessionTracking();
    void initAnalyticsCountry();

    settingsStore().$subscribe((_mutation, state) => {
        if (typeof state.locale === "string" && state.locale.length > 0) {
            trackAnalyticsLocaleChange(state.locale);
        }
    });

    enqueueAnalyticsEvent("session_start", {locale: analyticsState.locale});

    setInterval(() => flushAnalyticsQueue("interval"), Analytics_batch_flush_ms);

    window.addEventListener("beforeunload", onAnalyticsPageUnload);
    // event.persisted true means the page is being frozen into the back/forward cache, not actually
    // unloading -- it can be fully restored later (e.g. via the Back button) with this same JS state
    // intact, so that case is routed through the non-final "hidden" checkpoint instead (see
    // onAnalyticsPageHidden's own comment): treating it as final here would permanently block any
    // further session_end for a page that's still genuinely in use, the same class of bug the
    // "hidden" checkpoint itself was added to fix.
    window.addEventListener("pagehide", (event) => {
        if (event.persisted) {
            onAnalyticsPageHidden();
        }
        else {
            onAnalyticsPageUnload();
        }
    });
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            onAnalyticsPageHidden();
        }
    });
}
