/** Session active-time tick interval (see `sessionTracker.ts`). */
export const Analytics_session_tick_ms = 30_000;

/** Idle gap after which active time is not accumulated. */
export const Analytics_session_idle_threshold_ms = 5 * 60_000;

/** Periodic flush interval for the analytics event queue. */
export const Analytics_batch_flush_ms = 60_000;

/** Size cap that triggers an immediate flush when the queue grows past it. */
export const Analytics_batch_max_events = 100;

/** Hard cap on retained events; oldest dropped when exceeded. */
export const Analytics_queue_overflow_cap = 500;
