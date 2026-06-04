import { useStore } from "@/store/store";
import { analyticsState, enqueueAnalyticsEvent, flushAnalyticsQueue } from "@/store/analytics";
import { Analytics_session_idle_threshold_ms, Analytics_session_tick_ms } from "@/helpers/analyticsConstants";

let runFinalSessionTick: (() => void) | null = null;
let pageUnloadHandled = false;

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

    runFinalSessionTick = tick;
    setInterval(tick, Analytics_session_tick_ms);
}

/** Runs once per page hide/unload: final tick, session_end event, then flush the queue. */
export function onAnalyticsPageUnload(): void {
    if (pageUnloadHandled) {
        return;
    }
    pageUnloadHandled = true;

    runFinalSessionTick?.();

    const store = useStore();
    analyticsState.frameCount = Object.values(store.frameObjects).filter((f) => f.id > 0).length;
    enqueueAnalyticsEvent("session_end", {
        activeDurationMs: analyticsState.activeSessionTime,
        frameCount: analyticsState.frameCount,
    });
    flushAnalyticsQueue("unload");
}
