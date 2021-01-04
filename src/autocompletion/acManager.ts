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
import { ElementDef, LanguageDef, LibraryPath, SearchLangDefScope } from "@/types/types";
import store from "@/store/store";

// Gets an element (a class/module/method/variable defined by it's path name) from the language definitions
// undefined is returned if no module is found.
export function retrieveElementInDefs(scope: SearchLangDefScope, path: string, customDef?: ElementDef[]): ElementDef|undefined {
    //user defined elements have priority over libraries elements, which have priority over builtin elements.
    //so the order to list all the language elements below is important 
    let tempModuleDefs = [] as ElementDef[];
    switch(scope){
    case SearchLangDefScope.userDefs:
        tempModuleDefs = [...store.getters.getUserDefinedElements()];
        break;
    case SearchLangDefScope.libraryDefs:
        tempModuleDefs = [...(langDescription as LanguageDef).libraries];
        break;
    case SearchLangDefScope.currentSearchDefs:
        tempModuleDefs = [...store.getters.getCurrentLangSearchReferential()];
        break;
    case SearchLangDefScope.custom:
        tempModuleDefs = [...customDef??[]];
        break;
    default:
        break;
    }

    const pathLevels = path.split(".");
    const rootDefs = [...tempModuleDefs];

    //before searching, we check that the first level of the path isn't a "shorcut" for a pseudo element added when module name space isn't required.
    //if we find one, we change the given path as argument to the complete actual path
    const firstLevelShortcutElement = tempModuleDefs.find((elt) => elt.name === pathLevels[0] && (elt.target??"").length > 0);
    if(firstLevelShortcutElement){
        path = (firstLevelShortcutElement.target??"") + ((pathLevels.length > 1) ? ("." + pathLevels.slice(1,pathLevels.length).join(".")) : "");
    }
    
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
                //if the currentPath points at a variable or a method, we need to change the path
                //to point at the type
                if(foundCurrentPathElt.kind === "variable" || foundCurrentPathElt.kind === "method"){
                    tempPath = (foundCurrentPathElt.type + "." + subPath)??"";
                    tempModuleDefs = rootDefs;
                }
                else{
                    tempPath = tempPath.substr(tempPath.indexOf(".") + 1);
                    tempModuleDefs = foundCurrentPathElt.elements ?? [];    
                }
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
function addImportedLibraryElement(importPartsStr: string, moduleName: string){
    //Prepare the import list
    const imports = [] as string[], aliases = [] as string[];
    importPartsStr.split(",").forEach((fullImportStr) => {
        const eltAliasArray = fullImportStr.split(" as ");
        imports.push(eltAliasArray[0].trim());
        aliases.push((eltAliasArray.length > 1) ? eltAliasArray[1].trim() : "");     
    });

    //Go through the imports to add required parts in the referential
    let index = 0;
    imports.forEach((importName) => {
        //take care of the weird import format "from module import *, xx as yy"
        const eltPath = moduleName + "." + importName;
        if(importName==="*" || retrieveElementInDefs(SearchLangDefScope.libraryDefs, eltPath)){
            const importPath = {} as LibraryPath;
            importPath.name = (aliases[index].length > 0) ? aliases[index] : moduleName + ((importName === "*") ? "" : ("." + importName));
            importPath.aliasFor = (aliases[index].length > 0) ?  moduleName + "." + importName : "";
            store.commit("addImportedLibrary", importPath);
        }
        index++;
    });
}

// Adds the dependencies of an element specified by its path, in the specified location
function addDependencyModuleParts(currentElementPath: string, targetDefs: ElementDef[]){
    const currentElement = retrieveElementInDefs(SearchLangDefScope.custom, currentElementPath,targetDefs)??{} as ElementDef;

    let dependencyNames = [] as string[];
    if(currentElement.kind === "method" || currentElement.kind === "variable"){
        dependencyNames = [currentElement.type??""];  
    }
    else if(currentElement.kind === "class"){
        dependencyNames = currentElement.super??[];
    }
    
    dependencyNames.forEach((dependencyName) => {
        //check if the dependency is valid, and if is NOT a native/built-in/core dependency
        //(because for native depencencies we don't need to anything: they are included by default)
        if(dependencyName.length > 0 && dependencyName.indexOf(".") > 0){
            let target = targetDefs;
            //check if the dependency exists already in the target --> if not, add it from the language description
            if(!retrieveElementInDefs(SearchLangDefScope.custom, dependencyName, target)){
                //When adding the dependency we need to make sure all levels of the path are created too
                const levels = dependencyName.split(".");
                let levelIndex = 0;
                levels.forEach((level) => {
                    let targetLevelIndex = target.findIndex((elt) => elt.name === level);
                    if(targetLevelIndex === -1){
                        //the level isn't found. Add it from language description (using a copy not to delete anything unwanted from the language description)
                        //but making sure that we only add the specific level to the target
                        //(because we only add what we need)
                        const fullLevelName = levels.slice(0, levelIndex + 1).join(".");
                        const levelElt = JSON.parse(JSON.stringify(retrieveElementInDefs(SearchLangDefScope.libraryDefs, fullLevelName))) as ElementDef;
                        //We should always get here -- testing levelElt to keep TS happy
                        if(levelElt){
                            if(levelIndex < levels.length - 1){
                                levelElt.elements = [];
                            }
                            //add the level in the target
                            target.push(levelElt);
                            targetLevelIndex  = target.length - 1;
                            //add potential super classes of the super classes recursively
                            if(levelElt.kind==="class"){
                                addDependencyModuleParts(fullLevelName, targetDefs);
                            }
                        }
                    }
                    target = target[targetLevelIndex].elements??[];
                    levelIndex++;
                })
            }
        }
    });
}

// Update the referential for autocompletion: every time a module or its parts its added/remove from the code.
// The referential is ALWAYS CLEARED AND REBUILT whenever a change happens on imports to avoid descripancy in the referential
// (for example: if the user made 2 imports that which modules parts overlap, removing one of the import should still preserve the overlapping part)
// args:
//  import statements : list of import statements to build the referential upon
export function updateImportedLibraries(imports: string[]) {
    // Clear the imported libraries
    store.commit("clearImportedLibraries");
    
    // Rebuilt imports
    imports.forEach((importStr) => {
        // Parse the import statement to retrieve the module and potential elements/aliases
        // We support these formats:
        // import module [as x]
        // import module1 [as x], module 2 [as y] (this can be done, but it's a boderline use of our frames)
        // from module import x [as y] (where x is a defined identifier, not *)
        // from module import *
        // from module import x [as a], y [as b] (this can be done, but it's a borderline use of our frames)
        const isNSRequired = importStr.startsWith("import ");

        const aliasNames = [] as string[];
        const moduleNames = [] as string[];
        let importPartsStr = "";
        if(isNSRequired){
            importStr.substr("import ".length ).split(",").forEach((moduleAlias) => {
                const moduleAliasArray = moduleAlias.split(" as ");
                moduleNames.push(moduleAliasArray[0].trim());
                aliasNames.push((moduleAliasArray.length > 1) ? moduleAliasArray[1].trim() : "");        
            });
        }
        else{
            const fromPartOffset = 5; //the offset of "from "
            const moduleName = importStr.substr(fromPartOffset, importStr.indexOf(" import ") - fromPartOffset);
            moduleNames.push(moduleName);
            importPartsStr = importStr.substr(importStr.indexOf(" import ") + " import ".length);
        }

        //Add the import library contents.
        let moduleIndex = 0;
        moduleNames.forEach((moduleName ) => {
            const moduleDef = retrieveElementInDefs(SearchLangDefScope.libraryDefs, moduleName);
            if(moduleDef){
                moduleDef.needNS = isNSRequired;
            
                if(!isNSRequired && importPartsStr !== "*"){
                    //the import targets specific module's parts
                    addImportedLibraryElement(importPartsStr, moduleName);
                }
                else{
                    //the import targets the whole module
                    const moduleImportedPath = {} as LibraryPath;
                    const hasAlias = (aliasNames.length > 0 && aliasNames[moduleIndex].length > 0);
                    moduleImportedPath.name = (hasAlias) ? aliasNames[moduleIndex] : moduleName;
                    moduleImportedPath.aliasFor = (hasAlias) ? moduleName : "";
                    store.commit("addImportedLibrary", moduleImportedPath);
                }
            }
            moduleIndex++;
        });
    });
}

// Generates the referential used during a search on the language
export function makeLangSearchReferential(searchBase: {scope: SearchLangDefScope; rootPath: string}): ElementDef[]{
    const ref: ElementDef[] = [];
    let rootModule: ElementDef | undefined;
    switch(searchBase.scope){
    case SearchLangDefScope.importModule:
        //Search for a module in imports (as xx in from xx" or "import xx") --> init on language defs libraries root modules
        (langDescription as LanguageDef).libraries
            .filter((elt) => elt.kind === "module")
            .forEach((elt) => ref.push(elt));
        console.log("importModule");
        break;
    case SearchLangDefScope.importModulePart:
        //Search for a module part in imports (as xx in from <module> import xx") --> init on language defs libraries root module's vars/classes/methods
        rootModule = retrieveElementInDefs(SearchLangDefScope.libraryDefs, searchBase.rootPath);
        if(rootModule){
            rootModule.elements
            ?.filter((elt) => elt.kind !== "module" && !elt.hide)
            .forEach((elt) => ref.push(elt));
        }
        console.log("ImportModulePart");
        break;
    case SearchLangDefScope.inCode:
        //Search for user defined elements, imported libraries elements (and their dependencies) when we are outside imports frames
        //add user definitions first (that are defined in the scope of the current)
        (store.getters.getUserDefinedElements() as ElementDef[]).forEach((elt) => ref.push(elt));
        //then add the imported library based on imported paths, and its dependencies
        store.getters.getImportedLibraryPaths().forEach((importedLibPath: LibraryPath) => {
            let addIn = ref;

            const aliasName = (importedLibPath.aliasFor.length > 0) ? importedLibPath.name : "";
            const elementName = (importedLibPath.aliasFor.length > 0) ? importedLibPath.aliasFor : importedLibPath.name;
            
            //we need to check if the upper levels of the element to add are in the referential, otherwise, we add them accordingly 
            const levels = elementName.split(".");
            
            //change the name to alias if alias is defined
            if(aliasName.length > 0){ 
                levels[levels.length-1] = aliasName;
            }

            //if a whole module or an element of a module is imported, and the module name space isn't requiredn
            // we add the whole content or the module elemnt here in a pseudo element targetting the actual path
            const targettedModuleElement = retrieveElementInDefs(SearchLangDefScope.libraryDefs, elementName);
            const targettedModuleElementParent = (levels.length > 1) 
                ? retrieveElementInDefs(SearchLangDefScope.libraryDefs, levels.slice(0,levels.length-1).join(".")) 
                : undefined;
            if(targettedModuleElement && targettedModuleElement.kind === "module" && !targettedModuleElement.needNS){
                targettedModuleElement.elements?.forEach((elt) => addIn.push({name: elt.name, kind: elt.kind,target: elementName +"." + elt.name}));
            }
            else if(targettedModuleElementParent && targettedModuleElementParent.kind === "module" && !targettedModuleElementParent.needNS) {
                //the kind here should always return, but to keep TS happy, use "class" as default
                addIn.push({name: levels[levels.length-1], kind: targettedModuleElement?.kind??"class",target: elementName});
            }
            
            for(let levelIndex = 0; levelIndex < levels.length; levelIndex++){
                const fullLevelPath = levels.slice(0,levelIndex+1).join(".");
                if(!retrieveElementInDefs(SearchLangDefScope.custom, fullLevelPath, ref)){
                    //add the level. If that's not the LAST level, we only don't add the sub elements, just prepare the empty array
                    const elt = JSON.parse(JSON.stringify(retrieveElementInDefs(SearchLangDefScope.libraryDefs, elementName))) as ElementDef;
                    if(levelIndex < levels.length - 1){
                        elt.elements = []
                    }
                    else if(aliasName.length > 0){
                        elt.name = aliasName;
                    }
                    addIn.push(elt)
                    //may add in a sublevel
                    addIn = elt.elements??[];
                }
            }
            //check the dependencies
            addDependencyModuleParts(levels.join("."), ref);
        });
        //then add builtin
        (langDescription as LanguageDef).builtin.forEach((elt) => ref.push(elt));
        break;
    case SearchLangDefScope.none:
    default:
        break;
    }
    return ref;                
}

// Gets language elements depending on the contextElementPath (where do we search) and the token (what do we search).
// The search is made on the current referential and returns a subset of the elements.
// The order is reset here to priortise the token as start of the candidate.
// If the token is empty, the search doesn't filter anything
export function searchLanguageElements(token: string, contextElementPath: string): ElementDef[]{
    const results = [] as ElementDef[];

    //position the root where to apply the search
    let rootElements: ElementDef[] = store.getters.getCurrentLangSearchReferential();
    if(contextElementPath.length > 0){
        const contextElt = retrieveElementInDefs(SearchLangDefScope.currentSearchDefs, contextElementPath);
        if(contextElt === undefined){
            rootElements = [];
        }
        else{
            let actualContextElt = {} as ElementDef;
            switch(contextElt.kind){
            case "module":
                rootElements = contextElt.elements??[];
                break;
            case "variable":
            case "method":
                actualContextElt = retrieveElementInDefs(SearchLangDefScope.currentSearchDefs, contextElt.type??"")??({} as ElementDef);
                rootElements = actualContextElt.elements??[];
                //instances of a class cannot have variables elements: we remove them
                rootElements = rootElements.filter((elt) => elt.kind !== "variable");
                break;
            case "class":
                actualContextElt = retrieveElementInDefs(SearchLangDefScope.currentSearchDefs, contextElementPath)??({} as ElementDef);
                rootElements = actualContextElt.elements??[];
                break;
            default:
                break;
            }
        }
    }

    rootElements
        .filter((elt) => {
            //First check if the element is a "pseudo" elements added when namespace isn't required:
            //if that's so, we check the properties of the target element instead
            let eltToCheck = elt;
            if(elt.target??0 > 0){
                eltToCheck = retrieveElementInDefs(SearchLangDefScope.custom, elt.target??"", rootElements)??({} as ElementDef);
            }
            let acceptElt = !(eltToCheck.kind === "class" && eltToCheck.hide) && (token.length === 0 || elt.name.toLowerCase().indexOf(token.toLowerCase()) > -1);
            
            switch(store.getters.getCurrentLangSearchType()){
            case SearchLangDefScope.importModule:
                acceptElt = acceptElt && eltToCheck.kind === "module";
                break;
            case SearchLangDefScope.importModulePart:
                acceptElt = acceptElt && eltToCheck.kind !== "module";
                break;
            case SearchLangDefScope.inCode:
                //a module which whose name space isn't required is not retrieved by the search
                if(eltToCheck.kind==="module" && !eltToCheck.needNS){
                    acceptElt = false;
                }
                break;
            }
            return acceptElt;
        })
        .forEach((elt) => {
            results.push(elt);
        });

    //sort the candidates with this rule: first those starting with with the token (and sort alphbetically) and others, alphabetically
    results.sort((el1, el2) => {
        if(el1.name.toLowerCase().startsWith(token.toLowerCase())) {
            if(el2.name.startsWith(token)){
                return el1.name.localeCompare(el2.name);
            }
            return -1;
        }
        if(el2.name.toLowerCase().startsWith(token.toLowerCase())){
            return 1;
        }
        return el1.name.localeCompare(el2.name);
    })

    // In specific cases we want to alter the result
    switch(store.getters.getCurrentLangSearchType()){
    case SearchLangDefScope.importModule:
        //for importing modules, if the first entry matches exactly the token, we replace it by "." if submodules exists, remove it if no submodule exist
        if(results.length > 0 && results[0].name === token){
            if(results[0].elements?.find((elt) => elt.kind === "module")){
                results[0] = {name: ".", kind: "keyword"};
            }
            else{
                results.splice(0,1);
            }
        }
        break;
    case SearchLangDefScope.importModulePart: 
        //for importing a module part, if the token is empty, we insert the star token before the results
        if(results.length > 0 && token.length === 0){
            results.splice(0, 0, {name: "*", kind: "keyword"});
        }
        break;
    case SearchLangDefScope.inCode:
        //for in-code autocompletion, if the element exactly match the suggestion then we change it to "."
        if(results.length > 0 && results[0].name === token){
            results[0] = {name: ".", kind: "keyword"};
        }
        break;
    default:
        break;
    }

    return results;
}

/*********************** FOR TESTS AND TEMPORARY WORK ONLY  **************************/

//TEST PART FOR CHECKING AUTOCOMPLETION CONTENT ON VARS IS COHERENT WITH LIBRARIES
function getACSuggestionsForElement(fullNameElt: string): ElementDef[]{
    const res = [] as ElementDef[];
    const obj = retrieveElementInDefs(SearchLangDefScope.libraryDefs, fullNameElt)
    if(obj){
        if(obj.kind === "variable"){
            //get the type of that object
            const objType = obj.type;
            if(objType){
                console.log("The class type for that object is: "+ objType);
                //retrieve the element defining the object type (+ super types)
                const toLookType = [objType];
                while(toLookType.length > 0){
                    const objTypeElt = retrieveElementInDefs(SearchLangDefScope.libraryDefs, toLookType.pop()??"");
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
    updateImportedLibraries(/*["from microbit import pin0 as myFirstPin, pin12 as mySecondPint, pin3",*/["from microbit import *", "import audio as theSoundModule, machine"]);
    console.log("imported libraries defs :")
    console.log("TBD");
    console.log("imported libraries paths :")
    console.log(store.getters.getImportedLibraryPaths());
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