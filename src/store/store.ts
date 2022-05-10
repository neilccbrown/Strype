import Vue from "vue";
import { FrameObject, CurrentFrame, CaretPosition, MessageDefinitions, Definitions, ObjectPropertyDiff, AddFrameCommandDef, EditorFrameObjects, MainFramesContainerDefinition, ForDefinition, WhileDefinition, ReturnDefinition, FuncDefContainerDefinition, BreakDefinition, ContinueDefinition, EditableSlotReachInfos, StateAppObject, FuncDefDefinition, VarAssignDefinition, UserDefinedElement, FrameSlotContent, AcResultsWithModule, ImportDefinition, CommentDefinition, EmptyDefinition, TryDefinition, ElseDefinition, ImportsContainerDefinition, EditableFocusPayload, EditableSlotPayload, FramesDefinitions, EmptyFrameObject, NavigationPosition, FormattedMessage, FormattedMessageArgKeyValuePlaceholders, GlobalDefinition} from "@/types/types";
import { getObjectPropertiesDifferences, getSHA1HashForObject } from "@/helpers/common";
import i18n from "@/i18n";
import { checkCodeErrors, checkDisabledStatusOfMovingFrame, checkStateDataIntegrity, cloneFrameAndChildren, countRecursiveChildren, getAllChildrenAndJointFramesIds, getAvailableNavigationPositions, getDisabledBlockRootFrameId, getParentOrJointParent, isContainedInFrame, removeFrameInFrameList, restoreSavedStateFrameTypes } from "@/helpers/storeMethods";
import { AppPlatform, AppVersion } from "@/main";
import initialStates from "@/store/initial-states";
import { defineStore } from "pinia";
import { generateAllFrameCommandsDefs, getAddCommandsDefs, getEditableSlotUIID, undoMaxSteps } from "@/helpers/editor";
import { DAPWrapper } from "@/helpers/partial-flashing";
import LZString from "lz-string"
import { getAPIItemTextualDescriptions } from "@/helpers/microbitAPIDiscovery";

let initialState: StateAppObject = initialStates["initialPythonState"];
/* IFTRUE_isMicrobit */
initialState = initialStates["initialMicrobitState"];
/* FITRUE_isMicrobit */

export const useStore = defineStore("app", {
    state: () => {
        return {
            /** these flags need checking when a build is done **/
            debugging: initialState.debugging,

            // Flag used to keep the AC shown for debug purposes
            debugAC: false,

            showKeystroke: initialState.showKeystroke,

            frameObjects: initialState.initialState,

            nextAvailableId: initialState.nextAvailableId, 

            importContainerId: -1,

            functionDefContainerId: -2,
            /** END of flags that need checking when a build is done **/

            currentFrame: { id: -3, caretPosition: CaretPosition.body } as CurrentFrame,

            // This is an indicator of the CURRENT editable slot's initial content being edited.
            currentInitCodeValue: "", 

            // This is the selected tab index of the Commands' tab panel.
            commandsTabIndex: 0, 

            isEditing: false,

            // This flag can be used anywhere a key event should be ignored within the application
            ignoreKeyEvent: false,

            currentMessage: MessageDefinitions.NoMessage,

            preCompileErrors: [] as string[],

            diffToPreviousState: [] as ObjectPropertyDiff[][],

            diffToNextState: [] as ObjectPropertyDiff[][],
            
            // We use -100 to avoid any used id. This variable holds the id of the root copied frame.
            copiedFrameId: -100 as number,

            // This variable holds the ids of the root copied frames.
            copiedSelectionFrameIds: []  as number[],

            copiedFrames: {} as EditorFrameObjects,

            // Keeps a copy of the state when 2-steps operations are performed and we need to know the previous state (to clear after use!)
            stateBeforeChanges : {} as  {[id: string]: any}, 

            contextMenuShownId: "",

            projectName: i18n.t("appMenu.defaultProjName") as string,

            // Flag to indicate when a drag and drop (in the 2 step process) shouldn't complete. To reset at false after usage !
            ignoredDragAction: false, 

            selectedFrames: [] as number[],

            appLang: "en",

            isAppMenuOpened: false,

            acResults: {} as AcResultsWithModule,

            editableSlotViaKeyboard: {isKeyboard: false, direction: 1} as EditableSlotReachInfos, //indicates when a slot is reached via keyboard arrows, and the direction (-1 for left/up and 1 for right/down)
        
            /* The following wrapper is used for interacting with the microbit board via DAP*/
            DAPWrapper: {} as DAPWrapper,

            previousDAPWrapper: {} as DAPWrapper,
        }
    },

    getters: { 
        getFramesForParentId: (state) => (frameId: number) => {
            //Get the childrenIds of this frame and based on these return the children objects corresponding to them
            return state.frameObjects[frameId].childrenIds
                .map((a) => state.frameObjects[a])
                .filter((a) => a);
        },
        
        getContentForFrameSlot: (state) => (frameId: number, slotId: number) => {
            const retCode = state.frameObjects[frameId]?.contentDict[slotId].code;
            // return "" if it is undefined
            return retCode ?? "";
        },
        
        getJointFramesForFrameId: (state) => (frameId: number, group: string) => {
            const jointFrameIds = state.frameObjects[frameId].jointFrameIds;
            const jointFrames: FrameObject[] = [];
            jointFrameIds?.forEach((jointFrameId: number) => {
                const jointFrame = state.frameObjects[jointFrameId];
                if (jointFrame !== undefined) {
                    //this frame should have the same draggableGroup with the parent Joint frame for it to be Draggable)
                    if (group === "draggable" && jointFrame.frameType.draggableGroup === state.frameObjects[frameId].frameType.innerJointDraggableGroup) {
                        jointFrames.push(jointFrame);
                    }
                    //this frame should not have the same draggableGroup with the parent Joint frame for it to be Static (undraggable)
                    else if (group === "static" && jointFrame.frameType.draggableGroup !== state.frameObjects[frameId].frameType.innerJointDraggableGroup) {
                        jointFrames.push(jointFrame);
                    }
                    else if (group === "all") {
                        jointFrames.push(jointFrame);
                    }
                }
            });
            return jointFrames;
        },
        
        getAllowedChildren: (state) => (frameId: number) => {
            return state.frameObjects[frameId].frameType.allowChildren;
        },
        
        getAllowedJointChildren: (state) => (frameId: number) => {
            return state.frameObjects[frameId].frameType.allowJointChildren;
        },
        
        isJointFrameById: (state) => (frameId: number) => {
            return state.frameObjects[frameId].jointParentId > 0;
        },
        
        getCurrentFrameObject: (state) => {
            return state.frameObjects[state.currentFrame.id];
        },
        
        canAddFrameBelowDisabled: (state) => (frameId: number) => {
            //in this method, we check if frames can be added below the specified (disabled) frame.
            if(state.frameObjects[frameId].jointParentId > 0 ){
                //for joint frames we check that it is the last (commands are treated in addFrameCommands)
                const jointFrameIds = state.frameObjects[state.frameObjects[frameId].jointParentId].jointFrameIds;
                return (jointFrameIds.indexOf(frameId) == jointFrameIds.length - 1);
            }
            else{
                //for other frames, we just check the parent's property, except for joint root frames if they have children: they can't have more children
                if(state.frameObjects[frameId].jointFrameIds.length > 0){
                    return false;
                }
                return !state.frameObjects[state.frameObjects[frameId].parentId].isDisabled;
            }
        },
        
        getMainCodeFrameContainerId: (state) => {
            return Object.values(state.frameObjects).filter((frame: FrameObject) => frame.frameType.type === MainFramesContainerDefinition.type)[0].id;
        },
        
        getDraggableGroupById: (state) => (frameId: number) => {
            return state.frameObjects[frameId].frameType.draggableGroup;
        },
        
        getDraggableJointGroupById: (state) => (frameId: number) => {
            const frame = state.frameObjects[frameId];
            return frame.frameType.innerJointDraggableGroup;
        },
        
        isEditableFocused: (state) => (frameId: number, slotIndex: number) => {
            return state.frameObjects[frameId].contentDict[slotIndex].focused;
        },
        
        generateAvailableFrameCommands: (state) => (frameId: number, caretPosition: CaretPosition) => {
            const currentFrame  = state.frameObjects[frameId];
            const parent = state.frameObjects[currentFrame.parentId];

            // list with all potential joint children to be added
            let allowedJointChildren: string[] = [];
            // if we are on a JointFrame's context, we need to know which is this joint frame (can be different from the currentFrame)
            let focusedFrame = undefined;
            // We need the next joint of the current in order to contextualise the potential joint frames
            let nextJointChildID = -100;

            // The RULE for the JOINTS is:
            // We allow joint addition only at the end of the body

            // Two possible cases:
            // 1) If we are in an (a)EMPTY (b)BODY, of (C)SOMETHING that is a (C)JOINT frame
            // (b) and (a)
            if ( caretPosition === CaretPosition.body && currentFrame.childrenIds.length === 0 ){
                focusedFrame = currentFrame;
            }
            // 2) If we are (a)BELOW the (b)FINAL frame of (C)SOMETHING that is a (C)JOINT frame
            // (a) and (b)
            else if ( caretPosition === CaretPosition.below && [...parent.childrenIds].pop() === currentFrame.id) {
                focusedFrame = parent
            }

            //if we are in the joint context
            if(focusedFrame!==undefined) {

                // (c) -> I am either in a joint parent
                if(focusedFrame.frameType.allowJointChildren ) {
                    allowedJointChildren = [...focusedFrame.frameType.jointFrameTypes];
                    nextJointChildID = focusedFrame.jointFrameIds[0]??-100;
                }
                // (c) -> Or a joint child
                else if(focusedFrame.jointParentId>0){
                    // we get the allowed joints from our joint parent
                    allowedJointChildren = [...state.frameObjects[focusedFrame.jointParentId].frameType.jointFrameTypes];
                    const focusedIndexInJointParent = state.frameObjects[focusedFrame.jointParentId].jointFrameIds.indexOf(focusedFrame.id);
                    // get the next joint child from the parent (based on my index)
                    nextJointChildID = state.frameObjects[focusedFrame.jointParentId].jointFrameIds[focusedIndexInJointParent+1]??-100;
                }

                // If (c) was true
                if(allowedJointChildren.length>0) {

                    const uniqueJointFrameTypes = [Definitions.ElseDefinition.type,Definitions.FinallyDefinition.type];

                    // -100 means there is no next Joint Child => focused is the last
                    if(nextJointChildID === -100){
                        // If the focused Joint is a unique, we need to show the available uniques that can go after it (i.e. show FINALLY or nothing)
                        //    OR special case if we are in TRY statement: we can't show ELSE at any case
                        // else show them all
                        if(focusedFrame.frameType.type === TryDefinition.type){
                            allowedJointChildren.splice(allowedJointChildren.indexOf(ElseDefinition.type), 1); 
                        }
                        else if(uniqueJointFrameTypes.includes(focusedFrame.frameType.type)){
                            allowedJointChildren.splice(
                                0,
                                allowedJointChildren.indexOf(focusedFrame.frameType.type)+1 //delete from the beginning to the current frame type
                            );                        
                        } 
                    }
                    // on the presence of a next child
                    else{
                        const nextJointChild = state.frameObjects[nextJointChildID];          

                        // if the next is not unique, show all non-uniques ()
                        if(!uniqueJointFrameTypes.includes(nextJointChild.frameType.type)) {
                            allowedJointChildren = allowedJointChildren.filter( (x) => !uniqueJointFrameTypes.includes(x)) // difference
                        }
                        // else if the next AND the current are uniques (i.e. I am in an ELSE and there is a FINALLY after me)
                        else if(uniqueJointFrameTypes.includes(focusedFrame.frameType.type)) {
                            allowedJointChildren = [];
                        }
                        // In the case where only the next is unique
                        // show all but the available up to before the existing unique (i.e. at most up to ELSE)
                        // Special case: if we are in a TRY statement (and since we passed the condition above, next is unique (i.e. FINALLY)) --> we can't show ELSE
                        else {
                            if(focusedFrame.frameType.type === TryDefinition.type){
                                allowedJointChildren.splice(
                                    allowedJointChildren.indexOf(ElseDefinition.type),
                                    1
                                );
                            }
                            else{
                                allowedJointChildren.splice(
                                    allowedJointChildren.indexOf(nextJointChild.frameType.type),
                                    allowedJointChildren.length - allowedJointChildren.indexOf(nextJointChild.frameType.type) //delete from the index of the nextJointChild to the end
                                );
                            }
                        }
                    }
                }
            }

            //forbidden frames are those of the current frame's type if caret is body, those of the parent/joint root otherwise
            const forbiddenTypes = (caretPosition === CaretPosition.body) ? 
                [...currentFrame.frameType.forbiddenChildrenTypes] :
                ((currentFrame.jointParentId > 0) ? [...state.frameObjects[currentFrame.jointParentId].frameType.forbiddenChildrenTypes] : [...state.frameObjects[currentFrame.parentId].frameType.forbiddenChildrenTypes]);

            //as there is no static rule for showing the "break" or "continue" statements,
            //we need to check if the current frame is within a "for" or a "while" loop.
            //if we are not into a nested for/while --> we add "break" and "continue" in the forbidden frames list
            const canShowLoopBreakers = isContainedInFrame(state. frameObjects, frameId,caretPosition, [ForDefinition.type, WhileDefinition.type]);
            if(!canShowLoopBreakers){
                //by default, "break" and "continue" are NOT forbidden to any frame which can host children frames,
                //so if we cannot show "break" and "continue" : we add them from the list of forbidden
                forbiddenTypes.splice(
                    0,
                    0,
                    ...[BreakDefinition.type, ContinueDefinition.type]
                );
            }

            //"return" and "global" statements can't be added when in the main container frame
            //We don't forbid them to be in the main container, but we don't provide a way to add them directly.
            //They can be added when in the function definition container though.
            const canShowReturnStatement = isContainedInFrame(state. frameObjects, frameId,caretPosition, [FuncDefContainerDefinition.type]);
            if(!canShowReturnStatement){
                //by default, "break" and "continue" are NOT forbidden to any frame which can host children frames,
                //so if we cannot show "break" and "continue" : we add them from the list of forbidden
                forbiddenTypes.splice(
                    0,
                    0,
                    ...[ReturnDefinition.type, GlobalDefinition.type]
                );
            }
            const addCommandsDefs = getAddCommandsDefs();
            const filteredCommands: {[id: string]: AddFrameCommandDef[]} = JSON.parse(JSON.stringify(addCommandsDefs));
            const allowedJointCommand: {[id: string]: AddFrameCommandDef[]} = {}

            // for each shortcut we get a list of the corresponding commands
            for (const frameShortcut in addCommandsDefs) {

                // keep all the allowedJointChildren with their commands (as they may be deleted in the next step
                allowedJointCommand[frameShortcut] = filteredCommands[frameShortcut].filter( (x) => allowedJointChildren.includes(x.type.type))
                
                // filtered = filtered - forbidden - allJoints
                // all joints need to be removed here as they may overlap with the forbiden and the allowed ones. Allowed will be added on the next step
                filteredCommands[frameShortcut] = filteredCommands[frameShortcut].filter( (x) => !forbiddenTypes.includes(x.type.type) && !x.type.isJointFrame)

                // filtered = filtered + allowed
                filteredCommands[frameShortcut].push(...allowedJointCommand[frameShortcut])
                
                // remove any empty commands (forbidden) for this shortcut
                if( filteredCommands[frameShortcut].length === 0){
                    Vue.delete(
                        filteredCommands,
                        frameShortcut
                    );                    
                }
            }
            
            return filteredCommands;
        },
        
        isCurrentFrameLabelShown: (state) => (frameId: number, slotIndex: number) => {
            const frame = state.frameObjects[frameId]

            // if it is an optional Label (as there are optional slots WHITOUT optional labels [e.g. functional params[) and it is not a function call
            if(frame.frameType.labels[slotIndex]?.optionalLabel === true && frame.frameType.type !== EmptyDefinition.type){

                // show the label IFF:
                // 1) we are focused on this frame
                // 2) it has code in it
                // 3) We are editing this frame
                return state.currentFrame.id === frameId || 
                        frame.contentDict[slotIndex].code !== "" || 
                        (state.isEditing && state.currentFrame.id === frameId);
            }

            //not optional label --> it's never hidden so we don't need to check any flag
            return true;
        },
        
        isErroneousSlot: (state) => (frameId: number, slotIndex: number) => {
            return state.frameObjects[frameId].contentDict[slotIndex].error !== "";
        },
        
        getErrorForSlot: (state) => (frameId: number, slotIndex: number) => {
            return state.frameObjects[frameId].contentDict[slotIndex].error;
        },

        getErrorHeaderForSlot: (state) => (frameId: number, slotIndex: number) => {
            return (state.frameObjects[frameId].contentDict[slotIndex].errorTitle) 
                ? state.frameObjects[frameId].contentDict[slotIndex].errorTitle as string
                : i18n.t("errorMessage.errorTitle") as string; 
        },

        preCompileErrorExists: (state) => (id: string) => {
            return state.preCompileErrors.includes(id);
        },
        
        isMessageBannerOn: (state) => {
            return state.currentMessage.type !== MessageDefinitions.NoMessage.type;
        },
        
        // Automatically checks returns index in Parent OR JointParent
        getIndexInParent: (state) => (frameId: number) => {
            const isJointFrame = state.frameObjects[frameId].frameType.isJointFrame;
            return (isJointFrame)? 
                state.frameObjects[state.frameObjects[frameId].jointParentId].jointFrameIds.indexOf(frameId):
                state.frameObjects[state.frameObjects[frameId].parentId].childrenIds.indexOf(frameId);
        },
        
        isCopiedAvailable: (state) => {
            return (state.copiedFrameId !== -100) || (state.copiedSelectionFrameIds.length > 0);
        },
        
        isPasteAllowedAtFrame() { 
            return (frameId: number, caretPos: CaretPosition) => {
                if(this.isSelectionCopied){
                    if(this.isPositionAllowsSelectedFrames(frameId, caretPos, true)) {
                        return true;
                    }  
                }
                else {
                    if(this.isPositionAllowsFrame(frameId, caretPos)) {
                        return true;
                    }
                }
    
                return false;
            }            
        },
        
        // frameToBeMovedId is an optional argument and it is used in cases where we are just checking if a 
        // frame can be moved to a position based on the copied frame type --> we are not really checking about the actual copied Frame
        isPositionAllowsFrame() {
            return (targetFrameId: number, targetCaretPosition: CaretPosition, frameToBeMovedId?: number) => {
                // Where do we get the frame from --> from copiedFrames if it is a copied frame
                // Otherwise the input frame is to be checked (e.g. for moving an else statement or duplicating an else statement -- which doesn't go anywhere).
                const sourceFrameList: EditorFrameObjects = (frameToBeMovedId === undefined) ? this.copiedFrames : this.frameObjects ;    

                frameToBeMovedId = frameToBeMovedId ?? this.copiedFrameId;

                if(frameToBeMovedId < 1){
                    return false;
                }     

                const allowedFrameTypes = this.generateAvailableFrameCommands(targetFrameId, targetCaretPosition);
                // isFrameCopied needs to be checked in the case that the original frame which was copied has been deleted.
                const copiedType: string = sourceFrameList[frameToBeMovedId].frameType.type;
            
                // for..of is used instead of foreach here, as foreach does not supports return.........
                for (const element of Object.values(allowedFrameTypes)) {
                    if (element[0].type.type === copiedType) {
                        return true;
                    }
                }

                return false;
            }
        },

        isPositionAllowsSelectedFrames(){
            return (targetFrameId: number, targetCaretPosition: CaretPosition, areFramesCopied: boolean) => {   
                const allowedFrameTypes = this.generateAvailableFrameCommands(targetFrameId, targetCaretPosition);

                const selectedFramesIds = (areFramesCopied) ? this.copiedSelectionFrameIds : this.selectedFrames;
                const sourceList = (areFramesCopied) ? this.copiedFrames : this.frameObjects;
                
                // for..of is used instead of foreach here, as foreach does not supports return.........
                for (const id of selectedFramesIds) {
                    // If one of the selected frames is not found in the allowed list, then return false
                    if(!Object.values(allowedFrameTypes).find((allowed) => allowed[0].type.type === sourceList[id].frameType.type)){
                        return false;
                    }
                }

                return true;
            }
        },

        isFrameSelected: (state) => (frameId: number) => {
            return state.selectedFrames.indexOf(frameId) > -1;
        },

        getFrameSelectionPosition: (state) => (frameId: number) => {
            const index = state.selectedFrames.indexOf(frameId);

            if( index == -1) {
                return "unselected";
            }
            else if( index == 0) {
                if( index == state.selectedFrames.length-1 ){
                    return "first-and-last";
                }
                return "first";
            }
            else  if( index == state.selectedFrames.length-1) {
                return "last";
            }
            else {
                return "middle";
            }
        },

        areAnyFramesSelected: (state) => {
            return state.selectedFrames.length > 0;
        },
        
        isUndoRedoEmpty: (state) => (action: string) => {
            return (action === "undo") ? state.diffToPreviousState.length === 0 : state.diffToNextState.length === 0;
        },

        isSelectionCopied: (state) => {
            return state.copiedSelectionFrameIds.length > 0;
        },

        isFrameVisible: (state) => (frameId: number) => {
            return state.frameObjects[frameId].isVisible;
        },

        getMultiDragPosition: (state) => (frameId: number) => {
            return state.frameObjects[frameId].multiDragPosition;
        },

        retrieveUserDefinedElements:(state) => {
            // Retrieve the user defined functions and variables.
            // We make sure we don't look up the variable/function in the current frame
            // (for example, if we are in a variable assignment, we shouldn't pick up on that variable being written)
            // the returned value is an array of UserDefinedElement objects.
            return Object.values(state.frameObjects).filter((frame: FrameObject) => (frame.id !== state.currentFrame.id 
                && (frame.frameType.type === FuncDefDefinition.type || frame.frameType.type === VarAssignDefinition.type)))
                .map((frame: FrameObject) => ({name: frame.contentDict[0].code, isFunction: frame.frameType.type === FuncDefDefinition.type}) as UserDefinedElement);
        },

        isSlotFirstVisibleInFrame:(state) => (frameId: number, slotIndex: number) => {
            // This getter checks if the given slot of a given frame is *visually* the first shown to the user
            const contentDict = Object.values(state.frameObjects[frameId].contentDict);
            return (contentDict.find((content: FrameSlotContent, index) => (index < slotIndex && content.shownLabel)) === undefined);
        },

        // Check up if the API generator can be shown, depending on the current position in the code editor (cf. details in method)
        canShowAPICodeGenerator: (state) => {
            // first check if we are in an editoble slot or at a position where the caret is shown
            const currentFrame = state.frameObjects[state.currentFrame.id];
            const slotContent = Object.entries(currentFrame.contentDict).find((entry) => entry[1].focused);
            if(slotContent){
                // we are in a slot. All slots allow the code generated by the API if they are empty, except those that never show it:
                // - var assign LHS
                // - imports
                // - function definition
                // - comment
                return slotContent[1].code.length == 0 && !((currentFrame.frameType.type === VarAssignDefinition.type && slotContent[0] === "0")
                    || currentFrame.frameType.type === ImportDefinition.type 
                    || currentFrame.frameType.type === FuncDefDefinition.type 
                    || currentFrame.frameType.type === CommentDefinition.type);
            }
            else{
                // we are at a caret position. We can always add a new method call frame as long as we're not in one of the following:
                // - imports container
                // - function definition container
                return (state.currentFrame.caretPosition == CaretPosition.body && currentFrame.id != state.importContainerId && currentFrame.id != state.functionDefContainerId) 
                    || (state.currentFrame.caretPosition == CaretPosition.below && currentFrame.parentId !== undefined && currentFrame.parentId != state.importContainerId && currentFrame.parentId != state.functionDefContainerId);        
            }
        },

        isImportFrame: (state) => (frameId: number) => {
            return state.frameObjects[frameId].frameType.isImportFrame;
        },

        isContainerCollapsed: (state) => (frameId: number) => {
            return state.frameObjects[frameId].isCollapsed ?? false;
        },
    },
    
    actions:{
        setAppLang(lang: string) {
            //set the language in the store first
            this.appLang = lang;

            //then change the UI via i18n
            i18n.locale = lang;

            //set the right app name
            document.title = i18n.t("appName") as string;

            //change the values of the container frames as they are not reactive
            Object.values(this.frameObjects).forEach((frame) => {
                switch(frame.frameType.type){
                case ImportsContainerDefinition.type:
                    Vue.set(this.frameObjects[frame.id].frameType.labels[0],"label", i18n.t("appMessage.importsContainer") as string)
                    break;
                case FuncDefContainerDefinition.type:
                    Vue.set(this.frameObjects[frame.id].frameType.labels[0],"label", i18n.t("appMessage.funcDefsContainer") as string)
                    break;
                case MainFramesContainerDefinition.type:
                    Vue.set(this.frameObjects[frame.id].frameType.labels[0],"label", i18n.t("appMessage.mainContainer") as string)
                    break;
                default:
                    break;
                }
            });

            // Change the frame command labels / details 
            generateAllFrameCommandsDefs();

            /* IFTRUE_isMicrobit */
            //change the API description content here, as we don't want to construct the textual API description every time we need it
            getAPIItemTextualDescriptions(true);
            /* FITRUE_isMicrobit */
        },

        updateStateBeforeChanges(release: boolean) {
            //if the flag release is true, we clear the current stateBeforeChanges value
            Vue.set(
                this,
                "stateBeforeChanges",
                (release) ? {} : JSON.parse(JSON.stringify(this.$state))
            );
        },

        deleteFrame(payload: {key: string; frameToDeleteId: number; deleteChildren?: boolean}) {
            //if delete is pressed
            //  case cursor is body: cursor stay here, the first child (if exits) is deleted (*)
            //  case cursor is below: cursor stay here, the next sibling (if exits) is deleted (*)
            //if backspace is pressed
            //  case current frame is Container --> do nothing, a container cannot be deleted
            //  case cursor is body: cursor needs to move one level up, and the current frame's children + all siblings replace its parent
            //  case cursor is below: cursor needs to move to bottom of previous sibling (or body of parent if first child) and the current frame (*) is deleted
            //(*) with all sub levels children

            if(payload.key=== "Delete"){
                //delete the frame and all children
                removeFrameInFrameList(
                    this.frameObjects,
                    payload.frameToDeleteId
                );
            }
            else{
                //delete the frame entirely with sub levels
                if(payload.deleteChildren === true){
                    removeFrameInFrameList(
                        this.frameObjects,
                        payload.frameToDeleteId
                    );
                }
                else{
                    //we "replace" the frame to delete by its content in its parent's location
                    //note: the content is its children and the children of its potential joint frames
                    const frameToDelete = this.frameObjects[payload.frameToDeleteId];
                    const isFrameToDeleteJointFrame = (frameToDelete.jointParentId > 0);
                    const isFrameToDeleteRootJointFrame = (frameToDelete.jointParentId === 0 && frameToDelete.frameType.jointFrameTypes.length > 0);
                    let parentIdOfFrameToDelete = frameToDelete.parentId; 
                    //if the current frame is a joint frame, we find the "parent": the root of the structure if it's the first joint, the joint before otherwise
                    if (isFrameToDeleteJointFrame) {
                        const indexOfJointFrame = this.frameObjects[frameToDelete.jointParentId].jointFrameIds.indexOf(payload.frameToDeleteId);
                        parentIdOfFrameToDelete = (indexOfJointFrame > 0) ?
                            this.frameObjects[frameToDelete.jointParentId].jointFrameIds[indexOfJointFrame - 1] :
                            this.frameObjects[payload.frameToDeleteId].jointParentId     
                    }

                    const listOfChildrenToMove = this.frameObjects[payload.frameToDeleteId].childrenIds
                    //if the frame to remove is the root of a joint frames structure, we include all the joint frames' children in the list of children to remove
                    if(isFrameToDeleteRootJointFrame){
                        this.frameObjects[payload.frameToDeleteId]
                            .jointFrameIds
                            .forEach((jointFrameId) => listOfChildrenToMove.push(...this.frameObjects[jointFrameId].childrenIds));
                    }

                    //update the new parent Id of all the children to their new parent
                    listOfChildrenToMove.forEach((childId) => this.frameObjects[childId].parentId = parentIdOfFrameToDelete);
                    //replace the frame to delete by the children in the parent frame or append them at the end (for joint frames)
                    const parentChildrenIds = this.frameObjects[parentIdOfFrameToDelete].childrenIds;
                    const indexOfFrameToReplace = (isFrameToDeleteJointFrame) ? parentChildrenIds.length : parentChildrenIds.lastIndexOf(payload.frameToDeleteId);
                    parentChildrenIds.splice(
                        indexOfFrameToReplace,
                        (isFrameToDeleteJointFrame) ? 0 : 1,
                        ...listOfChildrenToMove
                    );
                    //if the frame to delete is a joint frame, we remove it from its parent
                    if(isFrameToDeleteJointFrame){
                        this.frameObjects[this.frameObjects[payload.frameToDeleteId].jointParentId].jointFrameIds.splice(
                            this.frameObjects[this.frameObjects[payload.frameToDeleteId].jointParentId].jointFrameIds.indexOf(payload.frameToDeleteId),
                            1
                        );
                    }
                    //and finally, delete the frame
                    Vue.delete(
                        this.frameObjects,
                        payload.frameToDeleteId
                    );
                }
            }
        },

        doUpdateFramesOrder(payload: {event: any; eventParentId: number}) {
            const eventType = Object.keys(payload.event)[0];
            //If we are moving a joint frame the list to be updated is it's parents jointFrameIds list.
            const listToUpdate = (payload.event[eventType].element.jointParentId > 0 ) ?
                this.frameObjects[payload.eventParentId].jointFrameIds : 
                this.frameObjects[payload.eventParentId].childrenIds;

            if (eventType === "added") {
                // Add the id to the parent's childrenId list
                listToUpdate.splice(
                    payload.event[eventType].newIndex,
                    0,
                    payload.event[eventType].element.id
                );

                // Set the new parentId/jointParentId to the added frame
                Vue.set(
                    this.frameObjects[payload.event[eventType].element.id],
                    (payload.event[eventType].element.jointParentId === 0) ? "parentId" : "jointParentId" ,
                    payload.eventParentId
                );
            }
            else if (eventType === "moved") {
                // Delete the frameId from the old position
                listToUpdate.splice(
                    payload.event[eventType].oldIndex,
                    1
                );
                // Add it in the new position
                listToUpdate.splice(
                    payload.event[eventType].newIndex,
                    0,
                    payload.event[eventType].element.id
                );
            }
            else if (eventType === "removed") {
                // Remove the id from the parent's childrenId list
                listToUpdate.splice(
                    payload.event[eventType].oldIndex,
                    1
                ); 
            }
        },

        setEditableFocus(payload: EditableFocusPayload) {
            Vue.set(
                this.frameObjects[payload.frameId].contentDict[payload.slotId],
                "focused",
                payload.focused
            );
        },

        changeCaretWithKeyboard(key: string) {            
            const currId = this.currentFrame.id;
            const currPosition = this.currentFrame.caretPosition;

            //Turn off previous caret 
            Vue.set(
                this.frameObjects[currId],
                "caretVisibility",
                CaretPosition.none
            );

            const currentCaret: CurrentFrame = {id: currId, caretPosition: currPosition};
            const availablePositions = getAvailableNavigationPositions();
            const listOfCaretPositions = availablePositions.filter(((e)=> e.slotNumber === false));
            // Where is the current in the list
            const currentCaretIndex = listOfCaretPositions.findIndex((e) => e.id===currentCaret.id && e.caretPosition === currentCaret.caretPosition)

            const delta = (key === "ArrowDown")?1:-1;
            const nextCaret = (listOfCaretPositions[currentCaretIndex + delta]??currentCaret) as CurrentFrame;

            this.currentFrame.id = nextCaret.id;
            this.currentFrame.caretPosition = nextCaret.caretPosition;

            Vue.set(
                this.frameObjects[nextCaret.id],
                "caretVisibility",
                nextCaret.caretPosition
            );

            const nextFrameObject = this.frameObjects[nextCaret.id];
            if( "isCollapsed" in nextFrameObject ) {
                Vue.set(
                    nextFrameObject,
                    "isCollapsed",
                    false
                );
            }
            else if("isCollapsed" in this.frameObjects[nextFrameObject.parentId]){
                Vue.set(
                    this.frameObjects[nextFrameObject.parentId],
                    "isCollapsed",
                    false
                );
            }
        },

        setCurrentFrame(newCurrentFrame: CurrentFrame) {
            Vue.set(
                this.frameObjects[this.currentFrame.id],
                "caretVisibility",
                CaretPosition.none
            );

            this.currentFrame.id = newCurrentFrame.id
            this.currentFrame.caretPosition = newCurrentFrame.caretPosition;

            Vue.set(
                this.frameObjects[newCurrentFrame.id],
                "caretVisibility",
                newCurrentFrame.caretPosition
            );
        },

        setCurrentInitCodeValue(payload: {frameId: number; slotId: number}){
            this.currentInitCodeValue = this.frameObjects[payload.frameId].contentDict[payload.slotId].code;
        },

        doSetFrameEditableSlotContent(payload: EditableSlotPayload){
            Vue.set(
                this.frameObjects[payload.frameId].contentDict[payload.slotId],
                "code",
                payload.code
            );
        },

        setSlotErroneous(payload: {frameId: number; slotIndex: number; error: string, errorTitle?: string}) {
            const existingError =  this.frameObjects[payload.frameId].contentDict[payload.slotIndex].error;
            const existingErrorBits = existingError.split("\n");
            // Sometimes we need to extend the error, if more than one different errors are on the same slot
            if(!existingErrorBits.includes(payload.error)){
                const newError = (existingError === "" || payload.error === "") ? payload.error: (existingError +"\n" + payload.error);
                Vue.set(
                    this.frameObjects[payload.frameId].contentDict[payload.slotIndex],
                    "error",
                    newError
                );

                if(payload.errorTitle){
                    Vue.set(
                        this.frameObjects[payload.frameId].contentDict[payload.slotIndex],
                        "errorTitle",
                        payload.errorTitle
                    );
                }
            }           
        },

        clearAllErrors() {
            Object.keys(this.frameObjects).forEach((id: any) => {
                Object.keys(this.frameObjects[id].contentDict).forEach((slot: any) => {
                    Vue.set(
                        this.frameObjects[id].contentDict[slot],
                        "error",
                        ""
                    );
                    Vue.delete(this.frameObjects[id].contentDict[slot], "errorTitle");
                });
            });  
        },

        addPreCompileErrors(id: string) {
            if(!this.preCompileErrors.includes(id)) {
                this.preCompileErrors.push(id);
            }
        },

        removePreCompileErrors(id: string ) {
            if(this.preCompileErrors.includes(id)) {
                this.preCompileErrors.splice(this.preCompileErrors.indexOf(id),1);
            }
        },

        updateNextAvailableId() {
            this.nextAvailableId = Math.max.apply({},(Object.keys(this.frameObjects).concat(Object.keys(this.copiedFrames))).map(Number))+1;
        },
        
        doCopyFrame(frameId: number) {
            this.copiedFrameId = this.nextAvailableId;

            // If it has a JointParent, we're talking about a JointFrame
            const isJointFrame = this.frameObjects[frameId].frameType.isJointFrame;
            
            const parent = (isJointFrame) ? this.frameObjects[frameId].jointParentId : this.frameObjects[frameId].parentId;

            cloneFrameAndChildren(this.frameObjects, frameId, parent, {id: this.nextAvailableId}, this.copiedFrames);             
        },

        doCopySelection() {
            // If it has a JointParent, we're talking about a JointFrame
            const isJointFrame = this.frameObjects[this.selectedFrames[0]].frameType.isJointFrame;
            
            const parent = (isJointFrame) ? this.frameObjects[this.selectedFrames[0]].jointParentId : this.frameObjects[this.selectedFrames[0]].parentId;

            // We generate the list of frames from the selectedFrames ids
            const sourceFrameList: EditorFrameObjects = {};
            this.selectedFrames.forEach((id) => sourceFrameList[id] = this.frameObjects[id])
            
            // All the top level cloned frames need to be stored in order to then added to their new parent's list
            const topLevelCopiedFrames: number[] = [];
            let nextAvailableId = this.nextAvailableId;

            Object.values(sourceFrameList).forEach( (frame) => {
                //For each top level frame (i.e. each one on the selected list) we record its new id
                topLevelCopiedFrames.push(nextAvailableId)
                cloneFrameAndChildren(this.frameObjects, frame.id, parent, {id: nextAvailableId}, this.copiedFrames); 
                // Find the largest id form the copied and increase it by 1
                nextAvailableId = Math.max.apply({},(Object.keys(this.copiedFrames).concat(Object.keys(this.copiedFrames))).map(Number)) + 1;
            });

            Vue.set( 
                this,
                "copiedSelectionFrameIds",  
                topLevelCopiedFrames
            );

        },

        setCaretVisibility(payload: {frameId: number; caretVisibility: CaretPosition}) {
            Vue.set(
                this.frameObjects[payload.frameId],
                "caretVisibility",
                payload.caretVisibility
            );
        },

        updateState(newState: Record<string, unknown>){
            //this method complete changes the state with a new state object
            Object.keys(this.$state).forEach((property) => {
                Vue.set(
                    this,
                    property,
                    newState[property]
                );
            } );

            //undo redo is cleared
            this.diffToPreviousState.splice(0,this.diffToPreviousState.length);
            this.diffToNextState.splice(0,this.diffToNextState.length);
            
            //copied frames are cleared
            this.copiedFrameId = -100;
            Vue.set(
                this,
                "copiedFrames",
                {}
            )

            //context menu indicator is cleared
            this.contextMenuShownId = "";
        },

        saveStateChanges(payload: {previousState: Record<string, unknown>; mockCurrentCursorFocus?: EditableFocusPayload}) {
            //Saves the state changes in diffPreviousState.
            //However it is not just doing it without checking up things: because of the caret issues we need to generate a mock change of currentFrame.Id etc 
            //if there is no difference and the action may rely on the cursor position.
            //We use a "mock" change to force a difference of cursor between state and previous state, and revert to actual value after change is backed up.

            let backupCurrentFrame = {} as CurrentFrame;
            let backupCurrentFocus = false;
            let backupCurrentFrameVisibility = CaretPosition.none;
            if(payload.mockCurrentCursorFocus !== undefined){
                //before saving the state, we "mock" a change of current state ID to a dummy value
                //so that a difference is raised --> if users change the cursor, before doing undo,
                //the cursor will correctly be at the right location. Same with focused.
                backupCurrentFrame = this.currentFrame;
                backupCurrentFocus = this.frameObjects[payload.mockCurrentCursorFocus.frameId].contentDict[payload.mockCurrentCursorFocus.slotId].focused;
                backupCurrentFrameVisibility = this.frameObjects[this.currentFrame.id].caretVisibility;
                this.frameObjects[payload.mockCurrentCursorFocus.frameId].contentDict[payload.mockCurrentCursorFocus.slotId].focused = false;
                this.currentFrame = {id: 0, caretPosition: CaretPosition.none};
                this.frameObjects[payload.mockCurrentCursorFocus.frameId].caretVisibility = CaretPosition.none;
            }
           

            this.diffToPreviousState.push(getObjectPropertiesDifferences(this.$state, payload.previousState));
            //don't exceed the maximum of undo steps allowed
            if(this.diffToPreviousState.length > undoMaxSteps) {
                this.diffToPreviousState.splice(
                    0,
                    1
                );
            }
            //we clear the diffToNextState content as we are now starting a new sequence of actions
            this.diffToNextState.splice(
                0,
                this.diffToNextState.length
            );

            if(payload.mockCurrentCursorFocus !== undefined){
                //revert the mock changes in the state
                this.frameObjects[payload.mockCurrentCursorFocus.frameId].contentDict[payload.mockCurrentCursorFocus.slotId].focused = backupCurrentFocus;
                this.currentFrame = backupCurrentFrame;
                this.frameObjects[backupCurrentFrame.id].caretVisibility = backupCurrentFrameVisibility;
            }
        },

        applyStateUndoRedoChanges(isUndo: boolean){
            //flags for performing a change of current caret
            let changeCaret = false;
            let newCaretId = 0;
            const oldCaretId = this.currentFrame.id;

            //performing the change if there is any change recorded in the state
            let changeList = [] as ObjectPropertyDiff[];
            if(isUndo) {
                changeList = this.diffToPreviousState.pop()??[];
            }
            else {
                changeList = this.diffToNextState.pop()??[];
            }

            const stateBeforeChanges = JSON.parse(JSON.stringify(this.$state));
            if(changeList.length > 0){
                //this flag stores the arrays that need to be "cleaned" (i.e., removing the null elements)
                const arraysToClean = [] as {[id: string]: any}[];                
                
                //if the value in the changes isn't "null" --> replaced/add, otherwise, delete.
                changeList.forEach((changeEntry: ObjectPropertyDiff) => {
                    //we reconstruct what in the state should be changed based on the difference path
                    const stateParts = changeEntry.propertyPathWithArrayFlag.split(".");
                    const property = stateParts[stateParts.length -1];
                    stateParts.pop();
                    let statePartToChange = this as {[id: string]: any};
                    let lastPartIsArray;
                    stateParts.forEach((partWithArrayFlag) => {
                        //intermediate parts have a flag suffix indicating if the part is an array or not
                        const part = partWithArrayFlag.substring(0, partWithArrayFlag.lastIndexOf("_"));
                        const isArrayPart = partWithArrayFlag.substring(partWithArrayFlag.lastIndexOf("_") + 1) === "true";
                        lastPartIsArray = isArrayPart;
                        //if a part doesn't exist, we create it with an empty object value
                        if(statePartToChange[part] === undefined){
                            Vue.set(
                                statePartToChange,
                                part,
                                (isArrayPart) ? [] : {}
                            );
                        }
                        statePartToChange = statePartToChange[part];
                    });

                    // Now we update the property value :
                    // - For arrays, we replace the element at the index n no matter if it's null or not
                    //   because deletion would offset the indexing during the loop, so we will clean the array later.
                    // - For objects, we check if the element is null: if so, it's fine to remove it directly
                    if(lastPartIsArray || !lastPartIsArray && changeEntry.value != null){
                        Vue.set(
                            statePartToChange,
                            property,
                            changeEntry.value
                        );

                        //if we update a current frame cursor, we make sure it is properly set
                        if(statePartToChange === this.currentFrame && property==="id"){
                            changeCaret = true;
                            newCaretId = changeEntry.value;
                        }

                        //if we "delete" something in an array, flag this array for clearning
                        if(lastPartIsArray && changeEntry.value===null && arraysToClean.indexOf(statePartToChange) === -1){
                            arraysToClean.push(statePartToChange);
                        }
                    }
                    else{
                        Vue.delete(
                            statePartToChange,
                            property
                        );                 
                    }
                });

                //clean arrays that need cleaning
                arraysToClean.forEach((arrayToClean) => {
                    for(let arrayIndex = arrayToClean.length; arrayIndex >=0; arrayIndex--){
                        if(arrayToClean[arrayIndex] === null){
                            Vue.delete(
                                arrayToClean,
                                arrayIndex
                            );
                        }
                    }
                });
             
                //if we notified a change of current caret, we make sure it makes correctly displayed 
                if(changeCaret){
                    //if the frame where the previous state of the caret was notified still exists, we set its caret to "none"
                    if(getAvailableNavigationPositions().map((e)=>e.id).includes(oldCaretId) && this.frameObjects[oldCaretId]){
                        Vue.set(
                            this.frameObjects[oldCaretId],
                            "caretVisibility",
                            CaretPosition.none
                        );
                    }
        
                    this.currentFrame.caretPosition = this.frameObjects[newCaretId].caretVisibility;
                }

                //finally, if there is a change on an editable slot, we trigger an error check for that slot/slot context
                //to make sure that the update on the editable slot is coherent with errors shown
                //If a change has something related to an editable slot content, we do an error check there
                const checkErrorChangeEntry: ObjectPropertyDiff|undefined = changeList.find((changeEntry: ObjectPropertyDiff) => (changeEntry.propertyPathWithArrayFlag.match(/\.contentDict_false\.\d*_false\.code$/)?.length??0) > 0);
                if(checkErrorChangeEntry){
                    //retrieve the elements we need to check an error regarding that slot
                    const changePath = checkErrorChangeEntry.propertyPathWithArrayFlag;
                    let indexOfId = "frameObjects_false.".length;
                    const frameId = parseInt(changePath.substr(indexOfId,changePath.indexOf("_",indexOfId)-indexOfId));
                    indexOfId = changePath.indexOf(".contentDict_false.") + ".contentDict_false.".length; 
                    const slotId = parseInt(changePath.substr(indexOfId,changePath.indexOf("_",indexOfId)-indexOfId));
                    const code = checkErrorChangeEntry.value; 
                    //now check the errors
                    checkCodeErrors(frameId, slotId, code);
                }

                //keep the arrays of changes in sync with undo/redo sequences
                const stateDifferences = getObjectPropertiesDifferences(this.$state, stateBeforeChanges);
                if(isUndo){
                    this.diffToNextState.push(stateDifferences);
                }
                else{
                    this.diffToPreviousState.push(stateDifferences);        
                }
            }
        },  
        
        doChangeDisableFrame(payload: {frameId: number; isDisabling: boolean; ignoreEnableFromRoot?: boolean}) {
            //if we enable, we may need to use the root frame ID instead of the frame ID where the menu has been invocked
            //because enabling a frame enables all the frames for that disabled "block" (i.e. the top disabled frame and its children/joint frames)
            const rootFrameID = (payload.isDisabling || (payload.ignoreEnableFromRoot??false)) ? payload.frameId : getDisabledBlockRootFrameId(this.frameObjects, payload.frameId);

            //When we disable or enable a frame, we also disable/enable all the sublevels (children and joint frames)
            const allFrameIds = [rootFrameID];
            allFrameIds.push(...getAllChildrenAndJointFramesIds(this.frameObjects, rootFrameID));
            allFrameIds.forEach((frameId) => {
                Vue.set(
                    this.frameObjects[frameId],
                    "isDisabled",
                    payload.isDisabling
                );

                //if disabling [resp. enabling], we also need to remove [resp. add] potential errors of empty editable slots
                if(payload.isDisabling){
                    Object.keys(this.frameObjects[frameId].contentDict).forEach((slotIndex: string) => {
                        Vue.set(
                            this.frameObjects[frameId].contentDict[parseInt(slotIndex)],
                            "error",
                            ""
                        );
                        Vue.delete(this.frameObjects[frameId].contentDict[parseInt(slotIndex)], "errorTitle");

                        const uiid = getEditableSlotUIID(frameId, Number.parseInt(slotIndex));
                        if(this.preCompileErrors.includes(uiid)) {
                            this.preCompileErrors.splice(this.preCompileErrors.indexOf(uiid),1);
                        }
                    });
                } 
                else{
                    Object.keys(this.frameObjects[frameId].contentDict).forEach((slotIndex: string) => {
                        const slotIndexNber = Number.parseInt(slotIndex);
                        checkCodeErrors(frameId, slotIndexNber, this.frameObjects[frameId].contentDict[slotIndexNber].code);
                    });
                }                 
            });
        },

        selectDeselectFrame(payload: {frameId: number; direction: string}) {
            const indexOfFrame = this.selectedFrames.indexOf(payload.frameId)
            // if it exists remove it
            if(indexOfFrame > -1) {
                this.selectedFrames.splice(indexOfFrame,1);
            }
            // else it may be added
            else { 
                this.selectedFrames.splice((payload.direction === "up") ? 0 : this.selectedFrames.length, 0, payload.frameId);
            }
        },

        unselectAllFrames() {
            this.selectedFrames.splice(0,this.selectedFrames.length);
        },

        flushCopiedFrames(){
            Vue.set(
                this,
                "copiedFrames",
                {}
            );

            this.copiedFrameId = -100;

            Vue.set(
                this,
                "copiedSelectionFrameIds",
                []
            );
        },

        makeSelectedFramesVisible(){
            this.selectedFrames.forEach((id) =>
                Vue.set(
                    this.frameObjects[id],
                    "isVisible",
                    true
                ));
        },

        removeMultiDragStyling() {
            this.selectedFrames.forEach((id) => {
                Vue.set(
                    this.frameObjects[id],
                    "multiDragPosition",
                    ""
                );
            });
        },
        
        setCollapseStatusContainer(payload: {frameId: number; isCollapsed: boolean}) {
            Vue.set(
                this.frameObjects[payload.frameId],
                "isCollapsed",
                payload.isCollapsed
            );
        },


        /******************** OLD ACTIONS ********** */
        updateFramesOrder(payload: {event: any; eventParentId: number}) {
            if(this.ignoredDragAction){
                //if the action should be ignore, just return and reset the flag
                this.ignoredDragAction = false;
                return;
            }

            this.unselectAllFrames();

            const eventType = Object.keys(payload.event)[0];

            //before the adding or at the moving step, we make a backup of the state to be used by undo/redo and inside the mutation method updateFramesOrder()
            if(eventType !== "removed"){
                this.updateStateBeforeChanges(false);
            }
            
            const isJointFrame = this.isJointFrameById(payload.event[eventType].element.id);

            const position: CaretPosition = (isJointFrame)?
                CaretPosition.below:
                CaretPosition.body;

            // Even in the same draggable group, some JointFrames cannot be moved (i.e. an elif below an else)
            // That should be checked both ways as for example if you move an `else` above an elif, it may be
            // valid, as the if accepts else there, but the elif cannot go below the else.
            // getIfPositionAllowsFrame() is used as it checks if a frame can be landed on a position     
            // succeedingFrame is the next frame (if it exists) above which we are adding
            const succeedingFrame = this.frameObjects[payload.eventParentId].jointFrameIds[payload.event[eventType].newIndex];   
            const jointFrameIds = this.frameObjects[payload.eventParentId].jointFrameIds;
            if(eventType !== "removed") {
                // EXAMPLE: Moving frame `A` above Frame `B`
                // IF `A` cannot be moved on this position 
                //                OR
                // IF `A` is jointFrame and there IS a frame `B` where I am moving `A` at
                //     on TRUE ==> Check if `B` CANNOT be placed below `A` / CANNOT be the trailing joint frame
                //     on FALSE ==> We don't care about this situation
                const jointFrameCase = (isJointFrame && jointFrameIds.length > 0)
                    ? (succeedingFrame !== undefined)
                        ? !this.isPositionAllowsFrame(payload.event[eventType].element.id, CaretPosition.below, succeedingFrame)
                        : !this.isPositionAllowsFrame(payload.event[eventType].element.id, CaretPosition.below, jointFrameIds[jointFrameIds.length - 1])
                    : false;

                if((!isJointFrame && !this.isPositionAllowsFrame(payload.eventParentId, position, payload.event[eventType].element.id)) || jointFrameCase) {       
                    //in the case of a 2 step move (when moving from one group to another) we set the flag to ignore the DnD changes
                    if(eventType === "added"){
                        this.ignoredDragAction = true;
                    }

                    //alert the user about a forbidden move
                    this.currentMessage = MessageDefinitions.ForbiddenFrameMove;
    
                    //don't leave the message for ever
                    setTimeout(() => this.currentMessage = MessageDefinitions.NoMessage, 3000);         
                    return;
                }
            }

            this.doUpdateFramesOrder(payload);

            //after the removing or at the moving step, we use the backup of the state for setting "isDisabled", prepare for undo/redo and clear the backup off
            if(eventType !== "added"){
                // Set the right value for "isDisabled"
                const srcFrameId = payload.event[eventType].element.id as number;
                const destContainerId = (this.frameObjects[srcFrameId].jointParentId > 0)
                    ? this.frameObjects[srcFrameId].jointParentId
                    : this.frameObjects[srcFrameId].parentId;
                const changeDisableInfo = checkDisabledStatusOfMovingFrame(this.stateBeforeChanges.frameObjects, srcFrameId, destContainerId);
                if(changeDisableInfo.changeDisableProp && changeDisableInfo.newBoolPropVal !== undefined){
                    this.doChangeDisableFrame({frameId: srcFrameId, isDisabling: changeDisableInfo.newBoolPropVal, ignoreEnableFromRoot: true});
                }    

                //save the state changes for undo/redo
                this.saveStateChanges({                   
                    previousState: this.stateBeforeChanges,
                });

                //clear the stateBeforeChanges flag off
                this.updateStateBeforeChanges(true);
            }
        },

        async setFrameEditableSlotContent(payload: EditableSlotPayload) {
            //This action is called EVERY time a unitary change is made on the editable slot.
            //We save changes at the entire slot level: therefore, we need to remove the last
            //previous state to replace it with the difference between the state even before and now;            
            let stateBeforeChanges = {};
            if(!payload.isFirstChange){
                this.diffToPreviousState.pop();
                this.frameObjects[payload.frameId].contentDict[payload.slotId].code = payload.initCode;  
            }

            //save the previous state
            stateBeforeChanges = JSON.parse(JSON.stringify(this.$state));

            this.doSetFrameEditableSlotContent(payload);

            //save state changes
            this.saveStateChanges({
                previousState: stateBeforeChanges,
                mockCurrentCursorFocus: {
                    frameId: payload.frameId,
                    slotId: payload.slotId,
                    focused: true,
                },
            });
        },

        updateErrorsOnSlotValidation(payload: EditableSlotPayload) {  
            this.isEditing = false;

            if(this.frameObjects[payload.frameId]){
                this.setEditableFocus(
                    {
                        frameId: payload.frameId,
                        slotId: payload.slotId,
                        focused: false,
                    }
                );
                
                // When we leave an editable slot, we explicitely select the add frames tab in the Commands panel
                this.commandsTabIndex = 0; //0 is the index of the add frame tab

                this.setCurrentInitCodeValue(
                    {
                        frameId: payload.frameId,
                        slotId: payload.slotId,
                    }
                );       
                
                // Now we check errors in relation with this code update
                checkCodeErrors(payload.frameId, payload.slotId, payload.code);
            }
        },

        setFocusEditableSlot(payload: {frameId: number; slotId: number; caretPosition: CaretPosition}){            
            this.setCurrentInitCodeValue(
                {
                    frameId: payload.frameId,
                    slotId: payload.slotId,
                }
            );
            
            this.isEditing = true;

            //First set the curretFrame to this frame
            this.setCurrentFrame(
                {
                    id: payload.frameId,
                    caretPosition: payload.caretPosition,
                }
            );
            //Then store which editable has the focus
            this.setEditableFocus(
                {
                    frameId: payload.frameId,
                    slotId: payload.slotId,
                    focused: true,
                }
            );   

            // When we enter an editable slot, we explicitely select the API discovery tab in the Commands panel
            this.commandsTabIndex = 1; //1 is the index of the API discovery tab
        
            this.unselectAllFrames();
        },

        undoRedo(isUndo: boolean) {
            //check if the undo/redo list is empty BEFORE doing any action
            const isEmptyList = (isUndo) ? this.diffToPreviousState.length == 0 : this.diffToNextState.length == 0;
            
            if(isEmptyList){
                //no undo or redo can performed: inform the user on a temporary message
                this.currentMessage = (isUndo) ? MessageDefinitions.NoUndo : MessageDefinitions.NoRedo;

                //don't leave the message for ever
                setTimeout(() => this.currentMessage = MessageDefinitions.NoMessage, 2000);
            }
            else{
                //a undo/redo can be performed: do the action
                this.applyStateUndoRedoChanges(isUndo);
            }

            this.unselectAllFrames();
        },

        changeCaretPosition(key: string) {
            // When the caret is being moved, we explicitely select the add frames tab in the Commands panel
            this.commandsTabIndex = 0; //0 is the index of the add frame tab

            this.changeCaretWithKeyboard(key);
            
            this.unselectAllFrames();
        },

        async addFrameWithCommand(frame: FramesDefinitions) {
            const stateBeforeChanges = JSON.parse(JSON.stringify(this.$state));
            const currentFrame = this.frameObjects[this.currentFrame.id];
            const addingJointFrame = frame.isJointFrame;

            // find parent id 
            let parentId = 0
            let listToUpdate: number[] = [];
            let indexToAdd = 0;

            // The frame by which we have to contextualise the addition
            // current frame by default (on caret==body)
            let  focusedFrame: FrameObject = currentFrame

            if(this.currentFrame.caretPosition === CaretPosition.below) {
                focusedFrame = this.frameObjects[currentFrame.parentId]
            }

            if(addingJointFrame){
                // if the focusedFrame allows for joint children
                // Add it in index 0 on the focusedFrame's joint list
                if(focusedFrame.frameType.allowJointChildren) {
                    parentId = focusedFrame.id
                    listToUpdate = focusedFrame.jointFrameIds
                }
                // else the focusedFrame is a joint child (e.g. elif)
                // thus we need to take the the focusedFrame's joint parent (e.g. if) and
                // put the frame below our focusedFrame joint frame
                else {
                    parentId = focusedFrame.jointParentId
                    listToUpdate = this.frameObjects[focusedFrame.jointParentId].jointFrameIds
                    indexToAdd = listToUpdate.indexOf(focusedFrame.id) +1 //id
                }
            }
            // else -not joint- simply add it to the focusedFrame's parent, below the focusedFrame
            else {
                parentId = focusedFrame.id
                listToUpdate = focusedFrame.childrenIds
                indexToAdd = listToUpdate.indexOf(currentFrame.id) +1 // for the case that we are on the body, indexOf is -1 so result = 0
            } 

            // construct the new Frame object to be added
            const newFrame: FrameObject = {
                ...JSON.parse(JSON.stringify(EmptyFrameObject)),
                frameType: frame,
                id: this.nextAvailableId++,
                parentId: addingJointFrame ? 0 : parentId, // Despite we calculated parentID earlier, it may not be used
                jointParentId: addingJointFrame ? parentId : 0,
                contentDict:
                    //find each editable slot and create an empty & unfocused entry for it
                    //optional labels are not visible by default, not optional labels are visible by default
                    frame.labels.filter((el)=> el.slot).reduce(
                        (acc, cur, idx) => ({ 
                            ...acc, 
                            [idx]: {code: "", focused: false, error: "", shownLabel:(!cur?.optionalLabel ?? true)},
                        }),
                        {}
                    ),
            };

            // Add the frame id to its parent's childrenIds list
            listToUpdate.splice(
                indexToAdd,
                0,
                newFrame.id
            );

            // Add the new frame to the list
            // "Vue.set" is used as Vue cannot catch the change by doing : state.frameObjects[fobj.id] = fobj
            Vue.set(
                this.frameObjects,
                newFrame.id,
                newFrame
            );
        
            // As the new frame isn't yet added to the DOM, we need a list to store its navigational positions,
            // which will then be merged to the existing caret positions
            const newFramesCaretPositions: NavigationPosition[] = [];
            
            //first add the slot numbers
            Object.values(newFrame.contentDict).forEach( (element,index) => {
                if(element.shownLabel){
                    newFramesCaretPositions.push({id: newFrame.id, caretPosition:false, slotNumber: index})
                }
            });
      
      
            //now add the caret positions
            if( newFrame.frameType.allowChildren ){
                newFramesCaretPositions.push({ id: newFrame.id, caretPosition: CaretPosition.body, slotNumber: false});
            }
            if( !addingJointFrame ){
                newFramesCaretPositions.push({ id: newFrame.id, caretPosition: CaretPosition.below, slotNumber: false});
            }
            const availablePositions = getAvailableNavigationPositions();
            const indexOfCurrent = availablePositions.findIndex((e) => e.id===this.currentFrame.id && e.caretPosition === this.currentFrame.caretPosition)
            
            // the old positions, with the new ones added at the right place
            // done here as we cannot splice while giving it as input
            availablePositions.splice(indexOfCurrent+1,0,...newFramesCaretPositions)

            //"move" the caret along, using the newly computed positions
            await this.leftRightKey(
                {
                    key: "ArrowRight",
                    availablePositions: availablePositions,
                }
            ).then(
                () => 
                    //save state changes
                    this.saveStateChanges(
                        {                 
                            previousState: stateBeforeChanges,
                        }
                    )
            );
            
            this.unselectAllFrames();
        },

        deleteFrames(key: string){
            const stateBeforeChanges = JSON.parse(JSON.stringify(this.$state));

            // we remove the editable slots from the available positions
            let availablePositions = getAvailableNavigationPositions();
            availablePositions = availablePositions.filter((e) => e.slotNumber === false);

            let showDeleteMessage = false;

            //we create a list of frames to delete that is either the elements of a selection OR the current frame's position
            let framesIdToDelete = [this.currentFrame.id];

            //If a selection is deleted, we don't distinguish between "del" and "backspace": 
            //We move the caret at the last element of the selection, and perform "backspace" for each element of the selection
            if(this.selectedFrames.length > 0){
                if(this.selectedFrames[this.selectedFrames.length-1] !== this.currentFrame.id){
                    this.setCurrentFrame(
                        {
                            id: this.selectedFrames[this.selectedFrames.length-1], 
                            caretPosition: CaretPosition.below,
                        }
                    );
                }
                key = "Backspace";
                framesIdToDelete = this.selectedFrames.reverse();
                //this flag to show the delete message is set on a per frame deletion basis,
                //but here we could have 3+ single frames delete, so we need to also check to selection length.
                showDeleteMessage = this.selectedFrames.length > 3;
            }
            
            framesIdToDelete.forEach((currentFrameId) => {
                //if delete is pressed
                //  case cursor is body: cursor stay here, the first child (if exits) is deleted (*)
                //  case cursor is below: cursor stay here, the next sibling (if exits) is deleted (*)
                //if backspace is pressed
                //  case current frame is Container --> do nothing, a container cannot be deleted
                //  case cursor is body: cursor needs to move one level up, and the current frame's children + all siblings replace its parent (except for function definitions frames)
                //  case cursor is below: cursor needs to move to bottom of previous sibling (or body of parent if first child) and the current frame (*) is deleted
                //(*) with all sub levels children

                const currentFrame = this.frameObjects[currentFrameId];

                let frameToDelete: NavigationPosition = {id:-100};
                let deleteChildren = false;

                if(key === "Delete"){
                    
                    // Where the current sits in the available positions
                    const indexOfCurrentInAvailables = availablePositions.findIndex((e)=> e.id === currentFrame.id && e.caretPosition === this.currentFrame.caretPosition);
                    // the "next" position of the current
                    frameToDelete = availablePositions[indexOfCurrentInAvailables+1]??{id:-100}
                    
                    // The only time to prevent deletion with 'delete' is when next position is a joint root's below OR a method declaration bellow
                    if((this.frameObjects[frameToDelete.id]?.frameType.allowJointChildren  || this.frameObjects[frameToDelete.id]?.frameType.type === FuncDefDefinition.type)
                         && frameToDelete.caretPosition === CaretPosition.below){
                        frameToDelete.id = -100
                    }
                }
                else {
                    if (currentFrame.id > 0) {
                        if(this.currentFrame.caretPosition === CaretPosition.body ){
                            //we just make sure the frame to delete isn't a function definition frame:
                            //we can't delete a function def frame with backspace in its body (unless empty) because it will result
                            //in its content put directly into the function defs container. So we just alert the users.
                            if(currentFrame.childrenIds.length === 0 || currentFrame.frameType.type !== FuncDefDefinition.type){
                                //just move the cursor one level up
                                this.changeCaretWithKeyboard(key);
                            }
                            else{
                                //just show the user a message and do nothing else
                                this.currentMessage = MessageDefinitions.FunctionFrameCantDelete;
                
                                //don't leave the message for ever
                                setTimeout(() => this.currentMessage = MessageDefinitions.NoMessage, 7000);
                                return;
                            }
                        }
                        else{
                            const newCurrent = (availablePositions[availablePositions.findIndex((e)=> e.id===currentFrame.id)-1]??this.currentFrame) as CurrentFrame
                            this.setCurrentFrame({id: newCurrent.id, caretPosition: newCurrent.caretPosition});
                            deleteChildren = true;
                        }
                        frameToDelete.id = currentFrame.id;
                    }
                }

                //Delete the frame if a frame to delete has been found
                if(frameToDelete.id > 0){
                    //before actually deleting the frame(s), we check if the user should be notified of a large deletion
                    if(countRecursiveChildren(this.frameObjects, frameToDelete.id, 3) >= 3){
                        showDeleteMessage = true;
                    }

                    this.deleteFrame(
                        {
                            key:key,
                            frameToDeleteId: frameToDelete.id,  
                            deleteChildren: deleteChildren,
                        }
                    );
                }  
            });

            //clear the selection of frames
            this.unselectAllFrames();
                       
            //save state changes
            this.saveStateChanges(
                {
                    previousState: stateBeforeChanges,
                }
            );

            //we show the message of large deletion after saving state changes as this is not to be notified.
            if(showDeleteMessage){
                this.currentMessage = MessageDefinitions.LargeDeletion;

                //don't leave the message for ever
                setTimeout(() => this.currentMessage = MessageDefinitions.NoMessage, 7000);
            }
        },
        
        deleteFrameFromSlot(frameId: number){            
            // Before we delete the frame, we need to "invalidate" the key events: as this action (deleteFrameFromSlot) is triggered on a key down event, 
            // when the key (backspace) is released, the key up event is fired, but since the frame is deleted, 
            // the event is caught at the window level (and since we are no more in editing mode, the deletion method is called again). So we invalidate the 
            // key event momently so that this window key up event is ignored.
            // Furthermore, we make sure that the frame hasn't been already deleted: in case a long press, we don't want to have many deletion
            // triggered from "stacked" calls to this method
            if(this.frameObjects[frameId]){
                this.ignoreKeyEvent = true;
                this.deleteFrames("Backspace");  
            }
        },

        toggleCaret(newCurrent: CurrentFrame) {
            this.setCurrentFrame(newCurrent);
            
            this.unselectAllFrames();
        },

        async leftRightKey(payload: {key: string, availablePositions?: NavigationPosition[]}) {

            //  used for moving index up (+1) or down (-1)
            const directionDown = payload.key === "ArrowRight" || payload.key === "Enter";
            const directionDelta = (directionDown)?+1:-1;
            // if the available positions are not passed as argument, we compute them from the DOM
            const availablePositions = payload.availablePositions??getAvailableNavigationPositions();
            let currentFramePosition;

            if (this.isEditing){ 
                const posOfCurSlot = Object.entries(this.frameObjects[this.currentFrame.id].contentDict).findIndex((slot) => slot[1].focused);
                currentFramePosition = availablePositions.findIndex( (e) => e.slotNumber === posOfCurSlot && e.id === this.currentFrame.id); 
            }
            else {
                currentFramePosition = availablePositions.findIndex( (e) => e.caretPosition === this.currentFrame.caretPosition && e.id === this.currentFrame.id); 
            }
            
            const nextPosition = (availablePositions[currentFramePosition+directionDelta]??availablePositions[currentFramePosition])                        

            // irrespective to where we are going to, we need to make sure to hide current caret
            Vue.set(
                this.frameObjects[this.currentFrame.id],
                "caretVisibility",
                CaretPosition.none
            );

            // If next position is an editable slot
            if( nextPosition.slotNumber !== false) {
                this.isEditing = true;
                const slotReachInfos: EditableSlotReachInfos = {isKeyboard: true, direction: directionDelta};
                this.editableSlotViaKeyboard = slotReachInfos;

                this.setEditableFocus(
                    {
                        frameId: nextPosition.id,
                        slotId: (nextPosition.slotNumber ?? -1),
                        focused: true,
                    }
                );
            }
            else {
                // else we set editFlag to false as we are moving to a caret position
                this.isEditing = false;

                Vue.set(
                    this.frameObjects[nextPosition.id],
                    "caretVisibility",
                    nextPosition.caretPosition
                );
       
                this.currentFrame.caretPosition = nextPosition.caretPosition as CaretPosition;
            }

            //In any case change the current frame
            this.currentFrame.id = nextPosition.id;            
        },

        generateStateJSONStrWithCheckpoint(compress?: boolean) {
            /** This function was defined as a getter before, check details as to why it needs to be an action:
             *  the goal of this function is to make a "copy" of the state in a JSON format, with a few extra bits like the checkpoint.
                However, if defined as a getter, the state object we get in a getter is not exactly "just" the state object as we write it: 
                pinia adds a few extra bits that are used internally. So things like checksum later don't work well later when we need to use it.
                To avoid that situation, we should move the function in the actions, because in there, the access to the state object is really 
                "just" the state object as we defined it in the store. No extra bit are addede there by pinia.
             */
            const stateCopy = JSON.parse(JSON.stringify(this.$state));
            //clear the acResults, microbit DAP infos, copy frames, message banner and undo/redo related stuff as there is no need for storing them
            stateCopy["acResults"] = [],
            stateCopy["stateBeforeChanges"] = {};
            stateCopy["diffToPreviousState"] = [];
            stateCopy["diffToNextState"] = [];
            stateCopy["stateBeforeChanges"] = {};
            stateCopy["copiedFrames"] = {};
            delete stateCopy["DAPWrapper"];
            delete stateCopy["previousDAPWrapper"];
            stateCopy["currentMessage"] = MessageDefinitions.NoMessage;
            
            //simplify the storage of frame types by their type names only
            Object.keys(stateCopy["frameObjects"] as EditorFrameObjects).forEach((frameId) => {
                stateCopy["frameObjects"][frameId].frameType = stateCopy["frameObjects"][frameId].frameType.type;
            });

            const checksum =  getSHA1HashForObject(stateCopy)
            //add the checksum and other backup flags in the state object to be saved
            stateCopy["checksum"] = checksum;
            stateCopy["version"] = AppVersion;
            stateCopy["platform"] = AppPlatform;
            
            // finally, we save a compressed version of this JSON state if required (on auto-backup state saving)
            if(!compress){
                return JSON.stringify(stateCopy);
            }
            else{
                return LZString.compress(JSON.stringify(stateCopy))
            }      
        },
       
        
        setStateFromJSONStr(payload: {stateJSONStr: string; errorReason?: string, showMessage?: boolean, readCompressed?: boolean}){
            let isStateJSONStrValid = (payload.errorReason === undefined);
            let errorDetailMessage = payload.errorReason ?? "unknown reason";
            let isVersionCorrect = false;
            let newStateObj = {} as {[id: string]: any};

            // If there is an error set because the file couldn't be retrieved
            // we don't check anything, just get to the error display.
            if(isStateJSONStrValid){
                // If the string we read was compressed, we need to uncompress it first
                if(payload.readCompressed){
                    this.setStateFromJSONStr({stateJSONStr: LZString.decompress(payload.stateJSONStr) as string, showMessage: payload.showMessage});
                    return;
                }

                // We need to check the JSON string is:
                // 1) a valid JSON description of an object --> easy, we can just try to convert
                // 2) an object that matches the state (checksum checker)
                // 3) contains frame type names that are valid, and if so, replace the type names by the equivalent JS object (we replace the objects by the type name string to save space)    
                // 4) if the object is valid, we just verify the version is correct (and attempt loading) + for newer versions (> 1) make sure the target Strype "platform" is the same as the source's
                try {
                    //Check 1)
                    newStateObj = JSON.parse(payload.stateJSONStr);
                    if(!newStateObj || typeof(newStateObj) !== "object" || Array.isArray(newStateObj)){
                        //no need to go further
                        isStateJSONStrValid=false;
                        errorDetailMessage = i18n.t("errorMessage.dataNotObject") as string;
                    }
                    else{
                        // Check 2) as 1) is validated
                        if(!checkStateDataIntegrity(newStateObj)) {
                            isStateJSONStrValid = false;
                            errorDetailMessage = i18n.t("errorMessage.stateDataIntegrity") as string;
                        } 
                        else {
                            // Check 3) as 2) is validated
                            isVersionCorrect = (newStateObj["version"] == AppVersion);
                            if(Number.parseInt(newStateObj["version"]) > 1 && newStateObj["platform"] != AppPlatform) {
                                isStateJSONStrValid = false;
                                errorDetailMessage = i18n.t("errorMessage.stateWrongPlatform") as string;
                            }
                            else{
                                // Check 4) as 3) is validated
                                if(!restoreSavedStateFrameTypes(newStateObj)){
                                    // There was something wrong with the type name (it should not happen, but better check anyway)
                                    isStateJSONStrValid = false;
                                    errorDetailMessage = i18n.t("errorMessage.stateWrongFrameTypeName") as string;
                                }
                            }
                            delete newStateObj["version"];
                            delete newStateObj["platform"];
                        }          
                    }
                }
                catch(err){
                    //we cannot use the string arguemnt to retrieve a valid state --> inform the users
                    isStateJSONStrValid = false;
                    errorDetailMessage = i18n.t("errorMessage.wrongDataFormat") as string;
                }
            }
            
            // Apply the change and indicate it to the user if we detected a valid JSON string
            // or alert the user we couldn't if we detected a faulty JSON string to represent the state
            if(isStateJSONStrValid){  
                const newStateStr = JSON.stringify(newStateObj);     
                if(!isVersionCorrect) {
                    //if the version isn't correct, we ask confirmation to the user before continuing 
                    const confirmMsg = i18n.t("appMessage.editorFileUploadWrongVersion");
                    Vue.$confirm({
                        message: confirmMsg,
                        button: {
                            yes: i18n.t("buttonLabel.yes"),
                            no: i18n.t("buttonLabel.no"),
                        },
                        callback: (confirm: boolean) => {
                            if(confirm){
                                this.doSetStateFromJSONStr(
                                    {
                                        stateJSONStr: newStateStr,
                                        showMessage: payload.showMessage ?? true,
                                    }
                                );                                
                            }                        
                        },
                    })
                }
                else{
                    this.doSetStateFromJSONStr(
                        {
                            stateJSONStr: newStateStr,
                            showMessage: payload.showMessage ?? true,
                        }
                    );   
                }                
            }
            else{
                const message = MessageDefinitions.UploadEditorFileError;
                const msgObj: FormattedMessage = (message.message as FormattedMessage);
                msgObj.args[FormattedMessageArgKeyValuePlaceholders.error.key] = msgObj.args.errorMsg.replace(FormattedMessageArgKeyValuePlaceholders.error.placeholderName, errorDetailMessage);
                this.currentMessage = message;
            }
        },

        doSetStateFromJSONStr(payload: {stateJSONStr: string; showMessage?: boolean}){
            this.updateState(
                JSON.parse(payload.stateJSONStr)
            )
            // If the language has been updated, we need to also update the UI accordingly
            this.setAppLang(this.appLang);
            
            if(payload.showMessage) {
                this.currentMessage = MessageDefinitions.UploadEditorFileSuccess;

                //don't leave the message for ever
                setTimeout(() => this.currentMessage = MessageDefinitions.NoMessage, 5000);  
            }
        },

        // This method can be used to copy a frame to a position.
        // This can be a paste event or a duplicate event.
        copyFrameToPosition(payload: {frameId?: number; newParentId: number; newIndex: number}) {
            const stateBeforeChanges = JSON.parse(JSON.stringify(this.$state));
            
            const isPasteOperation: boolean = (payload.frameId === undefined);
            payload.frameId = payload.frameId ?? this.copiedFrameId;

            // If it is not a paste operation, it is a duplication of the frame.
            const sourceFrameList: EditorFrameObjects = (isPasteOperation) ? this.copiedFrames : this.frameObjects;            
            const copiedFrames: EditorFrameObjects = {};
            cloneFrameAndChildren(sourceFrameList, payload.frameId, payload.newParentId, {id: this.nextAvailableId}, copiedFrames); 


            // Add the copied objects to the FrameObjects
            Object.keys(copiedFrames).map(Number).forEach((id: number)=> {
                Vue.set(
                    this.frameObjects,
                    id,
                    copiedFrames[id]
                )
            });
            
            const topFrame = copiedFrames[Object.keys(copiedFrames).map(Number)[0]];

            // It will be added either as a Child or as a JointChild
            const isJointFrame = sourceFrameList[payload.frameId].frameType.isJointFrame;
            const childrenListToBeAdded = (isJointFrame) ? this.frameObjects[payload.newParentId].jointFrameIds : this.frameObjects[payload.newParentId].childrenIds;

            // Add the top frame to the its new parents children list
            childrenListToBeAdded.splice(
                payload.newIndex,
                0,
                topFrame.id
            );

            //Make the top new frame the current frame
            this.setCurrentFrame(
                { 
                    id: topFrame.id,
                    caretPosition: (topFrame.frameType.allowChildren) ? CaretPosition.body : CaretPosition.below,
                }
            );

            this.updateNextAvailableId();

            //if we do a paste, update the pasted frames' "isDisabled" property solely based on the parent's property
            if(isPasteOperation){
                this.doChangeDisableFrame(
                    {frameId: topFrame.id, isDisabling: this.frameObjects[payload.newParentId].isDisabled, ignoreEnableFromRoot: true}
                );
            }

            //save state changes
            this.saveStateChanges(
                {
                    previousState: stateBeforeChanges,
                }
            );
        
            this.unselectAllFrames();
        },

        // This method can be used to copy the selected frames to a position.
        // This can be a paste event or a duplicate event.
        copySelectedFramesToPosition(payload: {newParentId: number; newIndex?: number}) {
            const stateBeforeChanges = JSON.parse(JSON.stringify(this.$state));
            // -100 is chosen so that TS won't complain for non-initialised variable
            let newIndex = payload.newIndex??-100;
            const areWeDuplicating = newIndex === -100;

            // If newIndex does not exist, we are talking about a duplication
            if(areWeDuplicating){
                // In that case, the duplicated selection goes below the last selected item
                newIndex = this.getIndexInParent(this.selectedFrames[this.selectedFrames.length-1])+1;
            }

            // We generate the list of frames from the selectedFrames ids
            const sourceFrameList: EditorFrameObjects = (areWeDuplicating) ? this.frameObjects : this.copiedFrames;
            const sourceFrameIds: number[] = (areWeDuplicating) ? this.selectedFrames : this.copiedSelectionFrameIds;

            const copiedFrames: EditorFrameObjects = {};

            // All the top level cloned frames need to be stored in order to then added to their new parent's list
            const topLevelCopiedFrames: number[] = [];
            let nextAvailableId = this.nextAvailableId;

            Object.values(sourceFrameIds).forEach( (frame) => {
                //For each top level frame (i.e. each one on the selected list) we record its new id
                topLevelCopiedFrames.push(nextAvailableId)
                cloneFrameAndChildren(sourceFrameList, frame, payload.newParentId, {id: nextAvailableId}, copiedFrames); 
                // Find the largest id form the copied and increase it by 1
                nextAvailableId = Math.max.apply({},(Object.keys(copiedFrames).concat(Object.keys(copiedFrames))).map(Number)) + 1;
            });

            
            // Add the copied objects to the FrameObjects
            Object.keys(copiedFrames).map(Number).forEach((id: number)=> {
                Vue.set(
                    this.frameObjects,
                    id,
                    copiedFrames[id]
                )
            });
            this.updateNextAvailableId();            

            // It will be added either as a Child or as a JointChild
            const areSelectedJointFrames = sourceFrameList[sourceFrameIds[0]].frameType.isJointFrame;
            const childrenListToBeAdded = (areSelectedJointFrames) ? this.frameObjects[payload.newParentId].jointFrameIds : this.frameObjects[payload.newParentId].childrenIds;

            // Add each one of the copied frames in their new parent's list
            topLevelCopiedFrames.forEach( (id) => {
                childrenListToBeAdded.splice(
                    newIndex++,
                    0,
                    id
                );
            });

            //Make the top new frame the current frame
            this.setCurrentFrame(
                { 
                    id: topLevelCopiedFrames[topLevelCopiedFrames.length-1],
                    caretPosition: CaretPosition.below,
                }
            );

            this.updateNextAvailableId();

            //if we do a paste, update the pasted frames' "isDisabled" property solely based on the parent's property
            if(!areWeDuplicating){
                topLevelCopiedFrames.forEach( (id) =>
                    this.doChangeDisableFrame(
                        {
                            frameId: id, 
                            isDisabling: this.frameObjects[payload.newParentId].isDisabled, 
                            ignoreEnableFromRoot: true,
                        }
                    ));
            }

            //save state changes
            this.saveStateChanges(
                {
                    previousState: stateBeforeChanges,
                }
            );
        
            this.unselectAllFrames();
        },

        pasteFrame(payload: {clickedFrameId: number; caretPosition: CaretPosition}) {
            // If the copiedFrame has a JointParent, we're talking about a JointFrame
            const isCopiedJointFrame = this.copiedFrames[this.copiedFrameId].frameType.isJointFrame;
            const isClickedJointFrame = this.frameObjects[payload.clickedFrameId].frameType.isJointFrame;

            // Clicked is joint ? parent of clicked is its joint parent ELSE clicked is the real parent
            const clickedParentId = (isClickedJointFrame) ? this.frameObjects[payload.clickedFrameId].jointParentId : this.frameObjects[payload.clickedFrameId].parentId;

            // Index is 0 if we paste in the body OR we paste a JointFrame Below JointParent
            const index = (payload.caretPosition === CaretPosition.body || ( payload.caretPosition === CaretPosition.below && isCopiedJointFrame && !isClickedJointFrame)) ? 
                0 : 
                this.getIndexInParent(payload.clickedFrameId)+1;

            // If the caret is below and it is not a joint frame, parent is the clicked's parent 
            const pasteToParentId = (payload.caretPosition === CaretPosition.body || (isCopiedJointFrame && !isClickedJointFrame) ) ?
                payload.clickedFrameId:   
                clickedParentId;
                
            // frameId is omitted from the action call, so that the method knows we talk about the copied frame!
            this.copyFrameToPosition(
                {
                    newParentId: pasteToParentId,
                    newIndex: index,
                }
            );
        },

        pasteSelection(payload: {clickedFrameId: number; caretPosition: CaretPosition}) {
            // If the copiedFrame has a JointParent, we're talking about a JointFrame
            const areCopiedJointFrames = this.copiedFrames[this.copiedSelectionFrameIds[0]].frameType.isJointFrame;
            const isClickedJointFrame = this.frameObjects[payload.clickedFrameId].frameType.isJointFrame;

            // Clicked is joint ? parent of clicked is its joint parent ELSE clicked is the real parent
            const clickedParentId = (isClickedJointFrame) ? this.frameObjects[payload.clickedFrameId].jointParentId : this.frameObjects[payload.clickedFrameId].parentId;

            // Index is 0 if we paste in the body OR we paste a JointFrame Below JointParent
            const index = (payload.caretPosition === CaretPosition.body || ( payload.caretPosition === CaretPosition.below && areCopiedJointFrames && !isClickedJointFrame)) ? 
                0 : 
                this.getIndexInParent(payload.clickedFrameId)+1;

            // If the caret is below and it is not a joint frame, parent is the clicked's parent 
            const pasteToParentId = (payload.caretPosition === CaretPosition.body || (areCopiedJointFrames && !isClickedJointFrame) ) ?
                payload.clickedFrameId:   
                clickedParentId;
                
            // frameId is omitted from the action call, so that the method knows we talk about the copied frame!
            this.copySelectedFramesToPosition(
                {
                    newParentId: pasteToParentId,
                    newIndex: index,
                }
            );
        },

        copyFrame(frameId: number) {
            this.flushCopiedFrames();
            this.doCopyFrame(frameId);
            this.updateNextAvailableId();
        },

        copySelection() {
            this.flushCopiedFrames();
            this.doCopySelection();
            this.updateNextAvailableId();
        },

        changeDisableFrame(payload: {frameId: number; isDisabling: boolean}) {
            const stateBeforeChanges = JSON.parse(JSON.stringify(this.$state));

            this.doChangeDisableFrame(payload);
            
            //save state changes
            this.saveStateChanges(
                {
                    previousState: stateBeforeChanges,
                }
            );
        
            this.unselectAllFrames();
        },

        changeDisableSelection(isDisabling: boolean) {
            const stateBeforeChanges = JSON.parse(JSON.stringify(this.$state));

            this.selectedFrames.forEach( (id) =>
                this.doChangeDisableFrame(
                    {
                        frameId: id,
                        isDisabling: isDisabling,
                    }
                ));
            
            //save state changes
            this.saveStateChanges(
                {
                    previousState: stateBeforeChanges,
                }
            );
        
            this.unselectAllFrames();
        },

        selectMultipleFrames(key: string) {
            const directionUp = key==="ArrowUp"
            const delta = directionUp? -1 : +1;
            const currentFrame = this.frameObjects[this.currentFrame.id];

            // we filter the payload to remove the slot positions
            let availablePositions:NavigationPosition[]  = getAvailableNavigationPositions();
            availablePositions = availablePositions.filter((e) => e.slotNumber === false);
            
            let siblingsOrChildren: number[] = []
            let index = 0;
            
            if(this.currentFrame.caretPosition === CaretPosition.below) {
                siblingsOrChildren = this.frameObjects[currentFrame.parentId].childrenIds
                index = siblingsOrChildren.indexOf(currentFrame.id) + (directionUp?+1:0);
            }
            else {
                siblingsOrChildren = currentFrame.childrenIds
                // we need to get -1 if we are not going up, so that we can select the frame we are above
                // i.e. if we are above the first child frame, we need index of current to be -1 so that when
                // adding the delta (+1) to get
                index += (!directionUp)?-1:0
            }

            // the frame to be selected is the next towards the direction
            const frameIdToBeSelected = siblingsOrChildren[index+delta]??-100

            // We cannot select something, so we return
            if(frameIdToBeSelected===-100){
                return 
            }

            const availablePositionsOfSiblings: NavigationPosition[] = []
            availablePositions.forEach((element) => {
                // we need to keep the elements which correspond to the siblingsOrChildren list
                // we only include bellows
                if(siblingsOrChildren.includes(element.id) && element.caretPosition === CaretPosition.below) {
                    // going down, we cannot select a body position
                    availablePositionsOfSiblings.push(element)
                }
                // except when going upwards we may need the our parent's body to be added
                else if(directionUp && currentFrame.parentId === element.id && element.caretPosition == CaretPosition.body){
                    availablePositionsOfSiblings.push(element)
                }
            })
            
            // In the new list with the available positions that we could go to, we first find the index of the current
            const indexOfCurrent = availablePositionsOfSiblings.findIndex((e) => e.id === this.currentFrame.id && e.caretPosition === this.currentFrame.caretPosition)
            // and then we find the new current
            // NOTE here that the one to be selected and the new current can be different. i.e. I am below the first child of an if and going up
            // the one to be selected is the one I am bellow, and the current is the body of the if! (i.e. the parent)
            const newCurrent = availablePositionsOfSiblings[indexOfCurrent+delta]
          
            this.selectDeselectFrame({frameId: frameIdToBeSelected, direction: key.replace("Arrow","").toLowerCase()}); 
            this.setCurrentFrame(newCurrent as CurrentFrame);
        },

        shiftClickSelection(payload: {clickedFrameId: number; clickedCaretPosition: CaretPosition}) {
            // Remove current selection
            this.unselectAllFrames();

            const availablePositions = getAvailableNavigationPositions();
            const listOfCaretPositions = availablePositions.filter(((e)=> e.slotNumber === false));

            const indexOfCurrent: number = listOfCaretPositions.findIndex((item)=> item.id === this.currentFrame.id && item.caretPosition === this.currentFrame.caretPosition);
            const indexOfTarget: number = listOfCaretPositions.findIndex((item)=> item.id === payload.clickedFrameId && item.caretPosition === payload.clickedCaretPosition);
            
            if(indexOfCurrent === indexOfTarget) {
                return;
            }

            // is the targetFrame bellow or above the origin frame
            const direction = (indexOfCurrent < indexOfTarget)?"ArrowDown" : "ArrowUp" ;

            const stopId = (direction==="ArrowUp")
                ? listOfCaretPositions[indexOfTarget+1].id // going up we always stop on the next of the clicked
                : payload.clickedCaretPosition === CaretPosition.below 
                    ? payload.clickedFrameId // if we go down and click bellow, we go on the clicked
                    : listOfCaretPositions[indexOfTarget-1].id// down and click body, we go to the previous of clicked


            let previousFramesSelection: number[] = [];

            // Instead of writing a selection function from scratch
            do {
                previousFramesSelection = [...this.selectedFrames]
                this.selectMultipleFrames(direction);
            } while (previousFramesSelection.length !== this.selectedFrames.length && !this.selectedFrames.includes(stopId))

        },

        prepareForMultiDrag(draggedFrameId: number) {
            const position = this.getFrameSelectionPosition(draggedFrameId);
           
            const otherFrames = this.selectedFrames.filter((id) => id!==draggedFrameId);
            this.updateStateBeforeChanges(false);

            otherFrames.forEach( (frameId) => {
                Vue.set(
                    this.frameObjects[frameId],
                    "isVisible",
                    false
                );
            });

            Vue.set(
                this.frameObjects[draggedFrameId],
                "multiDragPosition",
                position
            );        
        },

        // This method can be used to move the selected frames to a position through Drag & Drop
        moveSelectedFramesToPosition(payload: {event: any; parentId: number}) { 
            // First remove the visual aspect
            this.removeMultiDragStyling();
            
            if(this.ignoredDragAction){
                //if the action should be ignore, just return and reset the flag
                this.ignoredDragAction = false;
                return;
            }

            const eventType = Object.keys(payload.event)[0];
            const isJointFrame = this.isJointFrameById(this.selectedFrames[0]);
            const position: CaretPosition = (isJointFrame) ? CaretPosition.below : CaretPosition.body;

            // Even in the same draggable group, some JointFrames cannot be moved (i.e. an elif below an else)
            // That should be checked both ways as for example if you move an `else` above an elif, it may be
            // valid, as the if accepts else there, but the elif cannot go below the else.
            // getIfPositionAllowsFrame() is used as it checks if a frame can be landed on a position     
            // succeedingFrame is the next frame (if it exists) above which we are adding
            let indexOfFirstSelected = (isJointFrame)
                ? this.frameObjects[payload.parentId].jointFrameIds.indexOf(this.selectedFrames[0])
                : this.frameObjects[payload.parentId].childrenIds.indexOf(this.selectedFrames[0]);

            const indexOfLastSelected = (isJointFrame)
                ? this.frameObjects[payload.parentId].jointFrameIds.indexOf(this.selectedFrames[this.selectedFrames.length-1])
                : this.frameObjects[payload.parentId].childrenIds.indexOf(this.selectedFrames[this.selectedFrames.length-1]);

            // If we are moving it to the same parent, we need to check whether
            // we are moving it to the same place (between first and last index of the selected ones); 
            // If that's the case we don't do anything as it may cause a problem (e.g. if selected indexes are 0...3
            // it may move it to 1 instead of 0.
            const parentIdOfSelected = getParentOrJointParent(this.frameObjects,this.frameObjects[this.selectedFrames[0]].id)
            let newIndex = payload.event[eventType].newIndex;

            if(eventType === "moved" && payload.parentId === parentIdOfSelected) {
                if(newIndex >= indexOfFirstSelected && newIndex <= indexOfLastSelected) {
                    this.makeSelectedFramesVisible();
                    return;
                }
            }

            const succeedingFrame = this.frameObjects[payload.parentId].jointFrameIds[payload.event[eventType].newIndex + (eventType === "moved")];   
            const jointFrameIds = this.frameObjects[payload.parentId].jointFrameIds;
            if(eventType !== "removed") {
                // EXAMPLE: Moving frame `A` above Frame `B`
                // IF `A` cannot be moved on this position 
                //                OR
                // IF `A` is jointFrame and there IS a frame `B` where I am moving `A` at
                //     on TRUE ==> Check if `B` CANNOT be placed below `A` / CANNOT be the trailing joint frame
                //     on FALSE ==> We don't care about this situation
                const jointFrameCase = (isJointFrame && jointFrameIds.length > 0)
                    ? (succeedingFrame !== undefined)
                        ? !this.isPositionAllowsSelectedFrames(payload.event[eventType].element.id, CaretPosition.below, false)
                        : !this.isPositionAllowsSelectedFrames(jointFrameIds[jointFrameIds.length - 1], CaretPosition.below, false)
                    : false;

                if((!isJointFrame && !this.isPositionAllowsSelectedFrames(payload.parentId, position, false)) || jointFrameCase) {       
                    //in the case of a 2 step move (when moving from one group to another) we set the flag to ignore the DnD changes
                    if(eventType === "added"){
                        this.ignoredDragAction = true;
                    }

                    //alert the user about a forbidden move
                    this.currentMessage = MessageDefinitions.ForbiddenFrameMove;
    
                    //don't leave the message for ever
                    setTimeout(() => this.currentMessage = MessageDefinitions.NoMessage, 3000);         
                    this.makeSelectedFramesVisible();
                    return;
                }
            }

            // The top level cloned frames need to be stored in order to then be added to their new parent's list
            const sourceFrameIds: number[] = this.selectedFrames;

            // In the case of moving in the same parent in some spaces below,
            // because at the same time we are removing and adding the newIndex
            // gets distorted (e.g. take from 0 and add move it to 5, if you remove first,
            // then the index 5 becomes index 4), hence if we are moving down, we do not increase the index.
            const indexIncrement = (eventType === "moved" && newIndex>indexOfLastSelected)? 0: 1;    
            const firstSelctedIncrement = (eventType === "removed" || (eventType === "moved" && newIndex>indexOfLastSelected))? 0: 1;    

            Object.values(sourceFrameIds).forEach( (id) => {
                // For each frame in the list, we are calling the `updateFramesOrder`
                // and for each frame we are creating a `fake` event, as the event really
                // occurs for only the dragged frame.
                this.doUpdateFramesOrder(
                    {
                        event: {
                            [eventType]: { // the [] are needed for JS to understand that we're talking about the variable and not the string 'eventType'
                                element: this.frameObjects[id],
                                newIndex: newIndex,
                                oldIndex: indexOfFirstSelected,
                                eventType : eventType,
                            },
                        },
                        eventParentId: payload.parentId,
                    }
                );
                
                newIndex += indexIncrement;
                indexOfFirstSelected += firstSelctedIncrement;
            });

            // In the end, unselect all frames
            if(eventType !== "added") {
                this.makeSelectedFramesVisible();
                this.unselectAllFrames();
                //save state changes
                //save the state changes for undo/redo
                this.saveStateChanges(
                    {                   
                        previousState: this.stateBeforeChanges,
                    }
                );

                //clear the stateBeforeChanges flag off
                this.updateStateBeforeChanges(true);
            }
        },
    },
});