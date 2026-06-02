import type { useStore } from "@/store/store";
import { Analytics_session_idle_threshold_ms, Analytics_session_tick_ms } from "@/helpers/analyticsConstants";

export function startSessionTracking(store: ReturnType<typeof useStore>): void {
    let lastActivityTime = Date.now();
    let lastTickTime = Date.now();

    store.analyticsSessionStartTime = Date.now();
    store.analyticsActiveSessionTime = 0;

    const onActivity = () => {
        lastActivityTime = Date.now();
    };

    document.addEventListener("mousemove", onActivity, { passive: true });
    document.addEventListener("keydown", onActivity, { passive: true });
    document.addEventListener("click", onActivity, { passive: true });
    document.addEventListener("scroll", onActivity, { passive: true });

    const tick = () => {
        const now = Date.now();
        if (now - lastActivityTime < Analytics_session_idle_threshold_ms) {
            store.analyticsActiveSessionTime += now - lastTickTime;
        }
        lastTickTime = now;
    };

    setInterval(tick, Analytics_session_tick_ms);

    let sessionEnded = false;
    const emitSessionEnd = () => {
        if (sessionEnded) {
            return;
        }
        sessionEnded = true;
        tick();
        store.analyticsFrameCount = Object.values(store.frameObjects).filter((f) => f.id > 0).length;
        store.enqueueAnalyticsEvent("session_end", {
            activeDurationMs: store.analyticsActiveSessionTime,
            frameCount: store.analyticsFrameCount,
        });
    };

    window.addEventListener("beforeunload", emitSessionEnd);
    window.addEventListener("pagehide", emitSessionEnd);
}
