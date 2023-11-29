// This file is used by the command-line script process-skulpt-api.ts so it is important
// that it does not import other parts of the code (e.g. i18n) that can't work outside webpack
interface CodeMatchIterable {
    hasMatches: boolean,
    iteratorMatches?: IterableIterator<RegExpMatchArray>
}

declare const Sk: any;

const INDENT = "    ";

const STRYPE_LIB_TO_HIDE_PREFIX = "__StrypePythonKW__";


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
export function prepareSkulptCode(userCode: string, contextAC: string, translateI18N: (key: string) => string): string {

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
                # IMPORTANT NOTE ----- this will work fine when the python modules can be imported (i.e. defined in Skulpt, or added by us for micro:bit)
                # if a module is defined but is not "reachable", then it won't show in the a/c
                module = ${jsonStringifiedContext} or globals().get(name).__module__ or ''
                if ${contextAC.length == 0 ? "True" : "False"}: 
                    if str(globals().get(name)).startswith('<module '):
                        module = "${translateI18N("autoCompletion.importedModules")}"
                if module:
                    if module.startswith('__main__'):
                        module="${translateI18N("autoCompletion.myFunctions")}"
                    elif module.startswith("builtins") or module == "":
                        module="${translateI18N("autoCompletion.myVariables")}"
                    # if there is no list for the specific mod, create it and append the name; otherwise just append the name
                    resultsWithModules.setdefault(module,[]).append({"acResult": name, "documentation": "", "type": "", "version": 0})

            # Before we finish we need to have the "My Variables" on the top of the list(dictionary)
            # Get the index of "My Variables" in the dictionary
            try:
                resultsWithModulesKeys = list(resultsWithModules.keys())
                # If it is present
                if "${translateI18N("autoCompletion.myVariables")}" in resultsWithModulesKeys:
                    indexOfMyVariables = resultsWithModulesKeys.index("${translateI18N("autoCompletion.myVariables")}")
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

export function configureSkulptForAutoComplete() : void {
    Sk.configure({output:(t:string) => console.log("Python said: " + t), yieldLimit:100,  killableWhile: true, killableFor: true});
}
