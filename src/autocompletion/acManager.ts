import {AllFrameTypesIdentifier, BaseSlot, CodeMatchIterable, FrameObject} from "@/types/types";
import { operators, keywordOperatorsWithSurroundSpaces, STRING_SINGLEQUOTE_PLACERHOLDER, STRING_DOUBLEQUOTE_PLACERHOLDER } from "@/helpers/editor";

import i18n from "@/i18n";
import _ from "lodash";
import {useStore} from "@/store/store";

const INDENT = "    ";

const STRYPE_LIB_TO_HIDE_PREFIX = "__StrypePythonKW__";

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

export function storeCodeToDOM(code: string): void {
    //evaluate the Python user code for the AC
    const userPythonCodeHTMLElt = document.getElementById("userCode");

    if(userPythonCodeHTMLElt){        
        (userPythonCodeHTMLElt as HTMLTextAreaElement).value = code;
    }
}

// Functions to check / replace the input function of Python, as this should not be run when the a/c is running
function getMatchesForCodeInputFunction(code: string) : CodeMatchIterable {
    // the method can be preceded by white characters, operators and brackets
    const regex = /([\s+([,?:=&|])(input *\()/g;
    const res = {hasMatches: code.match(regex) !==null} as CodeMatchIterable;
    if(res.hasMatches){
        res.iteratorMatches = code.matchAll(regex);
    }
    return res;
}

function replaceInputFunction(code: string): string {
    // if the method is not found at all we just exit and return the code at it was
    // otherwise, we need a bit more than just replacing the above regex: we have no guarantee the first/last closing parenthesis 
    // MATCH the opening one of "input(". We search for the right replacement to make
    const regexMatchs = getMatchesForCodeInputFunction(code);
    
    if(!regexMatchs.hasMatches) {
        return code;
    }
    
    if(regexMatchs.iteratorMatches) {
        for(const regexMatch of regexMatchs.iteratorMatches) {
        // we find where to stop the replacement for one match, note that we know there will be at least a \n introduced by the a/c control code before "input("
            const startMatchIndex = regexMatch.index??0 + 1; // because "input(" is the second group, the first group will always have something
            let hasOpenedBracket = false, bracketCount = 0, inStrLitteral = false, strLitteralIndic = "", charIndex = 1;
            while(!hasOpenedBracket || bracketCount > 0) {
                const charInCode = code.charAt(startMatchIndex + charIndex);
                const prevCharInCode = code.charAt(startMatchIndex + charIndex - 1) ;
                switch(charInCode){
                case "(":
                    hasOpenedBracket = true;
                    if(!inStrLitteral){
                        bracketCount++;
                    }
                    break;
                case ")":
                    if(!inStrLitteral){
                        bracketCount--;
                    }
                    break;            
                case "\"":
                    if(!inStrLitteral){
                        strLitteralIndic = "\"";
                        inStrLitteral = true;
                    }
                    else {
                        if(prevCharInCode!= "\\" && strLitteralIndic == "\""){
                            inStrLitteral = false;
                        }
                    }
                    break;
                case "'":
                    if(!inStrLitteral){
                        strLitteralIndic = "'";
                        inStrLitteral = true;
                    }
                    else {
                        if(prevCharInCode!= "\\" && strLitteralIndic == "'"){
                            inStrLitteral = false;
                        }
                    }
                    break;                
                }        
                charIndex++;
            }
            //for this match, we can now replace the input() function by a string (of the same length to make sure we don't mess up indexes)
            //note that we repeat a space charIndex-3 times because we need to account the 2 double quotes, and we started iterating charIndex at 1
            code = code.substring(0, startMatchIndex + 1) + "\"" + " ".repeat(charIndex - 3) + "\"" + code.substring(startMatchIndex + charIndex);
        }
    }
    return code;
}

// Function to be used in getCandidatesForAC() and getImportCandidatesForAC() 
// This parts contains the logic used with Brython to retrieve the AC elements.
/*
 * @param regenerateAC -> If false we simply reshow AutoCompletion without running Brython code again
 * @param userCode 
 * @param contextAC -> Anything before the dot in the text before the current cursor position
 * @param acSpanId -> The UIID of the ac span where the AC results goto
 * @param documentationSpanId -> The UIID of the ac span where the AC documentation goes to
 * @param typesSpanId -> The UIID of the ac spand where the AC types go to
 * @param isImportModuleAC -> Are we needing AC for an import slot?
 * @param reshowResultsId -> The UIID of the hidden 'button` that would trigger the existing AC to reshow.
 */
export function prepareSkulptCode(userCode: string, contextAC: string): string {

    // we want to remove prints, so that when the AC runs on Brython we don't get the prints on the console or the browsers terminal
    // we search for INDENT+print to avoid the very rare case that print is part of a string
    // we also replace with pass# to avoid leaving a blank or commented row which is considered a mistake by python
    // we also search for the input function as it would systematically trigger a prompt whenever we run the a/c (but OK for exec on console though)
    // we replace it by an empty string
    userCode = userCode.replaceAll(INDENT+"print(",INDENT+"pass#");
    userCode = replaceInputFunction(userCode);

    // To avoid problems with strings in the contextAC (i.e. in function calls), we use an "escaped" value JSON-compliant
    // (note that the rendered string is wrapped by double quotes)
    const jsonStringifiedContext = JSON.stringify(contextAC);

    const hide = STRYPE_LIB_TO_HIDE_PREFIX;
    // The dedent command assumes the first command is zero indent.  This avoids us having to
    // put the embedded Python in the first column (which would mess up indentation relative to Typescript).
    
    let inspectionCode = "ac = 'Error'\n";
    
    /* IFTRUE_isMicrobit */
    inspectionCode += `
import sys as ${hide}sys
import ${hide}osMB
import ${hide}timeMB
import ${hide}random
${hide}sys.modules['os'] = ${hide}osMB
${hide}sys.modules['time'] = ${hide}timeMB
${hide}sys.modules['random'] = ${hide}random
        `;
    /* FITRUE_isMicrobit */

    inspectionCode += `
#
# STEP 1 : Run the code and get the AC results
#
validContext = True
try:
    namesForAutocompletion = dir(${contextAC})
except Exception as e:
    print("Could not find names for ${contextAC}")
    validContext = False
# if the previous lines created a problem, that means that the context or the token are not correct and we should stop
if validContext:
    # Define the slot id we are talking about
    try:
        # append the line that removes useless names and saves them to the results
        # we also need to remove validContext so that we don't get it in the results
        # and explicitly remove "__builtins__", "__annotations__", "__doc__", and "__name__" from the root listing
        results = [name for name in namesForAutocompletion if not name.startswith('${hide}') and not name.startswith('$$') and name!='validContext' ${(contextAC.length == 0) ? " and name not in ['__builtins__', '__annotations__', '__doc__', '__name__'] " : ""}]
        # If there are no results, we notify the hidden span that there is no AC available
        resultsWithModules={}
        if(len(results)>0):
            # We are creating a Dictionary with tuples of {module: [list of results]}
            # If there is no context, we want to know each result's source/module
            # The results can belong to one of the following four modules:
            # 1) $exec_XXX --> user defined methods
            # 2) builtins --> user defined variable
            # 3) Any other imported library
            # 4) Python/Brython builtins (these are added at the next stage, on AutoCompletion.vue)
            for name in results:
                # in case the contextAC is not empty, this is the 'module'
                # otherwise, if the globals().get(name) is pointing at a (root) module, then we create an 'imported modules' module,
                # if not, the we retrieve the module name with globals().get(name).__module__
                # IMPORTANT NOTE ----- this will work fine when the python modules can be imported (i.e. defined in Brython, or added by us for micro:bit)
                # if a module is defined but is not "reachable", then it won't show in the a/c
                module = ${jsonStringifiedContext} or globals().get(name).__module__ or ''
                if ${contextAC.length == 0 ? "True" : "False"}: 
                    if str(globals().get(name)).startswith('<module '):
                        module = "${i18n.t("autoCompletion.importedModules")}"
                if module:
                    if module.startswith('__main__'):
                        module="${i18n.t("autoCompletion.myFunctions")}"
                    elif module.startswith("builtins") or module == "":
                        module="${i18n.t("autoCompletion.myVariables")}"
                    # if there is no list for the specific mod, create it and append the name; otherwise just append the name
                    resultsWithModules.setdefault(module,[]).append({"acResult": name, "documentation": "", "type": "", "version": 0})

            # Before we finish we need to have the "My Variables" on the top of the list(dictionary)
            # Get the index of "My Variables" in the dictionary
            try:
                resultsWithModulesKeys = list(resultsWithModules.keys())
                # If it is present
                if "${i18n.t("autoCompletion.myVariables")}" in resultsWithModulesKeys:
                    indexOfMyVariables = resultsWithModulesKeys.index("${i18n.t("autoCompletion.myVariables")}")
                    # Convert the dictionary to a list
                    tups = list(resultsWithModules.items())
                    # Swap My Variables with the module in the first place
                    tups[indexOfMyVariables], tups[0] = tups[0], tups[indexOfMyVariables]
                    # Convert back to dictionary!
                    resultsWithModules = dict(tups)
            except Exception as e:
                print('exception1 ' + str(e))
            ac = resultsWithModules
        # If there are no results
        else:
            # We empty any previous results so that the AC won't be shown
            ac = ""
    except Exception as e2:
        print('exception2 ' + str(e2))

    #
    # STEP 2 : Get the documentation for each one of the results
    #
    #from io import StringIO
    import sys
    documentation={}
    types={}
    try:
        # For each module
        for module in resultsWithModules:
            # For each result in the specific module
            for result in resultsWithModules[module]:
                try:
                    # If there is context available, the "type()" needs it in order to give proper results. 
                    typeOfResult = type(eval(${(contextAC.length>0)?(jsonStringifiedContext+"+'.'+"):""}result)).__name__
                    types.setdefault(module,[]).append(typeOfResult or 'No documentation available')
                except:
                    documentation.setdefault(module,[]).append('No documentation available')
                    continue
                # built-in types most likely refer to variable or values defined by the user
                isBuiltInType = (typeOfResult in ('str','bool','int','float','complex','list','tuple','range','bytes','bytearray','memoryview','set','frozenset'))
                if isBuiltInType:
                    documentation.setdefault(module,[]).append('Type of: '+(typeOfResult or 'No documentation available'))
                elif typeOfResult == 'function' or typeOfResult == 'method':
                    # We make sure for functions that we can get the arguments. If we can't we just explains it to get something, at least and not having a/c crashing
                    if '__code__' in dir(exec(${(contextAC.length>0)?(jsonStringifiedContext+"+'.'+"):""}result)) and 'co_varnames' in dir(exec(${(contextAC.length>0)?(jsonStringifiedContext+"+'.'+"):""}result+'.__code__')):
                        arguments = str(exec(${(contextAC.length>0)?(jsonStringifiedContext+"+'.'+"):""}result+'.__code__.co_varnames'))
                        documentation.setdefault(module,[]).append('Function ' + result + ((' with arguments: ' + arguments.replace("'"," ").replace("\\""," ").replace(",)",")")) if arguments != '()' else ' without arguments'));
                    else:
                        documentation.setdefault(module,[]).append('Function ' + result + '\\n(arguments could not be found)')
                elif typeOfResult == 'NoneType':
                    documentation.setdefault(module,[]).append('Built-in value')
                else:
                    try:
                        #old_stdout = sys.stdout
                        #sys.stdout = mystdout = StringIO()
                        help(exec(result))
                        #documentation.setdefault(module,[]).append((mystdout.getvalue().replace("'"," ").replace("\\""," ")) or 'No documentation available')
                    except:
                        documentation.setdefault(module,[]).append('No documentation available')
                    finally:
                        #sys.stdout = old_stdout
                        #mystdout.close()
                        pass
        #inspectionCode += "\\n"+INDENT+INDENT+STRYPE_LIB_TO_HIDE_PREFIX+"document['"+documentationSpanId+"'].text = "+STRYPE_LIB_TO_HIDE_PREFIX+"json.dumps(documentation);";
        #inspectionCode += "\\n"+INDENT+INDENT+STRYPE_LIB_TO_HIDE_PREFIX+"document['"+typesSpanId+"'].text = "+STRYPE_LIB_TO_HIDE_PREFIX+"json.dumps(types);";
    
        # we store the context *path* obtained by checking the type of the context with Python, or leave empty if no context.
        # it will be used in the AutoCompletion component to check versions
        #inspectionCode += "\\n"+INDENT+INDENT+STRYPE_LIB_TO_HIDE_PREFIX+"document['"+acContextPathSpanId+"'].text = ''";
        if ${contextAC.length > 0 ? "True" : "False"}:
            # if there is a context,  we get the context path from 
            # - self value if that's a module,
            # - type() that returns the type as "<class 'xxx'>"
            #if str(globals().get("+jsonStringifiedContext+")).startswith('<module '):
            #    ${hide}document['"+acContextPathSpanId+"'].text = "+jsonStringifiedContext;
            #elif str(type("+contextAC+")).startswith('<class '):
            #    ${hide}document['"+acContextPathSpanId+"'].text = str(type("+contextAC+"))[8:-2]
            pass
    except Exception as e3:
        print('exception3 ' + str(e3))
        
`;
    
    return (userCode + inspectionCode);
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
    // we also try to avoid checking for context and token when the line ends with multiple dots, as it creates a problem to Brython
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

function getAllUserDefinedVariablesWithinUpTo(framesForParentId: FrameObject[], frameId: number) : { found : Set<string>, complete: boolean} {
    const soFar = new Set<string>();
    for (const frame of framesForParentId) {
        if (frameId == frame.id) {
            return {found: soFar, complete: true};
        }
        if (frame.frameType.type === AllFrameTypesIdentifier.varassign) {
            // We may have all sorts on the LHS.  We want any slots which are plain,
            // and which are adjoined by either the beginning of the slot, the end,
            // or a comma
            let validOpBefore = true;
            const ops = frame.labelSlotsDict[0].slotStructures.operators;
            const fields = frame.labelSlotsDict[0].slotStructures.fields;
            for (let i = 0; i < fields.length; i++) {
                const validOpAfter = i == fields.length - 1 || ops[i].code === ",";
                if ((fields[i] as BaseSlot).code) {
                    if (validOpBefore && validOpAfter) {
                        soFar.add((fields[i] as BaseSlot).code);
                    }
                }
                validOpBefore = validOpAfter;
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
        const parentId = useStore().frameObjects[curFrameId].parentId;
        if (parentId == -2) {
            // It's a user-defined function, process accordingly
            return getAllUserDefinedVariablesWithinUpTo(useStore().getFramesForParentId(curFrameId), frameId).found;
        }
        else if (parentId <= 0) {
            // Reached top-level, go backwards from here:
            return getAllUserDefinedVariablesWithinUpTo(useStore().getFramesForParentId(parentId), frameId).found;
        }
        curFrameId = parentId;
    }
}
