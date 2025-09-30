<template>
    <div class="frame-container" :style="frameStyle" @click.self="onOuterContainerClick" @mouseenter="onFrameContainerHover(true)" @mouseleave="onFrameContainerHover(false)">
        <div class="frame-container-header" @click.self="onOuterContainerClick">
            <button v-if="!isMainCodeFrameContainer && !isDefsFrameContainer" class="frame-container-btn-collapse" @click="toggleCollapse">{{collapseButtonLabel}}</button>
            <span :class="{[scssVars.frameContainerLabelSpanClassName]: true,'no-toggle-frame-container-span': isMainCodeFrameContainer || isDefsFrameContainer}" @click.self="toggleCollapse">{{containerLabel}}</span>
            <div v-if="isDefsFrameContainer && frames.length > 0" :class="{'fold-children-control': true, 'fold-doc': isFoldDoc, 'fold-header': isFoldHeader, 'fold-full': isFoldFull, 'fold-mixed': isFoldMixed }" @click="cycleFoldChildren">
                <img class="fold-children-full" src="@/assets/images/quote-circle-container-filled-echoed.png">
                <img class="fold-children-doc" src="@/assets/images/quote-circle-container-echoed.png">
                <img class="fold-children-header" src="@/assets/images/quote-circle-container-empty-echoed.png">
            </div>
        </div>

        <!-- keep the tabindex attribute, it is necessary to handle focus properly -->
        <hr v-if="isCollapsed && frames.length > 0" class="non-empty-collapsed-frame-container-hr">
        <div :id="frameUID" :style="containerStyle" class="container-frames" @click="onFrameContainerClick" tabindex="-1" ref="containerFrames">
            <CaretContainer
                :frameId="frameId"
                :ref="getCaretContainerRef"
                :caretVisibility="caretVisibility"
                :caretAssignedPosition="caretPosition.body"
            />
            <div class="frame-container-minheight">
                <Frame 
                    v-for="frame in frames" 
                    :ref="setFrameRef(frame.id)"
                    :key="frame.frameType.type + '-id:' + frame.id"
                    :frameId="frame.id"
                    :isDisabled="frame.isDisabled"
                    :frameType="frame.frameType"
                    :isJointFrame="false"
                    :allowChildren="frame.frameType.allowChildren"
                    :caretVisibility="frame.caretVisibility"
                />
            </div>
        </div>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import Frame from "@/components/Frame.vue";
import CaretContainer from "@/components/CaretContainer.vue";
import { useStore } from "@/store/store";
import { CaretPosition, CollapsedState, FrameObject, DefaultFramesDefinition, FramesDefinitions, FrameContainersDefinitions, getFrameDefType, AllFrameTypesIdentifier, PythonExecRunningState } from "@/types/types";
import { mapStores } from "pinia";
import { CustomEventTypes, getCaretContainerRef, getCaretUID, getFrameUID} from "@/helpers/editor";
import scssVars from "@/assets/style/_export.module.scss";
import { getFrameSectionIdFromFrameId } from "@/helpers/storeMethods";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "FrameContainer",

    components: {
        Frame,
        CaretContainer,
    },


    props: {
        frameId: Number,
        caretVisibility: String,
        containerLabel: String,
        frameType: {
            type: Object,
            default: () => DefaultFramesDefinition,
        }, //Type of the Frame  
    },

    mounted() {
        // Register the caret container component at the upmost level for drag and drop
        this.$root.$refs[getCaretUID(this.caretPosition.body, this.frameId)] = this.$refs[getCaretContainerRef()];
    },

    destroyed() {
        // Remove the registration of the caret container component at the upmost level for drag and drop
        delete this.$root.$refs[getCaretUID(this.caretPosition.body, this.frameId)];
    },

    data: function(){
        return {
            isHovered: false,
            currentDragAndDropHoverTimeoutHandle: -1,
        };
    },

    computed: {
        ...mapStores(useStore),

        scssVars() {
            // just to be able to use in template
            return scssVars;
        },

        frameUID(): string{
            return getFrameUID(this.frameId);
        },

        getCaretContainerRef(): string {
            return getCaretContainerRef();
        },

        isMainCodeFrameContainer(): boolean {
            return this.frameId == this.appStore.getMainCodeFrameContainerId;
        },

        isDefsFrameContainer(): boolean {
            return this.frameId == this.appStore.getDefsFrameContainerId;
        },
        
        frames: {
            get(): FrameObject[] {
                // gets the frames objects which are nested in here (i.e. have this frameID as parent)
                return this.appStore.getFramesForParentId(this.frameId);
            },
            set() {
                return;
            },    
        },
        
        // Needed in order to use the `CaretPosition` type in the v-show
        caretPosition(): typeof CaretPosition {
            return CaretPosition;
        },

        isEditing(): boolean {
            return this.appStore.isEditing;
        },

        frameStyle(): Record<string, string> {
            const defaultStyle : Record<string, string> = {
                "background-color": `${
                    (this.frameType as FramesDefinitions).colour
                } !important`,
            };
            // For the main code, add 200px at the bottom so you can scroll down to put the last bit of code
            // above the bottom of the window.
            if (this.isMainCodeFrameContainer) {
                defaultStyle["padding-bottom"] = "200px";
            }
            return defaultStyle;
        },

        id(): string {
            return "frameContainerId_" + this.frameId;
        },

        isCollapsed: {
            get(): boolean {
                // Ignore the value for "My code" or Defs container for compatibility with saved project having collapsable "My code" container.
                return (this.isMainCodeFrameContainer || this.isDefsFrameContainer) ? false : this.appStore.isContainerCollapsed(this.frameId);
            },
            set(value: boolean){
                this.appStore.setCollapseStatusContainer(
                    {
                        frameId: this.frameId,
                        collapsed: value ? CollapsedState.ONLY_HEADER_VISIBLE : CollapsedState.FULLY_VISIBLE,
                    }
                );
            },
        },

        collapseButtonLabel(): string {
            return (this.isCollapsed) ? "\u25B6" : "\u25BC";
        },

        containerStyle(): Record<string, string> {
            return {
                "display": (this.isCollapsed) ? "none" : "block",
                "backgroundColor": `${(this.frameType.type === FrameContainersDefinitions.ImportsContainerDefinition.type || this.frameType.type == FrameContainersDefinitions.DefsContainerDefinition.type) 
                    ? getFrameDefType(AllFrameTypesIdentifier.import).colour
                    : getFrameDefType(AllFrameTypesIdentifier.return).colour}`,
            };
        },

        isPythonExecuting(): boolean {
            return (this.appStore.pythonExecRunningState ?? PythonExecRunningState.NotRunning) != PythonExecRunningState.NotRunning;
        },
        
        // If all direct children are in the same collapsed state, return it
        // If they are in a mixture of states, return undefined.
        childrenCollapsedState(): CollapsedState | undefined {
            const states = this.frames.map((f : FrameObject) => f.collapsedState ?? CollapsedState.FULLY_VISIBLE);
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
            return this.childrenCollapsedState === undefined;
        },
    },

    methods: {
        setFrameRef(frameId: number) {
            return getFrameUID(frameId);
        },
        
        toggleCollapse(): void {
            // Only collapse Imports and Definitions frame containers.
            if(!this.isMainCodeFrameContainer){
                this.isCollapsed = !this.isCollapsed;
                
                // Also move the frame cursor to the next uncollapsed frame container
                // if we were inside the frame container being collapsed
                if(this.isCollapsed && getFrameSectionIdFromFrameId(this.appStore.currentFrame.id) == this.frameId) {
                    const nextFrameContainerIndex = this.appStore.frameObjects[this.appStore.getRootFrameContainerId].childrenIds.indexOf(this.frameId) + 1;
                    const nextFrameContainerId = this.appStore.frameObjects[this.appStore.getRootFrameContainerId].childrenIds.at(nextFrameContainerIndex);
                    // As we have only 3 sections, if the next section is collapsed we automatically get to "My code", as this one is never collapsed.
                    const targetFrameContainerId = (nextFrameContainerId && this.appStore.frameObjects[nextFrameContainerId].collapsedState == CollapsedState.FULLY_VISIBLE)
                        ? nextFrameContainerId
                        : this.appStore.getMainCodeFrameContainerId;
                    this.appStore.setCurrentFrame({id: targetFrameContainerId, caretPosition: CaretPosition.body});
                }
            }
        },

        onFrameContainerClick(event: any): void {
            // If there are no frames in this container, a click should toggle the caret of this container
            if (this.frames.length == 0) {
                this.appStore.toggleCaret({id: this.frameId, caretPosition: CaretPosition.body});
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            }
        },
        
        onOuterContainerClick(event : any): void {
            const containerFramesBounds = (this.$refs.containerFrames as HTMLElement).getBoundingClientRect();
            
            // Was the click beneath the bottom of the frame container?
            if (event.clientY > containerFramesBounds.bottom) {
                // Select the lowest frame cursor position:
                if (this.frames.length == 0) {
                    this.appStore.toggleCaret({id: this.frameId, caretPosition: CaretPosition.body});
                }
                else {
                    this.appStore.toggleCaret({
                        id: this.frames[this.frames.length - 1].id,
                        caretPosition: CaretPosition.below,
                    });
                }
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            }
            else if (event.clientY < containerFramesBounds.top) {
                // Select the highest frame cursor position:
                this.appStore.toggleCaret({id: this.frameId, caretPosition: CaretPosition.body});
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            }

            // Make sure the container is expanded.
            this.appStore.frameObjects[this.frameId].collapsedState = CollapsedState.FULLY_VISIBLE;
        },

        onFrameContainerHover(isHovered: boolean): void {
            this.isHovered = isHovered;
            
            // Stop the timeout if one was set
            if(!isHovered && this.currentDragAndDropHoverTimeoutHandle > -1){
                window.clearTimeout(this.currentDragAndDropHoverTimeoutHandle);
                this.currentDragAndDropHoverTimeoutHandle = -1;
            }

            // During a drag and drop, if the frame container is collapsed and we've waited long enough, 
            // we can expand the frame (and we trigger an event to allow the drag and drop mechanism to 
            // take the new situation into account.)
            const timeout = 1000;
            if(isHovered && this.appStore.isDraggingFrame && !this.isMainCodeFrameContainer && this.isCollapsed){
                this.currentDragAndDropHoverTimeoutHandle = window.setTimeout(() => {
                    // Check if we are still hovering and dragging                
                    if(this.isHovered && this.appStore.isDraggingFrame){
                        this.appStore.frameObjects[this.frameId].collapsedState = CollapsedState.FULLY_VISIBLE;
                        document.dispatchEvent(new CustomEvent(CustomEventTypes.dropFramePositionsUpdated));
                    }
                }, timeout);
            }

        },
        
        cycleFoldChildren() {
            let nextState;
            // If they are in a mixed state we want next state to be fully collapsed, which is always available for defs:
            if (this.childrenCollapsedState === undefined) {
                nextState = CollapsedState.ONLY_HEADER_VISIBLE;
            }
            else {
                // Otherwise, we need to work out the next state.  It should be a state they can all reach, which
                // depends on the frames present (e.g. the doc state can't be reached if we have a mix of class and
                // function frames)

                // Step 1: compute remaining states per object
                const possibleNextStates = this.frames.map((f) => {
                    const idx = f.frameType.allowedCollapsedStates.indexOf(f.collapsedState);
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
            
            this.frames.forEach((f) => this.appStore.setCollapseStatusContainer({frameId: f.id, collapsed: nextState}));
        },
    },
});

</script>

<style lang="scss">
.frame-container {
    padding-bottom: 15px;
    margin-bottom: 0px;
    margin-left:0px;
}

.frame-container-btn-collapse {
    border-color: transparent;
    background-color: transparent;
    outline:none;
    padding-inline: 2px; // Not only for us to custom style, but because otherwise browsers set different values
}

.frame-container-btn-collapse:focus {
    outline: none;
}

.#{$strype-classname-frame-container-label-span} {       
    margin-left: 5px;
    cursor:default;
    color: #274D19;
    font-weight: 600;
}

.no-toggle-frame-container-span {
  margin-left: 4px; // 2px in place of the button border + 2px in place of the button inline padding 
}

.container-frames, .non-empty-collapsed-frame-container-hr {
    margin-left: 10px; // 1px less than for the right margin to make the rendering neat
    margin-right: 11px;
}

.container-frames {
    border-radius: 8px;
    border: 1px solid #B4B4B4;
    outline: none;
}

.frame-container-minheight {
    min-height: $frame-container-min-height;
}
.frame-container-header {
    display: flex;
    padding-right: 5px;
}
.frame-container-header > .frame-container-btn-collapse, .frame-container-header > span:not(.no-toggle-frame-container-span) {
    cursor: pointer;
}
.fold-children-control {
    margin-left: auto;
    margin-right: 15px;
    margin-bottom: 3px;
    position: relative;
    overflow: hidden;
    width: 0.9em;
    cursor: pointer;
}
.fold-children-control > img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
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
.frame-container-header:hover .fold-children-control.fold-full > img.fold-children-full {
    opacity: 0.5;
}
</style>
