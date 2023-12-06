import {AcResultsWithModule, AllFrameTypesIdentifier, BaseSlot, FrameObject, AcResultType, SlotsStructure} from "@/types/types";
import { operators, keywordOperatorsWithSurroundSpaces, STRING_SINGLEQUOTE_PLACERHOLDER, STRING_DOUBLEQUOTE_PLACERHOLDER } from "@/helpers/editor";

import _ from "lodash";
import {useStore} from "@/store/store";
import microbitPythonAPI from "@/autocompletion/microbit-api.json";
import { pythonBuiltins } from "@/autocompletion/pythonBuiltins";
import skulptPythonAPI from "@/autocompletion/skulpt-api.json";
import microbitModuleDescription from "@/autocompletion/microbit.json";


// Checks if the code passed as argument should not trigger the AC (implying the caret is at the end of this code)
function isACNeededToShow(code: string): boolean {
    //if there is no space in the code, the AC could be shown
    if(code.indexOf(" ") === -1){
        return true;
    }
 
    //check if we follow a symbols operator (that may not have surrounding spaces)
    let foundOperatorFlag = false;
    operators.forEach((op) => {
        if(code.match(".*"+_.escapeRegExp(op)+" *[a-zA-Z0-9_$()\\[\\]{}]*$")) {
            foundOperatorFlag = true;
        }
    });
 
    if(!foundOperatorFlag) {
        //then check if we follow a non symbols operators (that need surrounding spaces)
        keywordOperatorsWithSurroundSpaces.forEach((op) => {
            if(code.toLowerCase().match(".*"+op+"+[^ ]*")) {
                foundOperatorFlag = true;
            }
        });
    }  
    return foundOperatorFlag;
}

// Check every time you're in a slot and see how to show the AC (for the code section)
// the full AC content isn't recreated every time, but only do so when we detect a change of context.
export function getCandidatesForAC(slotCode: string, frameId: number): {tokenAC: string; contextAC: string; showAC: boolean} {
    // Replace the string placeholders
    const stringPlaceholdersParsedSlotCode = slotCode.replaceAll(STRING_SINGLEQUOTE_PLACERHOLDER, "'").replaceAll(STRING_DOUBLEQUOTE_PLACERHOLDER, "\"");
    // Replace the string quotes placeholders by quotes AND string literal value by equivalent length non space literal
    const quotesPlaceholdersRegex = "(" + STRING_SINGLEQUOTE_PLACERHOLDER.replaceAll("$","\\$") + "|" + STRING_DOUBLEQUOTE_PLACERHOLDER.replaceAll("$","\\$") + ")";
    const strRegEx = new RegExp(quotesPlaceholdersRegex+"((?!\\1).)*\\1","g");    
    const blankedStringCodeLiteral = slotCode.replace(strRegEx, (match) => {
        // The length of the blanked string is the match's, minus twice the length of the placeholders
        return "'" + "0".repeat(match.length - 2*STRING_DOUBLEQUOTE_PLACERHOLDER.length) + "'";            
    });

    //check that we are in a literal: here returns nothing
    //in a non terminated string literal
    //writing a number)
    if((stringPlaceholdersParsedSlotCode.match(/"/g) || []).length % 2 == 1 || !isNaN(parseFloat(stringPlaceholdersParsedSlotCode.substr(Math.max(stringPlaceholdersParsedSlotCode.lastIndexOf(" "), 0))))){
        // the user code for the python editor should not be triggered anymore, so we "break" the editor code's content
        const userPythonCodeHTMLElt = document.getElementById("userCode");
        if(userPythonCodeHTMLElt){        
            (userPythonCodeHTMLElt as HTMLTextAreaElement).value = "";
        }
        return {tokenAC: "", contextAC: "", showAC: false};
    }

    //We search for a smaller unit to work with, meaning we look at:
    //- any opened and non closed parenthesis
    //- the presence of an operator
    //- the presence of an argument separator
    let closedParenthesisCount = 0, closedSqBracketCount = 0, closedCurBracketCount = 0;
    let codeIndex = stringPlaceholdersParsedSlotCode.length;
    let breakShortCodeSearch = false;
    while(codeIndex > 0 && !breakShortCodeSearch) {
        codeIndex--;
        const codeChar = blankedStringCodeLiteral.charAt(codeIndex);
        if(codeChar != "." && operators.includes(codeChar) && closedParenthesisCount === 0){
            codeIndex++;
            break;
        }
        else{
            switch(codeChar){
            case "(":
                if(closedParenthesisCount > 0){
                    closedParenthesisCount--;
                }
                else{
                    codeIndex++;
                    breakShortCodeSearch = true;
                }
                break;
            case ")":
                closedParenthesisCount++;
                break;
            case "[":
                if(closedSqBracketCount > 0){
                    closedSqBracketCount--;
                }
                else{
                    codeIndex++;
                    breakShortCodeSearch = true;
                }
                break;
            case "]":
                closedSqBracketCount++;
                break;
            case "{":
                if(closedCurBracketCount > 0){
                    closedCurBracketCount--;
                }
                else{
                    codeIndex++;
                    breakShortCodeSearch = true;
                }
                break;
            case "}":
                closedCurBracketCount++;
                break;
            }
        }
    }

      
    // There are 2+1 cases for the context.
    //   1) When the prev char is a `.` dot :  Image.a  -->  context = Image  AND  tokenAC = a
    //   2) When the prev char is not a dot:   x = x +  --> context = "" and tokenAC = ""
    //   3?) The is a potential case that we are in a function call, and we need to return also the names and the number of arguments
    //        e.g.  max( --> here the context = `max()` and no tokenAC. We may need to return the args to show a hint to the user.

    let tokenAC = "";
    let contextAC = "";
    
    // if the string's last character is an operator or symbol that means there is no context and tokenAC
    // we also try to avoid checking for context and token when the line ends with multiple dots, as it creates a problem to Skulpt
    if(!stringPlaceholdersParsedSlotCode.substring(codeIndex).endsWith("..") && stringPlaceholdersParsedSlotCode[codeIndex] != "." && !operators.includes(stringPlaceholdersParsedSlotCode[codeIndex])) {
        // we don't want to show the autocompletion if the code at the current position is 
        // after a space that doesn't separate some parts of an operator. In other words,
        // we want to avoid to show the autocompletion EVERYTIME the space key is hit.
        if(slotCode.trim().length > 0 && !isACNeededToShow(blankedStringCodeLiteral)){
            // the user code for the python editor should not be triggered anymore, so we "break" the editor code's content
            const userPythonCodeHTMLElt = document.getElementById("userCode");
            if(userPythonCodeHTMLElt){        
                (userPythonCodeHTMLElt as HTMLTextAreaElement).value = "";
            }
            return {tokenAC: tokenAC , contextAC: contextAC, showAC: false};
        }
        // code we will give us context and token is the last piece of code after the last white space
        const indexOfLastSpace = blankedStringCodeLiteral.substring(codeIndex).lastIndexOf(" ");
        const subCode = stringPlaceholdersParsedSlotCode.substring(codeIndex).substring(indexOfLastSpace + 1);
        tokenAC = (subCode.indexOf(".") > -1) ? subCode.substring(subCode.lastIndexOf(".") + 1) : subCode;
        contextAC = (subCode.indexOf(".") > -1) ? subCode.substring(0, subCode.lastIndexOf(".")) : "";
    }
   
    /***
        TODO: Need to check for multiple dots ..
              Need to add try/except on dir
    */

    return {tokenAC: tokenAC , contextAC: contextAC, showAC: true};
}

// Given a slot, find all identifiers that are between two commas (or between a comma
// and the start/end of the slot) and add them to the given set.
function extractCommaSeparatedNamesAndAddToSet(slot: SlotsStructure, addTo: Set<string>) {
    let validOpBefore = true;
    const ops = slot.operators;
    const fields = slot.fields;
    for (let i = 0; i < fields.length; i++) {
        const validOpAfter = i == fields.length - 1 || ops[i].code === ",";
        if ((fields[i] as BaseSlot).code) {
            if (validOpBefore && validOpAfter) {
                addTo.add((fields[i] as BaseSlot).code);
            }
        }
        validOpBefore = validOpAfter;
    }
}

function getAllUserDefinedVariablesWithinUpTo(framesForParentId: FrameObject[], frameId: number) : { found : Set<string>, complete: boolean} {
    const soFar = new Set<string>();
    for (const frame of framesForParentId) {
        if (frameId == frame.id) {
            return {found: soFar, complete: true};
        }
        if (frame.frameType.type === AllFrameTypesIdentifier.varassign && !frame.isDisabled) {
            // We may have all sorts on the LHS.  We want any slots which are plain,
            // and which are adjoined by either the beginning of the slot, the end,
            // or a comma
            extractCommaSeparatedNamesAndAddToSet(frame.labelSlotsDict[0].slotStructures, soFar);
        }
        // Now go through children:
        for (const childrenId of frame.childrenIds) {
            const childFrame = useStore().frameObjects[childrenId];
            const childResult = getAllUserDefinedVariablesWithinUpTo([childFrame], frameId);
            childResult.found.forEach((item) => soFar.add(item));
            if (childResult.complete) {
                return {found: soFar, complete : true};
            }
        }
    }
    return {found: soFar, complete: false};
}

export function getAllUserDefinedVariablesUpTo(frameId: number) : Set<string> {
    // First we need to go up the tree, to find the top-most parent (either top-level frames or a user-defined function)
    let curFrameId = frameId;
    for (;;) {
        const frame = useStore().frameObjects[curFrameId];
        const parentId = frame.parentId;
        if (parentId == -2) {
            // It's a user-defined function, process accordingly
            const available = getAllUserDefinedVariablesWithinUpTo(useStore().getFramesForParentId(curFrameId), frameId).found;
            // Also add any parameters from the function:
            // Sanity check the frame type:
            if (frame.frameType.type === AllFrameTypesIdentifier.funcdef) {
                extractCommaSeparatedNamesAndAddToSet(frame.labelSlotsDict[1].slotStructures, available);
            }
            return available;
        }
        else if (parentId <= 0) {
            // Reached top-level, go backwards from here:
            return getAllUserDefinedVariablesWithinUpTo(useStore().getFramesForParentId(parentId), frameId).found;
        }
        curFrameId = parentId;
    }
}

export function getAllExplicitlyImportedItems() : AcResultsWithModule {
    const soFar : AcResultsWithModule = {};
    const imports : FrameObject[] = Object.values(useStore().frameObjects) as FrameObject[];
    loopImportFrames: for (let i = 0; i < imports.length; i++) {
        const frame = imports[i];
        if (!frame.isDisabled && frame.frameType.type === AllFrameTypesIdentifier.fromimport) {
            let module = "";
            for (let j = 0; j < frame.labelSlotsDict[0].slotStructures.fields.length; j++) {
                module += (frame.labelSlotsDict[0].slotStructures.fields[j] as BaseSlot).code;
                if (j < frame.labelSlotsDict[0].slotStructures.operators.length) {
                    // Should be a dot:
                    if (frame.labelSlotsDict[0].slotStructures.operators[j].code !== ".") {
                        // Error; ignore this import
                        continue loopImportFrames;
                    }
                    module += frame.labelSlotsDict[0].slotStructures.operators[j].code;
                }
            }
            
            if (frame.labelSlotsDict[1].slotStructures.fields.length == 1 && (frame.labelSlotsDict[1].slotStructures.fields[0] as BaseSlot).code === "*") {
                
                // Depending on whether we are microbit or Skulpt, access the appropriate JSON file and retrieve
                // the contents of the specific module:
                
                /* IFTRUE_isMicrobit */
                const allMicrobitItems : AcResultType[] = microbitPythonAPI[module as keyof typeof microbitPythonAPI] as AcResultType[];
                if (allMicrobitItems) {
                    soFar[module] = [...allMicrobitItems.filter((x) => !x.acResult.startsWith("_"))];
                }
                /* FITRUE_isMicrobit */

                /* IFTRUE_isPurePython */
                const allSkulptItems : AcResultType[] = skulptPythonAPI[module as keyof typeof skulptPythonAPI] as AcResultType[];
                if (allSkulptItems) {
                    soFar[module] = [...allSkulptItems.filter((x) => !x.acResult.startsWith("_"))];
                }
                /* FITRUE_isPurePython */
            }
            else {
                soFar[module] = [];
                
                let allItems : AcResultType[] = [];

                /* IFTRUE_isMicrobit */
                const allMicrobitItems : AcResultType[] = microbitPythonAPI[module as keyof typeof microbitPythonAPI] as AcResultType[];
                if (allMicrobitItems) {
                    allItems = [...allMicrobitItems.filter((x) => !x.acResult.startsWith("_"))];
                }
                /* FITRUE_isMicrobit */

                /* IFTRUE_isPurePython */
                const allSkulptItems : AcResultType[] = skulptPythonAPI[module as keyof typeof skulptPythonAPI] as AcResultType[];
                if (allSkulptItems) {
                    allItems = [...allSkulptItems.filter((x) => !x.acResult.startsWith("_"))];
                }
                /* FITRUE_isPurePython */
                
                // Find the relevant item from allItems (if it exists):
                for (const f of frame.labelSlotsDict[1].slotStructures.fields) {
                    const item = allItems.find((ac) => ac.acResult === (f as BaseSlot).code.trim());
                    if (item) {
                        soFar[module].push(item);
                    }
                }
            }
        }
    }
    return soFar;
}

export function getAvailableModulesForImport() : AcResultsWithModule {
    /* IFTRUE_isMicrobit */
    return {[""]: microbitModuleDescription.modules.map((m) => ({acResult: m, documentation: m in microbitPythonAPI ? (microbitPythonAPI[m as keyof typeof microbitPythonAPI].find((ac) => ac.acResult === "__doc__")?.documentation || "") : "", type: "module", version: 0}))};
    /* FITRUE_isMicrobit */
    /* IFTRUE_isPurePython */
    return {[""] : Object.keys(pythonBuiltins).filter((k) => pythonBuiltins[k]?.type === "module").map((k) => ({acResult: k, documentation: pythonBuiltins[k].documentation||"", type: pythonBuiltins[k].type, version: 0}))};
    /* FITRUE_isPurePython */
}
export function getAvailableItemsForImportFromModule(module: string) : AcResultsWithModule {
    const star : AcResultType = {"acResult": "*", "documentation": "All items from module", "version": 0, "type": "unknown"};
    /* IFTRUE_isMicrobit */
    const allMicrobitItems: AcResultType[] = microbitPythonAPI[module as keyof typeof microbitPythonAPI] as AcResultType[];
    if (allMicrobitItems) {
        return {"": [...allMicrobitItems, star]};
    }
    /* FITRUE_isMicrobit */

    /* IFTRUE_isPurePython */
    const allSkulptItems: AcResultType[] = skulptPythonAPI[module as keyof typeof skulptPythonAPI] as AcResultType[];
    if (allSkulptItems) {
        return {"": [...allSkulptItems, star]};
    }
    /* FITRUE_isPurePython */
    return {"": [star]};
}

export function getBuiltins() : AcResultType[] {
    /* IFTRUE_isPurePython */
    // Must return a clone as caller may later modify the list:
    return [...skulptPythonAPI[""] as AcResultType[]];
    /* FITRUE_isPurePython */
    /* IFTRUE_isMicrobit */
    // Must return a clone as caller may later modify the list:
    return [...microbitPythonAPI[""] as AcResultType[]];
    /* FITRUE_isMicrobit */
}
