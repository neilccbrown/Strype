// This file contains the steps for the tutorial: 
// each entry (step) contains information on
// - the UI element(s) to highlight
// - the explanation message to do display
// - the location of the message relative to the page
// - if arrows should be displayed from the message to the highlighted part(s)

import { getEditorCodeFrameContainerBodyCaretEltId, getEditorCodeFrameContainerEltId, getEditorCommandsContainerEltId, getEditorMenuEltId, getEditorSpecialButtonsContainerEltId } from "@/helpers/editor";
import i18n from "@/i18n";
import { TutorialStep } from "@/types/types";

//step definitions
const commandsStep: TutorialStep = {
    hightLighedComponentIds: [getEditorCommandsContainerEltId()],
    highLightedAreaExtraMargins : [{top: 5}],
    explanationMessage: i18n.t("tutorialExplanation.commands") as string,
    messageRelativePos: "left",
    showArrows: false,
}

const codeEditor: TutorialStep = {
    hightLighedComponentIds: [getEditorCodeFrameContainerEltId()],
    highLightedAreaExtraMargins : [{bottom: 15}],
    explanationMessage: i18n.t("tutorialExplanation.codeEditor") as string,
    messageRelativePos: "top",
    showArrows: false,
}

const editorCaret: TutorialStep = {
    hightLighedComponentIds: [getEditorCodeFrameContainerBodyCaretEltId()],
    highLightedAreaExtraMargins : [{top:5, left:5, right: 5, bottom: 5}],
    explanationMessage: i18n.t("tutorialExplanation.editorCaret") as string,
    messageRelativePos: "right",
    showArrows: false,
}

const editorMenus: TutorialStep = {
    hightLighedComponentIds: [getEditorMenuEltId(), getEditorSpecialButtonsContainerEltId()],
    highLightedAreaExtraMargins : [{left:0, right: 0, bottom: 0}, {left:5, right: 5, bottom: 5}],
    explanationMessage: i18n.t("tutorialExplanation.editorMenus") as string,
    messageRelativePos: "custom",
    messageCustomPos: {left:30, top:25},
    showArrows: false,
}

//object containing all steps
export const TutorialSteps: TutorialStep[] = [
    commandsStep,
    codeEditor,
    editorCaret,
    editorMenus,
];
