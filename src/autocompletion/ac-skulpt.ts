// This file is used by the command-line script process-skulpt-api.ts so it is important
// that it does not import other parts of the code (e.g. i18n) that can't work outside webpack
interface CodeMatchIterable {
    hasMatches: boolean,
    iteratorMatches?: IterableIterator<RegExpMatchArray>
}

declare const Sk: any;

const INDENT = "    ";

// The ID of a DIV that is used for "backend" operations with Skulpt, like a/c or retrieving
// documentation. Strype includes such DIV in the UI (NOT the Turtle output visible for users),
// but any mechanism using Skulpt for "backend" jobs that do not use Strype will need to create a
// DIV element with *this* ID.
export const BACKEND_SKULPT_DIV_ID = "backEndSkulptDiv";


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

// Takes user code from the editor and gets rid of print calls and input() functions, then returns the new code
function processUserCodeForAC(userCode: string) {
    // we want to remove prints, so that when the AC runs on Brython we don't get the prints on the console or the browsers terminal
    // we search for INDENT+print to avoid the very rare case that print is part of a string
    // we also replace with pass# to avoid leaving a blank or commented row which is considered a mistake by python
    // we also search for the input function as it would systematically trigger a prompt whenever we run the a/c (but OK for exec on console though)
    // we replace it by an empty string
    userCode = userCode.replaceAll(INDENT + "print(", INDENT + "pass#");
    return replaceInputFunction(userCode);
}

/*
 * Prepare code to be run by Skulpt in order to find out completions for autocomplete.
 * Calls dir() on the given context then puts the results as a list of string into the "acs" variable.
 * 
 * @param userCode -> The user code to run in Skulpt before asking for completions
 * @param contextAC -> Anything before the dot in the text before the current cursor position, to call dir() on.
 */
export function getPythonCodeForNamesInContext(userCode: string, contextAC: string): string {

    userCode = processUserCodeForAC(userCode);

    // To avoid problems with strings in the contextAC (i.e. in function calls), we use an "escaped" value JSON-compliant
    // (note that the rendered string is wrapped by double quotes)
    const jsonStringifiedContext = JSON.stringify(contextAC);

    const inspectionCode = `
acs = []
try:
    acs = dir(${contextAC})
except Exception as e:
    print("Could not find names for " + ${jsonStringifiedContext})
`;

    return (userCode + inspectionCode);
}

// Get Python code to get the list of class methods of moduleName.className into a list of strings named "acs"
// Each item in acs will be className.method (but no module name), e.g. for int it would be "int.from_bytes"
export function getPythonCodeForClassMethods(userCode: string, moduleName: string | null, className: string) : string {
    userCode = processUserCodeForAC(userCode);
    
    const fullyQualifiedClassName = moduleName ? (moduleName + "." + className) : className;

    const inspectionCode = `
# Get all attributes of the class
attributes = dir(${fullyQualifiedClassName})

# Filter the static methods
acs = []
for attr_name in attributes:
    if not attr_name.startswith("_"):
        try:
            attr = getattr(${fullyQualifiedClassName}, attr_name)
            # Check it is a class method:
            if callable(attr) and getattr(attr, "__self__") is ${fullyQualifiedClassName}:
                acs.append("${className}." + attr_name)
        except:
            pass
`;
    return userCode + inspectionCode;
}

/**
 * Generates some Python code to access the type and documentation of the itemToQuery.
 * @param userCode User code to run before querying the item
 * @param itemToQuery The item to query, unquoted
 * Leaves the list of types in itemTypes and the documentation in itemDocumentation
 */
export function getPythonCodeForTypeAndDocumentation(userCode: string, itemToQuery: string) : string {
    userCode = processUserCodeForAC(userCode);
    const inspectionCode = `
from types import ModuleType

itemTypes = []
try:
    if callable(${itemToQuery}):
        itemTypes.append("function")
    if isinstance(${itemToQuery}, type):
        itemTypes.append("type")    
    if isinstance(${itemToQuery}, ModuleType):
        itemTypes.append("module")
except:
    pass
itemDocumentation = ""
try:
    itemDocumentation = ${itemToQuery}.__doc__ or itemDocumentation
except:
    pass
# For some items, e.g. types.BuiltinMethodType, __doc__ is not a string.  If this happens, set it back to empty string:
if not isinstance(itemDocumentation, str):
    itemDocumentation = ""
`;
    return userCode + inspectionCode;
}

export function configureSkulptForAutoComplete() : void {
    Sk.configure({output:(t:string) => console.log("Python said: " + t), yieldLimit:100,  killableWhile: true, killableFor: true});
    // We also need to set some Turtle environment for Skulpt -- note that the output DIV is NOT the one visible by users,
    // because this environment is only used for our backend processes of the code for autocompletion.
    Sk.TurtleGraphics = {};
    // Create a DIV in the BODY element if the "backend" Turtle output DIV doesn't exist.
    if(document.getElementById(BACKEND_SKULPT_DIV_ID) == undefined){
        const turtleDiv = document.createElement("div");
        turtleDiv.id = BACKEND_SKULPT_DIV_ID;
        document.getElementsByTagName("body")[0].appendChild(turtleDiv);
    }       
    Sk.TurtleGraphics.target = BACKEND_SKULPT_DIV_ID; 
}
