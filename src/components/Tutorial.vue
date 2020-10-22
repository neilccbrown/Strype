<template>
    <div v-if="showTutorial" class="tutorial-pane" v-bind:id="id">
        <svg width="100%" height="100%">
            <defs>
                <mask id="svgmask2" >
                    <!-- this part of the mask is static: it's covers the full viewport's "show" part -->
                    <rect fill="#FFFFFF" x="0" y="0" width="100%" height="100%"></rect>
                    <!-- this part of the mask is dynamic and the parts that are "hidden", which means for us, see through -->
                    <rect 
                        v-for="(dimensions, index) in currentStepHighligthedComponentsDimensions" 
                        v-bind:key="'stepmask_'+ index" 
                        fill="#000000" 
                        v-bind:x="dimensions.x" 
                        v-bind:y="dimensions.y" 
                        v-bind:width="dimensions.width" 
                        v-bind:height="dimensions.height"></rect>  
                </mask>
            </defs>
            <!-- this image is a basic semi transparent dark SVG image that covers the view port and on which the mask above is applied -->
            <image mask="url(#svgmask2)" preserveAspectRatio="none" width="100%" height="100%" y="0" x="0" xlink:href="~@/assets/images/mask_background.svg"/>
        </svg>
        <!-- Tutorial explanations are displayed in a toast. This toaster is used ONLY for when center position is set in the step,
             otherwise, we use a predefined toaster as explained in Bootstap documentation. -->
        <div class="tutorial-toaster-container">
            <b-toaster 
                id="tutorialToaster" 
                name="tutorialToaster" 
                class="tutorialToaster"  
                v-bind:style="toasterPosStyle"
            />
        </div>
        <div>
            <!-- the carousel is used to change the masks and parts of the tutorial -->
            <b-carousel
                v-model="currentSlideIndex"
                ref="tutorialCarousel"
                no-animation
                :interval="0"
                indicators
            >
                <!-- the "slides" are generated based on the tutorial steps to show -->  
                <b-carousel-slide 
                    v-for="(step, index) in steps" 
                    v-bind:key="'tutorialStepCarouselSlide_' + index"
                ></b-carousel-slide>
            </b-carousel>
        </div>
        <!-- fixed skip and next buttons -->
        <div class="tutorial-button-container">
            <button class="tutorial-button skip-tutorial-button" v-t="'buttonLabel.skipTutorial'" @click="exit" />
            <button class="tutorial-button next-tutorial-button" v-t="'buttonLabel.next'" @click="next" />
        </div>
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import {TutorialSteps} from "@/constants/tutorialSteps"
import { TutorialHightightedComponentDimension, TutorialStep } from "@/types/types";
import { BCarousel } from "bootstrap-vue";
import { getTutorialEltId } from "@/helpers/editor"

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "Tutorial",
    
    mounted() {
        //set a listener on window resized to keep accurate values of the masks
        window.addEventListener("resize", () => this.currentStepHighligthedComponentsDimensions = this.getStepHighlightedComponentsDimensions());

        //set a listener on keyup here to listen for arrow events. This listener will be removed when existing the tutorial
        window.addEventListener("keyup", this.onKeyPress);
        //set the first step once everything is ready
        this.showCurrentStep(0)
    },

    data() {
        return {
            showTutorial: true,
            currentStep: {} as TutorialStep,
            currentStepIndex: 0,
            currentStepHighligthedComponentsDimensions: [] as TutorialHightightedComponentDimension[],
            toasterPosStyle: {},
        };
    },

    computed: {
        steps(): TutorialStep[] {
            return TutorialSteps;
        },
        currentSlideIndex: {
            get(): number {
                return 0;
            },
            set(value: number) {
                // When the index of the carousel changes, we update the tutorial step.
                this.showCurrentStep(value)
            }, 
        },
        id(): string {
            return getTutorialEltId();
        },
    },

    methods:{
        getStepHighlightedComponentsDimensions(): TutorialHightightedComponentDimension[] {
            //This method finds the coordinates and size for each component to be highlighted in the current step
            const dimensions = [] as TutorialHightightedComponentDimension[];
     
            this.currentStep.hightLighedComponentIds.forEach((componentId) => {
                const hightledComponent = document.getElementById(componentId);
                if(hightledComponent === null) {
                    dimensions.push({
                        x:0,
                        y:0,
                        width:0,
                        height:0,
                    });
                }
                else {
                    const boundingRect = hightledComponent.getBoundingClientRect()
                    dimensions.push({
                        x:boundingRect.x,
                        y:boundingRect.y,
                        width:boundingRect.width,
                        height:boundingRect.height,
                    });
                }
            });

            return dimensions;
        },    
        
        showToast(): void {
            // Show the toast with the right message, and location based on the step.
            this.toasterPosStyle = {};

            switch(this.currentStep.messageRelativePos){
            case "top-left":
                this.toasterPosStyle = {top:"5px", left:"5px"};
                break;
            case "top-right":
                this.toasterPosStyle = {top:"5px", right:"5px"};
                break;
            case "top-center":
                this.toasterPosStyle = {left:"50%", top:"5px", transform:"translate(-50%, 0%)"};
                break;
            case "bottom-left":
                this.toasterPosStyle = {bottom:"50px", left:"5px"};
                break;
            case "bottom-right":
                this.toasterPosStyle = {bottom:"50px", right:"5px"};
                break;
            case "bottom-center":
                this.toasterPosStyle = {left:"50%", bottom:"50px", transform:"translate(-50%, 0%)"};
                break;
            case "center" :
                this.toasterPosStyle = {left: "50%", top:"50%", transform:"translate(-50%, -50%)"};
                break;
            case "center-left" :
                this.toasterPosStyle = {left: "5px", top:"50%", transform:"translate(0%, -50%)"};
                break;
            case "center-right":
                this.toasterPosStyle = {right: "5px", top:"50%", transform:"translate(0%, -50%)"};
                break;
            default:
                break;                
            }

            this.$bvToast.toast(this.currentStep.explanationMessage, {
                id: "tutoturialToast",
                title: "",
                toaster: "tutorialToaster",
                solid: true,
                appendToast: false,
                noAutoHide: true,
                noCloseButton: true,
                noFade: true,
                headerClass: "tutorialToasterHeader",
                bodyClass: "tutorialToasterBody",
            });
        },

        showCurrentStep(stepIndex: number){
            this.currentStepIndex = stepIndex;
            this.currentStep = this.steps[stepIndex];
            this.currentStepHighligthedComponentsDimensions = this.getStepHighlightedComponentsDimensions();
            this.$bvToast.hide("tutoturialToast")
            this.showToast();
        },

        onKeyPress(event: KeyboardEvent) {
            if(event.key === "ArrowLeft" && this.currentStepIndex > 0){
                (this.$refs.tutorialCarousel as BCarousel).prev();
            }
            else if(event.key === "ArrowRight" && this.currentStepIndex < this.steps.length -1){
                (this.$refs.tutorialCarousel as BCarousel).next();
            }
            event.preventDefault();
        },
    
        next(): void {
            if(this.currentStepIndex < this.steps.length - 1){
                (this.$refs.tutorialCarousel as BCarousel).next();
            }
            else{
                //exit the tutorial when we are on the last slide/step
                this.$bvToast.hide("tutoturialToast")
                this.exit();
            }
        },

        exit(): void {
            this.showTutorial = false;
            //remove the key listener
            window.removeEventListener("keyup", this.onKeyPress);
        },
    },
});
</script>

<style lang="scss">

.tutorial-pane {
    width: 100vw;
    height: 100vh;
    position: absolute;
    left: 0px;
    top: 0px;
    z-index: 100;
    background-size: 100% 100%;
}

.tutorial-button-container {
    position: absolute;
    top: 0px;
    left:0px;
    width: 100vw;
    height: 100vh;
}

.tutorial-button {
    color: white;
    background-color: transparent;
    position: fixed;
} 

.skip-tutorial-button {
    border: solid 1px white;
    border-radius: 5px; 
    left: 15px;
    bottom: 15px;
    font-size: large;
}

.next-tutorial-button {
    border: none; 
    right: 15px;
    bottom: 8px;
    font-size: xx-large;
}

.tutorial-toaster-container {
    width: 100vw;
    height: 100vh;
    position: absolute;
    left: 0px;
    top: 0px;
}

.tutorialToaster {
    position: absolute; 
    border-radius: 50px !important;
}

.toast {
    //used to overwrite the toast class created by Bootstrap
    border-radius: 20px !important;
}

.tutorialToasterHeader {
    border: none !important;
    background-color: transparent !important;
}

.tutorialToasterBody {
    font-size: large;
    text-align: center;
}
</style>
