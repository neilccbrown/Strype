// This file contains the logic to get results for autocompletion based on the current frame text input.
// It narrows down the searches among the "built-in/native/core" and imported libraries currently refered by
// the project code, and analyses the current code input to decide which results should be given.
// In the following file "AC" shorthand refers to "AutoCompletion"

// The language description to use for this editor
import langDescription from "@/autocompletion/microbit.json"
import { ModuleDef } from "@/types/types";

// The referential for autocompletion. A default content is created at the application lauch time with
// only the built-in/core/native language library. **By default, this library is called "_core_" 
// in the JSON language file description**
const acReferential = [] as ModuleDef[];


// Update the referential for autocompletion: every time a module is added/remove from the code.
// We alway remove everything for the module in the referential first.
// If we were deleting, then stop there, otherwise get the right content for the import for that module    
// args:
//  adding : flag to indicate the user add/update or delete an import for a specified module
//  import startement : content of the statement so we can decide how to use it for changing the referential, if deletion only the module name matters
export function updateACReferential(adding: boolean, importStr: string) {
    //first parse the import statement
    const isNSRequired = importStr.startsWith("import ");
    let moduleName = (isNSRequired) ? importStr.substr(importStr.indexOf("import ") + "import ".length) : importStr.substr(importStr.indexOf("from ") + "from ".length)
    if(moduleName.indexOf(" import ") > 0){
        moduleName = moduleName.substr(0, moduleName.indexOf(" import "))
    } 
    else if(moduleName.indexOf(" as ") > 0){
        moduleName = moduleName.substr(0, moduleName.indexOf(" as "))
    } 
    const asAlias = (importStr.indexOf(" as ") > -1) ? importStr.substr(importStr.indexOf(" as ") + " as ".length) : ""; 
    let importParts = (isNSRequired) ? "" : importStr.substr(importStr.indexOf(" import ") + " import ".length);
    if(importParts.indexOf(" as ") > 0){
        importParts = importParts.substr(0, importParts.indexOf(" as "))
    }

    //remove everything about that module in the referential to work again on that module
    const moduleIndex = acReferential.findIndex((module) => module.name === moduleName);
    if(moduleIndex > -1){
        acReferential.splice(moduleIndex, 1);
    }

    //if are adding/updating the referencial for that module, continue...
    if(adding){
        const allModule = langDescription.modules.filter((module) => module.name === moduleName)[0];
        let toAdd = {} as ModuleDef;
        //if we are NOT importing the complete module, then we refine the scope of the referential
        if(!isNSRequired && importParts !== "*"){
            toAdd = allModule;
        }
        else{
            toAdd = allModule;
        }

        //set infos properties
        toAdd.name = moduleName;
        toAdd.needNS = isNSRequired;
        if(asAlias.length > 0){
            toAdd.alias = asAlias;
        }
        
        //add the module in the referencial
        acReferential.push(toAdd);
    }
}

// Load the AC with initial state, to be called when the application launches.
export function loadAC(){
    updateACReferential(true, "from _core_ import *");
    console.log(acReferential)
}