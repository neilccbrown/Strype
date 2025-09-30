<template>
    <div :class="{'fold-children-control': true, 'fold-doc': isFoldDoc, 'fold-header': isFoldHeader, 'fold-full': isFoldFull, 'fold-mixed': isFoldMixed }" @click.prevent.stop="cycleFoldChildren">
        <img class="fold-children-full" src="@/assets/images/quote-circle/quote-circle-container-filled-echoed.png">
        <img class="fold-children-doc" src="@/assets/images/quote-circle/quote-circle-container-echoed.png">
        <img class="fold-children-header" src="@/assets/images/quote-circle/quote-circle-container-empty-echoed.png">
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import {CollapsedState, FrameObject} from "@/types/types";
import {mapStores} from "pinia";
import {useStore} from "@/store/store";

export default Vue.extend({
    name: "ChildrenFrameStateToggle",
    
    props: {
        frames: Array, 
    },
    
    computed: {
        ...mapStores(useStore),
        
        // If all direct children are in the same collapsed state, return it
        // If they are in a mixture of states, return undefined.
        childrenCollapsedState(): CollapsedState | undefined {
            const states = (this.frames as FrameObject[]).map((f : FrameObject) => f.collapsedState ?? CollapsedState.FULLY_VISIBLE);
            const unique = Array.from(new Set(states));
            if (unique.length == 1) {
                return unique[0];
            }
            else {
                return undefined;
            }
        },

        isFoldDoc(): boolean {
            return this.childrenCollapsedState === CollapsedState.HEADER_AND_DOC_VISIBLE;
        },
        isFoldHeader(): boolean {
            return this.childrenCollapsedState === CollapsedState.ONLY_HEADER_VISIBLE;
        },
        isFoldFull(): boolean {
            return this.childrenCollapsedState === CollapsedState.FULLY_VISIBLE;
        },
        isFoldMixed(): boolean {
            return this.childrenCollapsedState === undefined && this.frames.length > 0;
        },
    },
    
    methods: {
        cycleFoldChildren() {
            let nextState : CollapsedState;
            // If they are in a mixed state we want next state to be fully collapsed, which is always available for defs:
            if (this.childrenCollapsedState === undefined) {
                nextState = CollapsedState.ONLY_HEADER_VISIBLE;
            }
            else {
                // Otherwise, we need to work out the next state.  It should be a state they can all reach, which
                // depends on the frames present (e.g. the doc state can't be reached if we have a mix of class and
                // function frames)

                // Step 1: compute remaining states per object
                const possibleNextStates = (this.frames as FrameObject[]).map((f) => {
                    const idx = f.frameType.allowedCollapsedStates.indexOf(f.collapsedState ?? CollapsedState.FULLY_VISIBLE);
                    if (idx < 0) {
                        return []; // safeguard if current not found
                    }

                    // everything after current + everything before current
                    return f.frameType.allowedCollapsedStates.slice(idx + 1).concat(f.frameType.allowedCollapsedStates.slice(0, idx));
                });

                // Step 2: intersect them all
                let intersection = new Set(possibleNextStates[0]);
                for (let i = 1; i < possibleNextStates.length; i++) {
                    intersection = new Set(possibleNextStates[i].filter((s) => intersection.has(s)));
                }

                if (intersection.size === 0) {
                    // Shouldn't happen:
                    nextState = CollapsedState.FULLY_VISIBLE;
                }
                else {
                    // Step 3: pick earliest in canonical order (say, the first object’s list)
                    for (const state of possibleNextStates[0]) {
                        if (intersection.has(state)) {
                            nextState = state;
                            break;
                        }
                    }
                }
            }

            (this.frames as FrameObject[]).forEach((f) => this.appStore.setCollapseStatusContainer({frameId: f.id, collapsed: nextState}));
        },
    },
});
</script>

<style lang="scss">
.fold-children-control {
    margin-left: auto;
    margin-right: 15px;
    margin-bottom: 3px;
    position: relative;
    width: 0.9em;
}
.fold-children-control > img {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 0.9em;
    height: auto;
    max-height: none;
    object-fit: cover;
    opacity: 0;
}
// Note: important the hover is on the folding control not the img, because
// the imgs are on top of each other so only the top one gets hover
.fold-children-control:hover > img {
   filter: brightness(1.25);
}

.fold-children-control.fold-header > img.fold-children-header,
.fold-children-control.fold-doc > img.fold-children-doc,
.fold-children-control.fold-mixed > img.fold-children-full,
.frame-container-header:hover .fold-children-control.fold-full > img.fold-children-full,
.frame-header-div-line:hover .fold-children-control.fold-full > img.fold-children-full {
    opacity: 0.5;
    cursor: pointer;
}
</style>
