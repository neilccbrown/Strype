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
        <!-- Tutorial explanations are displayed in a toast.  -->
        <b-toaster 
            id="tutorialToaster" 
            name="tutorialToaster" 
            class="tutorialToaster"  
            v-bind:style="toasterPosStyle"
        />
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
            <button id="tutorialNextButton" class="tutorial-button next-tutorial-button" @click="next">{{nextButtonLabel}}</button>
        </div>
        <!-- optinal arrows -->
        <div v-if="this.currentStep.showArrows" class="tutorial-arrows-div">
            <svg 
                v-for="(arrowPos, index) in stepArrowsPos"
                v-bind:key="'tutorialArrow_'+index"
                width ="100%" 
                height="100%" 
                class ="arrow-svg">
                <defs>
                    <marker 
                        id="arrowhead" 
                        v-bind:markerWidth="arrowHeadWidth" 
                        v-bind:markerHeight="arrowHeadHeight" 
                        refX="0" 
                        v-bind:refY="arrowHeadHeight / 2" 
                        orient="auto" 
                        fill="#F00"
                    >
                        <polygon v-bind:points="'0 0, ' + arrowHeadWidth + ' ' + (arrowHeadHeight/2) +', 0 ' + arrowHeadHeight" />
                    </marker>
                </defs>
                <line 
                    v-bind:x1="arrowPos.fromX" 
                    v-bind:y1="arrowPos.fromY" 
                    v-bind:x2="arrowPos.toX" 
                    v-bind:y2="arrowPos.toY"
                    stroke="#F00"
                    v-bind:stroke-width="arrowTailWidth" 
                    marker-end="url(#arrowhead)" />
            </svg>
        </div>
        <div id="testTargetBottomLeft" style="position: absolute; left: 20px; top: 400px; background-color: green; width: 50px; height: 30px" />
        <div id="testTargetBottomRight" style="position: absolute; left: 800px; top: 600px; background-color: blue; width: 100px; height: 150px" />
    </div>
</template>

<script lang="ts">
//////////////////////
//      Imports     //
//////////////////////
import Vue from "vue";
import store from "@/store/store";
import {TutorialSteps} from "@/constants/tutorialSteps";
import { TutorialArrowPos, TutorialHightightedComponentDimension, TutorialMargins, TutorialStep } from "@/types/types";
import { BCarousel } from "bootstrap-vue";
import { getTutorialEltId } from "@/helpers/editor";

//////////////////////
//     Component    //
//////////////////////
export default Vue.extend({
    name: "Tutorial",
    store: store,
    
    mounted() {
        //set a listener on window resized to keep accurate values of the masks and the message positioning
        window.addEventListener("resize", () => {
            this.currentStepHighligthedComponentsDimensions = this.getStepHighlightedComponentsDimensions();
            this.$bvToast.hide();
            this.showToast();
        });

        //set a listener on keyup here to listen for arrow events. This listener will be removed when existing the tutorial
        window.addEventListener("keydown", this.onKeyPress);

        //show the tutorial instead of normal init state
        store.commit("toggleTutorialState", true);

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
            stepArrowsPos: [] as TutorialArrowPos[],
            arrowTailWidth: 4,
            arrowHeadWidth: 10,
            arrowHeadHeight: 7,
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
        nextButtonLabel(): string {
            return (this.currentStepIndex === this.steps.length - 1) ? this.$i18n.t("buttonLabel.startCoding").toString() : this.$i18n.t("buttonLabel.next").toString();
        },
    },

    methods:{
        getStepHighlightedComponentsDimensions(): TutorialHightightedComponentDimension[] {
            //This method finds the coordinates and size for each component to be highlighted in the current step
            const dimensions = [] as TutorialHightightedComponentDimension[];

            const margins: TutorialMargins[] = this.currentStep.highLightedAreaExtraMargins??[];
     
            this.currentStep.hightLighedComponentIds.forEach((componentId, index) => {
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
                        x:boundingRect.x - (margins[index]?.left??0),
                        y:boundingRect.y - (margins[index]?.top??0),
                        width:boundingRect.width + (margins[index]?.left??0) + (margins[index]?.right??0),
                        height:boundingRect.height + (margins[index]?.top??0) + (margins[index]?.bottom??0),
                    });
                }
            });

            return dimensions;
        },    
        
        showToast(): void {
            // Show the toast with the right message, and location based on the step.
            // Note: the relative position is to the first highlighted element. Custom is not relative to something.
            this.toasterPosStyle = {};
            let toastStyle = "";
            const posPadding = 15; //the distance (in px) between the highlighted part and the message when left/right/top/bottom positioning are used
            
            //this variables are used in the custom case to work out the styling
            const style = document.createElement("style");
            let childToRemove = null;

            switch(this.currentStep.messageRelativePos){
            case "left":
                //When the message is on the left, we set the right/top/bottom of the toaster  
                //on the left (with gap)/top/bottom of the first highlighted element
                //then we translate the toast vertically to center the message and the element vertically.
                this.toasterPosStyle = {
                    right: (document.documentElement.clientWidth - this.currentStepHighligthedComponentsDimensions[0].x + posPadding) + "px",
                    top: this.currentStepHighligthedComponentsDimensions[0].y + "px",
                    height:this.currentStepHighligthedComponentsDimensions[0].height + "px",
                };
                toastStyle = "toast-v-centered";
                break;
            case "right":
                //When the message is on the rigth, we set the left/top/bottom of the toaster  
                //on the rigth (with gap)/top/bottom of the first highlighted element
                //then we translate the toast vertically to center the message and the element vertically.
                this.toasterPosStyle = {
                    left: (this.currentStepHighligthedComponentsDimensions[0].x + this.currentStepHighligthedComponentsDimensions[0].width + posPadding) + "px",
                    top: this.currentStepHighligthedComponentsDimensions[0].y + "px",
                    height:this.currentStepHighligthedComponentsDimensions[0].height + "px",
                };
                toastStyle = "toast-v-centered";
                break;
            case "top":
                //When the message is on the top, we set the left/rigth/bottom of the toaster  
                //on the left/right/top (with gap) of the first highlighted element
                //then we translate the toast horizontally to center the message and the element horizontally.
                this.toasterPosStyle = {
                    bottom: (document.documentElement.clientHeight - this.currentStepHighligthedComponentsDimensions[0].y + posPadding) + "px",
                    left: this.currentStepHighligthedComponentsDimensions[0].x + "px",
                    width:this.currentStepHighligthedComponentsDimensions[0].width + "px",
                };
                toastStyle = "toast-h-centered";
                break;
            case "bottom":
                //When the message is on the bottom, we set the left/rigth/top of the toaster  
                //on the left/right/bottom (with gap) of the first highlighted element
                //then we translate the toast horizontally to center the message and the element horizontally.
                this.toasterPosStyle = {
                    top: (this.currentStepHighligthedComponentsDimensions[0].y + this.currentStepHighligthedComponentsDimensions[0].height + posPadding) + "px",
                    left: this.currentStepHighligthedComponentsDimensions[0].x + "px",
                    width:this.currentStepHighligthedComponentsDimensions[0].width + "px",
                };
                toastStyle = "toast-h-centered";
                break;
            case "custom": 
                //For custom positioning, the toaster takes the whole viewport: the coordinates (in %) are relative to the viewport.
                //Note: we only use the left and top properties to position the toaster.
                //      and we use percentages because it give a similar rendering even if the size of the window differs.
                this.toasterPosStyle = {
                    //position: "absolute",
                    left: "0px",
                    top: "0px",
                    width: "100vw",
                    height: "100vh",
                };
     
                //toast styling need to be assigned by class name, as toast are dynamic; so we need to generate a CSS class dynamically
                style.type = "text/css";
                style.title = "tutorial-toast-custom"
                //if the style exists already, we remove it
                for(const childElement of document.getElementsByTagName("head")[0].children){
                    if(childElement.tagName.toLowerCase() === "style" && childElement.getAttribute("title") === style.title){
                        childToRemove = childElement
                        break;
                    }
                }
                if(childToRemove){
                    document.getElementsByTagName("head")[0].removeChild(childToRemove);
                }
                //create or recreate the style a custom toast
                style.innerHTML = `.toast-custom-pos { 
                    position: absolute;
                    left: ${(this.currentStep.messageCustomPos?.left??0) + "%"};
                    top:  ${(this.currentStep.messageCustomPos?.top??0) + "%"};
                }";`
                document.getElementsByTagName("head")[0].appendChild(style);
                toastStyle = "toast-custom-pos";
                break;
            default:
                break;                
            }

            this.$bvToast.toast(this.currentStep.explanationMessage, {
                id: "tutorialToast",
                title: "",
                toaster: "tutorialToaster",
                solid: true,
                noAutoHide: true,
                noCloseButton: true,
                noFade: true,
                headerClass: "tutorialToasterHeader",
                bodyClass: "tutorialToasterBody",
                toastClass: toastStyle,
            });
        },

        showCurrentStep(stepIndex: number){
            //update the tutorial step
            this.currentStepIndex = stepIndex;
            this.currentStep = this.steps[stepIndex];
            this.currentStepHighligthedComponentsDimensions = this.getStepHighlightedComponentsDimensions();
            this.$bvToast.hide("tutorialToast")
            this.showToast();

            //event on the toast show to get the accurate position/dimension of the current toast
            this.$root.$on("bv::toast:shown", () => {
                this.setStepArrows();   
            });           

            //When the list (carousel indicator) has focus, browsers seem to get the event first
            //and change the slide, so it results in bad behaviour. To avoid that, we always set
            //the focus on the "next" button after a slide has changed.
            document.getElementById("tutorialNextButton")?.focus()
        },

        setStepArrows(){
            //reset the arrow positions array
            this.stepArrowsPos = [];
                
            if(this.currentStep.showArrows){
                //For arrows: the source of the arrow is the toast message, the target are the highlighted parts.
                //for each hightlighted part, we compute the arrow coordinates as such:
                //1) we find the closest source/target corners to point the arrow from/to
                //2) we keep a distance between the the arrow and the source (2a)/target (2b): details to read below

                const toastBoundingRect = document.getElementById("tutorialToast")?.getBoundingClientRect();
                const marginAroundElements =  2; //the margin to keep around the source and target, in px

                if(toastBoundingRect){
                    //apply the steps aforementioned to each hightlighted areas
                    this.currentStepHighligthedComponentsDimensions.forEach((highLightedAreaDim) => {
                        //step 1), we find the corner based on the relative positions of the source and target
                        const isTargetOnLeft = ((highLightedAreaDim.x + highLightedAreaDim.width) < (toastBoundingRect.x + toastBoundingRect.width/2));
                        const isTargetAbove = ((highLightedAreaDim.y + highLightedAreaDim.height) < (toastBoundingRect.y + toastBoundingRect.height/2));

                        //then calculate the coordinates in each situations. 
                        //cosAngle and singAngle are the ABSOLUTE values of cos and sin of the angle
                        //formed by the arrow with the horizontal axis, we use the source corner as origin of the base to compute this angle in
                        let fromX = 0, fromY = 0, toX = 0, toY = 0, cosAngle = 0, sinAngle = 0;
                        if(isTargetOnLeft){
                            if(isTargetAbove){
                                //source corner: top left, target corner: bottom right
                                //step 2a) add margin on the source corner to get the tail's start coordinates
                                fromX = toastBoundingRect.x - marginAroundElements;
                                fromY = toastBoundingRect.y - marginAroundElements;
                                //step 2b) remove margin on the target corner + the box for the arrow head to get the tail's end coordinates
                                cosAngle = (toastBoundingRect.x - highLightedAreaDim.x - highLightedAreaDim.width ) 
                                    / Math.sqrt(Math.pow(highLightedAreaDim.x + highLightedAreaDim.width - toastBoundingRect.x, 2) + Math.pow(highLightedAreaDim.y + highLightedAreaDim.height - toastBoundingRect.y, 2))
                                sinAngle = (toastBoundingRect.y - highLightedAreaDim.y - highLightedAreaDim.height ) 
                                    / Math.sqrt(Math.pow(highLightedAreaDim.x + highLightedAreaDim.width - toastBoundingRect.x, 2) + Math.pow(highLightedAreaDim.y + highLightedAreaDim.height - toastBoundingRect.y, 2))
                                toX =  highLightedAreaDim.x + highLightedAreaDim.width + marginAroundElements + this.arrowHeadWidth * this.arrowTailWidth * cosAngle;
                                toY =  highLightedAreaDim.y + highLightedAreaDim.height + marginAroundElements + this.arrowHeadWidth * this.arrowTailWidth * sinAngle;
                            }
                            else{
                                //source corner: bottom left, target corner: top right
                                //step 2a) add margin on the source corner to get the tail's start coordinates
                                fromX = toastBoundingRect.x - marginAroundElements;
                                fromY = toastBoundingRect.y + toastBoundingRect.height + marginAroundElements;
                                //step 2b) remove margin on the target corner + the box for the arrow head to get the tail's end coordinates
                                cosAngle = (toastBoundingRect.x - highLightedAreaDim.x - highLightedAreaDim.width) 
                                    / Math.sqrt(Math.pow(highLightedAreaDim.x + highLightedAreaDim.width - toastBoundingRect.x,2) + Math.pow(highLightedAreaDim.y - toastBoundingRect.y - toastBoundingRect.height, 2))
                                sinAngle = (highLightedAreaDim.y - toastBoundingRect.y - toastBoundingRect.height) 
                                    / Math.sqrt(Math.pow(highLightedAreaDim.x + highLightedAreaDim.width - toastBoundingRect.x, 2) + Math.pow(highLightedAreaDim.y - toastBoundingRect.y - toastBoundingRect.height, 2))
                                toX =  highLightedAreaDim.x + highLightedAreaDim.width + marginAroundElements + this.arrowHeadWidth * this.arrowTailWidth * cosAngle;
                                toY =  highLightedAreaDim.y - marginAroundElements - this.arrowHeadWidth * this.arrowTailWidth * sinAngle;
                            }
                        }
                        else{
                            if(isTargetAbove){
                                //source corner: top right, target corner: bottom left
                                //step 2a) add margin on the source corner to get the tail's start coordinates
                                fromX = toastBoundingRect.x + toastBoundingRect.width + marginAroundElements;
                                fromY = toastBoundingRect.y - marginAroundElements;
                                //step 2b) remove margin on the target corner + the box for the arrow head to get the tail's end coordinates
                                cosAngle = (highLightedAreaDim.x - toastBoundingRect.x - toastBoundingRect.width) 
                                    / Math.sqrt(Math.pow(highLightedAreaDim.x - toastBoundingRect.x - toastBoundingRect.width, 2) + Math.pow(highLightedAreaDim.y + highLightedAreaDim.height- toastBoundingRect.y, 2))
                                sinAngle = (toastBoundingRect.y - highLightedAreaDim.y - highLightedAreaDim.height) 
                                    / Math.sqrt(Math.pow(highLightedAreaDim.x - toastBoundingRect.x - toastBoundingRect.width, 2) + Math.pow(highLightedAreaDim.y + highLightedAreaDim.height- toastBoundingRect.y, 2))
                                toX =  highLightedAreaDim.x - marginAroundElements - this.arrowHeadWidth * this.arrowTailWidth * cosAngle;
                                toY =  highLightedAreaDim.y + highLightedAreaDim.height + marginAroundElements + this.arrowHeadWidth * this.arrowTailWidth * sinAngle;
                            }
                            else{
                                //source corner: bottom right, target corner: top left
                                //step 2a) add margin on the source corner to get the tail's start coordinates
                                cosAngle = (highLightedAreaDim.x - toastBoundingRect.x - toastBoundingRect.width) 
                                    / Math.sqrt(Math.pow(highLightedAreaDim.x - toastBoundingRect.x - toastBoundingRect.width, 2) + Math.pow(highLightedAreaDim.y - toastBoundingRect.y - toastBoundingRect.height, 2))
                                sinAngle = (highLightedAreaDim.y - toastBoundingRect.y - toastBoundingRect.height) 
                                    / Math.sqrt(Math.pow(highLightedAreaDim.x - toastBoundingRect.x - toastBoundingRect.width, 2) + Math.pow(highLightedAreaDim.y - toastBoundingRect.y - toastBoundingRect.height, 2))
                                fromX = toastBoundingRect.x + toastBoundingRect.width + marginAroundElements;
                                fromY = toastBoundingRect.y + toastBoundingRect.height + marginAroundElements;
                                //step 2b) remove margin on the target corner + the box for the arrow head to get the tail's end coordinates
                                toX =  highLightedAreaDim.x - marginAroundElements - this.arrowHeadWidth * this.arrowTailWidth * cosAngle;
                                toY =  highLightedAreaDim.y - marginAroundElements - this.arrowHeadWidth * this.arrowTailWidth * sinAngle;
                            }
                        }

                        //add this arrow's coordinate to the arrow positions array
                        this.stepArrowsPos.push({fromX: fromX, fromY: fromY, toX: toX, toY: toY})
                    });
                }
            }
            
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
                this.$bvToast.hide("tutorialToast")
                this.exit();
            }
        },

        exit(): void {
            this.showTutorial = false;
            
            //remove the key listener
            window.removeEventListener("keydown", this.onKeyPress);

            //revert to the normal initial state
            store.commit("toggleTutorialState", false);
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

.tutorial-arrows-div {
    position: absolute;
    width: 100%;
    height: 100%;
    left:0px;
    top:0px;
}

.arrow-svg {
    position: absolute;
    left: 0px;
    right: 0px;
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
    z-index: 1200;
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
.next-tutorial-button:focus {
   outline: none;
}

.tutorialToaster {
    position: absolute; 
    border-radius: 50px !important;
}

.tutorialToasterHeader {
    border: none !important;
    background-color: transparent !important;
}

.tutorialToasterBody {
    font-size: large;
    text-align: center;
}

.toast-v-centered {
    position: relative;
    top: 50%;
    transform: translate(0, -50%);
}

.toast-h-centered {
    position: relative;
    left: 50%;
    transform: translate(-50%, 0);
}

//the styling below overwrites the default carousel indicators
//and default styling of the toast containers
.carousel-indicators {
    z-index: 1200 !important;
}

.carousel-indicators li {
    height: 15px !important;
    width: 15px !important;
    border-radius: 50% !important;
    outline: none;
    opacity: 0.5!important;
    background-color: grey !important;
    margin-right: 10px !important;
}

.carousel-indicators li.active {
    opacity: 1 !important;
    background-color: white !important;
}

.toast {
    border-radius: 20px !important;
}

.b-toast {
    width:100%;
    height: 100%;
    max-width: 100% !important;
}

.b-toaster-slot {
    width:100%;
    height: 100%;
}
</style>
