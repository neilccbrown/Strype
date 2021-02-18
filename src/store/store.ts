import Vue from "vue";
import Vuex from "vuex";
import { FrameObject, CurrentFrame, CaretPosition, MessageDefinition, MessageDefinitions, FramesDefinitions, EditableFocusPayload, Definitions, AllFrameTypesIdentifier, ToggleFrameLabelCommandDef, ObjectPropertyDiff, EditableSlotPayload, FormattedMessage, FormattedMessageArgKeyValuePlaceholders, AddFrameCommandDef, EditorFrameObjects, EmptyFrameObject, MainFramesContainerDefinition, ForDefinition, WhileDefinition, ReturnDefinition, FuncDefContainerDefinition, BreakDefinition, ContinueDefinition, EditableSlotReachInfos, ImportsContainerDefinition } from "@/types/types";
import { addCommandsDefs } from "@/constants/addFrameCommandsDefs";
import initialState from "@/store/initial-state";
import initialTestState from "@/store/initial-test-state";
import initialDemoState from "@/store/initial-demo-state";
import tutorialState from "@/store/tutorial-state"
import { getEditableSlotUIID, undoMaxSteps } from "@/helpers/editor";
import { getObjectPropertiesDifferences, getSHA1HashForObject } from "@/helpers/common";
import i18n from "@/i18n"
import { checkStateDataIntegrity, getAllChildrenAndJointFramesIds, getDisabledBlockRootFrameId, checkDisabledStatusOfMovingFrame, isContainedInFrame } from "@/helpers/storeMethods";
import { removeFrameInFrameList, cloneFrameAndChildren, childrenListWithJointFrames, countRecursiveChildren, getParent, frameForSelection, getParentOrJointParent, generateFrameMap, getAllSiblings, getNextSibling, checkIfLastJointChild, checkIfFirstChild, getPreviousIdForCaretBelow} from "@/helpers/storeMethods";
import { AppVersion } from "@/main";

Vue.use(Vuex);

export default new Vuex.Store({
    state: {
        debugging: false, // true,//

        showKeystroke: true, //false, 

        frameObjects: initialDemoState, // initialState,// initialTestState, // 

        frameMap : [-1,1,-2,-3,2,3,4] as number[],//[-1,1,2,-2,-3,3,4,5,6,7,8,9,10,11,14,15,12,16,13,17] as number[], //[-1,-2,-3,1,2,3,4,5,6,7] as number[],// // flat map of all the frames in a sequence

        nextAvailableId: Math.max.apply({},Object.keys(initialDemoState).map(Number))+1 as number, // won't work for tutorial, as it is not needed in there

        currentFrame: { id: -3, caretPosition: CaretPosition.body } as CurrentFrame,

        currentInitCodeValue: "", //this is an indicator of the CURRENT editable slot's initial content being edited.

        isEditing: false,

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

        editableSlotViaKeyboard: {isKeyboard: false, direction: 1} as EditableSlotReachInfos, //indicates when a slot is reached via keyboard arrows, and the direction (-1 for left/up and 1 for right/down)
    
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
        getCurrentFrameAddFrameCommands: (state) => (frameId: number, caretPosition: CaretPosition) => {
            const currentFrame  = state.frameObjects[frameId];

            //forbidden frames are those of the current frame's type if caret is body, those of the parent/joint root otherwise
            let forbiddenTypes = (caretPosition === CaretPosition.body) ? 
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
         
            //joint frames are retrieved only for the current frame or the joint frame root if the caret is below
            let jointTypes = (caretPosition === CaretPosition.below) ?
                [...currentFrame.frameType.jointFrameTypes] : 
                [];

            //update the list of joint frames depending on where we are in the joint frames structure to respect the rules
            if(jointTypes.length > 0){
                const rootJointFrame = (currentFrame.jointParentId > 0) ? state.frameObjects[currentFrame.jointParentId] : currentFrame;

                //after a joint frame (including the root frame) which is disabled, no joint frame can be added
                if(currentFrame.isDisabled){
                    jointTypes = [];                    
                }
                else{
                    //Remove "finally" in joint frames allowed after "else" if we are in anything else than in a "try"
                    if(rootJointFrame.frameType.type !== Definitions.TryDefinition.type && jointTypes.includes(Definitions.FinallyDefinition.type)){
                        jointTypes.splice(
                            jointTypes.indexOf(Definitions.FinallyDefinition.type),
                            1
                        );
                    }

                    //remove joint frames that can ony be included once if they already are in the current joint frames structure
                    const uniqueJointFrameTypes = [Definitions.ElseDefinition, Definitions.FinallyDefinition];
                    uniqueJointFrameTypes.forEach((frameDef) => {
                        if(jointTypes.includes(frameDef.type) &&
                            rootJointFrame.jointFrameIds.find((jointFrameId) => state.frameObjects[jointFrameId]?.frameType.type === frameDef.type) !== undefined){
                            jointTypes.splice(
                                jointTypes.indexOf(frameDef.type),
                                1
                            );
                        }
                    });
                    
                    //ensure the intermediate following joint frames orders are respected: if > elseif > else and try > except > else > finally
                    if(rootJointFrame.jointFrameIds.length > 0) {
                        const isCurrentFrameIntermediateJointFrame = (currentFrame.id === rootJointFrame.id 
                            || rootJointFrame.jointFrameIds.indexOf(currentFrame.id) < rootJointFrame.jointFrameIds.length -1);
                    
                        //Forbid every frame if we are in an intermediate joint, no frame should be added except allowed joint frames
                        if(isCurrentFrameIntermediateJointFrame ) {
                            forbiddenTypes = Object.values(AllFrameTypesIdentifier);
                        }
                    
                        //workout what types can be left for if and try joint frames structures.
                        if(rootJointFrame.frameType.type === Definitions.IfDefinition.type){  
                            //"if" joint frames --> only "elif" can be added after an intermediate joint frame                   
                            if(isCurrentFrameIntermediateJointFrame) {
                                jointTypes = jointTypes.filter((type) => type !== Definitions.ElseDefinition.type);
                            }
                        }
                        else if (rootJointFrame.frameType.type === Definitions.TryDefinition.type){
                            const hasFinally = (rootJointFrame.jointFrameIds.find((jointFrameId) => state.frameObjects[jointFrameId]?.frameType.type === Definitions.FinallyDefinition.type) !== undefined);
                            const hasElse = (rootJointFrame.jointFrameIds.find((jointFrameId) => state.frameObjects[jointFrameId]?.frameType.type === Definitions.ElseDefinition.type) !== undefined);
                            const hasExcept = (rootJointFrame.jointFrameIds.find((jointFrameId) => state.frameObjects[jointFrameId]?.frameType.type === Definitions.ExceptDefinition.type) !== undefined);

                            //"try" joint frames & "except" joint frames --> we make sure that "try" > "except" (n frames) > "else" and "finally" order is respected
                            if(currentFrame.frameType.type === Definitions.TryDefinition.type){
                                if(hasElse && !hasFinally){
                                    jointTypes.splice(
                                        jointTypes.indexOf(Definitions.FinallyDefinition.type),
                                        1
                                    );
                                }
                                if(hasExcept){
                                    uniqueJointFrameTypes.forEach((frameType) => {
                                        if(jointTypes.includes(frameType.type)){
                                            jointTypes.splice(
                                                jointTypes.indexOf(frameType.type),
                                                1
                                            );
                                        }
                                    });
                                }
                            }
                            else if( currentFrame.frameType.type === Definitions.ExceptDefinition.type){
                                //if this isn't the last expect in the joint frames structure, we need to know what is following it.
                                const indexOfCurrentFrameInJoints = (rootJointFrame.jointFrameIds.indexOf(currentFrame.id));
                                if(indexOfCurrentFrameInJoints < rootJointFrame.jointFrameIds.length -1){
                                    //This "except" is not the last joint frame: we check if the following joint frame is "except"
                                    //if so, we remove "finally" and "else" from the joint frame types (if still there) to be sure 
                                    //none of these type frames can be added immediately after which could result in "...except > finally/else > except..."
                                    if(state.frameObjects[rootJointFrame.jointFrameIds[indexOfCurrentFrameInJoints + 1]]?.frameType.type === Definitions.ExceptDefinition.type){
                                        uniqueJointFrameTypes.forEach((frameType) => {
                                            if(jointTypes.includes(frameType.type)){
                                                jointTypes.splice(
                                                    jointTypes.indexOf(frameType.type),
                                                    1
                                                );
                                            }
                                        }); 
                                    }
                                    //And if this "except" frame is followed by an "else" but no "finally" is present, we remove "finally"
                                    //to avoid "... except > finally > else"
                                    else if(hasElse && !hasFinally){
                                        jointTypes.splice(
                                            jointTypes.indexOf(Definitions.FinallyDefinition.type),
                                            1
                                        );                                   
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            //remove the commands that are forbidden and not defined as joint frames
            const filteredCommands: {[id: string]: AddFrameCommandDef[]} = JSON.parse(JSON.stringify(addCommandsDefs));
            for (const frameShortcut in addCommandsDefs) {
                //we might have more than 1 frame assigned to a shortcut (case when there is a clear context distinction)
                //when this happens, there will always be at most 1 of those frames to keep.
                const frameDefsToCheckArray: AddFrameCommandDef[] = [...addCommandsDefs[frameShortcut]];
                
                //remove the frame definition that we don't need in filteredCommands:
                //step 1 - we first loop the frame definition array for that shortcut and remove the definitions we don't need,
                //step 2 - then if there is no more frame definition in the array for that shortcut, we delete the key/value entry filteredCommands
                //step 1:
                let frameArrayIndex=0;
                frameDefsToCheckArray.forEach((frameDefToCheck: AddFrameCommandDef) => {
                    if(forbiddenTypes.includes(frameDefToCheck.type.type) 
                        && !jointTypes.includes(frameDefToCheck.type.type)){
                        filteredCommands[frameShortcut].splice(frameArrayIndex, 1);
                        frameArrayIndex--; //to be consistent with the deletion
                    }                    
                    frameArrayIndex++;
                });

                //step 2:
                if(filteredCommands[frameShortcut].length === 0){
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

            const allowedFrameTypes: [AddFrameCommandDef[]] = getters.getCurrentFrameAddFrameCommands(targetFrameId, targetCaretPosition);
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
        
            const allowedFrameTypes: [AddFrameCommandDef[]] = getters.getCurrentFrameAddFrameCommands(targetFrameId, targetCaretPosition);

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

        getFrameContentVisibility: (state) => (frameId: number) => {
            return state.frameObjects[frameId].isContentVisible??true;
        },

        getEditableSlotViaKeyboard:(state) => () => {
            return state.editableSlotViaKeyboard;
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
                (toggle) ? tutorialState: ((state.debugging)? initialTestState : initialDemoState)
            );
        },

        addFrameObject(state, newFrame: FrameObject) {
 
            let indexToAdd = 0;
            const isAddingJointFrame = (newFrame.jointParentId > 0);
            const parentToAdd = (isAddingJointFrame) ? newFrame.jointParentId : newFrame.parentId;

            const listToUpdate = (isAddingJointFrame) ? state.frameObjects[parentToAdd].jointFrameIds : state.frameObjects[parentToAdd].childrenIds;
            
            // Adding a joint frame
            if (state.currentFrame.caretPosition === CaretPosition.below) {
                //calculate index in parent list
                const childToCheck = (state.frameObjects[state.currentFrame.id].jointParentId > 0 && newFrame.jointParentId === 0) ?
                    state.frameObjects[state.currentFrame.id].jointParentId :
                    state.currentFrame.id;
                indexToAdd = listToUpdate.indexOf(childToCheck) + 1;
            }

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

        changeCaretWithKeyboard(state, eventType: string) {

            let newId = state.currentFrame.id;
            let newPosition = state.currentFrame.caretPosition;

            //Turn off previous caret
            state.frameObjects[newId].caretVisibility = CaretPosition.none;

            const currentFrame = state.frameObjects[state.currentFrame.id];
            
            // Create the list of children + joints with which the caret will work with
            let childrenAndJointFramesIds = [] as number[];
            const parentId = getParent(state.frameObjects,currentFrame);

            if (eventType === "ArrowDown") {            
                
                childrenAndJointFramesIds = 
                childrenListWithJointFrames(
                    state.frameObjects, 
                    currentFrame.id,
                    state.currentFrame.caretPosition, 
                    "down"
                );

                if(state.currentFrame.caretPosition === CaretPosition.body) {
                    //if the currentFrame has children
                    if(currentFrame.childrenIds.length > 0) {

                        // The first child becomes the current frame
                        newId = currentFrame.childrenIds[0];

                        // If the child allows children, and it isn't collapsed, go to its body, else to its bottom
                        newPosition = (state.frameObjects[newId].frameType.allowChildren && (state.frameObjects[newId].isContentVisible??true)) ? CaretPosition.body : CaretPosition.below;
                    }
                    //if the currentFrame has NO children go below it, except if it is a container --> next container
                    else {
                        if(currentFrame.id < 0){
                            if(childrenAndJointFramesIds.indexOf(currentFrame.id) + 1 < childrenAndJointFramesIds.length){
                                newId = childrenAndJointFramesIds[childrenAndJointFramesIds.indexOf(currentFrame.id) + 1];
                                newPosition = CaretPosition.body;
                            }
                            //else we stay where we are.
                        }
                        else{
                            newPosition = CaretPosition.below;
                        }                        
                    }
                }
                else {
                    const currentFrameIndex = childrenAndJointFramesIds.indexOf(state.currentFrame.id);
                    // If not in the end of the list
                    if( currentFrameIndex + 1 < childrenAndJointFramesIds.length) {
                        // The next child becomes the current frame
                        newId = childrenAndJointFramesIds[currentFrameIndex + 1];

                        // If the new current frame allows children & isn't collapsed go to its body, else to its bottom
                        newPosition = (state.frameObjects[newId].frameType.allowChildren && (state.frameObjects[newId].isContentVisible??true))? CaretPosition.body : CaretPosition.below;
                    }
                    // If that's the content of a container, go to the next container if possible (body)
                    else if(currentFrame.parentId < 0){
                        const containers = state.frameObjects[0].childrenIds;
                        const indexOfCurrentContainer = containers.indexOf(currentFrame.parentId);
                        if(indexOfCurrentContainer + 1 < containers.length) {
                            newId = containers[indexOfCurrentContainer + 1];
                            newPosition = CaretPosition.body;
                        }
                    }
                    else {
                        newId = (parentId > 0)? parentId : currentFrame.id;

                        newPosition = CaretPosition.below;
                    }
                }
            }
            else if (eventType === "ArrowUp") {

                childrenAndJointFramesIds = 
                childrenListWithJointFrames(
                    state.frameObjects, 
                    currentFrame.id, 
                    state.currentFrame.caretPosition,
                    "up"
                );

                // If ((not allow children && I am below) || I am in body || (frame is collapsed)) ==> I go out of the frame
                if ( (!currentFrame.frameType.allowChildren && state.currentFrame.caretPosition === CaretPosition.below) || state.currentFrame.caretPosition === CaretPosition.body || !(currentFrame.isContentVisible??true)){
                    const currentFrameIndex = childrenAndJointFramesIds.indexOf(state.currentFrame.id);
                  
                    // If the current is not on the top of its parent's children
                    if (currentFrameIndex > 0) {
                        // Goto parent's previous child below
                        newId = childrenAndJointFramesIds[currentFrameIndex - 1];

                        //the caret position is below except for Containers where it is always body
                        newPosition = (newId < 0) ? CaretPosition.body : CaretPosition.below;
                    }
                    else {
                        newId = (parentId !== 0)? parentId : currentFrame.id;

                        newPosition = CaretPosition.body;
                    }
                }
                else { // That only validates for (Allow children && position == below) ==> I go in the frame
                    const currentFrameChildrenLength = currentFrame.childrenIds.length;
                    //if the currentFrame has children
                    if (currentFrameChildrenLength > 0) {

                        // Current's last child becomes the current frame
                        newId = currentFrame.childrenIds[currentFrameChildrenLength-1];

                        newPosition = CaretPosition.below;
                    }
                    else {
                        newPosition = CaretPosition.body;
                    }
                }
            }

            Vue.set(
                state.currentFrame,
                "id",
                newId
            );

            Vue.set(
                state.currentFrame,
                "caretPosition",
                newPosition
            );

            Vue.set(
                state.frameObjects[newId],
                "caretVisibility",
                newPosition
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
            )

            //clear the potential error
            Vue.set(
                state.frameObjects[payload.frameId].contentDict[payload.slotId],
                "error",
                ""
            )
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

        saveStateChanges(state, payload: {previousState: object; mockCurrentCursorFocus?: EditableFocusPayload}) {
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

                //If the copied frame doesn't exist after changes, we revert to the default -100 value.
                if(state.frameObjects[state.copiedFrameId] === undefined){
                    Vue.set(state, "copiedFrameId", -100);
                }
             
                //if we notified a change of current caret, we make sure it makes correctly displayed 
                if(changeCaret){
                    Vue.set(
                        state.frameObjects[oldCaretId],
                        "caretVisibility",
                        CaretPosition.none
                    );
        
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

        setFrameContentVisibility(state, payload: {frameId: number; collapse: boolean}) {
            Vue.set(
                state.frameObjects[payload.frameId],
                "isContentVisible",
                !payload.collapse
            );
        },

        setEditableSlotViaKeyboard(state, payload: EditableSlotReachInfos) {
            Vue.set(state, "editableSlotViaKeyboard", payload);
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

        changeCaretPosition({ commit }, key) {
            commit(
                "changeCaretWithKeyboard",
                key
            );
            
            commit("unselectAllFrames");
        },

        addFrameWithCommand({ commit, state, dispatch }, payload: FramesDefinitions) {
            const stateBeforeChanges = JSON.parse(JSON.stringify(state));

            //Prepare the newFrame object based on the frameType
            const isJointFrame = payload.isJointFrame;
            
            let parentId = (isJointFrame) ? 0 : state.currentFrame.id;
            //if the cursor is below a frame, we actually add to the current's frame parent)
            if(parentId > 0 && state.currentFrame.caretPosition === CaretPosition.below) {
                const currentFrame = state.frameObjects[state.currentFrame.id];
                const parentOfCurrent = (currentFrame.jointParentId > 0) ?
                    state.frameObjects[state.frameObjects[currentFrame.jointParentId].parentId] :
                    state.frameObjects[currentFrame.parentId];
                parentId = parentOfCurrent.id;
            }

            const newFrame = {
                ...JSON.parse(JSON.stringify(EmptyFrameObject)),
                frameType: payload,
                id: state.nextAvailableId++,
                parentId: isJointFrame ? 0 : parentId, 
                jointParentId: isJointFrame
                    ? (state.frameObjects[state.currentFrame.id].jointParentId > 0) ? state.frameObjects[state.currentFrame.id].jointParentId : state.currentFrame.id
                    : 0,
                contentDict:
                    //find each editable slot and create an empty & unfocused entry for it
                    //optional labels are not visible by default, not optional labels are visible by default
                    payload.labels.filter((el)=> el.slot).reduce(
                        (acc, cur, idx) => ({ 
                            ...acc, 
                            [idx]: {code: "", focused: false, error: "", shownLabel:(!cur?.optionalLabel ?? true)},
                        }),
                        {}
                    ),
            };

            commit(
                "addFrameObject",
                newFrame
            );
            
            //"move" the caret along
            dispatch(
                "leftRightKey",
                "ArrowRight"                
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

        deleteFrames({commit, state}, payload: string){
            const stateBeforeChanges = JSON.parse(JSON.stringify(state));
            
            let showDeleteMessage = false;

            //we create a list of frames to delete that is either the elements of a selection OR the current frame's position
            let framesIdToDelete = [state.currentFrame.id];

            //If a selection is deleted, we don't distinguish between "del" and "backspace": 
            //We move the caret at the last element of the selection, and perform "backspace" for each element of the selection
            if(state.selectedFrames.length > 0){
                if(state.selectedFrames[state.selectedFrames.length-1] !== state.currentFrame.id){
                    commit("setCurrentFrame", {id: state.selectedFrames[state.selectedFrames.length-1], caretPosition: CaretPosition.below});
                }
                payload = "Backspace";
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
                //  case cursor is body: cursor needs to move one level up, and the current frame's children + all siblings replace its parent
                //  case cursor is below: cursor needs to move to bottom of previous sibling (or body of parent if first child) and the current frame (*) is deleted
                //(*) with all sub levels children


                const currentFrame = state.frameObjects[currentFrameId];

                // Create the list of children + joints with which the caret will work with
                const parentId = getParent(state.frameObjects,currentFrame);

                const listOfSiblings = 
                childrenListWithJointFrames(
                    state.frameObjects, 
                    currentFrame.id, 
                    state.currentFrame.caretPosition,
                    "down"
                );

                const indexOfCurrentFrame = listOfSiblings.indexOf(currentFrame.id);
                let frameToDeleteId = 0;
                let deleteChildren = false;

                if(payload === "Delete"){
                    if(indexOfCurrentFrame + 1 < listOfSiblings.length){
                        frameToDeleteId = listOfSiblings[indexOfCurrentFrame + 1];
                    } 
                }
                else {
                    if (currentFrame.id > 0) {
                        if(state.currentFrame.caretPosition === CaretPosition.body ){
                            //just move the cursor one level up
                            commit(
                                "changeCaretWithKeyboard",
                                "ArrowUp"
                            );
                        }
                        else{
                            //move the cursor up to the previous sibling bottom if available, otherwise body of parent
                            let newId = parentId;
                            if(indexOfCurrentFrame - 1 >= 0){
                                newId = listOfSiblings[indexOfCurrentFrame - 1];
                                //make sure that this sibling isn't a joint frame root, otherwise, we need to get its last joint frame instead of the root
                                if(state.frameObjects[newId].jointFrameIds.length > 0 && !state.frameObjects[newId].jointFrameIds.includes(currentFrameId)){
                                    newId = [...state.frameObjects[newId].jointFrameIds].pop() as number;
                                }
                            }
                            const newPosition = (indexOfCurrentFrame - 1 >= 0 || currentFrame.jointParentId > 0) ? CaretPosition.below : CaretPosition.body;
                            commit(
                                "setCurrentFrame",
                                {id: newId, caretPosition: newPosition}
                            );
                            deleteChildren = true;
                        }
                        frameToDeleteId = currentFrame.id;
                    }
                }

                //Delete the frame if a frame to delete has been found
                if(frameToDeleteId > 0){
                    //before actually deleting the frame(s), we check if the user should be notified of a large deletion
                    if(countRecursiveChildren(
                        state.frameObjects,
                        frameToDeleteId,
                        3
                    ) >= 3){
                        showDeleteMessage = true;
                    }

                    commit(
                        "deleteFrame",
                        {
                            key:payload,
                            frameToDeleteId: frameToDeleteId,  
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

        toggleCaret({ commit }, newCurrent) {
            commit(
                "setCurrentFrame",
                newCurrent
            );
            
            commit("unselectAllFrames");
        },

        leftRightKey({commit, state} , key) {
            let editFlag = state.isEditing;
            
            if(editFlag) {
                const currentEditableSlots = Object.entries(state.frameObjects[state.currentFrame.id].contentDict).filter((slot) => slot[1].shownLabel);
                const posCurSlot = currentEditableSlots.findIndex((slot) => slot[1].focused);
                const change = (key === "ArrowLeft") ? -1: 1;

                // if we won't exceed the editable slots
                if( posCurSlot + change >= 0 && posCurSlot + change <= currentEditableSlots.length - 1 ){
                    commit(
                        "setEditableFocus",
                        {
                            frameId: state.currentFrame.id,
                            slotId: currentEditableSlots[posCurSlot][0],
                            focused: false,
                        }
                    );

                    const slotReachInfos: EditableSlotReachInfos = {isKeyboard: true, direction: change};
                    commit("setEditableSlotViaKeyboard", slotReachInfos);

                    commit(
                        "setEditableFocus",
                        {
                            frameId: state.currentFrame.id,
                            slotId: currentEditableSlots[posCurSlot + change][0],
                            focused: true,
                        }
                    );
                }
                // Else we are at the edge and we need to change move caret
                else {

                    commit(
                        "setEditFlag",
                        false
                    );

                    // The caret is set to Body, so with a right click we just show it. With a left click, we move up
                    if(key === "ArrowLeft") {
                        commit(
                            "changeCaretWithKeyboard",
                            "ArrowUp"
                        );
                    }
                }
            }
            else { 
                const currentFrame = state.frameObjects[state.currentFrame.id];
                // By nextFrame we mean either the next or the previous frame, depending on the direction
                let nextFrame = 0;
                //  direction = up | down
                let directionDown = true;

                if(key === "ArrowRight") {
                    const parent = state.frameObjects[currentFrame.parentId];
                    //In the case we are in the body and there are no children OR caret bellow and last in parent, move the caret
                    if ((state.currentFrame.caretPosition === CaretPosition.body && !(currentFrame.childrenIds.length >0)) || (state.currentFrame.caretPosition === CaretPosition.below && parent.childrenIds.indexOf(currentFrame.id) === parent.childrenIds.length-1)) {
                        commit(
                            "changeCaretWithKeyboard",
                            "ArrowDown"
                        );
                        return;
                    }
                    else {
                        const framesIdList = 
                        childrenListWithJointFrames(
                            state.frameObjects,
                            currentFrame.id,
                            state.currentFrame.caretPosition,
                            "down"
                        );
                        // avoid getting an out of bound exception
                        nextFrame = (framesIdList.indexOf(currentFrame.id)+1 < framesIdList.length) ? framesIdList[framesIdList.indexOf(currentFrame.id)+1] : framesIdList[framesIdList.length - 1];   
                    }
                }
                else {
                    // If bellow a frame that does not allow children OR in the body, we check for this frame's slots
                    if((state.currentFrame.caretPosition === CaretPosition.below && !state.frameObjects[currentFrame.id].frameType.allowChildren) || state.currentFrame.caretPosition === CaretPosition.body)  {
                        nextFrame = currentFrame.id;
                    }
                    // in the case where you are bellow and you are simply going in it body
                    else if (state.currentFrame.caretPosition == CaretPosition.below) {
                        commit(
                            "changeCaretWithKeyboard",
                            "ArrowUp"
                        );
                        return;
                    }
                    else {
                        const framesIdList = 
                        childrenListWithJointFrames(
                            state.frameObjects,
                            currentFrame.id,
                            state.currentFrame.caretPosition,
                            "up"
                        );
                        // avoid getting an out of bound exception
                        nextFrame = (framesIdList.indexOf(currentFrame.id) > 0) ? framesIdList[framesIdList.indexOf(currentFrame.id)-1] : framesIdList[0];
                    }
                    directionDown = false;
                }

                //If there are editable slots, go in the first available slot
                const editableSlotsIndexes: number[] = [];
                Object.entries(state.frameObjects[nextFrame].contentDict).forEach((entry) => {
                    if(entry[1].shownLabel){
                        editableSlotsIndexes.push(parseInt(entry[0]));
                    }
                });

                if(editableSlotsIndexes.length > 0) {

                    editFlag = true;

                    const slotReachInfos: EditableSlotReachInfos = {isKeyboard: true, direction: (directionDown) ? 1 : -1};
                    commit("setEditableSlotViaKeyboard", slotReachInfos);

                    commit(
                        "setEditableFocus",
                        {
                            frameId: state.frameObjects[nextFrame].id,
                            slotId: (directionDown)? editableSlotsIndexes[0] : editableSlotsIndexes[editableSlotsIndexes.length -1],
                            focused: true,
                        }
                    );
                }
                else {
                    //In the case of no editable slots, just move the caret
                    commit(
                        "changeCaretWithKeyboard",
                        (directionDown)? "ArrowDown" : "ArrowUp"
                    );
                }

                commit(
                    "setEditFlag",
                    editFlag
                );
            }
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

        selectMultipleFrames({state, commit}, key: string) {
            
            const direction = (key==="ArrowUp")? "up" : "down"

            // The frame the selection will start from
            const frameToSelectId =  
                (state.currentFrame.caretPosition === CaretPosition.body)?
                    // Body
                    (direction === "up")?
                        -100 : // in the body and going up is not possible
                        [...state.frameObjects[state.currentFrame.id].childrenIds].shift()??-100 // body and going down, first child if it exists
                    :
                    // Below
                    (direction === "up")?
                        // up
                        (checkIfLastJointChild(state.frameObjects, state.currentFrame.id))? 
                            (state.selectedFrames.includes(state.currentFrame.id))?          // we need to check whether this joint is selected
                                -100                                                         // if it is selected we should not do anything
                                :      
                                state.frameObjects[state.currentFrame.id].jointParentId     // Otherwise select its parent
                            : 
                            state.currentFrame.id // below and going up, is the last jointframe => target is the parent, otherwise the frame itself 
                        :
                        // down
                        // Are we below a frame which has joint children -> ie above a Joint
                        [...state.frameObjects[state.currentFrame.id].jointFrameIds].shift()     // If yes, give me the first joint child
                        ??                                                                       // else
                        (getNextSibling(state.frameObjects,                                      // below and going down, get next sibling.
                            (checkIfLastJointChild(state.frameObjects, state.currentFrame.id))?  // If we are below the last joint child
                                (state.selectedFrames.includes(state.currentFrame.id))?          // we need to check whether this joint is selected
                                    -100                                                         // if it is selected we should not do anything
                                    :                                                            // otherwise
                                    state.frameObjects[state.currentFrame.id].jointParentId      // we need to select below our parent
                                :
                                state.currentFrame.id)                                           // if not below a joint child, select the current
                        );

            if(frameToSelectId === -100) {
                return;
            }

            const newCurrentCaret = 
                (direction === "up")?
                    // up
                    (checkIfFirstChild(state.frameObjects,frameToSelectId))? CaretPosition.body : CaretPosition.below
                    :
                    // down
                    CaretPosition.below;

            const newCurrentId = 
                (direction === "up")?
                    //up
                    (newCurrentCaret === CaretPosition.below)? // direction=up and caret=down => there is another frame before me
                        getPreviousIdForCaretBelow(state.frameObjects, frameToSelectId)// the previous frame is the new current
                        :
                        state.frameObjects[frameToSelectId].parentId // otherwise it is the parent
                    :
                    // down
                    [...state.frameObjects[frameToSelectId].jointFrameIds].pop()??frameToSelectId//The next frame after me of me if it there no next

          
            commit("selectDeselectFrame", {frameId: frameToSelectId, direction: direction}) 
            commit("setCurrentFrame", {id: newCurrentId, caretPosition: newCurrentCaret});

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

        toggleFrameContentVisibility({commit, state}, payload: {frameId: number; collapse: boolean}) {
            //set the flag on the collapsed/expanded frame
            commit("setFrameContentVisibility", payload);

            //move the caret under the collapsed frame if the caret was somewhere inside the frame
            if(payload.collapse){
                const nextSiblingPos = state.frameMap.indexOf(getNextSibling(state.frameObjects, payload.frameId));
                const collapsedFramePos = state.frameMap.indexOf(payload.frameId);
                const currentFramePos = state.frameMap.indexOf(state.currentFrame.id);
                if(currentFramePos > collapsedFramePos && (nextSiblingPos === -1 || currentFramePos < nextSiblingPos)){
                    commit("setCurrentFrame", {id: payload.frameId, caretPosition: CaretPosition.below});
                }                
            }
        },
    },
    
    modules: {},
});

