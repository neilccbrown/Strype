import {AcResultsWithCategory, AllFrameTypesIdentifier, BaseSlot, FrameObject, AcResultType, SlotsStructure, FieldSlot, StringSlot} from "@/types/types";

import {useStore} from "@/store/store";
import microbitPythonAPI from "@/autocompletion/microbit-api.json";
import { pythonBuiltins } from "@/autocompletion/pythonBuiltins";
import skulptPythonAPI from "@/autocompletion/skulpt-api.json";
import microbitModuleDescription from "@/autocompletion/microbit.json";
import {getMatchingBracket} from "@/helpers/editor";
import {getAllEnabledUserDefinedFunctions} from "@/helpers/storeMethods";

// Given a FieldSlot, get the program code corresponding to it, to use
// as the prefix (context) for code completion.
export function getContentForACPrefix(item : FieldSlot, excludeLast? : boolean) : string {
    if ("quote" in item) {
        // It's a string literal
        const ss = item as StringSlot;
        return ss.quote + ss.code + ss.quote;
    }
    else if ("code" in item) {
        const basic = item as BaseSlot;
        return basic.code;
    }
    else {
        // Must be a SlotsStructure, then
        const struct = item as SlotsStructure;
        let glued = "";
        for (let i = 0; i < struct.fields.length - (excludeLast ? 1 : 0); i++) {
            glued += getContentForACPrefix(struct.fields[i]);
            if (i < struct.operators.length - (excludeLast ? 1 : 0)) {
                // Add spaces to avoid adjacent items running together:
                glued += struct.operators[i].code;
            }
        }
        if (struct.openingBracketValue) {
            return struct.openingBracketValue + glued + getMatchingBracket(struct.openingBracketValue, true);
        }
        else {
            return glued;
        }
    }
}

// Check every time you're in a slot and see how to show the AC (for the code section)
// the full AC content isn't recreated every time, but only do so when we detect a change of context.
// The return is a token (or null if code completion is invalid here)
// and context (prefix) which is the part before a dot before the token.
export function getCandidatesForAC(slotCode: SlotsStructure, location: number[]): {tokenAC: string | null; contextAC: string} {
    // If anything goes wrong we make sure not to throw an exception; just show the AC with "No completion available":
    try {
        if (location.length == 1) {
            let fieldIndex = location[0];
            const ourField = slotCode.fields[fieldIndex];
            // We only offer completions for basic slots that are not string literals:
            if ("code" in ourField && !("quote" in ourField)) {
                let prefix = "";
                // Glue together any previous slots that are joined by dots (or blank operators):
                if (fieldIndex > 0 && slotCode.operators[fieldIndex - 1].code === ".") {
                    while (fieldIndex > 0 && (slotCode.operators[fieldIndex - 1].code === "." || slotCode.operators[fieldIndex - 1].code === "")) {
                        fieldIndex -= 1;
                        prefix = getContentForACPrefix(slotCode.fields[fieldIndex]) + (prefix ? slotCode.operators[fieldIndex].code : "") + prefix;
                    }
                }
                
                return {tokenAC: ourField.code, contextAC: prefix};
            }
        }
        else {
            // We are in a bracket.  We can ignore everything at higher levels for autocompletion,
            // because it doesn't affect the autocompletion.  That is, if you have "myVar." and hit ctrl-space,
            // it doesn't matter if the code is just "myVar." or "len(myVar.)", being in a bracket doesn't matter.
            // So just dig down to the next level:
            return getCandidatesForAC(slotCode.fields[location[0]] as SlotsStructure, location.slice(1));
        }
    }
    catch (e) {
        console.log("Exception while constructing code for autocompletion:" + e);
    }
    return {tokenAC: null, contextAC: ""};
}

// Given a slot, find all identifiers that are between two commas (or between a comma
// and the start/end of the slot) and add them to the given set.
export function extractCommaSeparatedNames(slot: SlotsStructure) : string[] {
    const found : string[] = [];
    let validOpBefore = true;
    const ops = slot.operators;
    const fields = slot.fields;
    for (let i = 0; i < fields.length; i++) {
        const validOpAfter = i == fields.length - 1 || ops[i].code === ",";
        if ((fields[i] as BaseSlot).code) {
            if (validOpBefore && validOpAfter) {
                found.push((fields[i] as BaseSlot).code);
            }
        }
        validOpBefore = validOpAfter;
    }
    return found;
}

function getAllUserDefinedVariablesWithinUpTo(framesForParentId: FrameObject[], frameId: number) : { found : Set<string>, complete: boolean} {
    const soFar = new Set<string>();
    for (const frame of framesForParentId) {
        if (frameId == frame.id) {
            return {found: soFar, complete: true};
        }
        // Get LHS from assignments:
        if (frame.frameType.type === AllFrameTypesIdentifier.varassign && !frame.isDisabled) {
            // We may have all sorts on the LHS.  We want any slots which are plain,
            // and which are adjoined by either the beginning of the slot, the end,
            // or a comma
            extractCommaSeparatedNames(frame.labelSlotsDict[0].slotStructures).forEach((x) => soFar.add(x));
        }
        // Get iterator variables from for loops:
        if (frame.frameType.type === AllFrameTypesIdentifier.for && !frame.isDisabled) {
            if ((frame.labelSlotsDict[0].slotStructures.fields[0] as BaseSlot).code) {
                soFar.add((frame.labelSlotsDict[0].slotStructures.fields[0] as BaseSlot).code);
            }
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
                extractCommaSeparatedNames(frame.labelSlotsDict[1].slotStructures).forEach((x) => available.add(x));
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

export function getAllExplicitlyImportedItems() : AcResultsWithCategory {
    const soFar : AcResultsWithCategory = {};
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

export function getAvailableModulesForImport() : AcResultsWithCategory {
    /* IFTRUE_isMicrobit */
    return {[""]: microbitModuleDescription.modules.map((m) => ({acResult: m, documentation: m in microbitPythonAPI ? (microbitPythonAPI[m as keyof typeof microbitPythonAPI].find((ac) => ac.acResult === "__doc__")?.documentation || "") : "", type: ["module"], version: 0}))};
    /* FITRUE_isMicrobit */
    /* IFTRUE_isPurePython */
    return {[""] : Object.keys(pythonBuiltins).filter((k) => pythonBuiltins[k]?.type === "module").map((k) => ({acResult: k, documentation: pythonBuiltins[k].documentation||"", type: [pythonBuiltins[k].type], version: 0}))};
    /* FITRUE_isPurePython */
}
export function getAvailableItemsForImportFromModule(module: string) : AcResultType[] {
    const star : AcResultType = {"acResult": "*", "documentation": "All items from module", "version": 0, "type": []};
    /* IFTRUE_isMicrobit */
    const allMicrobitItems: AcResultType[] = microbitPythonAPI[module as keyof typeof microbitPythonAPI] as AcResultType[];
    if (allMicrobitItems) {
        return [...allMicrobitItems, star];
    }
    /* FITRUE_isMicrobit */

    /* IFTRUE_isPurePython */
    const allSkulptItems: AcResultType[] = skulptPythonAPI[module as keyof typeof skulptPythonAPI] as AcResultType[];
    if (allSkulptItems) {
        return [...allSkulptItems, star];
    }
    /* FITRUE_isPurePython */
    return [star];
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


// Get the placeholder text for the given function parameter index
// If it's the last parameter, glue the rest together with commas
function getParamPrompt(params: string[], targetParamIndex: number, lastParam: boolean) : string {
    if (targetParamIndex >= params.length) {
        return "";
    }
    else if (!lastParam) {
        return params[targetParamIndex];
    }
    else {
        return params.slice(targetParamIndex).join(", ");
    }
}

// Gets the parameter name prompt for the given autocomplete details (context+token)
// for the given parameter.
export function calculateParamPrompt(context: string, token: string, paramIndex: number, lastParam: boolean) : string {
    if (!context) {
        // If context is blank, we know that the function must be one of:
        // - A user-defined function
        // - A built-in function
        // - An explicitly imported function with from...import...
        // We check the items in that order.  We can do this without using Skulpt, which will speed things up
        const userFunc = getAllEnabledUserDefinedFunctions().find((f) => (f.labelSlotsDict[0].slotStructures.fields[0] as BaseSlot)?.code === token);
        if (userFunc !== undefined) {
            const params : string[] = extractCommaSeparatedNames(userFunc.labelSlotsDict[1].slotStructures);
            return getParamPrompt(params, paramIndex, lastParam);
        }
        const builtinFunc = getBuiltins().find((f) => f.acResult === token);
        if (builtinFunc !== undefined) {
            if (builtinFunc.params) {
                return getParamPrompt(builtinFunc.params.filter((p) => p.defaultValue === undefined).map((p) => p.name), paramIndex, lastParam);
            }
            else {
                return "";
            }
        }
        const importedFunc = Object.values(getAllExplicitlyImportedItems()).flat().find((f) => f.acResult === token);
        if (importedFunc !== undefined) {
            if (importedFunc.params) {
                return getParamPrompt(importedFunc.params.filter((p) => p.defaultValue === undefined).map((p) => p.name), paramIndex, lastParam);
            }
            else {
                return "";
            }
        }

        // Didn't find it anywhere, so we just don't know:
        return "";
    }
    else {
        // If the context matches an imported module, we can look it up there.        
        const fromModule = getAvailableItemsForImportFromModule(context).find((ac) => ac.acResult === token);
        if (fromModule?.params !== undefined) {
            return getParamPrompt(fromModule.params.filter((p) => p.defaultValue === undefined).map((p) => p.name), paramIndex, lastParam);
        }

        // Otherwise, if there's context, we would have to use Skulpt, but the problem is that Skulpt
        // doesn't have an inspect module to reflect params

        // So unfortunately, we just can't help with param names.
        return "";
    }

}
