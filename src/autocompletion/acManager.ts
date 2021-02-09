import Parser from "@/parser/parser";

const operators = ["+","-","/","*","%","//","**","&","|","~","^",">>","<<",
    "+=","-+","*=","/=","%=","//=","**=","&=","|=","^=",">>=","<<=",
    "==","=","!=",">=","<=","<",">"];

const operatorsWithBrackets = [...operators,"(",")","[","]","{","}"];
const operatorsWithBracketsAndSpace = [...operatorsWithBrackets," "];

const INDENT = "    ";

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

// Brython does not have the documentation for the built-in method 'breakpoint'; hence, we need to hardcode it
const breakpointDocumentation = "Help on built-in function breakpoint in module builtins:\nbreakpoint(...)\nbreakpoint(*args, **kws)\n\nCall sys.breakpointhook(*args, **kws).  sys.breakpointhook() must accept\nwhatever arguments are passed.\n\nBy default, this drops you into the pdb debugger."

// Check every time you're in a slot and see how to show the AC
export function getCandidatesForAC(slotCode: string, frameId: number, acSpanId: string, documentationSpanId: string): {tokenAC: string; contextAC: string; showAC: boolean} {
    //check that we are in a literal: here returns nothing
    //in a non terminated string literal
    //writing a number)

    if((slotCode.match(/"/g) || []).length % 2 == 1 || !isNaN(parseFloat(slotCode.substr(Math.max(slotCode.lastIndexOf(" "), 0))))){
        console.log("found a string literal or a number, nothing to do for AC")
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
    //   3?) The is a potential case that we are in a method call, and we need to return also the names and the number of arguments
    //        e.g.  max( --> here the context = `max()` and no tokenAC. We may need to return the args to show a hint to the user.

    let tokenAC = "";
    let contextAC = ""
    
    // if the string's last character is an operator or symbol that means there is no context and tokenAC
    // we also try to avoid checking for context and token when the line ends with multiple dots, as it creates a problem to Brython
    if(!operatorsWithBracketsAndSpace.includes(slotCode.substr(codeIndex).slice(-1)) && !slotCode.substr(codeIndex).endsWith("..")) {
    
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
    const userCode = parser.getCodeWithoutErrors(frameId,true);
    let inspectionCode ="";

    /*
    *       STEP 1 : Run the code and get the AC results
    */
    // append the line that gets all the possible names of the namespace and the context
    // The builtins will be used only if we don't have a context
    inspectionCode += "\ntry:"
    inspectionCode += "\n"+INDENT+"namesForAutocompletion="+((contextAC)?"":" dir(__builtins__) +")+" dir("+contextAC+")";
    inspectionCode += "\nexcept:\n"+INDENT+"pass"
    // Define the slot id we are talking about
    inspectionCode += "\ntry:"
    // append the line that removes useless names and saves them to the results
    inspectionCode += "\n"+INDENT+"results = [name for name in namesForAutocompletion if not name.startswith('__') and not name.startswith('$$')]"
    // If there are no results, we notify the hidden span that there is no AC available
    inspectionCode += "\n"+INDENT+"if(len(results)>0):"
    inspectionCode += "\n"+INDENT+INDENT+"document['"+acSpanId+"'].text = results"
    // Fake a click to the hidden span to trigger the AC window to show
    inspectionCode += "\n"+INDENT+INDENT+"event1 = window.MouseEvent.new('click')"
    inspectionCode += "\n"+INDENT+INDENT+"document['"+acSpanId+"'].dispatchEvent(event1)"
    inspectionCode += "\n"+INDENT+"else:"
    // We empty any previous results so that the AC won't be shown
    inspectionCode += "\n"+INDENT+INDENT+"document['"+acSpanId+"'].text =''"
    inspectionCode += "\nexcept:\n"+INDENT+"pass" 

    /*
    *       STEP 2 : Get the documentation for each one of the results
    */

    inspectionCode += "\ntry:";
    inspectionCode += "\n"+INDENT+"documentation=[]";
    inspectionCode += "\n"+INDENT+"for result in results:";
    inspectionCode += "\n"+INDENT+INDENT+"typeOfResult = type(exec(result))";
    // built-in types most likely refer to variable or values defined by the user
    inspectionCode += "\n"+INDENT+INDENT+"isBuiltInType = typeOfResult in (str,bool,int,float,complex,list, tuple, range,bytes, bytearray, memoryview,set, frozenset, type);"
    inspectionCode += "\n"+INDENT+INDENT+"if isBuiltInType:";
    inspectionCode += "\n"+INDENT+INDENT+INDENT+"documentation.append('Type of: '+typeOfResult.__name__);"
    inspectionCode += "\n"+INDENT+INDENT+"elif typeOfResult.__name__ == 'function':"
    inspectionCode += "\n"+INDENT+INDENT+INDENT+"documentation.append('Function '+result+' with arguments: '+exec(result+'.__code__.co_varnames'));"
    inspectionCode += "\n"+INDENT+INDENT+"elif typeOfResult.__name__ == 'NoneType':"
    inspectionCode += "\n"+INDENT+INDENT+INDENT+"documentation.append('Built-in value')"
    inspectionCode += "\n"+INDENT+INDENT+"elif result != 'breakpoint':"
    inspectionCode += "\n"+INDENT+INDENT+INDENT+"documentation.append(help(exec(result)).replace(\"'\",\" \").replace(\"\\\"\",\" \"));"
    inspectionCode += "\n"+INDENT+INDENT+"else:"
    inspectionCode += "\n"+INDENT+INDENT+INDENT+"documentation.append(\"\"\""+breakpointDocumentation+"\"\"\");"
    inspectionCode += "\n"+INDENT+"document['"+documentationSpanId+"'].text = documentation;"
    inspectionCode += "\n"+INDENT+"event2 = window.MouseEvent.new('click')"
    inspectionCode += "\n"+INDENT+"document['"+documentationSpanId+"'].dispatchEvent(event2)"
    inspectionCode += "\nexcept:\n"+INDENT+"pass";

    // We need to put the user code before, so that the inspection can work on the code's results
    runPythonCode(userCode + inspectionCode);
    // console.log(userCode);
    return {tokenAC: tokenAC , contextAC: contextAC, showAC: true};
}


