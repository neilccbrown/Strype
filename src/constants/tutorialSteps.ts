// This file contains the steps for the tutorial: 
// each entry (step) contains information on
// - the UI element(s) to highlight
// - the explanation message to do display
// - the location of the message relative to the page
// - if arrows should be displayed from the message to the highlighted part(s)

import { getEditorCodeFrameContainerEltId, getEditorCommandsContainerEltId } from "@/helpers/editor";
import i18n from "@/i18n";
import { TutorialStep } from "@/types/types";

//step definitions
const commandsStep: TutorialStep = {
    hightLighedComponentIds: [getEditorCommandsContainerEltId()],
    explanationMessage: i18n.t("tutorialExplanation.commands") as string,
    messageRelativePos: "center",
    showArrows: false,
}

const codeEditor: TutorialStep = {
    hightLighedComponentIds: [getEditorCodeFrameContainerEltId()],
    explanationMessage: i18n.t("tutorialExplanation.codeEditor") as string,
    messageRelativePos: "center-right",
    showArrows: false,
}
//object containing all steps
export const TutorialSteps: TutorialStep[] = [
    commandsStep,
    codeEditor];
