
// Splits arguments at a comma, but allows brackets with commas in them
// which do not split.  So only splits at top-level of a potentially nested expression.
import {Signature, TPyParser} from "tigerpython-parser";

function splitTopLevelArgs(s: string): string[] {
    const result: string[] = [];
    let depth = 0;
    let current = "";

    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === "," && depth === 0) {
            result.push(current.trim());
            current = "";
        }
        else {
            if (c === "[" || c === "(") {
                depth++;
            }
            if (c === "]" || c === ")") {
                depth--;
            }
            current += c;
        }
    }

    if (current) {
        result.push(current.trim());
    }

    return result;
}

// Processes a .py file with optional "# type" annotations after each item,
// and returns the .pyi file.
export function extractPYI(original : string) : string {
    const lines = original.split("\n");
    const output: string[] = [];

    let lastTopLevelLine: "class" | "other" = "other";
    for (let i = 0; i < lines.length; i++) {
        // Type lines are optional so we want to find the def/class lines, then look following those.
        // But we actually look for type line first:
        const typeMatch = i + 1 >= lines.length ? null : lines[i + 1].match(/\s*#\s*type\s*:\s*(\S.*)/);

        // Look for a function definition on current line:
        const funcDefMatch = lines[i].match(/^(\s*)def (\w+)\((.*?)\)\s*:\s*$/);
        if (funcDefMatch) {
            const [indent, fnName, args] = funcDefMatch.slice(1);
            const argNames : [string, string | null][] = args.trim() ? args.split(",").map((s) => {
                if (s.includes("=")) {
                    return [s.replace(/=.*$/, "").trim(), s.replace(/^[^=]*=/, "").trim()];
                }
                else {
                    return [s.trim(), null];
                }
            }) : [];
            if (indent != "") {
                if (lastTopLevelLine === "class") {
                    // If we're indented, and we're a class, remove first argName as it's self:
                    argNames.shift();
                }
                else {
                    // We are a function nested inside e.g. another function.  Skip this line:
                    continue;
                }
            }
            else {
                lastTopLevelLine = "other";
            }
            let argTypeList : string[];
            let returnType : string;
            if (typeMatch) {
                let argTypes;
                [argTypes, returnType] = typeMatch[1].trim().split("->").map((s) => s.trim());
                argTypeList = splitTopLevelArgs(argTypes.slice(1, -1)).map((s) => s.trim());
            }
            else {
                returnType = "any";
                argTypeList = Array.from(argNames, () => "any");
            }

            const typedArgs = (indent != "" ? "self" + (argTypeList.length > 0 ? ", " : "") : "") + argNames.map(([arg, defVal], i) => `${arg}: ${argTypeList[i]} ${defVal == null ? "" : " = " + defVal}`).join(", ");
            output.push(`${indent}def ${fnName}(${typedArgs}) -> ${returnType}: ...`);
        }
        
        const classMatch = lines[i].match(/^class (\w+).*:\s*$/);
        if (classMatch) {
            output.push(lines[i]);
            lastTopLevelLine = "class";
        }
        const varMatch = lines[i].match(/^(\s*)(\S+)\s*=(.*)$/);
        if (varMatch) {
            //const [indent, name, rhs] = varMatch.slice(1);
            if (lines[i].includes("namedtuple(")) {
                output.push(lines[i]);
            }
            //output.push(`${indent}${name}: ${type}`);
        }
        if (lines[i].match(/^import\s+/) || lines[i].match(/^from\s+.*import/)) {
            output.push(lines[i]);
            lastTopLevelLine = "other";
        }
    }

    return output.join("\n");
}

// Maps function name and class.function name to signatures
type FunctionMap = Record<string, Signature>;

// This uses TigerPython to define a module, and is not intended to be called from Strype main,
// only from the preprocessing code.
export function parsePyiForPreprocess(content: string): FunctionMap {
    const lines = content.split(/\r?\n/);
    const result: FunctionMap = {};
    
    // Unique name:
    const modName = "foo" + Date.now();
    TPyParser.defineModule(modName, content, "pyi");

    const classRegex = /^\s*class\s+(\w+)\s*[:(]/;
    const funcRegex = /^\s*def\s+(\w+)\s*\(([^)]*)\)/;

    let currentClass: string | null = null;

    for (const line of lines) {
        const classMatch = classRegex.exec(line);
        if (classMatch) {
            currentClass = classMatch[1];
            continue;
        }

        const funcMatch = funcRegex.exec(line);
        if (funcMatch) {
            let funcName = funcMatch[1];
            
            const fullName = currentClass ? `${currentClass}.${funcName}` : funcName;
            let code = "import " + modName + "\n" + modName + ".";
            if (currentClass) {
                if (funcName == "__init__") {
                    funcName = currentClass;
                }
                else {
                    code += currentClass + ".";
                }
            }
            const tigerResult = TPyParser.autoCompleteExt(code, code.length);
            const r = tigerResult?.filter((c) => c.acResult == funcName)?.[0];
            if (r?.signature) {
                result[fullName] = r?.signature;
            }
        }

        // Reset class context if we are back to top-level
        if (line.trim() === "" || /^\S/.test(line)) {
            currentClass = null;
        }
    }

    return result;
}
