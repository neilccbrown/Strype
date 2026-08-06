<template>
    <div class="frame-numbers-gutter" v-if="isGutterMode">
        <span
            v-for="frameId in numberedFrameIds"
            :key="frameId"
            :class="{'frame-number-gutter-item': true, 'frame-number-selected': appStore.isFrameSelected(frameId)}"
            :style="{top: (offsets[frameId] ?? 0) + 'px'}"
        >{{ appStore.getFrameVisualNumbers[frameId] }}</span>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import { defineComponent } from "vue";
import { mapStores } from "pinia";
import { settingsStore, useStore } from "@/store/store";
import { getFrameHeaderUID } from "@/helpers/editor";
import scssVars from "@/assets/style/_export.module.scss";

//////////////////////
//     Component    //
//////////////////////
// Renders frame numbers ("LHS" and "LHS floating" display modes) in a single vertical column
// pinned to the left edge of the editor pane, regardless of how deeply each numbered frame is
// nested. Since the numbers must stay visually aligned with their frame's header row despite
// that row being nested arbitrarily deep (and thus not sharing a common left edge with the
// gutter), we can't achieve this with pure CSS margins: instead we measure each header's actual
// position and position each number to match, re-measuring whenever the editor's layout could
// have changed.
export default defineComponent({
    name: "FrameNumbersGutter",

    data() {
        return {
            offsets: {} as Record<number, number>,
            resizeObserver: null as ResizeObserver | null,
            mutationObserver: null as MutationObserver | null,
            recomputeScheduled: false,
        };
    },

    computed: {
        ...mapStores(useStore, settingsStore),

        isGutterMode(): boolean {
            return this.settingsStore.frameNumbersDisplay === "lhs" || this.settingsStore.frameNumbersDisplay === "lhs-floating";
        },

        // In "floating" mode, the numbers are corrected so that they don't shift as the frame
        // cursor moves up/down the file (see recomputeOffsets() for how).
        isFloatingMode(): boolean {
            return this.settingsStore.frameNumbersDisplay === "lhs-floating";
        },

        numberedFrameIds(): number[] {
            return Object.keys(this.appStore.getFrameVisualNumbers).map(Number);
        },
    },

    watch: {
        isGutterMode: {
            immediate: true,
            handler(isGutter: boolean) {
                if (isGutter) {
                    this.$nextTick(() => this.setupObservers());
                }
                else {
                    this.teardownObservers();
                }
            },
        },

        numberedFrameIds() {
            this.scheduleRecompute();
        },
    },

    beforeUnmount() {
        this.teardownObservers();
    },

    methods: {
        setupObservers(): void {
            this.teardownObservers();
            const editorDiv = this.getEditorCodeDiv();
            if (!editorDiv) {
                return;
            }

            // Catches font/viewport-driven reflow (e.g. window resize changing where labels wrap).
            this.resizeObserver = new ResizeObserver(() => this.scheduleRecompute());
            this.resizeObserver.observe(editorDiv);

            // Catches frame add/remove/fold/edit (and, relevant to "floating" mode, the frame
            // cursor moving, which toggles the "invisible" class of caret elements), any of which
            // can shift where frames sit.
            this.mutationObserver = new MutationObserver(() => this.scheduleRecompute());
            this.mutationObserver.observe(editorDiv, {childList: true, subtree: true, attributes: true, characterData: true});

            this.scheduleRecompute();
        },

        teardownObservers(): void {
            this.resizeObserver?.disconnect();
            this.resizeObserver = null;
            this.mutationObserver?.disconnect();
            this.mutationObserver = null;
        },

        getEditorCodeDiv(): HTMLElement | null {
            return (this.$el as HTMLElement)?.closest?.(".editor-code-div") ?? null;
        },

        scheduleRecompute(): void {
            if (this.recomputeScheduled || !this.isGutterMode) {
                return;
            }
            this.recomputeScheduled = true;
            requestAnimationFrame(() => {
                this.recomputeScheduled = false;
                this.recomputeOffsets();
            });
        },

        // The frame cursor ("caret") between two frames normally occupies zero height, and only
        // grows to its visible height at the one position it currently sits at. That means moving
        // it shifts every frame between the old and new position by the caret's height, which in
        // turn would shift any gutter number measured naively from the frames' live positions.
        // To avoid that, in "floating" mode we find whichever single caret is currently expanded
        // and subtract its height back out of the measured position of anything below it -- i.e.
        // we compute where each frame would be if the caret were *always* collapsed, which doesn't
        // change as the cursor moves.
        getActiveCaretTopAndHeight(): {top: number, height: number} | null {
            const expandedCarets = document.querySelectorAll(`.${scssVars.caretClassName}:not(.${scssVars.invisibleClassName})`);
            if (expandedCarets.length !== 1) {
                // Either no caret is currently expanded (e.g. while editing a slot's text), or more
                // than one is (e.g. during drag-and-drop) -- in both cases we can't sensibly correct.
                return null;
            }
            const rect = (expandedCarets[0] as HTMLElement).getBoundingClientRect();
            return {top: rect.top, height: rect.height};
        },

        recomputeOffsets(): void {
            const editorDiv = this.getEditorCodeDiv();
            if (!editorDiv) {
                return;
            }
            const editorRect = editorDiv.getBoundingClientRect();
            const activeCaret = this.isFloatingMode ? this.getActiveCaretTopAndHeight() : null;
            const newOffsets: Record<number, number> = {};
            this.numberedFrameIds.forEach((frameId) => {
                const headerEl = document.getElementById(getFrameHeaderUID(frameId));
                if (headerEl) {
                    const rect = headerEl.getBoundingClientRect();
                    const correctedTop = (activeCaret && rect.top > activeCaret.top) ? rect.top - activeCaret.height : rect.top;
                    newOffsets[frameId] = Math.round(correctedTop - editorRect.top + editorDiv.scrollTop);
                }
            });
            this.offsets = newOffsets;
        },
    },
});
</script>

<style lang="scss">
.frame-numbers-gutter {
    position: absolute;
    left: 2px;
    top: 0;
    width: 20px;
    height: 100%;
    pointer-events: none;
}

.frame-number-gutter-item {
    position: absolute;
    left: 0;
    width: 20px;
    line-height: 1.5rem;
    text-align: right;
    font-size: 0.75em;
    opacity: 0.6;
    user-select: none;
}

.frame-number-gutter-item.frame-number-selected {
    font-weight: 700;
    opacity: 1;
}
</style>
