import { useStore } from "@/store/store";
import { analyticsState, enqueueAnalyticsEvent } from "@/store/analytics";
import { Analytics_session_idle_threshold_ms, Analytics_session_tick_ms } from "@/helpers/analyticsConstants";

export function startSessionTracking(): void {
    let lastActivityTime = Date.now();
    let lastTickTime = Date.now();

    analyticsState.sessionStartTime = Date.now();
    analyticsState.activeSessionTime = 0;

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
            const elapsed = now - lastTickTime;
            analyticsState.activeSessionTime += Math.min(elapsed, Analytics_session_tick_ms);
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
        const store = useStore();
        analyticsState.frameCount = Object.values(store.frameObjects).filter((f) => f.id > 0).length;
        enqueueAnalyticsEvent("session_end", {
            activeDurationMs: analyticsState.activeSessionTime,
            frameCount: analyticsState.frameCount,
        });
    };

    window.addEventListener("beforeunload", emitSessionEnd);
    window.addEventListener("pagehide", emitSessionEnd);
}
