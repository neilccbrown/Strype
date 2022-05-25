import i18n from "@/i18n";
import { useStore } from "@/store/store";
import { AddFrameCommandDef, CaretPosition, Definitions, FramesDefinitions } from "@/types/types";
import Vue from "vue";
import { getAboveFrameCaretPosition } from "./storeMethods";

export const undoMaxSteps = 50;

export enum CustomEventTypes {
    editorAddFrameCommandsUpdated = "frameCommandsUpdated",
    /* IFTRUE_isPurePython */
    pythonConsoleDisplayChanged = "pythonConsoleDisplayChanged",
    /* FITRUE_isPurePython */
}

export function getFrameContainerUIID(frameId: number): string {
    return "FrameContainer_" + frameId;
}

export function getFrameUIID(frameId: number): string{
    return "frame_id_" + frameId;
}

function retrieveFrameIDfromUIID(uiid: string): number {
    return parseInt(uiid.substring("frame_id_".length));
}

export function isIdAFrameId(id: string): boolean {
    return id.match(/^frame_id_\d+$/) !== null;
}

export function getEditableSlotUIID(frameId: number, slotIndex: number): string  {
    //if a change is done in this method, also update isElementEditableSlotInput()
    return "input_frameId_" + frameId + "_slot_" + slotIndex;
}

export function isElementEditableSlotInput(element: EventTarget | null): boolean{
    if(!(element instanceof HTMLInputElement)){
        return false;
    }

    return (((element as HTMLInputElement).id.match("^input_frameId_\\d+_slot_\\d+$")?.length)??0) > 0;
}

export function getFrameContextMenuUIID(frameUIID: string): string{
    return frameUIID + "frameContextMenu"
}

export function getCodeEditorUIID(): string {
    return getFrameContainerUIID(useStore().getMainCodeFrameContainerId);
}

export function getCaretUIID(caretAssignedPosition: string, frameId: number): string{
    return "caret_"+caretAssignedPosition+"_"+frameId;
}

export function getCommandsContainerUIID(): string {
    return "editorCommands";
}

export function getEditorMenuUIID(): string {
    return "showHideMenu";
} 

export function getEditorButtonsContainerUIID(): string {
    return "editorButtonsContainer"
}

export function getMenuLeftPaneUIID(): string {
    return "menu-bar";
}

export function getEditorMiddleUIID(): string {
    return "editorCodeDiv";
}

export function getCommandsRightPaneContainerId(): string {
    return "commandsContainerDiv";
}

export function getAcSpanId(slotId: string): string {
    return slotId + "_ResultsSpan";
}

export function getReshowResultsId(slotId: string): string {
    return slotId + "_ReshowResults";
}

export function getDocumentationSpanId(slotId: string): string {
    return slotId + "_DocumentationSpan";
}

export function getTypesSpanId(slotId: string): string {
    return slotId + "_TypesSpan";
}

export function getAcContextPathId(slotId: string): string{
    return slotId+"_AcContextPathSpan";
}

export const fileImportSupportedFormats: string[] = ["spy"];

// Check if the code contains errors: precompiled errors & TigerPyton errors are all indicated in the editor
// by an error class on a frame ("frameDiv" + "error"), a frame body ("frame-body-container" + "error") 
// or an editable slot ("editableslot-input" + "error").
export function hasEditorCodeErrors(): boolean {
    const erroneousHTMLElements = document.getElementsByClassName("error");
    if(erroneousHTMLElements.length > 0){
        let hasErrors = false;
        for(const erroneousHTMLElement of erroneousHTMLElements) {
            hasErrors = hasErrors || erroneousHTMLElement.className.includes("frameDiv") 
                || erroneousHTMLElement.className.includes("frame-body-container") 
                || erroneousHTMLElement.className.includes("editableslot-input");
        }
        return hasErrors
    }
    return false; 
}

// Helper function to generate the frame commands on demand. 
// Calls will happen when the frames are created the first time, and whenever the language is changed
export function generateAllFrameCommandsDefs():void {
    allFrameCommandsDefs = {
        "i": [
            {
                type: Definitions.IfDefinition,
                description: "if",
                shortcut: "i",
                tooltip:i18n.t("frame.if_detail") as string,
                index: 0,
            },
            {
                type: Definitions.ImportDefinition,
                description: "import",
                shortcut: "i",
                tooltip:i18n.t("frame.import_detail") as string,
                index:1,
            },
        ],
        "l": [{
            type: Definitions.ElifDefinition,
            description: "elif",
            tooltip:i18n.t("frame.elif_detail") as string,
            shortcut: "l",
        }],
        "e": [{
            type: Definitions.ElseDefinition,
            description: "else",
            tooltip:i18n.t("frame.else_detail") as string,
            shortcut: "e",
        }],
        "f": [
            {
                type: Definitions.ForDefinition,
                description: "for",
                shortcut: "f",
                tooltip:i18n.t("frame.for_detail") as string,
                index: 0,
            },
            {
                type: Definitions.FuncDefDefinition,
                description: i18n.t("frame.funcdef_desc") as string,
                shortcut: "f",
                tooltip:i18n.t("frame.funcdef_detail") as string,
                index: 1,
            },
            {
                type: Definitions.FromImportDefinition,
                description: "from...import",
                tooltip:i18n.t("frame.fromimport_detail") as string,
                shortcut: "f",
                index:2,
            },
        ],
        "w": [{
            type: Definitions.WhileDefinition,
            description: "while",
            tooltip:i18n.t("frame.while_detail") as string,
            shortcut: "w",
        }],
        "b" : [{
            type: Definitions.BreakDefinition,
            description: "break",
            tooltip:i18n.t("frame.break_detail") as string,
            shortcut: "b",
        }],
        "u" : [{
            type: Definitions.ContinueDefinition,
            description: "continue",
            tooltip:i18n.t("frame.continue_detail") as string,
            shortcut: "u",
        }],
        "=": [{
            type: Definitions.VarAssignDefinition,
            description: i18n.t("frame.varassign_desc") as string,
            tooltip:i18n.t("frame.varassign_detail") as string,
            shortcut: "=",
        }],
        " ": [{
            type: Definitions.EmptyDefinition,
            description: i18n.t("frame.funccall_desc") as string,
            shortcut: " ",
            tooltip:i18n.t("frame.funccall_detail") as string,
            symbol: "⌴",//"␣"
        }],
        "r": [{
            type: Definitions.ReturnDefinition,
            description: "return",
            tooltip:i18n.t("frame.return_detail") as string,
            shortcut: "r",
        }],
        "c": [{
            type: Definitions.CommentDefinition,
            description: i18n.t("frame.comment_desc") as string,
            tooltip:i18n.t("frame.comment_detail") as string,
            shortcut: "c",
        }],
        "t": [{
            type: Definitions.TryDefinition,
            description: "try",
            tooltip:i18n.t("frame.try_detail") as string,
            shortcut: "t",
        }],
        "a" : [{
            type: Definitions.RaiseDefinition,
            description: "raise",
            tooltip:i18n.t("frame.raise_detail") as string,
            shortcut: "a",
        }],
        "x": [{
            type: Definitions.ExceptDefinition,
            description: "except",
            tooltip:i18n.t("frame.except_detail") as string,
            shortcut: "x",
        }],
        "n": [{
            type: Definitions.FinallyDefinition,
            description: "finally",
            tooltip:i18n.t("frame.finally_detail") as string,
            shortcut: "n",
        }],
        "h": [{
            type: Definitions.WithDefinition,
            description: "with",
            tooltip:i18n.t("frame.with_detail") as string,
            shortcut: "h",
        }],
        "g": [{
            type:Definitions.GlobalDefinition,
            description: "global",
            tooltip: i18n.t("frame.global_detail") as string,
            shortcut: "g",
        }],
    };

    // We need to "tell" the Vue component that hosts the frame commands (Commands.vue) to refresh as there is no reactivity
    // between the frame definitions here and the component's computed property.
    // We can do it via a custom event Commands.vue will be listening to.
    document.dispatchEvent(new Event(CustomEventTypes.editorAddFrameCommandsUpdated));
}

//Commands for Frame insertion, one command can match more than 1 frame ONLY when there is a TOTAL distinct context between the two
let allFrameCommandsDefs: {[id: string]: AddFrameCommandDef[]} | undefined = undefined;

export function getAddCommandsDefs(): {[id: string]: AddFrameCommandDef[]} { 
    if(allFrameCommandsDefs === undefined){
        generateAllFrameCommandsDefs();
    }
    return allFrameCommandsDefs as {[id: string]: AddFrameCommandDef[]};
}

export function findAddCommandFrameType(shortcut: string, index?: number): FramesDefinitions | null { 
    if(allFrameCommandsDefs === undefined){
        generateAllFrameCommandsDefs();
    }
    const shortcutCommands = Object.values(allFrameCommandsDefs as {[id: string]: AddFrameCommandDef[]}).flat().filter((command) => command.shortcut === shortcut);
    if(shortcutCommands.length > 0) {
        if(index) {
            if(index < shortcutCommands.length) {
                const shortcutCommandIndexed = shortcutCommands.find((command) => command?.index == index);
                if(shortcutCommandIndexed){
                    return shortcutCommandIndexed.type;
                }
            }
        }
        else{
            return shortcutCommands[0].type;
        }
    }

    // If we are here, it means the call to this method has been misused...
    return null;
}

// Used for easing handling events for drag & drop of frames
let currentDraggedSingleFrameId = 0;
export function getDraggedSingleFrameId(): number {
    return currentDraggedSingleFrameId;
}

export function notifyDragStarted(frameId?: number):void {
    // If the argument "frameId" is set, the drag and drop is done on a single frame
    // so we set currentDraggedSingleFrameId
    if(frameId){
        currentDraggedSingleFrameId = frameId;
    }

    // Update the store about dragging started
    useStore().isDraggingFrame = true;
} 
export function notifyDragEnded(draggedHTMLElement: HTMLElement):void {
    // Regardless we moved 1 or several frames at once, we reset currentDraggedSingleFrameId
    currentDraggedSingleFrameId = 0;

    // Retrieve the id of the frame dragged or of the top frame from the frames dragged.
    // We find it by retrieving the first frame div id of dragged HTML object given as argument of this function
    const subHTMLElementIdsMatches = draggedHTMLElement.innerHTML.matchAll(/ id="([^"]*)"/g);
    let topFrameId = 0, foundFrameID = false;
    if(subHTMLElementIdsMatches != null){    
        [...subHTMLElementIdsMatches].forEach((matchBit) => {
            if(!foundFrameID && isIdAFrameId(matchBit[1])){
                topFrameId = retrieveFrameIDfromUIID(matchBit[1]);
                foundFrameID = true;
            }
        })
    }
    
    // Update the store about dragging ended 
    useStore().isDraggingFrame = false;

    // Position the blue caret where *visually* the fake caret was positionned.
    // NOTE: at this stage, the UI hasn't yet updated the frame order -- so we do this caret selection at the next Vue tick
    Vue.nextTick(() => {
        const newCaretPosition = getAboveFrameCaretPosition(topFrameId);
        
        // Set the caret properly in the store which will update the editor UI
        useStore().toggleCaret({id:newCaretPosition.id, caretPosition: newCaretPosition.caretPosition as CaretPosition});
    });
}