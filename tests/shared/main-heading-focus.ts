// Shared by the Cypress and Playwright suites.
//
// Whether the "My code" heading is itself a stop for the frame cursor when navigating with
// ArrowUp/ArrowDown (the cursor sits on the heading, between the end of Definitions and the top of
// My code). Must match the app: see CaretPosition.header in src/types/types.ts and the
// header CaretContainer in src/components/FrameContainer.vue.
//
// Tests must not hard-code how many arrow presses it takes to cross from Definitions to My code
// (or back): use the constants below, so only this flag needs changing if the app's behaviour does.
export const MAIN_HEADING_TAKES_FOCUS = true;

// Arrow presses needed to go from the (empty, or last position of) Definitions to the top of My code.
export const ARROWS_DEFS_TO_MAIN = MAIN_HEADING_TAKES_FOCUS ? 2 : 1;
// And the other direction, from the top of My code to the (last position of) Definitions.
export const ARROWS_MAIN_TO_DEFS = ARROWS_DEFS_TO_MAIN;
// Presses from the top of an empty Imports section to the top of My code (via an empty Definitions).
export const ARROWS_IMPORTS_TO_MAIN = 1 + ARROWS_DEFS_TO_MAIN;

// Presses needed to go up from the top of My code to the given number of empty sections above it
// (0 = stay in My code, 1 = Definitions, 2 = Imports).
export function arrowsUpFromMain(sectionsUp: number): number {
    return sectionsUp <= 0 ? 0 : ARROWS_MAIN_TO_DEFS + (sectionsUp - 1);
}
