// This file contains the logic to get results for autocompletion based on the current frame text input.
// It narrows down the searches among the "built-in/native/core" and imported libraries currently refered by
// the project code, and analyses the current code input to decide which results should be given.
// In the following file "AC" shorthand refers to "AutoCompletion"

// The language description to use for this editor
import langDescription from "@/autocompletion/microbit.json"
import { AliasesPath, ElementDef, ModulesDefScope } from "@/types/types";

// The referential for autocompletion. A default content is created at the application lauch time with
// only the built-in/core/native language library. **By default, this library is called "_core_" 
// in the JSON language file description**
export const acReferential = [] as ElementDef[];
export const aliasesPath = {} as AliasesPath;

// Gets a module (can be full named module) from one of the definitions (language or referential)
// undefined is returned if no module is found.
function retrieveModuleInDefs(scope: ModulesDefScope, moduleName: string, customScope?: ElementDef[]): ElementDef|undefined {
    let tempModuleName = moduleName;
    let parentModuleName = "", subModuleName = ""; 
    let tempModuleDefs = (scope === ModulesDefScope.languageDefs) 
        ? langDescription.modules as ElementDef[] 
        : (scope === ModulesDefScope.acReferentialDefs)
            ? acReferential
            : customScope??[];
    do{
        parentModuleName = (tempModuleName.indexOf(".") > -1) ? tempModuleName.substr(0, tempModuleName.indexOf(".")) : tempModuleName;
        subModuleName =  (tempModuleName.indexOf(".") > -1) ? tempModuleName.substr(tempModuleName.indexOf(".") + 1) : "";

        //check in the modules definitions
        const foundModule = tempModuleDefs.find((elt) => elt.name === parentModuleName && elt.kind === "module");
        if(foundModule){
            //the parentmodule is found in the descriptions, if it's the termination (no subModule) then return it
            //otherwise, we prepare for the next iteration going into another sublevel of the modules
            if(subModuleName.length === 0){
                return foundModule;
            }
            else{
                tempModuleName = tempModuleName.substr(tempModuleName.indexOf(".") + 1);
                tempModuleDefs = foundModule.elements?.filter((elt) => elt.kind === "module") ?? []; //we shouldn't get to [], just keep TS happy here
            }
        }
        else{
            //nothing is found for that module, we just break the loop by returning undefined
            return undefined;
        }
    }
    while(subModuleName.length > 0);
}

// Removes a module (qualified with full name) to the referential
function removeModuleFromReferential(moduleName: string){
    //if the module has no sublevel, we just delete it directly from the referential if it exists there
    //otherwise, we look for its parent first, then delete the module if the parent isn't undefined
    const parentModule = (moduleName.indexOf("0") === -1) 
        ? acReferential 
        : retrieveModuleInDefs(ModulesDefScope.acReferentialDefs, moduleName.substr(moduleName.lastIndexOf(".")))?.elements?.filter((elt) => elt.kind === "module");

    if(parentModule){
        const moduleIndex = parentModule.findIndex((module) => module.name === moduleName);
        if(moduleIndex > -1){
            parentModule.splice(moduleIndex, 1);
        }
    }
}


// Adds the required module parts dependant of the user's selected imports
// If the dependancies are in the same module as the current import, we need to add the dependancies to "currToAdd"
// otherwise, we add them to the referential.
function addRelatedModuleParts(eltToAdd: ElementDef, currToAdd: ElementDef, moduleName: string){
    let dependencyName = "";
    if(eltToAdd.type === "method" || eltToAdd.kind === "variable"){
        dependencyName = eltToAdd.type??"";  
    }
    
    //check if the dependency is valid, and if is NOT a native/built-in/core dependency
    //(because for native depencencies we don't need to anything: they are included by default)
    if(dependencyName.length > 0 && dependencyName.indexOf(".") > 0){
        const checkInCurrentToAdd = (dependencyName.substr(0, dependencyName.lastIndexOf(".")).startsWith(moduleName));
        let target = checkInCurrentToAdd ? currToAdd.elements??[] : acReferential;
        //check if the dependency exists already in the target --> if not, add it from the language description
        const searchDependencyName = (checkInCurrentToAdd) ? dependencyName.substr(dependencyName.indexOf(moduleName) + 1) : dependencyName;
        let parentLevelsDepName = (checkInCurrentToAdd) ? dependencyName.substr(0, dependencyName.indexOf(moduleName)) : "";
        if(!retrieveModuleInDefs(ModulesDefScope.customDefs, searchDependencyName, target)){
            //When adding the dependency we need to make sure all levels of the path are created too
            const levels =searchDependencyName.split(".");
            let levelIndex = 0;
            levels.forEach((level) => {
                let targetLevelIndex = target.findIndex((elt) => elt.name === level);
                if(targetLevelIndex === -1){
                    //the level isn't found. Add it from language description (using a copy not to delete anything unwanted from the language description)
                    //but making sure that we only add the specific level to the target
                    //(because we only add what we need)
                    parentLevelsDepName += ((parentLevelsDepName.length > 0) ? "." :"" + level);
                    const levelElt = JSON.parse(JSON.stringify(retrieveModuleInDefs(ModulesDefScope.languageDefs, parentLevelsDepName)));
                    //We should always get here -- testing levelElt to keep TS happy
                    if(levelElt){
                        if(levelIndex < levels.length - 1){
                            levelElt.elements = [];
                        }
                        //add the level in the target
                        target.push(levelElt);
                        targetLevelIndex  = target.length - 1;
                    }
                }
                target = target[targetLevelIndex].elements??[];
                levelIndex++;
            })
        }
    }
}

// Gets the elements of a module (filtered) based on the import statement
function getFilteredModule(allModule: ElementDef, importPartsStr: string, moduleName: string): ElementDef{
    const toAdd = {} as ElementDef;
    toAdd.name = allModule.name;
    toAdd.kind = "module";
    toAdd.needNS = false;
    toAdd.elements = [];

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

    //go through the imports to add required parts in the "toAdd" elements
    let index = 0;
    imports.forEach((importName) => {
        const eltToAdd = allModule.elements?.find((elt) => elt.name === importName);
        if(eltToAdd){
            toAdd.elements?.push(eltToAdd)
            if(aliases[index].length > 0){
                aliasesPath[aliases[index]] = moduleName + "." + importName;
            }

            //We also make sure that for this import, related modules/modules parts are also included in the referential
            addRelatedModuleParts(eltToAdd, toAdd, moduleName);
        }
        index++;
    });

    return toAdd;
}

// Update the referential for autocompletion: every time a module is added/remove from the code.
// We alway remove everything for the module in the referential first.
// If we were deleting, then stop there, otherwise get the right content for the import for that module    
// args:
//  adding : flag to indicate the user add/update or delete an import for a specified module
//  import startement : content of the statement so we can decide how to use it for changing the referential, if deletion only the module name matters
export function updateACReferential(adding: boolean, importStr: string) {
    // First parse the import statement
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
    
    //remove everything about that module in the referential to work again on that module
    removeModuleFromReferential(moduleName);

    //if are adding/updating the referencial for that module, get the right content in the referential
    if(adding){
        const allModule = retrieveModuleInDefs(ModulesDefScope.languageDefs, moduleName);
        if(allModule){
            let toAdd = {} as ElementDef;
            //if we are NOT importing the complete module, then we refine the scope of the referential
            if(!isNSRequired && importPartsStr !== "*"){
                toAdd = getFilteredModule(allModule, importPartsStr, moduleName);
            }
            else{
                //we just take the whole module
                toAdd = allModule;
            }
    
            //set infos properties
            toAdd.name = moduleName;
            toAdd.needNS = isNSRequired;
            if(moduleAliasName.length > 0){
                aliasesPath[moduleAliasName] = moduleName;
            }

            //add the module in the referencial ONLY if there is any definition inside the module
            if(toAdd.elements?.length??0 > 0){
                acReferential.push(toAdd);    
            }
        }               
    }
}

// Load the AC with initial state, to be called when the application launches.
export function loadAC(){
    //updateACReferential(true, "from _core_ import *");
    updateACReferential(true, "from microbit import button_a");
    console.log(acReferential);
    console.log(aliasesPath);
    console.log("language desc")
    console.log(langDescription)
}