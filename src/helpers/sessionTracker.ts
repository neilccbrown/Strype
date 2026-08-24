import { useStore } from "@/store/store";
import { analyticsState, enqueueAnalyticsEvent, flushAnalyticsQueue } from "@/store/analytics";
import { Analytics_session_idle_threshold_ms, Analytics_session_tick_ms } from "@/helpers/analyticsConstants";

let runFinalSessionTick: (() => void) | null = null;
let finalUnloadHandled = false;

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

/** Final tick, session_end event, then flush the queue -- shared by the "genuinely gone for good"
 * and "merely hidden for now" callers below. */
function sendSessionEndSnapshot(): void {
    runFinalSessionTick?.();

    const store = useStore();
    analyticsState.frameCount = Object.values(store.frameObjects).filter((f) => f.id > 0).length;
    enqueueAnalyticsEvent("session_end", {
        activeDurationMs: analyticsState.activeSessionTime,
        frameCount: analyticsState.frameCount,
    });
    flushAnalyticsQueue("unload");
}

/** Runs once per genuine page unload (beforeunload/pagehide): final tick, session_end event, then
 * flush the queue. Guarded against double-firing since both events can fire for the same navigation,
 * and against firing again after a "hidden" checkpoint (below) -- once the page is genuinely gone,
 * nothing will observe a further event anyway. */
export function onAnalyticsPageUnload(): void {
    if (finalUnloadHandled) {
        return;
    }
    finalUnloadHandled = true;
    sendSessionEndSnapshot();
}

/** Tab merely hidden (switched away from, minimized, backgrounded) -- NOT necessarily final: unlike
 * beforeunload/pagehide, this fires on an ordinary tab switch and the page can easily still be
 * revisited hours or days later if the user just leaves it open in the background (confirmed via a
 * DB query: ~17% of sessions had real activity events timestamped after their own session_end, with
 * gaps averaging ~4 hours and reaching over two weeks -- consistent with long-lived backgrounded tabs,
 * not genuinely-ended sessions). So this sends a checkpoint session_end (the server upserts sessions
 * to the latest values it receives, so a later, more accurate one still wins) without setting
 * finalUnloadHandled -- unlike onAnalyticsPageUnload, it deliberately doesn't self-guard against
 * repeat calls, so it can keep checkpointing every time the tab goes back into the background. */
export function onAnalyticsPageHidden(): void {
    if (finalUnloadHandled) {
        return;
    }
    sendSessionEndSnapshot();
}
