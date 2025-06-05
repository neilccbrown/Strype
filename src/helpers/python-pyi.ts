
// Splits arguments at a comma, but allows brackets with commas in them
// which do not split.  So only splits at top-level of a potentially nested expression.
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

    for (let i = 0; i < lines.length; i++) {
        // Type lines are optional so we want to find the def/class lines, then look following those.
        // But we actually look for type line first:
        const typeMatch = i + 1 >= lines.length ? null : lines[i + 1].match(/\s*#\s*type\s*:\s*(\S.*)/);

        // Look for a function definition on current line:
        const funcDefMatch = lines[i].match(/^(\s*)def (\w+)\((.*?)\)\s*:\s*$/);
        if (funcDefMatch) {
            const [indent, fnName, args] = funcDefMatch.slice(1);
            const argNames = args.trim() ? args.split(",").map((s) => s.replace(/=.*/, "").trim()) : [];
            let argTypeList : string[];
            let returnType : string;
            if (typeMatch) {
                let argTypes;
                [argTypes, returnType] = typeMatch[1].trim().split("->").map((s) => s.trim());

                if (indent != "") {
                    // If we're indented, we're a class, so remove first argName as it's self:
                    argNames.shift();
                }
                argTypeList = splitTopLevelArgs(argTypes.slice(1, -1)).map((s) => s.trim());
            }
            else {
                returnType = "any";
                argTypeList = Array.from(argNames, () => "any");
            }

            const typedArgs = (indent != "" ? "self" + (argTypeList.length > 0 ? ", " : "") : "") + argNames.map((arg, i) => `${arg}: ${argTypeList[i]}`).join(", ");
            output.push(`${indent}def ${fnName}(${typedArgs}) -> ${returnType}: ...`);
        }
        
        const classMatch = lines[i].match(/^class (\w+).*:\s*$/);
        if (classMatch) {
            output.push(lines[i]);
        }
        const varMatch = lines[i].match(/^(\s*)(\S+)\s*=(.*)$/);
        if (varMatch) {
            //const [indent, name, rhs] = varMatch.slice(1);
            if (lines[i].includes("namedtuple(")) {
                output.push(lines[i]);
            }
            //output.push(`${indent}${name}: ${type}`);
        }
        if (lines[i].match(/^import/)) {
            output.push(lines[i]);
        }
    }

    return output.join("\n");
}

// Maps function name to list of parameter names
type FunctionMap = Record<string, string[]>;

export function parsePyi(content: string): FunctionMap {
    const lines = content.split(/\r?\n/);
    const result: FunctionMap = {};

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
            const [, funcName, paramList] = funcMatch;
            let params = paramList.split(",")
                .map((p) => p.trim().split(":")[0].trim())
                .filter((p) => p && !p.startsWith("*"));

            // Remove 'self' or 'cls' from class methods
            if (currentClass && (params[0] === "self" || params[0] === "cls")) {
                params = params.slice(1);
            }

            const fullName = currentClass ? `${currentClass}.${funcName}` : funcName;
            result[fullName] = params;
        }

        // Reset class context if we are back to top-level
        if (line.trim() === "" || /^\S/.test(line)) {
            currentClass = null;
        }
    }

    return result;
}
