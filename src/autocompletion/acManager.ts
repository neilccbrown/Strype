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

// Check every time you're in a slot and see how to show the AC
export function getCandidatesForAC(slotCode: string, frameId: number, slotId: string): {tokenAC: string; contextAC: string; showAC: boolean} {
    //check that we are in a literal: here returns nothing
    //in a non terminated string literal
    //writing a number)

    // TODO, does it work for every case?
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
    let userCode = parser.getCodeWithoutErrors(frameId);
    
    // append the line that gets all the possible names of the namespace and the context
    // The builtins will be used only if we don't have a context
    userCode += "\ntry:"
    userCode += "\n"+INDENT+"namesForAutocompletion="+((contextAC)?"":" dir(__builtins__) +")+" dir("+contextAC+")";
    userCode += "\nexcept:\n    pass"
    // Define the slot id we are talking about
    userCode += "\ntry:"
    userCode += "\n"+INDENT+"slotId='popupAC"+slotId+"ResutlsSpan'"
    // append the line that removes useless names and adds the results to the DOM
    userCode += "\n"+INDENT+"document[slotId].text = [name for name in namesForAutocompletion if not name.startswith('__') and not name.startswith('$$')]";
    // Fake a click to the hidden span to trigger the AC window to show
    userCode += "\n"+INDENT+"event = window.MouseEvent.new('click')"
    userCode += "\n"+INDENT+"document[slotId].dispatchEvent(event)"
    userCode += "\nexcept:\n"+INDENT+"pass"


    console.log(userCode);

    runPythonCode(userCode);

    return {tokenAC: tokenAC , contextAC: contextAC, showAC: true};
}

export function getFuncSignature(funcName: string, frameId: number): void {
    const parser = new Parser();
    let inspectionCode = parser.getCodeWithoutErrors(frameId);
    // console.log("%%%%%%%%%%%%%\n"+inspectionCode);
    inspectionCode += "\ntry:";
    inspectionCode += "\n"+INDENT+"typeOfInput = type("+funcName+")";
    // built-in types most likely refer to variable or values defined by the user
    inspectionCode += "\n"+INDENT+"isBuiltInType = typeOfInput in (str,bool,int,float,complex,list, tuple, range,bytes, bytearray, memoryview,set, frozenset)"
    inspectionCode += "\n"+INDENT+"if not isBuiltInType:";

    inspectionCode += "\n"+INDENT.repeat(2)+"documentation = help("+funcName+")";

    inspectionCode += "\n"+INDENT.repeat(2)+"if documentation != None :";
    inspectionCode += "\n"+INDENT.repeat(3)+"print(documentation)";
    inspectionCode += "\nexcept:\n"+INDENT+"pass";// Exception as e:\n"+INDENT+"print(e)";
    console.log("________________");
    console.log(inspectionCode);
    console.log("________________");
    


    runPythonCode(inspectionCode);

}
