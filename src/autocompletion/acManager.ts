// This file contains the logic to 
// - retrieve information to display in AC
// - maintain a referential for autocompletion (AC) based on the imports
//
// The referencial is simply a list of paths that refers to the specific libraries elements based on the user code imports
// The builtin and user definited elements don't need to be added in the referential because:
//  1) the builtin elements are always accessible regardless the user code
//  2) the user defined elements (variables and functions) are to be used as a whole in AC

// The language description to use for this editor
import langDescription from "@/autocompletion/microbit.json"
import { AliasesPath, ElementDef, LanguageDef } from "@/types/types";

// The referential for autocompletion. A default content is created at the application lauch time with
// only the built-in/core/native language library. 
export const acReferential = [] as string[];
// The hash for aliases and their path
export const aliasesPath = {} as AliasesPath;

// Gets an element (a class/module/method/variable defined by it's path name) from the language definitions
// undefined is returned if no module is found.
function retrieveElementInDefs(path: string): ElementDef|undefined {
    //user defined elements have priority over libraries elements, which have priority over builtin elements.
    //so the order to list all the language elements below is important 
    const languageDef = langDescription as LanguageDef;
    let tempModuleDefs = [...languageDef.userDefinitions,...languageDef.libraries, ...languageDef.builtin];
    
    let tempPath = path;
    let currPath = "", subPath = "";  
    do{
        currPath = (tempPath.indexOf(".") > -1) ? tempPath.substr(0, tempPath.indexOf(".")) : tempPath;
        subPath =  (tempPath.indexOf(".") > -1) ? tempPath.substr(tempPath.indexOf(".") + 1) : "";

        //check the current level in the definitions
        const foundCurrentPathElt = tempModuleDefs.find((elt) => elt.name === currPath);
        if(foundCurrentPathElt){
            //the current element is found in the descriptions, if it's the termination (no subPath) then return it
            //otherwise, we prepare for the next iteration going into another sublevel of the path
            if(subPath.length === 0){
                return foundCurrentPathElt;
            }
            else{
                tempPath = tempPath.substr(tempPath.indexOf(".") + 1);
                tempModuleDefs = foundCurrentPathElt.elements ?? [];
            }
        }
        else{
            //nothing is found at some level of the path, we just break the loop by returning undefined
            return undefined;
        }
    }
    while(subPath.length > 0);
}

// Add the filtered elements of a module in the referential based on the import statement
function addModuleFileredEltToACRef(importPartsStr: string, moduleName: string){
    //Prepare the import list
    const imports = [] as string[], aliases = [] as string[];
    importPartsStr.split(",").forEach((fullImportStr) => {
        if(fullImportStr.indexOf(" as ") > -1){
            imports.push(fullImportStr.substr(0, fullImportStr.indexOf(" as ")).trim());
            aliases.push(fullImportStr.substr(fullImportStr.lastIndexOf(" ")).trim());
        } 
        else{
            imports.push(fullImportStr.trim());
            aliases.push("");
        }
    });

    //Go through the imports to add required parts in the referential
    let index = 0;
    imports.forEach((importName) => {
        const eltPath = moduleName + "." + importName;
        if(acReferential.indexOf(eltPath) === -1 && retrieveElementInDefs(eltPath)){
            acReferential.push(eltPath);
            if(aliases[index].length > 0){
                aliasesPath[aliases[index]] = moduleName + "." + importName;
            }
        }
        index++;
    });
}

// Update the referential for autocompletion: every time a module or its parts its added/remove from the code.
// The referential is ALWAYS CLEARED AND REBUILT whenever a change happens on imports to avoid descripancy in the referential
// (for example: if the user made 2 imports that which modules parts overlap, removing one of the import should still preserve the overlapping part)
// args:
//  import statements : list of import statements to build the referential upon
export function updateACReferential(imports: string[]) {
    // Clear the referential
    acReferential.splice(0,acReferential.length);
    
    // Rebuilt the referential
    imports.forEach((importStr) => {
        // Parse the import statement to retrieve the module and potential elements/aliases
        // We support these formats:
        // import module as [x]
        // from module import x [as y] (where x is a defined identifier, not *)
        // from module import *
        // from module import x [as a], y [as b], z [as c] (this can be done, but it's a borderline use of our frames)
        const isNSRequired = importStr.startsWith("import ");

        let moduleAliasName = "";

        let moduleName = (isNSRequired) ? importStr.substr(importStr.indexOf("import ") + "import ".length) : importStr.substr(importStr.indexOf("from ") + "from ".length)
        if(moduleName.indexOf(" import ") > 0){
            moduleName = moduleName.substr(0, moduleName.indexOf(" import "));
        } 
        else if(moduleName.indexOf(" as ") > 0){
            moduleAliasName = moduleName.substr(moduleName.indexOf(" as ") + " as ".length);
            moduleName = moduleName.substr(0, moduleName.indexOf(" as "))
        } 

        const importPartsStr = (isNSRequired) ? "" : importStr.substr(importStr.indexOf(" import ") + " import ".length);

        // Add the elements in the referential.
        // Note that imports that can't match something in the language definition are discarded
        if(!isNSRequired && importPartsStr !== "*"){
            addModuleFileredEltToACRef(importPartsStr, moduleName);
        }
        else{
            //we just take the whole module
            if(acReferential.indexOf(moduleName) === -1 && retrieveElementInDefs(moduleName) !== undefined){
                acReferential.push(moduleName)
            }
        }
        //set module alias and if NS is required (if the module exists)
        const moduleDef = retrieveElementInDefs(moduleName);
        if(moduleDef){
            moduleDef.needNS = isNSRequired;
            if(moduleAliasName.length > 0){
                aliasesPath[moduleAliasName] = moduleName;
            }
        }
    });
}

/*********************** FOR TESTS AND TEMPORARY WORK ONLY  **************************/

//TEST PART FOR CHECKING AUTOCOMPLETION CONTENT ON VARS IS COHERENT WITH LIBRARIES
function getACSuggestionsForElement(fullNameElt: string): ElementDef[]{
    const res = [] as ElementDef[];
    const obj = retrieveElementInDefs(fullNameElt)
    if(obj){
        if(obj.kind === "variable"){
            //get the type of that object
            const objType = obj.type;
            if(objType){
                console.log("The class type for that object is: "+ objType);
                //retrieve the element defining the object type (+ super types)
                const toLookType = [objType];
                while(toLookType.length > 0){
                    const objTypeElt = retrieveElementInDefs(toLookType.pop()??"");
                    objTypeElt?.elements?.forEach((elt) => res.push(elt));
                    objTypeElt?.super?.forEach((superType) => toLookType.push(superType));
                }                
            }
            else{
                console.log("The TYPE (class type) isn't properly set for that object !")
            }
        }
        else{
            console.log("The suggestions are not looked upon a VARIABLE !")
        }
    }
    else{
        console.log("Cannot find object in language def !!");
    }
    return res;
}

// Load the AC with initial state (built in elements), to be called when the application launches.
export function testAC(){
    updateACReferential(["from microbit import pin0, pin12","import audio"]);
    console.log("ac referential :")
    console.log(acReferential);
    console.log("alias paths :")
    console.log(aliasesPath);
    console.log("language desc :")
    console.log(langDescription)


    //few tests to check libraries implementation
    const objToTest = [
        /*"microbit.button_a",
        "microbit.button_b",*/
        "microbit.compass",
    ]

    objToTest.forEach((objName) => {
        console.log("\nTEST FOR ==> " + objName);
        console.log(getACSuggestionsForElement(objName));
    })
}