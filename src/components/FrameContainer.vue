<template>
    <div v-show="!isTestsFrameContainer || isShowingTests" class="frame-container" :style="frameStyle" @click.self="onOuterContainerClick" @mouseenter="onFrameContainerHover(true)" @mouseleave="onFrameContainerHover(false)">
        <!-- The Testing container has no heading of its own: it shares the "My code" heading, which switches between the two -->
        <div v-if="!isTestsFrameContainer" class="frame-container-header" @click.self="onOuterContainerClick">
            <button v-if="!isMainCodeFrameContainer && !isDefsFrameContainer" class="frame-container-btn-collapse" @click="toggleCollapse">{{collapseButtonLabel}}</button>
            <span :class="{[scssVars.frameContainerLabelSpanClassName]: true,'no-toggle-frame-container-span': isMainCodeFrameContainer || isDefsFrameContainer, 'frame-container-heading-focused': isHeadingFocused, 'frame-container-heading-focused-pane': isHeadingFocused && isFrameCommandsPaneActive, 'frame-container-heading-clickable': isMainCodeFrameContainer && !isPythonExecuting}" @click.self="onLabelClicked">{{headingLabel}}</span>
            <!-- While the heading has the frame cursor, left/right arrow (or clicking this or the heading) switch between My code and Testing: the double-headed arrow hints at that -->
            <span v-if="isHeadingFocused" :class="{'frame-container-heading-arrows': true, 'frame-container-heading-arrows-pane': isFrameCommandsPaneActive, 'frame-container-heading-clickable': !isPythonExecuting}" aria-hidden="true" @click.stop="onHeadingClicked">
                <svg width="32" height="14" viewBox="0 0 32 14">
                    <path d="M6 9 Q16 3 26 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M1 9 L8 5 L8 13 Z" fill="currentColor"/>
                    <path d="M31 9 L24 5 L24 13 Z" fill="currentColor"/>
                </svg>
            </span>
            <ChildrenFrameStateToggle v-if="isDefsFrameContainer" :frames="frames" :parentIsFrozen="false"/>
        </div>
        <!-- The "My code" header can take the frame cursor, so that up/down arrows stop on it between the definitions and the main code -->
        <!-- While Testing is showing, the heading's cursor belongs to the Testing container, so that anything done there (adding or pasting frames) goes into the testing code -->
        <CaretContainer
            v-if="isMainCodeFrameContainer && mainHeadingTakesFocus"
            :frameId="headingCaretFrameId"
            :caretVisibility="appStore.frameObjects[headingCaretFrameId].caretVisibility"
            :caretAssignedPosition="caretPosition.header"
        />

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
import { defineComponent } from "vue";
import Frame from "@/components/Frame.vue";
import CaretContainer from "@/components/CaretContainer.vue";
import { useStore } from "@/store/store";
import { CaretPosition, CollapsedState, FrameObject, DefaultFramesDefinition, FramesDefinitions, FrameContainersDefinitions, getFrameDefType, AllFrameTypesIdentifier, PythonExecRunningState } from "@/types/types";
import { mapStores } from "pinia";
import { CustomEventTypes, getCaretContainerRef, getFrameUID} from "@/helpers/editor";
import scssVars from "@/assets/style/_export.module.scss";
import { getFrameSectionIdFromFrameId } from "@/helpers/storeMethods";
import { MainHeadingTakesFocus } from "@/helpers/appContext";
import ChildrenFrameStateToggle from "@/components/ChildrenFrameStateToggle.vue";

//////////////////////
//     Component    //
//////////////////////
export default defineComponent({
    name: "FrameContainer",

    components: {
        ChildrenFrameStateToggle,
        Frame,
        CaretContainer,
    },


    props: {
        frameId: {type: Number, required: true},
        caretVisibility: String,
        containerLabel: String,
        frameType: {
            type: Object,
            default: () => DefaultFramesDefinition,
        }, //Type of the Frame  
    },

    data: function(){
        return {
            isHovered: false,
            currentDragAndDropHoverTimeoutHandle: -1,
        };
    },

    computed: {
        mainHeadingTakesFocus(): boolean {
            return MainHeadingTakesFocus;
        },

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

        isTestsFrameContainer(): boolean {
            return this.frameId == this.appStore.getTestsFrameContainerId;
        },

        // Whether the frame cursor is on the "My code"/"Testing" heading, which shows as an outline round its text
        // rather than as a frame cursor (see isInvisible in CaretContainer.vue)
        // The container the "My code"/"Testing" heading's frame cursor belongs to: whichever of the two is showing
        headingCaretFrameId(): number {
            return this.appStore.mainSectionShowsTests ? this.appStore.getTestsFrameContainerId : this.appStore.getMainCodeFrameContainerId;
        },

        isHeadingFocused(): boolean {
            return this.isMainCodeFrameContainer && !this.appStore.isEditing
                && this.appStore.currentFrame.id == this.headingCaretFrameId && this.appStore.currentFrame.caretPosition == CaretPosition.header;
        },

        isFrameCommandsPaneActive(): boolean {
            return this.appStore.isFrameCommandsPaneActive;
        },

        isPythonExecuting(): boolean {
            return (this.appStore.pythonExecRunningState ?? PythonExecRunningState.NotRunning) != PythonExecRunningState.NotRunning;
        },

        // Whether the third section of the editor is currently showing the testing code rather than the main code
        isShowingTests(): boolean {
            return this.appStore.mainSectionShowsTests;
        },

        // The "My code" heading changes to "Testing" while the testing code is what's showing
        headingLabel(): string {
            return (this.isMainCodeFrameContainer && this.isShowingTests)
                ? this.$t("appMessage.testsContainer")
                : (this.containerLabel ?? "");
        },

        // Of the main code and the testing code, only one is shown at a time
        isHiddenByMode(): boolean {
            return (this.isMainCodeFrameContainer && this.isShowingTests) || (this.isTestsFrameContainer && !this.isShowingTests);
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
            // The same goes for the testing code, which takes the place of the main code when it is showing.
            if ((this.isMainCodeFrameContainer && !this.isShowingTests) || (this.isTestsFrameContainer && this.isShowingTests)) {
                defaultStyle["padding-bottom"] = "200px";
            }
            // While the testing code is showing, "My code" is just the heading above it: no space below, so the
            // testing code sits right under the heading exactly as the main code does.
            else if (this.isMainCodeFrameContainer && this.isShowingTests) {
                defaultStyle["padding-bottom"] = "0px";
            }
            return defaultStyle;
        },

        id(): string {
            return "frameContainerId_" + this.frameId;
        },

        isCollapsed: {
            get(): boolean {
                // Ignore the value for "My code" or Defs container for compatibility with saved project having collapsable "My code" container.
                // The Testing container is never collapsed either (it is shown in place of "My code").
                return (this.isMainCodeFrameContainer || this.isDefsFrameContainer || this.isTestsFrameContainer) ? false : this.appStore.isContainerCollapsed(this.frameId);
            },
            set(value: boolean){
                this.appStore.setCollapseStatuses({[this.frameId]: value ? CollapsedState.ONLY_HEADER_VISIBLE : CollapsedState.FULLY_VISIBLE});
            },
        },

        collapseButtonLabel(): string {
            return (this.isCollapsed) ? "\u25B6" : "\u25BC";
        },

        containerStyle(): Record<string, string> {
            return {
                "display": (this.isCollapsed || this.isHiddenByMode) ? "none" : "block",
                "backgroundColor": `${(this.frameType.type === FrameContainersDefinitions.ImportsContainerDefinition.type || this.frameType.type == FrameContainersDefinitions.DefsContainerDefinition.type)
                    ? getFrameDefType(AllFrameTypesIdentifier.import).colour
                    : getFrameDefType(AllFrameTypesIdentifier.return).colour}`,
            };
        },

    },

    methods: {
        setFrameRef(frameId: number) {
            return getFrameUID(frameId);
        },
        
        // Clicking the "My code"/"Testing" heading (or its arrow) switches between the two, and puts the frame cursor on it.
        // (Not while a program is running: the store ignores it then, and the heading isn't styled as clickable.)
        onHeadingClicked(): void {
            if (this.isMainCodeFrameContainer && !this.isPythonExecuting) {
                this.appStore.toggleMainSectionShowsTests();
            }
        },

        onLabelClicked(): void {
            if (this.isMainCodeFrameContainer) {
                this.onHeadingClicked();
            }
            else {
                this.toggleCollapse();
            }
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
  // 4px in total: 2px in place of the button border + 2px in place of the button inline padding. Some of it is
  // padding, so that the outline shown when the heading has the frame cursor can sit close to the text.
  margin-left: 1px;
  padding: 0 3px;
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
// The frame cursor on the heading (same colours as the frame cursor: blue, or grey once the frame commands pane is active)
.frame-container-heading-focused {
    outline: 2px solid #3467FE;
    outline-offset: 0;
    border-radius: 4px;
}

.frame-container-heading-focused-pane {
    outline-color: #b8bac0;
}

// A double-headed (slightly curved) arrow to the right of the focused heading, pointing left and right (the keys that switch section)
.frame-container-heading-arrows {
    display: flex;
    align-items: center;
    margin-left: 10px;
    color: #3467FE;
}

.frame-container-heading-arrows-pane {
    color: #b8bac0;
}

.frame-container-heading-clickable {
    cursor: pointer;
}

.frame-container-header {
    display: flex;
    padding-right: 5px;
}
.frame-container-header > .frame-container-btn-collapse, .frame-container-header > span:not(.no-toggle-frame-container-span) {
    cursor: pointer;
}
</style>
