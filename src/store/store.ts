import Vue from "vue";
import Vuex from "vuex";
import { FrameObject, CurrentFrame, CaretPosition, MessageDefinition, MessageDefinitions, FramesDefinitions, EditableFocusPayload, Definitions, ToggleFrameLabelCommandDef, ObjectPropertyDiff, EditableSlotPayload, FormattedMessage, FormattedMessageArgKeyValuePlaceholders, AddFrameCommandDef, EditorFrameObjects, EmptyFrameObject, MainFramesContainerDefinition, ForDefinition, WhileDefinition, ReturnDefinition, FuncDefContainerDefinition, BreakDefinition, ContinueDefinition, EditableSlotReachInfos, ImportsContainerDefinition, StateObject, FuncDefDefinition, VarAssignDefinition, UserDefinedElement, FrameSlotContent, AcResultsWithModule, NavigationPayload, NavigationPosition, DeleteFromSlotPayload} from "@/types/types";
import { addCommandsDefs } from "@/constants/addFrameCommandsDefs";
import { getEditableSlotUIID, undoMaxSteps } from "@/helpers/editor";
import { getObjectPropertiesDifferences, getSHA1HashForObject } from "@/helpers/common";
import i18n from "@/i18n";
import tutorialState from "@/store/tutorial-state";
import { checkStateDataIntegrity, getAllChildrenAndJointFramesIds, getDisabledBlockRootFrameId, checkDisabledStatusOfMovingFrame, isContainedInFrame } from "@/helpers/storeMethods";
import { removeFrameInFrameList, cloneFrameAndChildren, childrenListWithJointFrames, countRecursiveChildren, getParent, getParentOrJointParent, generateFrameMap, getAllSiblings, getNextSibling, checkIfLastJointChild, checkIfFirstChild, getPreviousIdForCaretBelow} from "@/helpers/storeMethods";
import { AppVersion } from "@/main";
import initialStates from "@/store/initial-states";
import {DAPWrapper} from "@/helpers/partial-flashing"
import { siblings } from "cheerio/lib/api/traversing";



Vue.use(Vuex);

const initialState: StateObject = initialStates["debugging"];

export default new Vuex.Store({
    state: {
        /*these flags need checking when a build is done + toggleTutorialState()*/
        debugging: initialState.debugging,

        // Flag used to keep the AC shown for debug purposes
        debugAC: false,

        showKeystroke: initialState.showKeystroke,

        frameObjects: initialState.initialState,

        frameMap : initialState.frameMap, // flat map of all the frames in a sequence

        nextAvailableId: Math.max(...initialState.frameMap)+1, // won't work for tutorial, as it is not needed in there
        /*END of flags that need checking when a build is done*/

        currentFrame: { id: -3, caretPosition: CaretPosition.body } as CurrentFrame,

        currentInitCodeValue: "", //this is an indicator of the CURRENT editable slot's initial content being edited.

        isEditing: false,

        ignoreKeyEvent: false, //this flag can be used anywhere a key event should be ignored within the application

        currentMessage: MessageDefinitions.NoMessage,

        preCompileErrors: [] as string[],

        diffToPreviousState: [] as ObjectPropertyDiff[][],

        diffToNextState: [] as ObjectPropertyDiff[][],
        
        copiedFrameId: -100 as number, // We use -100 to avoid any used id. This variable holds the id of the root copied frame.

        copiedSelectionFrameIds: []  as number[], //This variable holds the ids of the root copied frames.

        copiedFrames: {} as EditorFrameObjects,

        stateBeforeChanges : {} as  {[id: string]: any}, // Keeps a copy of the state when 2-steps operations are performed and we need to know the previous state (to clear after use!)

        contextMenuShownId: "",

        projectName: i18n.t("appMenu.defaultProjName") as string,

        ignoredDragAction: false, // Flag to indicate when a drag and drop (in the 2 step process) shouldn't complete. To reset at false after usage !

        selectedFrames: [] as number[],

        appLang: "en",

        isAppMenuOpened: false,

        acResults: [] as AcResultsWithModule[],

        editableSlotViaKeyboard: {isKeyboard: false, direction: 1} as EditableSlotReachInfos, //indicates when a slot is reached via keyboard arrows, and the direction (-1 for left/up and 1 for right/down)
    
        /* the following wrapper is used for interacting with the microbit board via DAP*/
        DAPWrapper: undefined, //expected type when set: DAPWrapper

        previousDAPWrapper: undefined, //expected type when set:DAPWrapper
    },

    getters: {
        getStateJSONStrWithCheckpoints : (state) => (): string => {
            //we get the state's checksum and the current app version,
            //and add them to the state's copy object to return
            const stateCopy = JSON.parse(JSON.stringify(state));
            const checksum =  getSHA1HashForObject(stateCopy)
            stateCopy["checksum"] = checksum;
            stateCopy["version"] = AppVersion;
            return JSON.stringify(stateCopy);
        },
        getAppLang: (state) => () => {
            return state.appLang;
        },
        isAppMenuOpened: (state) => () => {
            return state.isAppMenuOpened;
        },
        getFrameObjectFromId: (state) => (frameId: number) => {
            return state.frameObjects[frameId];
        },
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
        getInitContentForFrameSlot: (state) => () => {
            return state.currentInitCodeValue;
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
        getAllowsJointChildren: (state) => (frameId: number) => {
            return state.frameObjects[frameId].frameType.allowJointChildren;
        },
        getIsJointFrameById: (state) => (frameId: number) => {
            return state.frameObjects[frameId].jointParentId > 0;
        },
        getCurrentFrameObject: (state) => () => {
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
        getMainCodeFrameContainerId: (state) => () => {
            return Object.values(state.frameObjects).filter((frame: FrameObject) => frame.frameType.type === MainFramesContainerDefinition.type)[0].id;
        },
        getDraggableGroupById: (state) => (frameId: number) => {
            return state.frameObjects[frameId].frameType.draggableGroup;
        },
        getDraggableJointGroupById: (state) => (frameId: number) => {
            const frame = state.frameObjects[frameId];
            return frame.frameType.innerJointDraggableGroup;
        },
        getIsEditing: (state) => () => {
            return state.isEditing;
        },
        getIsEditableFocused: (state) => (frameId: number, slotIndex: number) => {
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

            const uniqueJointFrameTypes = [Definitions.FinallyDefinition.type, Definitions.ElseDefinition.type];

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
                        if(uniqueJointFrameTypes.includes(focusedFrame.frameType.type)){
                            allowedJointChildren.splice(
                                0,
                                allowedJointChildren.indexOf(focusedFrame.frameType.type)+1 //delete from the beginning to the current frame type
                            );
                        }
                        //else show them all
                    }
                    // on the presence of a next child
                    else{
                        const nextJointChild = state.frameObjects[nextJointChildID];          

                        // if the next is not unique, show all non-uniques
                        if(!uniqueJointFrameTypes.includes(nextJointChild.frameType.type)) {
                            allowedJointChildren = allowedJointChildren.filter( (x) => !uniqueJointFrameTypes.includes(x)) // difference
                        }
                        // else if the next AND the current are uniques (i.e. I am in an ELSE and there is a FINALLY after me)
                        else if(uniqueJointFrameTypes.includes(focusedFrame.frameType.type)) {
                            allowedJointChildren = [];
                        }
                        // In the case where only the next is unique
                        // show all but the available up to before the existing unique (i.e. at most up to ELSE)
                        else {
                            allowedJointChildren.splice(
                                allowedJointChildren.indexOf(nextJointChild.frameType.type),
                                allowedJointChildren.length - allowedJointChildren.indexOf(nextJointChild.frameType.type) //delete from the index of the nextJointChild to the end
                            );
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

            //"return" statements can't be added when in the main container frame
            //We don't forbid them to be in the main container, but we don't provide a way to add them directly.
            //They can be added when in the function definition container though.
            const canShowReturnStatement = isContainedInFrame(state. frameObjects, frameId,caretPosition, [FuncDefContainerDefinition.type]);
            if(!canShowReturnStatement){
                //by default, "break" and "continue" are NOT forbidden to any frame which can host children frames,
                //so if we cannot show "break" and "continue" : we add them from the list of forbidden
                forbiddenTypes.splice(
                    0,
                    0,
                    ...[ReturnDefinition.type]
                );
            }


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
        getCurrentFrameToggleFrameLabelCommands: (state) => () => {
            const commands: ToggleFrameLabelCommandDef[] = [];
            state.frameObjects[state.currentFrame.id].frameType.labels.forEach((labelDef) => {
                const command = labelDef.toggleLabelCommand;
                if(command !== undefined){
                    commands.push(command);
                }
            });
            return commands;
        },
        getIsCurrentFrameLabelShown: (state) => (frameId: number, slotIndex: number) => {
            //for an optional label, the corresponding contentDict is always definined with a shown value
            if(state.frameObjects[frameId].frameType.labels[slotIndex]?.optionalLabel === true){
                return (state.frameObjects[frameId].contentDict[slotIndex].shownLabel);
            }

            //not optional label --> it's never hidden so we don't need to check any flag
            return true;
        },
        getAllowChildren: (state) => (frameId: number) => {
            return state.frameObjects[frameId].frameType.allowChildren;
        },

        getIsErroneousSlot: (state) => (frameId: number, slotIndex: number) => {
            return state.frameObjects[frameId].contentDict[slotIndex].error !== "";
        },

        getIsErroneousFrame: (state) => (frameId: number) => {
            return state.frameObjects[frameId].error !== "";
        },
        
        getErrorForSlot: (state) => (frameId: number, slotIndex: number) => {
            return state.frameObjects[frameId].contentDict[slotIndex].error;
        },

        getErrorForFrame: (state) => (frameId: number) => {
            return state.frameObjects[frameId].error;
        },

        getPreCompileErrors: (state) => () => {
            return state.preCompileErrors;
        },

        getPreCompileErrorExists: (state) => (id: string) => {
            return state.preCompileErrors.includes(id);
        },
        getIsMessageBannerOn: (state) => () => {
            return state.currentMessage !== MessageDefinitions.NoMessage;
        },
        getCurrentMessage: (state) => () => {
            return state.currentMessage;
        },
        // Automatically checks returns index in Parent OR JointParent
        getIndexInParent: (state) => (frameId: number) => {
            const isJointFrame = state.frameObjects[frameId].frameType.isJointFrame;
            return (isJointFrame)? 
                state.frameObjects[state.frameObjects[frameId].jointParentId].jointFrameIds.indexOf(frameId):
                state.frameObjects[state.frameObjects[frameId].parentId].childrenIds.indexOf(frameId);
        },
        getIsCopiedAvailable: (state) => () => {
            return (state.copiedFrameId !== -100) || (state.copiedSelectionFrameIds.length > 0);
        },
        isPasteAllowedAtFrame: (state, getters) => (frameId: number, caretPos: CaretPosition) => {
            if(getters.isSelectionCopied()){
                if(getters.getIfPositionAllowsSelectedFrames(frameId, caretPos, true)) {
                    return true;
                }  
            }
            else {
                if(getters.getIfPositionAllowsFrame(frameId, caretPos)) {
                    return true;
                }
            }

            return false;
        },
        // frameToBeMovedId is an optional argument and it is used in cases where we are just checking if a 
        // frame can be moved to a position based on the copied frame type --> we are not really checking about the actual copied Frame
        getIfPositionAllowsFrame: (state, getters) => (targetFrameId: number, targetCaretPosition: CaretPosition, frameToBeMovedId?: number) => {
            
            // Where do we get the frame from --> from copiedFrames if it is a copied frame
            // Otherwise the input frame is to be checked (e.g. for moving an else statement or duplicating an else statement -- which doesn't go anywhere).
            const sourceFrameList: EditorFrameObjects = (frameToBeMovedId === undefined) ? state.copiedFrames : state.frameObjects ;    

            frameToBeMovedId = frameToBeMovedId ?? state.copiedFrameId;

            if(frameToBeMovedId < 1){
                return false;
            }     

            const allowedFrameTypes: [AddFrameCommandDef[]] = getters.generateAvailableFrameCommands(targetFrameId, targetCaretPosition);
            // isFrameCopied needs to be checked in the case that the original frame which was copied has been deleted.
            const copiedType: string = sourceFrameList[frameToBeMovedId].frameType.type;
           
            // for..of is used instead of foreach here, as foreach does not supports return.........
            for (const element of Object.values(allowedFrameTypes)) {
                if (element[0].type.type === copiedType) {
                    return true;
                }
            }

            return false;
        },

        getIfPositionAllowsSelectedFrames: (state, getters) => (targetFrameId: number, targetCaretPosition: CaretPosition, areFramesCopied: boolean) => {
        
            const allowedFrameTypes: [AddFrameCommandDef[]] = getters.generateAvailableFrameCommands(targetFrameId, targetCaretPosition);

            const selectedFramesIds = (areFramesCopied)?state.copiedSelectionFrameIds:state.selectedFrames;
            const sourceList = (areFramesCopied)?state.copiedFrames:state.frameObjects;
            
            // for..of is used instead of foreach here, as foreach does not supports return.........
            for (const id of selectedFramesIds) {
                // If one of the selected frames is not found in the allowed list, then return false
                if(!Object.values(allowedFrameTypes).find((allowed) => allowed[0].type.type === sourceList[id].frameType.type)){
                    return false;
                }
            }

            return true;
        },

        getContextMenuShownId: (state) => () => {
            return state.contextMenuShownId;
        },

        getProjectName: (state) => () => {
            return state.projectName;
        },

        getSelectedFrameIds: (state) => () => {
            return state.selectedFrames;
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

        areAnyFramesSelected: (state) => () => {
            return state.selectedFrames.length>0;
        },
        
        getIsUndoRedoEmpty: (state) => (action: string) => {
            return (action === "undo") ? state.diffToPreviousState.length === 0 : state.diffToNextState.length === 0;
        },

        isSelectionCopied: (state) => () => {
            return state.copiedSelectionFrameIds.length > 0;
        },

        isFrameVisible: (state) => (frameId: number) => {
            return state.frameObjects[frameId].isVisible;
        },

        getMultiDragPosition: (state) => (frameId: number) => {
            return state.frameObjects[frameId].multiDragPosition;
        },

        getAcResults: (state) => () => {
            return state.acResults;
        },
        
        getEditableSlotViaKeyboard:(state) => () => {
            return state.editableSlotViaKeyboard;
        },

        retrieveUserDefinedElements:(state) => () => {
            // Retrieve the user defined functions and variables.
            // We make sure we don't look up the variable/function in the current frame
            // (for example, if we are in a variable assignment, we shouldn't pick up on that variable being written)
            // the returned value is an array of UserDefinedElement objects.
            return Object.values(state.frameObjects).filter((frame: FrameObject) => (frame.id !== state.currentFrame.id 
                && (frame.frameType.type === FuncDefDefinition.type || frame.frameType.type === VarAssignDefinition.type)))
                .map((frame: FrameObject) => ({name: frame.contentDict[0].code, isFunction: frame.frameType.type === FuncDefDefinition.type}) as UserDefinedElement);
        },

        getIsSlotFirstVisibleInFrame:(state) => (frameId: number, slotIndex: number) => {
            // This getter checks if the given slot of a given frame is *visually* the first shown to the user
            const contentDict = Object.values(state.frameObjects[frameId].contentDict);
            return (contentDict.find((content: FrameSlotContent, index) => (index < slotIndex && content.shownLabel)) === undefined);
        },

        getIgnoreKeyEvent: (state) => () => {
            return state.ignoreKeyEvent;
        },

        getDAPWrapper: (state) => () => {
            return state.DAPWrapper;
        },

        getPreviousDAPWrapper: (state) => () => {
            return state.previousDAPWrapper;
        },

        getDebugAC: (state) => () => {
            return state.debugAC;
        },

        isImportFrame: (state) => (frameId: number) => {
            return state.frameObjects[frameId].frameType.isImportFrame;
        },
    }, 

    mutations: {
        setAppLang(state, lang: string) {
            //set the language in the store first
            Vue.set(
                state,
                "appLang",
                lang
            );
            //then change the UI via i18n
            i18n.locale = lang;

            //change the values of the container frames as they are not reactive
            Object.values(state.frameObjects).forEach((frame) => {
                switch(frame.frameType.type){
                case ImportsContainerDefinition.type:
                    Vue.set(state.frameObjects[frame.id].frameType.labels[0],"label", i18n.t("appMessage.importsContainer") as string)
                    break;
                case FuncDefContainerDefinition.type:
                    Vue.set(state.frameObjects[frame.id].frameType.labels[0],"label", i18n.t("appMessage.funcDefsContainer") as string)
                    break;
                case MainFramesContainerDefinition.type:
                    Vue.set(state.frameObjects[frame.id].frameType.labels[0],"label", i18n.t("appMessage.mainContainer") as string)
                    break;
                default:
                    break;
                }
            });
        },

        setIsAppMenuOpened(state, isOpened: boolean) {
            Vue.set(
                state,
                "isAppMenuOpened",
                isOpened
            );
        },

        updateStateBeforeChanges(state, release: boolean) {
            //if the flag release is true, we clear the current stateBeforeChanges value
            Vue.set(
                state,
                "stateBeforeChanges",
                (release) ? {} : JSON.parse(JSON.stringify(state))
            );
        },

        toggleTutorialState(state, toggle: boolean) {
            Vue.set(
                state,
                "frameObjects",
                (toggle) ? tutorialState: initialState.initialState
            );
        },

        deleteFrame(state, payload: {key: string; frameToDeleteId: number; deleteChildren?: boolean}) {
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
                    state.frameObjects,
                    payload.frameToDeleteId
                );
            }
            else{
                //delete the frame entirely with sub levels
                if(payload.deleteChildren === true){
                    removeFrameInFrameList(
                        state.frameObjects,
                        payload.frameToDeleteId
                    );
                }
                else{
                    //we "replace" the frame to delete by its content in its parent's location
                    //note: the content is its children and the children of its potential joint frames
                    const frameToDelete = state.frameObjects[payload.frameToDeleteId];
                    const isFrameToDeleteJointFrame = (frameToDelete.jointParentId > 0);
                    const isFrameToDeleteRootJointFrame = (frameToDelete.jointParentId === 0 && frameToDelete.frameType.jointFrameTypes.length > 0);
                    let parentIdOfFrameToDelete = frameToDelete.parentId; 
                    //if the current frame is a joint frame, we find the "parent": the root of the structure if it's the first joint, the joint before otherwise
                    if (isFrameToDeleteJointFrame) {
                        const indexOfJointFrame = state.frameObjects[frameToDelete.jointParentId].jointFrameIds.indexOf(payload.frameToDeleteId);
                        parentIdOfFrameToDelete = (indexOfJointFrame > 0) ?
                            state.frameObjects[frameToDelete.jointParentId].jointFrameIds[indexOfJointFrame - 1] :
                            state.frameObjects[payload.frameToDeleteId].jointParentId     
                    }

                    const listOfChildrenToMove = state.frameObjects[payload.frameToDeleteId].childrenIds
                    //if the frame to remove is the root of a joint frames structure, we include all the joint frames' children in the list of children to remove
                    if(isFrameToDeleteRootJointFrame){
                        state.frameObjects[payload.frameToDeleteId]
                            .jointFrameIds
                            .forEach((jointFrameId) => listOfChildrenToMove.push(...state.frameObjects[jointFrameId].childrenIds));
                    }

                    //update the new parent Id of all the children to their new parent
                    listOfChildrenToMove.forEach((childId) => state.frameObjects[childId].parentId = parentIdOfFrameToDelete);
                    //replace the frame to delete by the children in the parent frame or append them at the end (for joint frames)
                    const parentChildrenIds = state.frameObjects[parentIdOfFrameToDelete].childrenIds;
                    const indexOfFrameToReplace = (isFrameToDeleteJointFrame) ? parentChildrenIds.length : parentChildrenIds.lastIndexOf(payload.frameToDeleteId);
                    parentChildrenIds.splice(
                        indexOfFrameToReplace,
                        (isFrameToDeleteJointFrame) ? 0 : 1,
                        ...listOfChildrenToMove
                    );
                    //if the frame to delete is a joint frame, we remove it from its parent
                    if(isFrameToDeleteJointFrame){
                        state.frameObjects[state.frameObjects[payload.frameToDeleteId].jointParentId].jointFrameIds.splice(
                            state.frameObjects[state.frameObjects[payload.frameToDeleteId].jointParentId].jointFrameIds.indexOf(payload.frameToDeleteId),
                            1
                        );
                    }
                    //and finally, delete the frame
                    Vue.delete(
                        state.frameObjects,
                        payload.frameToDeleteId
                    );
                }
            }
            generateFrameMap(state.frameObjects,state.frameMap);
        },

        updateFramesOrder(state, payload: {event: any; eventParentId: number}) {
            const eventType = Object.keys(payload.event)[0];
            //If we are moving a joint frame the list to be updated is it's parents jointFrameIds list.
            const listToUpdate = (payload.event[eventType].element.jointParentId > 0 ) ?
                state.frameObjects[payload.eventParentId].jointFrameIds : 
                state.frameObjects[payload.eventParentId].childrenIds;

            if (eventType === "added") {
                // Add the id to the parent's childrenId list
                listToUpdate.splice(
                    payload.event[eventType].newIndex,
                    0,
                    payload.event[eventType].element.id
                );

                // Set the new parentId/jointParentId to the added frame
                Vue.set(
                    state.frameObjects[payload.event[eventType].element.id],
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

            // Update the frameMap
            if(eventType !== "removed"){
                generateFrameMap(state.frameObjects,state.frameMap);
            }
        },

        // It may be called more than once from the same place and thus requires the editing value
        setEditFlag(state, editing) {
            Vue.set(
                state,
                "isEditing", 
                editing
            );
        },

        setEditableFocus(state, payload: EditableFocusPayload) {
            Vue.set(
                state.frameObjects[payload.frameId].contentDict[payload.slotId],
                "focused",
                payload.focused
            );
        },

        changeCaretWithKeyboard(state, payload: NavigationPayload) {
            
            const currId = state.currentFrame.id;
            const currPosition = state.currentFrame.caretPosition;

            //Turn off previous caret 
            Vue.set(
                state.frameObjects[currId],
                "caretVisibility",
                CaretPosition.none
            );

            const currentCaret: CurrentFrame = {id: currId, caretPosition: currPosition};
            const listOfCaretPositions = payload.availablePositions.filter(((e)=> e.slotNumber === false));
            // Where is the current in the list
            const currentCaretIndex = listOfCaretPositions.findIndex((e) => e.id===currentCaret.id && e.caretPosition === currentCaret.caretPosition)

            const delta = (payload.key === "ArrowDown")?1:-1;
            const nextCaret = listOfCaretPositions[currentCaretIndex + delta]??currentCaret;

            Vue.set(
                state.currentFrame,
                "id",
                nextCaret.id
            );

            Vue.set(
                state.currentFrame,
                "caretPosition",
                nextCaret.caretPosition
            );

            Vue.set(
                state.frameObjects[nextCaret.id],
                "caretVisibility",
                nextCaret.caretPosition
            );

        },

        setCurrentFrame(state, newCurrentFrame: CurrentFrame) {
            Vue.set(
                state.frameObjects[state.currentFrame.id],
                "caretVisibility",
                CaretPosition.none
            );
            Vue.set(
                state.currentFrame,
                "id",
                newCurrentFrame.id
            );

            Vue.set(
                state.currentFrame,
                "caretPosition",
                newCurrentFrame.caretPosition
            );

            Vue.set(
                state.frameObjects[newCurrentFrame.id],
                "caretVisibility",
                newCurrentFrame.caretPosition
            );
        },

        setCurrentInitCodeValue(state, payload: {frameId: number; slotId: number}){
            Vue.set(
                state,
                "currentInitCodeValue",
                state.frameObjects[payload.frameId].contentDict[payload.slotId].code
            )
        },

        setFrameEditableSlotContent(state, payload: EditableSlotPayload){
            Vue.set(
                state.frameObjects[payload.frameId].contentDict[payload.slotId],
                "code",
                payload.code
            );
        },

        setSlotErroneous(state, payload: {frameId: number; slotIndex: number; error: string}) {
            const existingError =  state.frameObjects[payload.frameId].contentDict[payload.slotIndex].error;
            const existingErrorBits = existingError.split("\n");
            // Sometimes we need to extend the error, if more than one different errors are on the same slot
            if(!existingErrorBits.includes(payload.error)){
                const newError = (existingError === "" || payload.error === "") ? payload.error: (existingError +"\n" + payload.error);
                Vue.set(
                    state.frameObjects[payload.frameId].contentDict[payload.slotIndex],
                    "error",
                    newError
                );
            }           
        },

        setFrameErroneous(state, payload: {frameId: number; error: string}){
            const existingError =  state.frameObjects[payload.frameId].error;
            // Sometimes we need to extend the error, if more than one errors are on the same frame
            const newError = (existingError === "" || payload.error === "" ) ? payload.error: (existingError +"\n" + payload.error);
            Vue.set(
                state.frameObjects[payload.frameId],
                "error",
                newError
            );
        },

        clearAllErrors(state) {
            Object.keys(state.frameObjects).forEach((id: any) => {
                if(state.frameObjects[id].error !==""){
                    Vue.set(
                        state.frameObjects[id],
                        "error",
                        ""
                    );
                }
                Object.keys(state.frameObjects[id].contentDict).forEach((slot: any) => {
                    Vue.set(
                        state.frameObjects[id].contentDict[slot],
                        "error",
                        ""
                    );
                });
            });  
        },

        addPreCompileErrors(state, id: string ) {
            //if it exists remove it else add it
            if(!state.preCompileErrors.includes(id)) {
                state.preCompileErrors.push(id);
            }
        },

        removePreCompileErrors(state, id: string ) {
            //if it exists remove it else add it
            if(state.preCompileErrors.includes(id)) {
                state.preCompileErrors.splice(state.preCompileErrors.indexOf(id),1);
            }
        },
        
        setMessageBanner(state, messageType: MessageDefinition) {
            Vue.set(
                state,
                "currentMessage",
                messageType
            );
        },

        updateNextAvailableId(state) {
            Vue.set( 
                state,
                "nextAvailableId",  
                Math.max.apply({},(Object.keys(state.frameObjects).concat(Object.keys(state.copiedFrames))).map(Number))+1
            );
        },
        
        copyFrame(state, frameId: number) {
            Vue.set( 
                state,
                "copiedFrameId",  
                state.nextAvailableId
            );
            // If it has a JointParent, we're talking about a JointFrame
            const isJointFrame = state.frameObjects[frameId].frameType.isJointFrame;
            
            const parent = (isJointFrame)? state.frameObjects[frameId].jointParentId : state.frameObjects[frameId].parentId;

            cloneFrameAndChildren(state.frameObjects, frameId, parent, {id: state.nextAvailableId}, state.copiedFrames);             
        },

        copySelection(state) {

            // If it has a JointParent, we're talking about a JointFrame
            const isJointFrame = state.frameObjects[state.selectedFrames[0]].frameType.isJointFrame;
            
            const parent = (isJointFrame)? state.frameObjects[state.selectedFrames[0]].jointParentId : state.frameObjects[state.selectedFrames[0]].parentId;

            // We generate the list of frames from the selectedFrames ids
            const sourceFrameList: EditorFrameObjects = {};
            state.selectedFrames.forEach((id) => sourceFrameList[id] = state.frameObjects[id])
            
            // All the top level cloned frames need to be stored in order to then added to their new parent's list
            const topLevelCopiedFrames: number[] = [];
            let nextAvailableId = state.nextAvailableId;

            Object.values(sourceFrameList).forEach( (frame) => {
                //For each top level frame (i.e. each one on the selected list) we record its new id
                topLevelCopiedFrames.push(nextAvailableId)
                cloneFrameAndChildren(state.frameObjects, frame.id, parent, {id: nextAvailableId}, state.copiedFrames); 
                // Find the largest id form the copied and increase it by 1
                nextAvailableId = Math.max.apply({},(Object.keys(state.copiedFrames).concat(Object.keys(state.copiedFrames))).map(Number)) + 1;
            });

            Vue.set( 
                state,
                "copiedSelectionFrameIds",  
                topLevelCopiedFrames
            );

        },

        setCaretVisibility(state, payload: {frameId: number; caretVisibility: CaretPosition}) {
            Vue.set(
                state.frameObjects[payload.frameId],
                "caretVisibility",
                payload.caretVisibility
            );
        },

        updateState(state, newState){
            //this method complete changes the state with a new state object
            Object.keys(state).forEach((property) => {
                Vue.set(
                    state,
                    property,
                    newState[property]
                );
            } );

            //undo redo is cleared
            state.diffToPreviousState.splice(0,state.diffToPreviousState.length);
            state.diffToNextState.splice(0,state.diffToNextState.length);
            
            //copied frames are cleared
            Vue.set(
                state,
                "copiedFrameId",
                -100
            );
            Vue.set(
                state,
                "copiedFrames",
                {}
            )

            //context menu indicator is cleared
            Vue.set(
                state,
                "contextMenuShownId",
                ""
            )
        },

        saveStateChanges(state, payload: {previousState: Record<string, unknown>; mockCurrentCursorFocus?: EditableFocusPayload}) {
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
                backupCurrentFrame = state.currentFrame;
                backupCurrentFocus = state.frameObjects[payload.mockCurrentCursorFocus.frameId].contentDict[payload.mockCurrentCursorFocus.slotId].focused;
                backupCurrentFrameVisibility = state.frameObjects[state.currentFrame.id].caretVisibility;
                state.frameObjects[payload.mockCurrentCursorFocus.frameId].contentDict[payload.mockCurrentCursorFocus.slotId].focused = false;
                state.currentFrame = {id: 0, caretPosition: CaretPosition.none};
                state.frameObjects[payload.mockCurrentCursorFocus.frameId].caretVisibility = CaretPosition.none;
            }
           

            state.diffToPreviousState.push(getObjectPropertiesDifferences(state, payload.previousState));
            //don't exceed the maximum of undo steps allowed
            if(state.diffToPreviousState.length > undoMaxSteps) {
                state.diffToPreviousState.splice(
                    0,
                    1
                );
            }
            //we clear the diffToNextState content as we are now starting a new sequence of actions
            state.diffToNextState.splice(
                0,
                state.diffToNextState.length
            );

            if(payload.mockCurrentCursorFocus !== undefined){
                //revert the mock changes in the state
                state.frameObjects[payload.mockCurrentCursorFocus.frameId].contentDict[payload.mockCurrentCursorFocus.slotId].focused = backupCurrentFocus;
                state.currentFrame = backupCurrentFrame;
                state.frameObjects[backupCurrentFrame.id].caretVisibility = backupCurrentFrameVisibility;
            }
        },

        applyStateUndoRedoChanges(state, isUndo: boolean){
            //flags for performing a change of current caret
            let changeCaret = false;
            let newCaretId = 0;
            const oldCaretId = state.currentFrame.id;

            //performing the change if there is any change recorded in the state
            let changeList = [] as ObjectPropertyDiff[];
            if(isUndo) {
                changeList = state.diffToPreviousState.pop()??[];
            }
            else {
                changeList = state.diffToNextState.pop()??[];
            }

            const stateBeforeChanges = JSON.parse(JSON.stringify(state));
            if(changeList.length > 0){
                //this flag stores the arrays that need to be "cleaned" (i.e., removing the null elements)
                const arraysToClean = [] as {[id: string]: any}[];

                //precompiled errors on editor slots are not saved for undo/redo
                //so if there is a change on an editable slot value in the change list, we clear the errors for that slot
                //so that the errors are still correct once undo/redo is applied
                //note : we do it in a separate foreach to be sure we dont clear errors if they were supposed to be marked
                const checkErrorChangeEntry: ObjectPropertyDiff|undefined = changeList.find((changeEntry: ObjectPropertyDiff) => (changeEntry.propertyPathWithArrayFlag.match(/\.contentDict_false\.\d*_false\.code$/)?.length??0) > 0);
                if(checkErrorChangeEntry){
                    const changePath = checkErrorChangeEntry.propertyPathWithArrayFlag;
                    let indexOfId = "frameObjects_false.".length;
                    const frameId = changePath.substr(indexOfId,changePath.indexOf("_",indexOfId)-indexOfId);
                    indexOfId = changePath.indexOf(".contentDict_false.") + ".contentDict_false.".length; 
                    const slotId = changePath.substr(indexOfId,changePath.indexOf("_",indexOfId)-indexOfId);
                    if(state.preCompileErrors.includes(getEditableSlotUIID(parseInt(frameId), parseInt(slotId)))) {
                        state.preCompileErrors.splice(state.preCompileErrors.indexOf(getEditableSlotUIID(parseInt(frameId), parseInt(slotId))),1);
                        state.frameObjects[parseInt(frameId)].contentDict[parseInt(slotId)].error="";
                    }
                }

                //if the value in the changes isn't "null" --> replaced/add, otherwise, delete.
                changeList.forEach((changeEntry: ObjectPropertyDiff) => {
                    //we reconstruct what in the state should be changed based on the difference path
                    const stateParts = changeEntry.propertyPathWithArrayFlag.split(".");
                    const property = stateParts[stateParts.length -1];
                    stateParts.pop();
                    let statePartToChange = state as {[id: string]: any};
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
                        if(statePartToChange === state.currentFrame && property==="id"){
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
                    if(state.frameMap.includes(oldCaretId)){
                        Vue.set(
                            state.frameObjects[oldCaretId],
                            "caretVisibility",
                            CaretPosition.none
                        );
                    }
        
                    Vue.set(
                        state.currentFrame,
                        "caretPosition",
                        state.frameObjects[newCaretId].caretVisibility
                    );
                }

                //keep the arrays of changes in sync with undo/redo sequences
                const stateDifferences = getObjectPropertiesDifferences(state, stateBeforeChanges);
                if(isUndo){
                    state.diffToNextState.push(stateDifferences);
                }
                else{
                    state.diffToPreviousState.push(stateDifferences);        
                }
            }
        },

        setContextMenuShownId(state, id: string) {
            Vue.set(state, "contextMenuShownId", id);
        },  
        
        changeDisableFrame(state, payload: {frameId: number; isDisabling: boolean; ignoreEnableFromRoot?: boolean}) {
            //if we enable, we may need to use the root frame ID instead of the frame ID where the menu has been invocked
            //because enabling a frame enables all the frames for that disabled "block" (i.e. the top disabled frame and its children/joint frames)
            const rootFrameID = (payload.isDisabling || (payload.ignoreEnableFromRoot??false)) ? payload.frameId : getDisabledBlockRootFrameId(state.frameObjects, payload.frameId);

            //When we disable or enable a frame, we also disable/enable all the sublevels (children and joint frames)
            const allFrameIds = [rootFrameID];
            allFrameIds.push(...getAllChildrenAndJointFramesIds(state.frameObjects, rootFrameID));
            allFrameIds.forEach((frameId) => {
                Vue.set(
                    state.frameObjects[frameId],
                    "isDisabled",
                    payload.isDisabling
                );

                //if disabling [resp. enabling], we also need to remove [resp. add] potential errors of empty editable slots
                if(payload.isDisabling){
                    Object.keys(state.frameObjects[frameId].contentDict).forEach((slotIndex: string) => {
                        Vue.set(
                            state.frameObjects[frameId].contentDict[Number.parseInt(slotIndex)],
                            "error",
                            ""
                        );

                        const uiid = getEditableSlotUIID(frameId, Number.parseInt(slotIndex));
                        if(state.preCompileErrors.includes(uiid)) {
                            state.preCompileErrors.splice(state.preCompileErrors.indexOf(uiid),1);
                        }
                    });
                } 
                else{
                    Object.keys(state.frameObjects[frameId].contentDict).forEach((slotIndex: string) => {
                        const optionalSlot = state.frameObjects[payload.frameId].frameType.labels[Number.parseInt(slotIndex)].optionalSlot ?? true
                        if(!optionalSlot && state.frameObjects[frameId].contentDict[Number.parseInt(slotIndex)].code.trim().length == 0){
                            Vue.set(
                                state.frameObjects[frameId].contentDict[Number.parseInt(slotIndex)],
                                "error",
                                i18n.t("errorMessage.emptyEditableSlot")
                            );
    
                            const uiid = getEditableSlotUIID(frameId, Number.parseInt(slotIndex));
                            state.preCompileErrors.push(uiid)
                        }
                    });
                }                 
            });
        },

        setProjectName(state, newName) {
            Vue.set(state, "projectName", newName);
        },

        setIgnoredDragAction(state, value: boolean){
            Vue.set(state, "ignoredDragAction", value);
        },

        selectDeselectFrame(state, payload: {frameId: number; direction: string}) {
            const indexOfFrame = state.selectedFrames.indexOf(payload.frameId)
            // if it exists remove it
            if(indexOfFrame > -1) {
                state.selectedFrames.splice(indexOfFrame,1);
            }
            // else it may be added
            else { 
                state.selectedFrames.splice((payload.direction === "up") ? 0 : state.selectedFrames.length, 0, payload.frameId);
            }
        },

        unselectAllFrames(state) {
            state.selectedFrames.splice(0,state.selectedFrames.length);
        },

        flushCopiedFrames(state){
            Vue.set(
                state,
                "copiedFrames",
                {}
            );

            Vue.set(
                state,
                "copiedFrameId",
                -100
            );

            Vue.set(
                state,
                "copiedSelectionFrameIds",
                []
            );
        },

        makeSelectedFramesVisible(state){
            state.selectedFrames.forEach( (id) =>
                Vue.set(
                    state.frameObjects[id],
                    "isVisible",
                    true
                ));
        },

        removeMultiDragStyling(state) {
            state.selectedFrames.forEach( (id) => {
                Vue.set(
                    state.frameObjects[id],
                    "multiDragPosition",
                    ""
                );
            });
        },

        setAcResults(state, value: AcResultsWithModule){
            Vue.set(
                state,
                "acResults",
                value
            );
        },
        
        setEditableSlotViaKeyboard(state, payload: EditableSlotReachInfos) {
            Vue.set(state, "editableSlotViaKeyboard", payload);
        },

        setIgnoreKeyEvent(state, value: boolean){
            Vue.set(state, "ignoreKeyEvent", value);
        },

        setDAPWrapper(state, wrapper: DAPWrapper){
            Vue.set(state, "DAPWrapper", wrapper);
        },

        setPreviousDAPWrapper(state, wrapper: DAPWrapper){
            Vue.set(state, "previousDAPWrapper", wrapper);
        },
    },

    actions: {
        updateFramesOrder({getters, commit, state }, payload: {event: any; eventParentId: number}) {
            if(state.ignoredDragAction){
                //if the action should be ignore, just return and reset the flag
                commit(
                    "setIgnoredDragAction",
                    false
                );

                return;
            }

            commit("unselectAllFrames");

            const eventType = Object.keys(payload.event)[0];

            //before the adding or at the moving step, we make a backup of the state to be used by undo/redo and inside the mutation method updateFramesOrder()
            if(eventType !== "removed"){
                commit(
                    "updateStateBeforeChanges",
                    false
                );
            }
            
            
            const isJointFrame = getters.getIsJointFrameById(payload.event[eventType].element.id);

            const position: CaretPosition = (isJointFrame)?
                CaretPosition.below:
                CaretPosition.body;

            // Even in the same draggable group, some JointFrames cannot be moved (i.e. an elif below an else)
            // That should be checked both ways as for example if you move an `else` above an elif, it may be
            // valid, as the if accepts else there, but the elif cannot go below the else.
            // getIfPositionAllowsFrame() is used as it checks if a frame can be landed on a position     
            // succeedingFrame is the next frame (if it exists) above which we are adding
            const succeedingFrame = state.frameObjects[payload.eventParentId].jointFrameIds[payload.event[eventType].newIndex];   
            const jointFrameIds = state.frameObjects[payload.eventParentId].jointFrameIds;
            if(eventType !== "removed") {
                // EXAMPLE: Moving frame `A` above Frame `B`
                // IF `A` cannot be moved on this position 
                //                OR
                // IF `A` is jointFrame and there IS a frame `B` where I am moving `A` at
                //     on TRUE ==> Check if `B` CANNOT be placed below `A` / CANNOT be the trailing joint frame
                //     on FALSE ==> We don't care about this situation
                const jointFrameCase = (isJointFrame && jointFrameIds.length > 0)
                    ? (succeedingFrame !== undefined)
                        ? !getters.getIfPositionAllowsFrame(payload.event[eventType].element.id, CaretPosition.below, succeedingFrame)
                        : !getters.getIfPositionAllowsFrame(payload.event[eventType].element.id, CaretPosition.below, jointFrameIds[jointFrameIds.length - 1])
                    : false;

                if((!isJointFrame && !getters.getIfPositionAllowsFrame(payload.eventParentId, position, payload.event[eventType].element.id)) || jointFrameCase) {       
                    //in the case of a 2 step move (when moving from one group to another) we set the flag to ignore the DnD changes
                    if(eventType === "added"){
                        commit(
                            "setIgnoredDragAction",
                            true
                        );
                    }

                    //alert the user about a forbidden move
                    commit(
                        "setMessageBanner",
                        MessageDefinitions.ForbiddenFrameMove
                    );
    
                    //don't leave the message for ever
                    setTimeout(()=>commit(
                        "setMessageBanner",
                        MessageDefinitions.NoMessage
                    ), 3000);         
                    return;
                }
            }

            commit(
                "updateFramesOrder",
                payload
            );

            //after the removing or at the moving step, we use the backup of the state for setting "isDisabled", prepare for undo/redo and clear the backup off
            if(eventType !== "added"){
                // Set the right value for "isDisabled"
                const srcFrameId = payload.event[eventType].element.id as number;
                const destContainerId = (state.frameObjects[srcFrameId].jointParentId > 0)
                    ? state.frameObjects[srcFrameId].jointParentId
                    : state.frameObjects[srcFrameId].parentId;
                const changeDisableInfo = checkDisabledStatusOfMovingFrame(state.stateBeforeChanges.frameObjects, srcFrameId, destContainerId);
                if(changeDisableInfo.changeDisableProp){
                    this.commit(
                        "changeDisableFrame",
                        {frameId: srcFrameId, isDisabling: changeDisableInfo.newBoolPropVal, ignoreEnableFromRoot: true}
                    );
                }    

                //save the state changes for undo/redo
                commit(
                    "saveStateChanges",
                    {                   
                        previousState: state.stateBeforeChanges,
                    }
                );

                //clear the stateBeforeChanges flag off
                commit(
                    "updateStateBeforeChanges",
                    true
                );
            }
        },

        setFrameEditableSlotContent({state, commit}, payload: EditableSlotPayload) {
            //This action is called EVERY time a unitary change is made on the editable slot.
            //We save changes at the entire slot level: therefore, we need to remove the last
            //previous state to replace it with the difference between the state even before and now;            
            let stateBeforeChanges = {};
            if(!payload.isFirstChange){
                state.diffToPreviousState.pop();
                state.frameObjects[payload.frameId].contentDict[payload.slotId].code = payload.initCode;  
            }

            //save the previous state
            stateBeforeChanges = JSON.parse(JSON.stringify(state));

            commit(
                "setFrameEditableSlotContent",
                payload
            );

            //save state changes
            commit(
                "saveStateChanges",
                {
                    previousState: stateBeforeChanges,
                    mockCurrentCursorFocus: {
                        frameId: payload.frameId,
                        slotId: payload.slotId,
                        focused: true,
                    },
                }
            );
        },

        updateErrorsOnSlotValidation({state, commit, getters}, payload: EditableSlotPayload) {            
            commit(
                "setEditFlag",
                false
            );

            if(state.frameObjects[payload.frameId]){
                commit(
                    "setEditableFocus",
                    {
                        frameId: payload.frameId,
                        slotId: payload.slotId,
                        focused: false,
                    }
                );

                commit(
                    "setCurrentInitCodeValue",
                    {
                        frameId: payload.frameId,
                        slotId: payload.slotId,
                    }
                )

                const optionalSlot = state.frameObjects[payload.frameId].frameType.labels[payload.slotId].optionalSlot ?? true;
                const errorMessage = getters.getErrorForSlot(payload.frameId,payload.slotId);
                if(payload.code !== "") {
                    //if the user entered text on previously left blank slot, remove the error
                    if(!optionalSlot && errorMessage === i18n.t("errorMessage.emptyEditableSlot")) {
                        commit(
                            "setSlotErroneous", 
                            {
                                frameId: payload.frameId, 
                                slotIndex: payload.slotId, 
                                error: "",
                            }
                        );
                        commit("removePreCompileErrors", getEditableSlotUIID(payload.frameId, payload.slotId));                
                    }
                    //if there is still an error here, it may be an error from tigerpython. We clear them here as they'll show up when required (e.g. downloading the file)
                    if(errorMessage !== i18n.t("errorMessage.emptyEditableSlot")){
                        commit(
                            "setSlotErroneous", 
                            {
                                frameId: payload.frameId, 
                                slotIndex: payload.slotId, 
                                error: "",
                            }
                        );
                    }
                }
                else if(!optionalSlot){
                    commit(
                        "setSlotErroneous", 
                        {
                            frameId: payload.frameId, 
                            slotIndex: payload.slotId,  
                            error: i18n.t("errorMessage.emptyEditableSlot"),
                        }
                    );
                    commit("addPreCompileErrors", getEditableSlotUIID(payload.frameId, payload.slotId));
                }
            }
        },

        setFocusEditableSlot({commit}, payload: {frameId: number; slotId: number; caretPosition: CaretPosition}){            
            commit(
                "setCurrentInitCodeValue",
                {
                    frameId: payload.frameId,
                    slotId: payload.slotId,
                }
            )
            
            commit(
                "setEditFlag",
                true
            );

            //First set the curretFrame to this frame
            commit(
                "setCurrentFrame",
                {
                    id: payload.frameId,
                    caretPosition: payload.caretPosition,
                }
            );
            //Then store which editable has the focus
            commit(
                "setEditableFocus",
                {
                    frameId: payload.frameId,
                    slotId: payload.slotId,
                    focused: true,
                }
            );   
        
            commit("unselectAllFrames");
        },

        undoRedo({ state, commit }, isUndo: boolean) {
            //check if the undo/redo list is empty BEFORE doing any action
            const isEmptyList = (isUndo) ? state.diffToPreviousState.length == 0 : state.diffToNextState.length == 0;
            
            if(isEmptyList){
                //no undo or redo can performed: inform the user on a temporary message
                commit(
                    "setMessageBanner",
                    (isUndo) ? MessageDefinitions.NoUndo : MessageDefinitions.NoRedo
                );

                //don't leave the message for ever
                setTimeout(()=>commit(
                    "setMessageBanner",
                    MessageDefinitions.NoMessage
                ), 2000);
            }
            else{
                //a undo/redo can be performed: do the action
                commit(
                    "applyStateUndoRedoChanges",
                    isUndo 
                );
            }

            commit("unselectAllFrames");
        },

        changeCaretPosition({ commit }, payload: NavigationPayload) {
            commit(
                "changeCaretWithKeyboard",
                payload
            );
            
            commit("unselectAllFrames");
        },

        addFrameWithCommand({ commit, state, dispatch }, payload: {frame: FramesDefinitions; availablePositions: NavigationPosition[]}) {

            const stateBeforeChanges = JSON.parse(JSON.stringify(state));
            const currentFrame = state.frameObjects[state.currentFrame.id];
            const addingJointFrame = payload.frame.isJointFrame;

            // find parent id 
            let parentId = 0
            let listToUpdate: number[] = [];
            let indexToAdd = 0;

            // The frame by which we have to contextualise the addition
            // current frame by default (on caret==body)
            let  focusedFrame: FrameObject = currentFrame

            if(state.currentFrame.caretPosition === CaretPosition.below) {
                focusedFrame = state.frameObjects[currentFrame.parentId]
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
                    listToUpdate = state.frameObjects[focusedFrame.jointParentId].jointFrameIds
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
                frameType: payload.frame,
                id: state.nextAvailableId++,
                parentId: addingJointFrame ? 0 : parentId, // Despite we calculated parentID earlier, it may not be used
                jointParentId: addingJointFrame ? parentId : 0,
                contentDict:
                    //find each editable slot and create an empty & unfocused entry for it
                    //optional labels are not visible by default, not optional labels are visible by default
                    payload.frame.labels.filter((el)=> el.slot).reduce(
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
                state.frameObjects,
                newFrame.id,
                newFrame
            );
        
            generateFrameMap(state.frameObjects,state.frameMap);

            // We need a list to store the navigational positions of this newly added frame,
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
            const indexOfCurrent = payload.availablePositions.findIndex((e) => e.id===state.currentFrame.id && e.caretPosition === state.currentFrame.caretPosition)
            
            // the old positions, with the new ones added at the right place
            // done here as we cannot splice while giving it as input
            payload.availablePositions.splice(indexOfCurrent+1,0,...newFramesCaretPositions)

            //"move" the caret along
            dispatch(
                "leftRightKey",
                { 
                    key: "ArrowRight",
                    availablePositions: payload.availablePositions,
                }
            ).then(
                () => 
                    //save state changes
                    commit(
                        "saveStateChanges",
                        {                 
                            previousState: stateBeforeChanges,
                        }
                    )
            );
            
            commit("unselectAllFrames");
        },

        deleteFrames({commit, state}, payload: NavigationPayload){
            const stateBeforeChanges = JSON.parse(JSON.stringify(state));

            // we remove the editable slots from the available positions
            const availablePositions = payload.availablePositions.filter((e) => e.slotNumber === false);

            let showDeleteMessage = false;

            //we create a list of frames to delete that is either the elements of a selection OR the current frame's position
            let framesIdToDelete = [state.currentFrame.id];

            //If a selection is deleted, we don't distinguish between "del" and "backspace": 
            //We move the caret at the last element of the selection, and perform "backspace" for each element of the selection
            if(state.selectedFrames.length > 0){
                if(state.selectedFrames[state.selectedFrames.length-1] !== state.currentFrame.id){
                    commit("setCurrentFrame", {id: state.selectedFrames[state.selectedFrames.length-1], caretPosition: CaretPosition.below});
                }
                payload.key = "Backspace";
                framesIdToDelete = state.selectedFrames.reverse();
                //this flag to show the delete message is set on a per frame deletion basis,
                //but here we could have 3+ single frames delete, so we need to also check to selection length.
                showDeleteMessage = state.selectedFrames.length > 3;
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


                const currentFrame = state.frameObjects[currentFrameId];

                // Create the list of children + joints with which the caret will work with
                // const parentId = getParent(state.frameObjects,currentFrame);

                // const listOfSiblings = 
                // childrenListWithJointFrames(
                //     state.frameObjects, 
                //     currentFrame.id, 
                //     state.currentFrame.caretPosition,
                //     "down"
                // );

                // const indexOfCurrentFrame = listOfSiblings.indexOf(currentFrame.id);
                let frameToDelete: NavigationPosition = {id:-100};
                let deleteChildren = false;

                if(payload.key === "Delete"){
                    
                    // Where the current sits in the available positions
                    const indexOfCurrentInAvailables = availablePositions.findIndex((e)=> e.id === currentFrame.id && e.caretPosition === state.currentFrame.caretPosition);
                    // the "next" position of the current
                    frameToDelete = availablePositions[indexOfCurrentInAvailables+1]??{id:-100}
                    
                    // The only time to prevent deletion with 'delete' is when next posision is a joint root's below OR a method declaration bellow
                    if( (state.frameObjects[frameToDelete.id]?.frameType.allowJointChildren  || state.frameObjects[frameToDelete.id]?.frameType.type === FuncDefDefinition.type)
                         && frameToDelete.caretPosition === CaretPosition.below){
                        frameToDelete.id = -100
                    }
                }
                else {
                    if (currentFrame.id > 0) {
                        if(state.currentFrame.caretPosition === CaretPosition.body ){
                            //we just make sure the frame to delete isn't a function definition frame:
                            //we can't delete a function def frame with backspace in its body because it will result
                            //in its content put directly into the function defs container. So we just alert the users.
                            if(currentFrame.frameType.type !== FuncDefDefinition.type){
                                //just move the cursor one level up
                                commit(
                                    "changeCaretWithKeyboard",
                                    payload
                                );
                            }
                            else{
                                //just show the user a message and do nothing else
                                commit(
                                    "setMessageBanner",
                                    MessageDefinitions.FunctionFrameCantDelete
                                );
                
                                //don't leave the message for ever
                                setTimeout(()=>commit(
                                    "setMessageBanner",
                                    MessageDefinitions.NoMessage
                                ), 7000);
                                return;
                            }
                        }
                        else{
                            const newCurrent = availablePositions[availablePositions.findIndex((e)=> e.id===currentFrame.id)-1]??state.currentFrame
                            commit(
                                "setCurrentFrame",
                                {id: newCurrent.id, caretPosition: newCurrent.caretPosition}
                            );
                            deleteChildren = true;
                        }
                        frameToDelete.id = currentFrame.id;
                    }
                }

                //Delete the frame if a frame to delete has been found
                if(frameToDelete.id > 0){
                    //before actually deleting the frame(s), we check if the user should be notified of a large deletion
                    if(countRecursiveChildren(
                        state.frameObjects,
                        frameToDelete.id,
                        3
                    ) >= 3){
                        showDeleteMessage = true;
                    }

                    commit(
                        "deleteFrame",
                        {
                            key:payload.key,
                            frameToDeleteId: frameToDelete.id,  
                            deleteChildren: deleteChildren,
                        }
                    );
                }  
            });

            //clear the selection of frames
            commit("unselectAllFrames");
                       
            //save state changes
            commit(
                "saveStateChanges",
                {
                    previousState: stateBeforeChanges,
                }
            );

            //we show the message of large deletion after saving state changes as this is not to be notified.
            if(showDeleteMessage){
                commit(
                    "setMessageBanner",
                    MessageDefinitions.LargeDeletion
                );

                //don't leave the message for ever
                setTimeout(()=>commit(
                    "setMessageBanner",
                    MessageDefinitions.NoMessage
                ), 7000);
            }
        },
        
        deleteFrameFromSlot({commit, dispatch, state}, payload: DeleteFromSlotPayload){            
            // Before we delete the frame, we need to "invalidate" the key events: as this action (deleteFrameFromSlot) is triggered on a key down event, 
            // when the key (backspace) is released, the key up event is fired, but since the frame is deleted, 
            // the event is caught at the window level (and since we are no more in editing mode, the deletion method is called again). So we invalidate the 
            // key event momently so that this window key up event is ignored.
            // Furthermore, we make sure that the frame hasn't been already deleted: in case a long press, we don't want to have many deletion
            // triggered from "stacked" calls to this method
            if(state.frameObjects[payload.frameId]){
                commit("setIgnoreKeyEvent", true);
                dispatch(
                    "deleteFrames",
                    {
                        key: "Backspace",
                        availablePositions : payload.availablePositions,
                    }
                );  
            }
        },

        toggleCaret({ commit }, newCurrent) {
            commit(
                "setCurrentFrame",
                newCurrent
            );
            
            commit("unselectAllFrames");
        },

        leftRightKey({commit, state} , payload: NavigationPayload) {

            //  used for moving index up (+1) or down (-1)
            const directionDown = payload.key === "ArrowRight";
            const directionDelta = (directionDown)?+1:-1;

            let currentFramePosition;

            if (state.isEditing){ 
                const currentEditableSlots = Object.entries(state.frameObjects[state.currentFrame.id].contentDict).filter((slot) => slot[1].shownLabel);
                const posOfCurSlot = currentEditableSlots.findIndex((slot) => slot[1].focused);
                currentFramePosition = payload.availablePositions.findIndex( (e) => e.slotNumber === posOfCurSlot && e.id === state.currentFrame.id); 
            }
            else {
                currentFramePosition = payload.availablePositions.findIndex( (e) => e.caretPosition === state.currentFrame.caretPosition && e.id === state.currentFrame.id); 
            }
            
            const nextPosition = (payload.availablePositions[currentFramePosition+directionDelta]??payload.availablePositions[currentFramePosition])                        

            // irrespective to where we are going to, we need to make sure to hide current caret
            Vue.set(
                state.frameObjects[state.currentFrame.id],
                "caretVisibility",
                CaretPosition.none
            );

            // If next position is an editable slot
            if( nextPosition.slotNumber !== false) {
                commit(
                    "setEditFlag",
                    true
                );
                const slotReachInfos: EditableSlotReachInfos = {isKeyboard: true, direction: directionDelta};
                commit("setEditableSlotViaKeyboard", slotReachInfos);

                commit(
                    "setEditableFocus",
                    {
                        frameId: nextPosition.id,
                        slotId: nextPosition.slotNumber,
                        focused: true,
                    }
                );
                
            }
            else {
                // else we set editFlag to false as we are moving to a caret position
                commit(
                    "setEditFlag",
                    false
                );

                Vue.set(
                    state.frameObjects[nextPosition.id],
                    "caretVisibility",
                    nextPosition.caretPosition
                );
       
                Vue.set(
                    state.currentFrame,
                    "caretPosition",
                    nextPosition.caretPosition
                );
            }

            //In any case change the current frame
            Vue.set(
                state.currentFrame,
                "id",
                nextPosition.id
            );

            
        },
        
        //Toggle the current frame label that matches the type specified in the payload.
        toggleFrameLabel({commit, state}, commandType: string) {
            const stateBeforeChanges = JSON.parse(JSON.stringify(state));

            //Get the FrameLabel (index) matching the type
            const frameLabeToTogglelIndex = state.frameObjects[state.currentFrame.id].frameType.labels.findIndex((frameLabel) => frameLabel?.toggleLabelCommand?.type === commandType);
            
            const changeShowLabelTo = !state.frameObjects[state.currentFrame.id].contentDict[frameLabeToTogglelIndex].shownLabel;
            //toggle the "shownLabel" property of in the contentDict for that label
            Vue.set(
                state.frameObjects[state.currentFrame.id].contentDict[frameLabeToTogglelIndex],
                "shownLabel",
                changeShowLabelTo
            );

            //update the precompiled errors based on the visibility of the label (if the label isn't shown, no error should be raised)
            const slotUIID = getEditableSlotUIID(state.currentFrame.id, frameLabeToTogglelIndex);
            if(changeShowLabelTo){
                //we show the label: add the slot in precompiled error if the slot is empty
                if(state.frameObjects[state.currentFrame.id].contentDict[frameLabeToTogglelIndex].code.trim().length == 0){
                    commit(
                        "addPreCompileErrors",
                        slotUIID
                    );
                }
            }
            else{
                //we hide the label: remove the slot in precompiled error
                commit(
                    "removePreCompileErrors",
                    slotUIID
                );
            }

            //save state changes
            commit(
                "saveStateChanges",
                {
                    previousState: stateBeforeChanges,
                }
            );
        },        
        
        setMessageBanner({commit}, message: MessageDefinition){
            commit("setMessageBanner", message);
        },

        setStateFromJSONStr({dispatch, commit}, payload: {stateJSONStr: string; errorReason?: string}){
            let isStateJSONStrValid = (payload.errorReason === undefined);
            let errorDetailMessage = payload.errorReason ?? "unknown reason";
            let isVersionCorrect = false;

            // If there is an error set because the file couldn't be retrieved
            // we don't check anything, just get to the error display.
            if(isStateJSONStrValid){

                // We need to check the JSON string is:
                // 1) a valid JSON description of an object --> easy, we can just try to convert
                // 2) an object that matches the state (checksum checker)
                // 3) if the object is valid, we just verify the version is correct (and attempt loading)
                
                try {
                    //Check 1)
                    const newStateObj = JSON.parse(payload.stateJSONStr);
                    if(!newStateObj || typeof(newStateObj) !== "object" || Array.isArray(newStateObj)){
                        //no need to go further
                        isStateJSONStrValid=false;
                        const error = i18n.t("errorMessage.dataNotObject");
                        //note: the following conditional test is only for TS... the message should always be found
                        errorDetailMessage = (typeof error === "string") ? error : "data doesn't describe object";
                    }
                    else{
                        // Check 2) as 1) is validated
                        if(!checkStateDataIntegrity(newStateObj)) {
                            isStateJSONStrValid = false;
                            const error = i18n.t("errorMessage.stateDataIntegrity")
                            //note: the following conditional test is only for TS... the message should always be found
                            errorDetailMessage = (typeof error === "string") ? error : "data integrity error"; 
                        } 
                        else {
                            // Check 3) as 2) is validated
                            isVersionCorrect = (newStateObj["version"] == AppVersion);
                            delete newStateObj["version"];
                        }          
                    }
                }
                catch(err){
                    //we cannot use the string arguemnt to retrieve a valid state --> inform the users
                    isStateJSONStrValid = false;
                    const error = i18n.t("errorMessage.wrongDataFormat");
                    //note: the following conditional test is only for TS... the message should always be found
                    errorDetailMessage = (typeof error === "string") ? error : "wrong data format";
                }
            }
            
            // Apply the change and indicate it to the user if we detected a valid JSON string
            // or alert the user we couldn't if we detected a faulty JSON string to represent the state
            if(isStateJSONStrValid){
                
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
                                dispatch(
                                    "doSetStateFromJSONStr",
                                    payload
                                );                                
                            }                        
                        },
                    })
                }
                else{
                    dispatch(
                        "doSetStateFromJSONStr",
                        payload
                    );   
                }                
            }
            else{
                const message = MessageDefinitions.UploadEditorFileError;
                const msgObj: FormattedMessage = (message.message as FormattedMessage);
                msgObj.args[FormattedMessageArgKeyValuePlaceholders.error.key] = msgObj.args.errorMsg.replace(FormattedMessageArgKeyValuePlaceholders.error.placeholderName, errorDetailMessage);

                commit(
                    "setMessageBanner",
                    message
                );
            }
        },

        doSetStateFromJSONStr({commit}, payload: {stateJSONStr: string; errorReason?: string}){
            commit(
                "updateState",
                JSON.parse(payload.stateJSONStr)
            )

            commit(
                "setMessageBanner",
                MessageDefinitions.UploadEditorFileSuccess
            );

            //don't leave the message for ever
            setTimeout(()=>commit(
                "setMessageBanner",
                MessageDefinitions.NoMessage
            ), 5000);  

        },

        // This method can be used to copy a frame to a position.
        // This can be a paste event or a duplicate event.
        copyFrameToPosition({commit, state}, payload: {frameId?: number; newParentId: number; newIndex: number}) {
            const stateBeforeChanges = JSON.parse(JSON.stringify(state));
            
            const isPasteOperation: boolean = (payload.frameId === undefined);
            payload.frameId = payload.frameId ?? state.copiedFrameId;

            // If it is not a paste operation, it is a duplication of the frame.
            const sourceFrameList: EditorFrameObjects = (isPasteOperation) ? state.copiedFrames : state.frameObjects;            
            const copiedFrames: EditorFrameObjects = {};
            cloneFrameAndChildren(sourceFrameList, payload.frameId, payload.newParentId, {id: state.nextAvailableId}, copiedFrames); 


            // Add the copied objects to the FrameObjects
            Object.keys(copiedFrames).map(Number).forEach((id: number)=> {
                Vue.set(
                    state.frameObjects,
                    id,
                    copiedFrames[id]
                )
            });
            
            const topFrame = copiedFrames[Object.keys(copiedFrames).map(Number)[0]];

            // It will be added either as a Child or as a JointChild
            const isJointFrame = sourceFrameList[payload.frameId].frameType.isJointFrame;
            const childrenListToBeAdded = (isJointFrame)? state.frameObjects[payload.newParentId].jointFrameIds : state.frameObjects[payload.newParentId].childrenIds;

            // Add the top frame to the its new parents children list
            childrenListToBeAdded.splice(
                payload.newIndex,
                0,
                topFrame.id
            );

            //Make the top new frame the current frame
            commit( "setCurrentFrame", { 
                id: topFrame.id,
                caretPosition: (topFrame.frameType.allowChildren) ? CaretPosition.body : CaretPosition.below,
            });

            commit( "updateNextAvailableId" );

            //if we do a paste, update the pasted frames' "isDisabled" property solely based on the parent's property
            if(isPasteOperation){
                this.commit(
                    "changeDisableFrame",
                    {frameId: topFrame.id, isDisabling: state.frameObjects[payload.newParentId].isDisabled, ignoreEnableFromRoot: true}
                );
            }

            generateFrameMap(state.frameObjects,state.frameMap);

            //save state changes
            commit(
                "saveStateChanges",
                {
                    previousState: stateBeforeChanges,
                }
            );
        
            commit("unselectAllFrames");
        },

        // This method can be used to copy the selected frames to a position.
        // This can be a paste event or a duplicate event.
        copySelectedFramesToPosition({commit, state, getters}, payload: {newParentId: number; newIndex?: number}) {
            const stateBeforeChanges = JSON.parse(JSON.stringify(state));
            // -100 is chosen so that TS won't complain for non-initialised variable
            let newIndex = payload.newIndex??-100;
            const areWeDuplicating = newIndex === -100;

            // If newIndex does not exist, we are talking about a duplication
            if(areWeDuplicating){
                // In that case, the duplicated selection goes below the last selected item
                newIndex = getters.getIndexInParent(state.selectedFrames[state.selectedFrames.length-1])+1;
            }

            // We generate the list of frames from the selectedFrames ids
            const sourceFrameList: EditorFrameObjects = (areWeDuplicating)?state.frameObjects:state.copiedFrames;
            const sourceFrameIds: number[] = (areWeDuplicating)?state.selectedFrames:state.copiedSelectionFrameIds;

            const copiedFrames: EditorFrameObjects = {};

            // All the top level cloned frames need to be stored in order to then added to their new parent's list
            const topLevelCopiedFrames: number[] = [];
            let nextAvailableId = state.nextAvailableId;

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
                    state.frameObjects,
                    id,
                    copiedFrames[id]
                )
            });
            commit( "updateNextAvailableId" );
            

            // It will be added either as a Child or as a JointChild
            const areSelectedJointFrames = sourceFrameList[sourceFrameIds[0]].frameType.isJointFrame;
            const childrenListToBeAdded = (areSelectedJointFrames)? state.frameObjects[payload.newParentId].jointFrameIds : state.frameObjects[payload.newParentId].childrenIds;

            // Add each one of the copied frames in their new parent's list
            topLevelCopiedFrames.forEach( (id) => {
                childrenListToBeAdded.splice(
                    newIndex++,
                    0,
                    id
                );
            });
            

            //Make the top new frame the current frame
            commit( "setCurrentFrame", { 
                id: topLevelCopiedFrames[topLevelCopiedFrames.length-1],
                caretPosition: CaretPosition.below,
            });

            commit( "updateNextAvailableId" );

            //if we do a paste, update the pasted frames' "isDisabled" property solely based on the parent's property
            if(!areWeDuplicating){
                topLevelCopiedFrames.forEach( (id) =>
                    this.commit(
                        "changeDisableFrame",
                        {
                            frameId: id, 
                            isDisabling: state.frameObjects[payload.newParentId].isDisabled, 
                            ignoreEnableFromRoot: true,
                        }
                    ))
            }

            generateFrameMap(state.frameObjects,state.frameMap);

            //save state changes
            commit(
                "saveStateChanges",
                {
                    previousState: stateBeforeChanges,
                }
            );
        
            commit("unselectAllFrames");
        },

        pasteFrame({dispatch, getters, state}, payload: {clickedFrameId: number; caretPosition: CaretPosition}) {
            // If the copiedFrame has a JointParent, we're talking about a JointFrame
            const isCopiedJointFrame = state.copiedFrames[state.copiedFrameId].frameType.isJointFrame;
            const isClickedJointFrame = state.frameObjects[payload.clickedFrameId].frameType.isJointFrame;

            // Clicked is joint ? parent of clicked is its joint parent ELSE clicked is the real parent
            const clickedParentId = (isClickedJointFrame)? state.frameObjects[payload.clickedFrameId].jointParentId: state.frameObjects[payload.clickedFrameId].parentId;

            // Index is 0 if we paste in the body OR we paste a JointFrame Below JointParent
            const index = (payload.caretPosition === CaretPosition.body || ( payload.caretPosition === CaretPosition.below && isCopiedJointFrame && !isClickedJointFrame)) ? 
                0 : 
                getters.getIndexInParent(payload.clickedFrameId)+1;

            // If the caret is below and it is not a joint frame, parent is the clicked's parent 
            const pasteToParentId = (payload.caretPosition === CaretPosition.body || (isCopiedJointFrame && !isClickedJointFrame) ) ?
                payload.clickedFrameId:   
                clickedParentId;
                
            // frameId is omitted from the action call, so that the method knows we talk about the copied frame!
            dispatch(
                "copyFrameToPosition",
                {
                    newParentId: pasteToParentId,
                    newIndex: index,
                }
            );
        },

        pasteSelection({dispatch, getters, state}, payload: {clickedFrameId: number; caretPosition: CaretPosition}) {
            // If the copiedFrame has a JointParent, we're talking about a JointFrame
            const areCopiedJointFrames = state.copiedFrames[state.copiedSelectionFrameIds[0]].frameType.isJointFrame;
            const isClickedJointFrame = state.frameObjects[payload.clickedFrameId].frameType.isJointFrame;

            // Clicked is joint ? parent of clicked is its joint parent ELSE clicked is the real parent
            const clickedParentId = (isClickedJointFrame)? state.frameObjects[payload.clickedFrameId].jointParentId: state.frameObjects[payload.clickedFrameId].parentId;

            // Index is 0 if we paste in the body OR we paste a JointFrame Below JointParent
            const index = (payload.caretPosition === CaretPosition.body || ( payload.caretPosition === CaretPosition.below && areCopiedJointFrames && !isClickedJointFrame)) ? 
                0 : 
                getters.getIndexInParent(payload.clickedFrameId)+1;

            // If the caret is below and it is not a joint frame, parent is the clicked's parent 
            const pasteToParentId = (payload.caretPosition === CaretPosition.body || (areCopiedJointFrames && !isClickedJointFrame) ) ?
                payload.clickedFrameId:   
                clickedParentId;
                
            // frameId is omitted from the action call, so that the method knows we talk about the copied frame!
            dispatch(
                "copySelectedFramesToPosition",
                {
                    newParentId: pasteToParentId,
                    newIndex: index,
                }
            );
        },

        copyFrame({commit}, frameId: number) {
            commit("flushCopiedFrames");
            commit(
                "copyFrame",
                frameId
            );
            commit( "updateNextAvailableId" );
        },

        copySelection({commit}) {
            commit("flushCopiedFrames");
            commit("copySelection");
            commit( "updateNextAvailableId" );
        },

        changeDisableFrame({state, commit}, payload: {frameId: number; isDisabling: boolean}) {
            const stateBeforeChanges = JSON.parse(JSON.stringify(state));

            commit(
                "changeDisableFrame",
                payload
            );
            
            //save state changes
            commit(
                "saveStateChanges",
                {
                    previousState: stateBeforeChanges,
                }
            );
        
            commit("unselectAllFrames");
        },

        changeDisableSelection({state, commit}, isDisabling: boolean) {
            const stateBeforeChanges = JSON.parse(JSON.stringify(state));

            state.selectedFrames.forEach( (id) =>
                commit(
                    "changeDisableFrame",
                    {
                        frameId: id,
                        isDisabling: isDisabling,
                    }
                ));
            
            //save state changes
            commit(
                "saveStateChanges",
                {
                    previousState: stateBeforeChanges,
                }
            );
        
            commit("unselectAllFrames");
        },

        selectMultipleFrames({state, commit}, payload: NavigationPayload) {
            
            const directionUp = payload.key==="ArrowUp"
            const delta = directionUp? -1 : +1;
            const currentFrame = state.frameObjects[state.currentFrame.id];

            // we filter the payload to remove the slot positions
            const availablePositions = payload.availablePositions.filter((e) => e.slotNumber === false);
            
            let siblingsOrChildren: number[] = []
            let index = 0;
            
            if(state.currentFrame.caretPosition === CaretPosition.below) {
                siblingsOrChildren = state.frameObjects[currentFrame.parentId].childrenIds
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
            const indexOfCurrent = availablePositionsOfSiblings.findIndex((e) => e.id === state.currentFrame.id && e.caretPosition === state.currentFrame.caretPosition)
            // and then we find the new current
            // NOTE here that the one to be selected and the new current can be different. i.e. I am below the first child of an if and going up
            // the one to be selected is the one I am bellow, and the current is the body of the if! (i.e. the parent)
            const newCurrent = availablePositionsOfSiblings[indexOfCurrent+delta]
          

            commit("selectDeselectFrame", {frameId: frameIdToBeSelected, direction: payload.key.replace("Arrow","").toLowerCase()}) 
            commit("setCurrentFrame", newCurrent);

        },

        shiftClickSelection({state, commit}, payload: {clickedFrameId: number; clickedCaretPosition: CaretPosition}) {
            // Remove current selection
            commit("unselectAllFrames");

            // is the targetFrame bellow or above the origin frame
            let direction: string;
            if(state.frameMap.indexOf(payload.clickedFrameId) === state.frameMap.indexOf(state.currentFrame.id)) {
                // if we clicked on current caret, then no need to select anything
                if(payload.clickedCaretPosition === state.currentFrame.caretPosition) {
                    return;
                }
                //if clicked on the same frame, but on another caret, then if the clicked is body we certainly are going up. Else, down
                direction = (payload.clickedCaretPosition === CaretPosition.body)? "up" : "down";
            }
            else {
                direction = (state.frameMap.indexOf(payload.clickedFrameId) > state.frameMap.indexOf(state.currentFrame.id))? "down" : "up" ;
            }


            // The frame the selection will start from
            const originFrameId =  
                (state.currentFrame.caretPosition === CaretPosition.body)?
                    // Body
                    (direction === "up")?
                        -100 : // in the body and going up is not possible
                        state.frameMap[state.frameMap.indexOf(state.currentFrame.id)+1] // body and going down, start from the next frame
                    :
                    // Below
                    (direction === "up")?
                        state.frameMap[state.frameMap.indexOf(state.frameObjects[state.currentFrame.id].jointParentId||state.currentFrame.id)]: // below a jointframe and going up => origin is the parent, otherwise the frame itself
                        state.frameMap[state.frameMap.indexOf([...state.frameObjects[state.currentFrame.id].childrenIds].pop()??state.currentFrame.id)+1]; // below and going down, start from the next after the last child

            if(originFrameId === -100) {
                return;
            }

            // The frame the selection will potentially end to (or as close to it as possible)
            const targetFrameId =  
                (payload.clickedCaretPosition === CaretPosition.body)?
                    // Body
                    (direction === "up")?
                        state.frameMap[state.frameMap.indexOf(payload.clickedFrameId)+1] : // body and going up, end at the next
                        state.frameMap[state.frameMap.indexOf([...state.frameObjects[payload.clickedFrameId].childrenIds].pop()??payload.clickedFrameId)]// body and going down, end at the last sibling of origin
                    :
                    // Below
                    (direction === "up")?
                        state.frameMap[state.frameMap.indexOf([...state.frameObjects[payload.clickedFrameId].childrenIds].pop()??payload.clickedFrameId)+1]: // below and going up, end at the next after the last child
                        state.frameMap[state.frameMap.indexOf((checkIfLastJointChild(state.frameObjects, payload.clickedFrameId))? state.frameObjects[payload.clickedFrameId].jointParentId : payload.clickedFrameId)]; // going below the last jointframe => target is the parent, otherwise the frame itself 

            // All the selected frames MUST be siblings (same parent) of the frame the selection starts from.
            const siblingsOfOrigin = getAllSiblings(state.frameObjects, originFrameId);

            const indexFrom = siblingsOfOrigin.indexOf(originFrameId);
            const indexTo = (direction === "up")? 0 : siblingsOfOrigin.length-1;
            const indexIncr = (direction === "up")? -1 : 1;

            let lastSelected = undefined;
            for(let i=indexFrom; ;i+=indexIncr) {
                const nextSibling = siblingsOfOrigin[i];
                // We need to check whether the target frame is in another level from the origin frame
                // if they are at diff levels, we must not include the sibling of the origin who is the parent of the target.
                if(!getAllChildrenAndJointFramesIds(state.frameObjects,state.frameObjects[nextSibling].id).includes(targetFrameId)) {
                    commit("selectDeselectFrame", {frameId: nextSibling, direction: direction}) 
                    lastSelected = nextSibling;

                    // if we reach the target frame or the end of the list we stop
                    if( nextSibling === targetFrameId || i === indexTo) {
                        break;
                    }
                    continue;
                }
                else {
                    break;
                }
            }

            const newCurrentId = 
                (!lastSelected)? 
                    targetFrameId //if nothing was selected, then move the caret to the clicked frame
                    :
                    (lastSelected != targetFrameId) ? // Have we landed in another frame that the one the user selected?
                        // landed on a different -> the were on different levels
                        (direction === "up")?
                            // up
                            getPreviousIdForCaretBelow(state.frameObjects, lastSelected) // get the proper previous
                            :
                            // down
                            lastSelected
                        :
                        // Landed on the selected
                        (direction === "up")?
                            // up
                            checkIfFirstChild(state.frameObjects,lastSelected) ?
                                // fist in parent
                                getParentOrJointParent(state.frameObjects,lastSelected) // the parent is the current frame as we have clicked no his body
                                :
                                // not the first in parent, get the previous frame
                                getPreviousIdForCaretBelow(state.frameObjects, lastSelected) // get the proper previous
                            :
                            // down
                            lastSelected

            // The caret calculation needs a frame to work with
            lastSelected = lastSelected?? targetFrameId;

            const newCurrentCaret = 
                (direction === "up")?
                    // up
                    (newCurrentId === state.frameObjects[lastSelected].parentId??state.frameObjects[lastSelected].jointParentId)? CaretPosition.body : CaretPosition.below
                    :
                    // down
                    CaretPosition.below;
                    
            commit("setCurrentFrame", {id: newCurrentId, caretPosition: newCurrentCaret});

        },

        prepareForMultiDrag({state, getters, commit}, draggedFrameId: number) {
            const position = getters.getFrameSelectionPosition(draggedFrameId);
           
            const otherFrames = state.selectedFrames.filter( (id) => id!==draggedFrameId);
            commit(
                "updateStateBeforeChanges",
                false
            );

            otherFrames.forEach( (frameId) => {
                Vue.set(
                    state.frameObjects[frameId],
                    "isVisible",
                    false
                );
            });

            Vue.set(
                state.frameObjects[draggedFrameId],
                "multiDragPosition",
                position
            );
        
        },

        // This method can be used to move the selected frames to a position through Drag & Drop
        moveSelectedFramesToPosition({commit, state, getters}, payload: {event: any; parentId: number}) {
            
            // First remove the visual aspect
            commit("removeMultiDragStyling");
            

            if(state.ignoredDragAction){
                //if the action should be ignore, just return and reset the flag
                commit(
                    "setIgnoredDragAction",
                    false
                );

                return;
            }

            const eventType = Object.keys(payload.event)[0];

            //before the adding or at the moving step, we make a backup of the state to be used by undo/redo and inside the mutation method updateFramesOrder()
            // if(eventType !== "removed"){
                
            // }

            const isJointFrame = getters.getIsJointFrameById(state.selectedFrames[0]);

            const position: CaretPosition = (isJointFrame)?
                CaretPosition.below:
                CaretPosition.body;

            // Even in the same draggable group, some JointFrames cannot be moved (i.e. an elif below an else)
            // That should be checked both ways as for example if you move an `else` above an elif, it may be
            // valid, as the if accepts else there, but the elif cannot go below the else.
            // getIfPositionAllowsFrame() is used as it checks if a frame can be landed on a position     
            // succeedingFrame is the next frame (if it exists) above which we are adding
            
            let indexOfFirstSelected = (isJointFrame)?
                state.frameObjects[payload.parentId].jointFrameIds.indexOf(state.selectedFrames[0]):
                state.frameObjects[payload.parentId].childrenIds.indexOf(state.selectedFrames[0]);

            const indexOfLastSelected = (isJointFrame)?
                state.frameObjects[payload.parentId].jointFrameIds.indexOf(state.selectedFrames[state.selectedFrames.length-1]):
                state.frameObjects[payload.parentId].childrenIds.indexOf(state.selectedFrames[state.selectedFrames.length-1]);

            // If we are moving it to the same parent, we need to check whether
            // we are moving it to the same place (between first and last index of the selected ones); 
            // If that's the case we don't do anything as it may cause a problem (e.g. if selected indexes are 0...3
            // it may move it to 1 instead of 0.
            const parentIdOfSelected = getParentOrJointParent(state.frameObjects,state.frameObjects[state.selectedFrames[0]].id)
            let newIndex = payload.event[eventType].newIndex;

            if(eventType === "moved" && payload.parentId === parentIdOfSelected) {
                if(newIndex >= indexOfFirstSelected && newIndex <= indexOfLastSelected) {
                    commit("makeSelectedFramesVisible");
                    return;
                }
            }

            const succeedingFrame = state.frameObjects[payload.parentId].jointFrameIds[payload.event[eventType].newIndex + (eventType === "moved")];   
            const jointFrameIds = state.frameObjects[payload.parentId].jointFrameIds;
            if(eventType !== "removed") {
                // EXAMPLE: Moving frame `A` above Frame `B`
                // IF `A` cannot be moved on this position 
                //                OR
                // IF `A` is jointFrame and there IS a frame `B` where I am moving `A` at
                //     on TRUE ==> Check if `B` CANNOT be placed below `A` / CANNOT be the trailing joint frame
                //     on FALSE ==> We don't care about this situation
                const jointFrameCase = (isJointFrame && jointFrameIds.length > 0)
                    ? (succeedingFrame !== undefined)
                        ? !getters.getIfPositionAllowsSelectedFrames(payload.event[eventType].element.id, CaretPosition.below, false)
                        : !getters.getIfPositionAllowsSelectedFrames(jointFrameIds[jointFrameIds.length - 1], CaretPosition.below, false)
                    : false;

                if((!isJointFrame && !getters.getIfPositionAllowsSelectedFrames(payload.parentId, position, false)) || jointFrameCase) {       
                    //in the case of a 2 step move (when moving from one group to another) we set the flag to ignore the DnD changes
                    if(eventType === "added"){
                        commit(
                            "setIgnoredDragAction",
                            true
                        );
                    }

                    //alert the user about a forbidden move
                    commit(
                        "setMessageBanner",
                        MessageDefinitions.ForbiddenFrameMove
                    );
    
                    //don't leave the message for ever
                    setTimeout(()=>commit(
                        "setMessageBanner",
                        MessageDefinitions.NoMessage
                    ), 3000);         
                    commit("makeSelectedFramesVisible");
                    return;
                }
            }


            // The top level cloned frames need to be stored in order to then be added to their new parent's list
            const sourceFrameIds: number[] = state.selectedFrames;

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
                commit(
                    "updateFramesOrder",
                    {
                        event: {
                            [eventType]: { // the [] are needed for JS to understand that we're talking about the variable and not the string 'eventType'
                                element: state.frameObjects[id],
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
                commit("makeSelectedFramesVisible");
                commit("unselectAllFrames");
                //save state changes
                //save the state changes for undo/redo
                commit(
                    "saveStateChanges",
                    {                   
                        previousState: state.stateBeforeChanges,
                    }
                );

                //clear the stateBeforeChanges flag off
                commit(
                    "updateStateBeforeChanges",
                    true
                );
            }
        
        },
    },
    
    modules: {},
});

