import Parser from "@/parser/parser";
import store from "@/store/store";
import { FrameObject } from "@/types/types";
import moduleDescription from "@/autocompletion/microbit.json"

const operators = ["+","-","/","*","%","//","**","&","|","~","^",">>","<<",
    "+=","-+","*=","/=","%=","//=","**=","&=","|=","^=",">>=","<<=",
    "==","=","!=",">=","<=","<",">"];

const keywordsWihtSurroundSpaces = [" and ", " in ", " is ", " or " ];

const INDENT = "    ";

let currentACContext= "_temp_AC_context_";

export function resetCurrentContextAC(): void {
    currentACContext = "_temp_AC_context_";
}

// Checks if the code passed as argument should not trigger the AC (implying the caret is at the end of this code)
function isACNeededToShow(code: string): boolean {
    //if there is no space in the code, the AC could be shown
    if(code.indexOf(" ") === -1){
        return true;
    }

    //check if we follow a symbols operator 
    let foundOperatorFlag = false;
    operators.forEach((op) => {
        if(code.trim().endsWith(op)) {
            foundOperatorFlag = true;
        }
    });

    if(!foundOperatorFlag) {
        //then check if we follow a non symbols operators (need a trailing space)
        keywordsWihtSurroundSpaces.forEach((op) => {
            if(code.toLowerCase().match(".*"+op+" *")) {
                foundOperatorFlag = true;
            }
        });
    }  

    return foundOperatorFlag;
}

function runPythonCode(code: string): void {
//evaluate the Python user code 
    const userPythonCodeHTMLElt = document.getElementById("userCode");

    if(userPythonCodeHTMLElt){        
        (userPythonCodeHTMLElt as HTMLSpanElement).textContent = code;
        
        const brythonContainer = document.getElementById("brythonContainer");
        // run the code by "clicking" the brythonContainer
        brythonContainer?.click();
    }
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
function prepareBrythonCode(regenerateAC: boolean, userCode: string, contextAC: string, acSpanId: string, documentationSpanId: string, typesSpanId: string, isImportModuleAC: boolean, reshowResultsId: string): void{
    let inspectionCode ="";

    if(regenerateAC){
        /*
        *       STEP 1 : Run the code and get the AC results
        */
        // append the line that gets all the possible names of the namespace and the context
        // The builtins will be used only if we don't have a context
        inspectionCode += "\ntry:"
        if(isImportModuleAC){
            inspectionCode += "\n"+INDENT+"namesForAutocompletion = "+contextAC;
            contextAC = "";
        }
        else{
            inspectionCode += "\n"+INDENT+"namesForAutocompletion = dir("+contextAC+")";
        }
        inspectionCode += "\nexcept:\n"+INDENT+"pass"
        // Define the slot id we are talking about
        inspectionCode += "\ntry:"
        // append the line that removes useless names and saves them to the results
        inspectionCode += "\n"+INDENT+"results = [name for name in namesForAutocompletion if not name.startswith('__') and not name.startswith('$$')]"
        // If there are no results, we notify the hidden span that there is no AC available
        inspectionCode += "\n"+INDENT+"if(len(results)>0):"
        //We are creating a Dictionary with tuples of {module: [list of results]}
        // If there is no context, we wan to know each result's source/module
        // The results can belong to one of the following three modules:
        // 1) $exec_XXX --> user defined methods
        // 2) builtins --> user defined variable
        // 3) Any other imported library
        inspectionCode += "\n"+INDENT+"resultsWithModules={}"
        inspectionCode += "\n"+INDENT+"for name in results:"
        inspectionCode += "\n"+INDENT+INDENT+"mod = globals()[name].__module__"
        inspectionCode += "\n"+INDENT+INDENT+"if mod.startswith(\"$exec\"):"
        inspectionCode += "\n"+INDENT+INDENT+INDENT+"mod=\"userFunctions\""
        inspectionCode += "\n"+INDENT+INDENT+"if mod not in resultsWithModules :"
        inspectionCode += "\n"+INDENT+INDENT+INDENT+"resultsWithModules[mod]=[]"
        inspectionCode += "\n"+INDENT+INDENT+"resultsWithModules[mod].append(name)"
        inspectionCode += "\n"+INDENT+INDENT+INDENT+"document['"+acSpanId+"'].text = resultsWithModules"

        inspectionCode += "\n"+INDENT+"else:"
        // We empty any previous results so that the AC won't be shown
        inspectionCode += "\n"+INDENT+INDENT+"document['"+acSpanId+"'].text =''"
        inspectionCode += "\nexcept:\n"+INDENT+"pass" 

        

        
        /*
        *       STEP 2 : Get the documentation for each one of the results
        */ 

        inspectionCode += "\nfrom io import StringIO";
        inspectionCode += "\nimport sys";
        inspectionCode += "\ndocumentation=[]";
        inspectionCode += "\ntypes=[]";
        inspectionCode += "\ntry:";
        inspectionCode += "\n"+INDENT+"for result in results:";
        inspectionCode += "\n"+INDENT+INDENT+"try:";
        // If there is context available, the `type()` needs it in order to give proper results. 
        inspectionCode += "\n"+INDENT+INDENT+INDENT+"typeOfResult = type(exec("+((contextAC.length>0)?("'"+contextAC+".'+"):"")+"result))";
        inspectionCode += "\n"+INDENT+INDENT+INDENT+"types.append(typeOfResult.__name__)";
        inspectionCode += "\n"+INDENT+INDENT+"except:";
        inspectionCode += "\n"+INDENT+INDENT+INDENT+"documentation.append('No documentation available')";
        inspectionCode += "\n"+INDENT+INDENT+INDENT+"continue";
        // built-in types most likely refer to variable or values defined by the user
        inspectionCode += "\n"+INDENT+INDENT+"isBuiltInType = (typeOfResult in (str,bool,int,float,complex,list, tuple, range,bytes, bytearray, memoryview,set, frozenset));"
        inspectionCode += "\n"+INDENT+INDENT+"if isBuiltInType:";
        inspectionCode += "\n"+INDENT+INDENT+INDENT+"documentation.append('Type of: '+typeOfResult.__name__);"
        inspectionCode += "\n"+INDENT+INDENT+"elif typeOfResult.__name__ == 'function':"
        inspectionCode += "\n"+INDENT+INDENT+INDENT+"documentation.append('Function '+result+' with arguments: ' + str(exec('"+((contextAC.length>0)?(contextAC+"."):"")+"'+result+'.__code__.co_varnames')).replace(\"'\",\" \").replace(\"\\\"\",\" \"));"
        inspectionCode += "\n"+INDENT+INDENT+"elif typeOfResult.__name__ == 'NoneType':"
        inspectionCode += "\n"+INDENT+INDENT+INDENT+"documentation.append('Built-in value')"
        inspectionCode += "\n"+INDENT+INDENT+"else:"
        inspectionCode += "\n"+INDENT+INDENT+INDENT+"try:";
        inspectionCode += "\n"+INDENT+INDENT+INDENT+INDENT+"old_stdout = sys.stdout";
        inspectionCode += "\n"+INDENT+INDENT+INDENT+INDENT+"sys.stdout = mystdout = StringIO()";
        inspectionCode += "\n"+INDENT+INDENT+INDENT+INDENT+"help(exec(result))";
        inspectionCode += "\n"+INDENT+INDENT+INDENT+INDENT+"documentation.append(mystdout.getvalue().replace(\"'\",\" \").replace(\"\\\"\",\" \"))";
        inspectionCode += "\n"+INDENT+INDENT+INDENT+"except:";
        inspectionCode += "\n"+INDENT+INDENT+INDENT+INDENT+"documentation.append('No documentation available')"
        inspectionCode += "\n"+INDENT+INDENT+INDENT+"finally:";
        inspectionCode += "\n"+INDENT+INDENT+INDENT+INDENT+"sys.stdout = old_stdout";
        inspectionCode += "\n"+INDENT+INDENT+INDENT+INDENT+"mystdout.close()"
        inspectionCode += "\n"+INDENT+"document['"+documentationSpanId+"'].text = documentation;"
        inspectionCode += "\n"+INDENT+"document['"+typesSpanId+"'].text = types;"
        inspectionCode += "\n"+INDENT+"document['test'].text = resultsWithModules;"
        inspectionCode += "\nexcept:\n"+INDENT+"pass";
    }

    // Fake a click to the hidden span to trigger the AC window to show
    // This must be done by Brython to be sure that the AC and documentation
    // have had time to load.
    inspectionCode += "\ntry:"
    inspectionCode += "\n"+INDENT+"event = window.MouseEvent.new('click')";
    inspectionCode += "\n"+INDENT+"document['"+((regenerateAC) ? acSpanId : reshowResultsId)+"'].dispatchEvent(event)"
    inspectionCode += "\nexcept:\n"+INDENT+"pass";
    
    // We need to put the user code before, so that the inspection can work on the code's results
    runPythonCode((regenerateAC) ? (userCode + inspectionCode) : inspectionCode);
}

// Check every time you're in a slot and see how to show the AC (for the code section)
// the full AC content isn't recreated every time, but only do so when we detect a change of context.
export function getCandidatesForAC(slotCode: string, frameId: number, acSpanId: string, documentationSpanId: string, typesSpanId: string, reshowResultsId: string): {tokenAC: string; contextAC: string; showAC: boolean} {
    //check that we are in a literal: here returns nothing
    //in a non terminated string literal
    //writing a number)

    if((slotCode.match(/"/g) || []).length % 2 == 1 || !isNaN(parseFloat(slotCode.substr(Math.max(slotCode.lastIndexOf(" "), 0))))){
        return {tokenAC: "", contextAC: "", showAC: false};
    }

    //We search for a smaller unit to work with, meaning we look at:
    //- any opened and non closed parenthesis
    //- the presence of an operator
    //- the presence of an argument separator
    let closedParenthesisCount = 0, closedSqBracketCount = 0, closedCurBracketCount = 0;
    let codeIndex = slotCode.length;
    let breakShortCodeSearch = false;
    while(codeIndex > 0 && !breakShortCodeSearch) {
        codeIndex--;
        const codeChar = slotCode.charAt(codeIndex);
        if((codeChar === "," || operators.includes(codeChar)) && closedParenthesisCount === 0){
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
    let contextAC = ""
    
    // if the string's last character is an operator or symbol that means there is no context and tokenAC
    // we also try to avoid checking for context and token when the line ends with multiple dots, as it creates a problem to Brython
    if(!slotCode.substr(codeIndex).endsWith("..") && !operators.includes(slotCode.substr(codeIndex).slice(-1))) {
        // we don't want to show the autocompletion if the code at the current position is 
        // after a space that doesn't separate some parts of an operator. In other words,
        // we want to avoid to show the autocompletion EVERYTIME the space key is hit.
        if(slotCode.trim().length > 0 && !isACNeededToShow(slotCode)){
            return {tokenAC: tokenAC , contextAC: contextAC, showAC: false};
        }
        // code we will give us context and token is the last piece of code after the last white space
        const subCode = slotCode.substr(codeIndex).split(" ").slice(-1).pop()??"";

        tokenAC = (subCode.indexOf(".") > -1) ? subCode.substr(subCode.lastIndexOf(".") + 1) : subCode;
        contextAC = (subCode.indexOf(".") > -1) ? subCode.substr(0, subCode.lastIndexOf(".")) : "";
    }
   
    /***
        TODO: Need to check for multiple dots ..
              Need to add try/except on dir
    */

    const parser = new Parser();
    const userCode = parser.getCodeWithoutErrorsAndLoops(frameId);

    //the full AC and documentation are only recreated when a next context is notified
    prepareBrythonCode((currentACContext.localeCompare(contextAC) != 0),userCode, contextAC, acSpanId, documentationSpanId, typesSpanId, false, reshowResultsId);
    currentACContext = contextAC;

    return {tokenAC: tokenAC , contextAC: contextAC, showAC: true};
}

// Check every time you're in a slot and see how to show the AC (for the imports section)
// Depending on what part of the import frame we are at, the AC will follow a different strategy:
// if we're on the "from" slot or the "import" slot (no "from" enabled) --> we retrieve the module name on the hard coded JSON module names list
// if we're on the "import" slot ("from" slot enabled) --> we retrieve the module's part directly via Brython
export function getImportCandidatesForAC(slotCode: string, frameId: number, slotIndex: number, acSpanId: string, documentationSpanId: string, typesSpanId: string, reshowResultsId: string): {tokenAC: string; contextAC: string; showAC: boolean} {
    //only keep the required part of the code token (for example if it's "firstMeth, secondMe" we only keep "secondMeth")
    if(slotCode.indexOf(",") > -1){
        slotCode = slotCode.substr(slotCode.lastIndexOf(",") + 1).trim();
    }

    //find out how to address the AC based on that import (are we looking for a module name or for a module part?)
    const frame: FrameObject = store.getters.getFrameObjectFromId(frameId);
    const lookupModulePart = (slotIndex == 1 && frame.contentDict[0].shownLabel); //false -> we look at a module itself, true -> we look at a module part  
    let contextAC = "";
    const tokenAC = slotCode;
    if(lookupModulePart){
        //we look at the module part --> get the module part candidates from Brython
        contextAC = frame.contentDict[0].code;
        const userCode = "import " + contextAC;
        prepareBrythonCode((currentACContext.localeCompare(contextAC)!=0), userCode, contextAC, acSpanId, documentationSpanId, typesSpanId, false, reshowResultsId);
    }
    else{
        //we look at the module --> get the module candidates from hard coded JSON
        contextAC = "['" + moduleDescription.modules.join("','") + "']";
        prepareBrythonCode((currentACContext.localeCompare(contextAC)!=0),"", contextAC, acSpanId, documentationSpanId, typesSpanId, true, reshowResultsId);
    }
    
    currentACContext = contextAC;
 
    return {tokenAC: tokenAC , contextAC: contextAC, showAC: true};
}


