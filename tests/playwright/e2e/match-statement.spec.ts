import {test, expect} from "@playwright/test";
import {readFileSync} from "node:fs";
import {save, testPlaywrightRoundTripImportAndDownload} from "../support/loading-saving";
import {skipPyodideLoading} from "../support/general";
import {getDefaultStrypeProjectDocumentationFullLine, pressN} from "../support/editor";

const defaultStandardStrypeProjectDocLiteral = getDefaultStrypeProjectDocumentationFullLine();

const basicMatchLiteral = `
#(=> Strype:1:std
${defaultStandardStrypeProjectDocLiteral}#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
match ___strype_blank  :
    case _  :
        pass
myString  = "Hello from Strype" 
print(myString) 
#(=> Section:End
`;

const defaultProjectCodeLiteral = `
#(=> Strype:1:std
${defaultStandardStrypeProjectDocLiteral}#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
myString  = "Hello from Strype" 
print(myString) 
#(=> Section:End
`;

test.beforeEach(async ({ page, browserName }, testInfo) => {
    if (browserName === "webkit" && process.platform === "win32") {
        // On Windows+Webkit it just can't seem to load the page for some reason:
        testInfo.skip(true, "Skipping on Windows + WebKit due to unknown problems");
    }

    // These tests can take longer than the default 30 seconds:
    testInfo.setTimeout(240000); // 240 seconds

    // Make browser's console.log output visible in our logs (useful for debugging):
    page.on("console", (msg) => {
        console.log("Browser log:", msg.text());
    });
    await skipPyodideLoading(page);
    await page.goto("./", {waitUntil: "load"});
    await page.waitForSelector("body");
    await page.evaluate(() => {
        (window as any).Playwright = true;
    });
});

test.describe("Add Match statement", () => {
    test("Add frame (basic)", async ({page}) => {
        await page.keyboard.press("m");
        expect(readFileSync(await save(page), "utf-8")).toEqual(basicMatchLiteral.trimStart());
    });

    test("Add frame (with match expression and one guarded extra case)", async ({page}) => {
        await page.keyboard.press("m");
        await page.waitForTimeout(200);
        await page.keyboard.type("foo");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("c");
        await page.waitForTimeout(200);
        await page.keyboard.type("bar if x>0");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("r");
        await page.waitForTimeout(200);
        await page.keyboard.type("\"hi\"");
        await page.waitForTimeout(200);
        expect(readFileSync(await save(page), "utf-8")).toEqual(`
#(=> Strype:1:std
${defaultStandardStrypeProjectDocLiteral}#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
match foo  :
    case bar if x>0  :
        return "hi" 
    case _  :
        pass
myString  = "Hello from Strype" 
print(myString) 
#(=> Section:End
`.trimStart());
    });

    test("Add frame (complex case blocks)", async ({page}) => {
        await page.keyboard.press("m");
        await page.waitForTimeout(200);
        await page.keyboard.type("value");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("#");
        await page.waitForTimeout(200);
        await page.keyboard.type(" 1. Literal patterns");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("c");
        await page.waitForTimeout(200);
        await page.keyboard.type("0");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("r");
        await page.waitForTimeout(200);
        await page.keyboard.type("\"Got zero\"");
        await page.waitForTimeout(200);
        await pressN("ArrowDown", 2, true)(page);
        await page.keyboard.press("c");
        await page.waitForTimeout(200);
        await page.keyboard.type("1|2|3");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("r");
        await page.waitForTimeout(200);
        await page.keyboard.type("\"Got a small number (1-3)\"");
        await page.waitForTimeout(200);
        await pressN("ArrowDown", 2, true)(page);
        await page.keyboard.press("#");
        await page.waitForTimeout(200);
        await page.keyboard.type(" 2. Type patterns");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("c");
        await page.waitForTimeout(200);
        await page.keyboard.type("str()");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("r");
        await page.waitForTimeout(200);
        await page.keyboard.type("f\"Got a string: {value}\"");
        await page.waitForTimeout(200);
        await pressN("ArrowDown", 2, true)(page);
        await page.keyboard.press("c");
        await page.waitForTimeout(200);
        await page.keyboard.type("int()");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("r");
        await page.waitForTimeout(200);
        await page.keyboard.type("f\"Got an integer: {value}\"");
        await page.waitForTimeout(200);
        await pressN("ArrowDown", 2, true)(page);
        await page.keyboard.press("#");
        await page.waitForTimeout(200);
        await page.keyboard.type(" 3. Sequence patterns");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("c");
        await page.waitForTimeout(200);
        await page.keyboard.type("[x,y]");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("r");
        await page.waitForTimeout(200);
        await page.keyboard.type("f\"Got a 2-item list: x={x}, y={y}");
        await page.waitForTimeout(200);
        await pressN("ArrowDown", 2, true)(page);   
        await page.keyboard.press("#");
        await page.waitForTimeout(200);
        await page.keyboard.type(" 4. Mapping patterns");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("c");
        await page.waitForTimeout(200);
        await page.keyboard.type("{\"type\":\"point\",\"x\":x,\"y\":y}");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("r");
        await page.waitForTimeout(200);
        await page.keyboard.type("f\"Got a point: ({x}, {y})");
        await page.waitForTimeout(200);
        await pressN("ArrowDown", 2, true)(page);
        await page.keyboard.press("#");
        await page.waitForTimeout(200);
        await page.keyboard.type(" 5. Class patterns");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("c");
        await page.waitForTimeout(200);
        await page.keyboard.type("complex(real=r,imag=i)");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("r");
        await page.waitForTimeout(200);
        await page.keyboard.type("f\"Complex number: real={r}, imag={i}");
        await page.waitForTimeout(200);
        await pressN("ArrowDown", 2, true)(page);
        await page.keyboard.press("#");
        await page.waitForTimeout(200);
        await page.keyboard.type(" 6. OR-patterns with structure");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("c");
        await page.waitForTimeout(200);
        await page.keyboard.type("(\"yes\"|\"y\"|\"ok\")");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("r");
        await page.waitForTimeout(200);
        await page.keyboard.type("\"Affirmative\"");
        await page.waitForTimeout(200);
        await pressN("ArrowDown", 2, true)(page);
        await page.keyboard.press("#");
        await page.waitForTimeout(200);
        await page.keyboard.type(" 7. Guard conditions");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("c");
        await page.waitForTimeout(200);
        await page.keyboard.type("int(n) if n<0");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("r");
        await page.waitForTimeout(200);
        await page.keyboard.type("\"Negative integer\"");
        await page.waitForTimeout(200);
        await pressN("ArrowDown", 2, true)(page);
        await page.keyboard.press("c");
        await page.waitForTimeout(200);
        await page.keyboard.type("int(n) if n>100");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("r");
        await page.waitForTimeout(200);
        await page.keyboard.type("\"Large integer\"");
        await page.waitForTimeout(200);
        await pressN("ArrowDown", 2, true)(page);
        await page.keyboard.press("#");
        await page.waitForTimeout(200);
        await page.keyboard.type(" 8. Default catch-all");
        await page.waitForTimeout(200);
        await pressN("ArrowDown", 2, true)(page);
        await page.keyboard.press("r");
        await page.waitForTimeout(200);
        await page.keyboard.type("f\"Something else: {value}\"");
        await page.waitForTimeout(200);
        // Note the following content is redacted from points 3 and 4 as we don't support rest patterns yet
        //# 3. Sequence patterns
        //case [x, y, *rest]  :
        //    return f"List with at least 2 items: x={x}, y={y}, rest={rest}" 
        //# 4. Mapping patterns
        //case {"type": "user", "name": name, **extra}  :
        //    return f"User {name} with extra fields {extra}" 
        expect(readFileSync(await save(page), "utf-8")).toEqual(`
#(=> Strype:1:std
${defaultStandardStrypeProjectDocLiteral}#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
match value  :
    # 1. Literal patterns
    case 0  :
        return "Got zero" 
    case 1|2|3  :
        return "Got a small number (1-3)" 
    # 2. Type patterns
    case str()  :
        return f"Got a string: {value}" 
    case int()  :
        return f"Got an integer: {value}" 
    # 3. Sequence patterns
    case [x,y]  :
        return f"Got a 2-item list: x={x}, y={y}" 
    # 4. Mapping patterns
    case {"type":"point","x":x,"y":y}  :
        return f"Got a point: ({x}, {y})" 
    # 5. Class patterns
    case complex(real=r,imag=i)  :
        return f"Complex number: real={r}, imag={i}" 
    # 6. OR-patterns with structure
    case ("yes"|"y"|"ok")  :
        return "Affirmative" 
    # 7. Guard conditions
    case int(n) if n<0  :
        return "Negative integer" 
    case int(n) if n>100  :
        return "Large integer" 
    # 8. Default catch-all
    case _  :
        return f"Something else: {value}" 
myString  = "Hello from Strype" 
print(myString) 
#(=> Section:End
`.trimStart());
    });

    test("Wrap with match", async ({page}) => {
        // Select the 2 frames of the default project code (in the main code section)
        await page.keyboard.press((process.platform == "darwin" ? "Meta" : "Control") + "+a");
        // Then wrap with a match statement
        await page.keyboard.press("m");
        expect(readFileSync(await save(page), "utf-8")).toEqual(`
#(=> Strype:1:std
${defaultStandardStrypeProjectDocLiteral}#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
match ___strype_blank  :
    case _  :
        myString  = "Hello from Strype" 
        print(myString) 
#(=> Section:End
`.trimStart());
    });
});

test.describe("Delete Match statemen", () => {
    test("Delete before Match", async ({page}) => {
        await page.keyboard.press("m");
        expect(readFileSync(await save(page), "utf-8")).toEqual(basicMatchLiteral.trimStart());
        await page.keyboard.press("ArrowUp");
        await page.waitForTimeout(200);
        await page.keyboard.press("Delete");
        await page.waitForTimeout(200);
        expect(readFileSync(await save(page, false), "utf-8")).toEqual(defaultProjectCodeLiteral.trimStart());
    });

    test("Backspace after Match", async ({page}) => {
        await page.keyboard.press("m");
        await page.waitForTimeout(200);
        await pressN("ArrowDown", 4, true)(page);
        await page.waitForTimeout(200);
        await page.keyboard.press("Backspace");
        await page.waitForTimeout(200);
        expect(readFileSync(await save(page), "utf-8")).toEqual(defaultProjectCodeLiteral.trimStart());
    });

    test("Backspace inside Match", async ({page}) => {
        await page.keyboard.press("m");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("Backspace");
        await page.waitForTimeout(200);
        // This backspace should not delete anything
        expect(readFileSync(await save(page), "utf-8")).toEqual(basicMatchLiteral.trimStart());
        // Now delete the case, and see that backspace delete the match frame
        await page.keyboard.press("Delete");
        await page.waitForTimeout(200);
        await page.keyboard.press("Backspace");
        await page.waitForTimeout(200);
        expect(readFileSync(await save(page, false), "utf-8")).toEqual(defaultProjectCodeLiteral.trimStart());
    });
    
    test("Backspace inside Case", async ({page}) => {
        await page.keyboard.press("m");
        // Add a comment and an if in the case
        await pressN("ArrowDown", 2, true)(page);
        await page.keyboard.press("#");
        await page.waitForTimeout(200);
        await page.keyboard.type("comment test");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("i");
        await page.waitForTimeout(200);
        await pressN("ArrowUp", 2, true)(page);
        // Try backspace: shouldn't change anything as case is not empty-like
        await page.keyboard.press("Backspace");
        await page.waitForTimeout(200);
        expect(readFileSync(await save(page), "utf-8")).toEqual(`
#(=> Strype:1:std
${defaultStandardStrypeProjectDocLiteral}#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
match ___strype_blank  :
    case _  :
        #comment test
        if ___strype_blank  :
            pass
myString  = "Hello from Strype" 
print(myString) 
#(=> Section:End
`.trimStart());
        // Delete the if, and try again to backspace: we should delete the case and bring the comment up
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("Delete");
        await page.waitForTimeout(200);
        await page.keyboard.press("ArrowUp");
        await page.waitForTimeout(200);
        await page.keyboard.press("Backspace");
        await page.waitForTimeout(200);
        expect(readFileSync(await save(page, false), "utf-8")).toEqual(`
#(=> Strype:1:std
${defaultStandardStrypeProjectDocLiteral}#(=> Section:Imports
#(=> Section:Definitions
#(=> Section:Main
match ___strype_blank  :
    pass
    #comment test
myString  = "Hello from Strype" 
print(myString) 
#(=> Section:End
`.trimStart());        
    });
});

test("Round trip", async ({page}) => {
    await testPlaywrightRoundTripImportAndDownload(page, "tests/cypress/fixtures/project-match-statement.spy");
});