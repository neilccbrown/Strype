import store from "@/store/store";
import { FrameContainersDefinitions, FrameObject, LineAndSlotPositions } from "@/types/types";
import { ErrorInfo, TPyParser } from "tigerpython-parser";
import { Store } from "vuex";

const INDENT = "    ";
const DISABLEDFRAMES_FLAG =  "\"\"\"";

export default class Parser {
    private stopAtFrameId = -100; // default value to indicate there is no stop
    private exitFlag = false; // becomes true when the stopAtFrameId is reached.
    private framePositionMap: LineAndSlotPositions = {} as LineAndSlotPositions;  // For each line holds the positions the slots start at
    private line = 0;
    private isDisabledFramesTriggered = false; //this flag is used to notify when we enter and leave the disabled frames.
    private disabledBlockIndent = "";

    private parseSlot(slot: string, position: number) {
        // This method parses semantically, by checking that every
        // token presented is known to the program (declared, keyword, or imported)

        // The list of all things that cannot be a name 
        const operators = ["+","-","/","*","%","//","**","&","|","~","^",">>","<<",
            "+=","-+","*=","/=","%=","//=","**=","&=","|=","^=",">>=","<<=",
            "==","=","!=",">=","<=","<",">","(",")","[","]","{","}",
        ];
        // list of keywords that are not user or library defined.
        const keywords = ["in","and","or","await","is","True","False",
            "lambda", "as", "from","del","not","with",
        ];

        let slotsCopy: string = slot;
        // first replace all the operators with a white space, so names can be separated
        operators.forEach( (operator) => slotsCopy=slotsCopy.replaceAll(operator," "))

        // Now tokenise the names based on white spaces
        let tokens: string[] = slotsCopy.split(/\s+/);

        // Now remove all the keywords.
        tokens = tokens.filter((token: string)=> !keywords.includes(token));


        // tokens.forEach( (token: string) => {
        //     if(token.includes(".")) {
        //        token.split(".").forEach( (name) => {

        //        });
        //     }
        // });

        

        // we need to built a simple AST of the code
        // to get all lexes and check if they exist.
        // Or we can simply run from L-to-R and 
        // get strings unless they are separated by 
        // () + - * / " " == ><= !=  or space 

        // if () are present, we need to know whether the symbol before is a method

        // if [] are present, we need to know whether the symbol before is an array

        // if {} are present, we need to know whether the symbol before is a dict

    }

    private parseBlock(block: FrameObject, indentation: string): string {
        let output = "";
        const children = store.getters.getFramesForParentId(block.id);

        if(this.checkIfFrameHasError(block)) {
            return "";
        }

        output += 
            this.parseStatement(block, indentation) + 
            ((block.frameType.allowChildren && children.length > 0)?
                this.parseFrames(
                    store.getters.getFramesForParentId(block.id),
                    indentation + INDENT
                ) :
                "") // empty bodies are added as empty lines in the code
            + 
            this.parseFrames(
                store.getters.getJointFramesForFrameId(block.id, "all"), 
                indentation
            );
        
        return output;
    }
    
    private parseStatement(statement: FrameObject, indentation = ""): string {
        let output = indentation;
        const positions: number[] = [];
        const lengths: number[] = [];
        let currSlotIndex = 0;

        if(this.checkIfFrameHasError(statement)) {
            return "";
        }
            
        statement.frameType.labels.forEach( (label) => {
            if(!label.slot || statement.contentDict[currSlotIndex].shownLabel) {
                output += label.label;

                //if there is an editable slot
                if(label.slot){
                    // Record its vertical position
                    const currentPosition = output.length;
                    positions.push(currentPosition);
                    // add its code to the output
                    output += statement.contentDict[currSlotIndex].code + " ";
                    lengths.push(output.length-currentPosition+1);

                    this.parseSlot(statement.contentDict[currSlotIndex].code,currentPosition);
                }
            }
            currSlotIndex++;
        });
        
        output += "\n";
    
        this.framePositionMap[this.line] =  {frameId: statement.id, slotStarts: positions, slotLengths: lengths};
        
        this.line += 1;

        return output;
    }

    private parseFrames(codeUnits: FrameObject[], indentation = ""): string {
        let output = "";
        let lineCode = "";

        //if the current frame is a container, we don't parse it as such
        //but parse directly its children (frames that it contains)
        for (const frame of codeUnits) {
            if(frame.id === this.stopAtFrameId || this.exitFlag){
                this.exitFlag = true; // this is used in case we are inside a recursion
                break;
            }
            //if the frame is disabled and we were not in a disabled group of frames, add the comments flag
            let disabledFrameBlockFlag = "";
            if(frame.isDisabled ? !this.isDisabledFramesTriggered : this.isDisabledFramesTriggered) {
                this.isDisabledFramesTriggered = !this.isDisabledFramesTriggered;
                if(frame.isDisabled) {
                    this.disabledBlockIndent = indentation;
                }
                disabledFrameBlockFlag = this.disabledBlockIndent + DISABLEDFRAMES_FLAG +"\n";
            }

            lineCode = frame.frameType.allowChildren ?
                // frame with children
                (Object.values(FrameContainersDefinitions).includes(frame.frameType)) ? 
                    // for containers call parseFrames again on their frames
                    this.parseFrames(store.getters.getFramesForParentId(frame.id), "") 
                    :
                    // for simple block frames (i.e. if) call parseBlock
                    this.parseBlock(frame, indentation) 
                : 
                // single line frame
                this.parseStatement(frame,indentation);

            output += disabledFrameBlockFlag + lineCode;
        }

        return output;
    }

    public parse(stopAtFrameId?: number): string {
        let output = "";
        if(stopAtFrameId){
            this.stopAtFrameId = stopAtFrameId;
        }

        //console.time();
        output += this.parseFrames(store.getters.getFramesForParentId(0));
        // We could have disabled frame(s) just at the end of the code. 
        // Since no further frame would be used in the parse to close the ongoing comment block we need to check
        // if there are disabled frames being rendered when reaching the end of the editor's code.
        let disabledFrameBlockFlag = "";
        if(this.isDisabledFramesTriggered) {
            this.isDisabledFramesTriggered = !this.isDisabledFramesTriggered;
            disabledFrameBlockFlag = this.disabledBlockIndent + DISABLEDFRAMES_FLAG ;
        }
        //console.timeEnd();

        //console.log(TPyParser.parse(output))

        return output + disabledFrameBlockFlag;
    }

    public getErrors(inputCode = ""): ErrorInfo[] {
        TPyParser.setLanguage("en");
        TPyParser.warningAsErrors = false;
        let code: string = inputCode;
        if (!inputCode) {
            code = this.parse();
        }

        const parsedCode = TPyParser.parse(code);
        console.log(parsedCode);

        return TPyParser.findAllErrors(code);
    }

    public getErrorsFormatted(inputCode = ""): string {
        const errors = this.getErrors(inputCode);
        let errorString = "";
        store.commit("clearAllErrors");
        
        if (errors.length > 0) {
            errorString = `${errors.map((e: any) => {
                return `\n${e.Ltigerpython_parser_ErrorInfo__f_line}:${e.Ltigerpython_parser_ErrorInfo__f_offset} | ${e.Ltigerpython_parser_ErrorInfo__f_msg}`;
            })}`;

            
            // For each error, show red border around its input in the UI
            errors.forEach((error: ErrorInfo) => {
                if( this.framePositionMap[error.line] !== undefined) {
                    if(this.isErrorIfInSlotBounds(error.line,error.offset)) {
                        store.commit("setSlotErroneous", {
                            frameId: this.framePositionMap[error.line].frameId,
                            // Get the slotIndex where the error's offset is ( i.e. slotStart[i]<= offset AND slotStart[i+1]?>offset)
                            slotIndex: this.framePositionMap[error.line].slotStarts.findIndex(
                                (element, index, array) => {
                                    return element<=error.offset && 
                                            ((index<array.length-1)? (array[index+1] > error.offset) : true)
                                }
                            ), 
                            error: error.msg,
                        });
                    }
                    else {
                        store.commit("setFrameErroneous", {
                            frameId: this.framePositionMap[error.line].frameId,
                            error: error.msg,
                        });
                    }
                }
            });

        }
        

        return errorString;
    }

    private isErrorIfInSlotBounds(errorLine: number, errorOffset: number) {

        for (let index = 0; index < this.framePositionMap[errorLine].slotLengths.length; index++) {
            const slot = this.framePositionMap[errorLine];
            // if the error's offset is within the bounds of any slot, return true
            if(errorOffset >= slot.slotStarts[index] && errorOffset <= (slot.slotStarts[index] + slot.slotLengths[index]-1)) {
                return true;
            }
        }
        // If the offset was inside none of the slots, then return false
        return false;
    
    }

    public getCodeWithoutErrors(endFrameId: number): string {
        const code = this.parse(endFrameId);

        const errors = this.getErrors(code);

        const lines = code.split(/\r?\n/g);

        // regularExpression to check the number of indentations 
        const regExp = new RegExp(INDENT, "g");

        let filteredCode = "";
    
        // We need to count the num of indentations to remove indentationed lines who's parent has an error
        let previousIndents = 0;

        // A flag that tells whether an error has open in a line; Used to avoid checking indentationed
        // -to the erroneous- lines of code
        let errorOpen = false;
        
        // remove errors line by line
        lines.forEach( (line,index) => {

            // get all the spaces at the beginning of a line
            // ^ = start , [\s]* = all space characters , [?!\s] = until you don't see a space
            const spaces = line.match(/^([\s]*[?!\s]){1}/g)??[""];
            // now count the number or indentations at the beginning of the line
            const indentationsInLine = (spaces.shift()?.match(regExp) || []).length;

            // If there was an error detected and we are inside it then go to the next iteration.
            if(errorOpen && indentationsInLine > previousIndents) {
                return;
            }

            // if the line has an error
            if(errors.find( (error) => error.line === index)) {
                // open the error flag
                errorOpen = true;
                // do not include the line
            }
            else {
                // no error found
                errorOpen = false;
                // include the line
                filteredCode += "\n"+line;
            }

            // store the indentations of this line as we go below (sibling code) or in it (child code)
            previousIndents = indentationsInLine;

        });
        
        let output = "";
        const indentationMap = [] as number[];

        // Now add try/except statements around each statement and block
        // This cannot be done on the previous stage (error removal) as 
        // There may be some blocks with potentially unhandled errors by 
        // try/except, like `for:` or `import 3 from x`
        filteredCode.split(/\r?\n/g).forEach( (line,index) => {
            
            // get all the spaces at the beginning of a line
            const spaces = line.match(/^([\s]*[?!\s]){1}/g)??[""];
            // now count the number or indentations at the beginning of the line
            const indentationsInLine = (spaces[0]?.match(regExp) || []).length;

            // I need to check that the line is not a joint statement/block (like `else`)
            // also that try or except is not already included

            const prevIndentation = ([...indentationMap].pop()||0) ;
            // If the current indentation is greater than the prev, we are going in a child 
            if(indentationsInLine > prevIndentation) {
                // We have changed level and we want to add the indentation to the map
                indentationMap.push(indentationsInLine);
            }
            // if we are exiting the parent and we don't have a compount (e.g. elif) nor a new block (starting with `:` )
            else if( indentationsInLine < prevIndentation && !this.isCompoundStatement(line,spaces) && !line.endsWith(":")) {
                // here we are going up a level (to the parent) and we remove the previous indentation
                indentationMap.pop();
                // here we want to close the opened try statement as well
                output += spaces +"except:\n" + spaces + INDENT + "pass" + "\n";
            }
            
            // if the line is not empty AND not a compound statement
            if(line) {

                // for lvl 0 we want the try/ block except to be not indented at all
                const conditionalIndent = ((indentationsInLine > 0)? INDENT : "");

                // Add the try only if it's not a compound
                output += (!this.isCompoundStatement(line,spaces)) ?
                    (spaces + conditionalIndent + "try:\n")
                    :
                    "" ;

                // add the line
                output += spaces + INDENT + line + "\n";

                // add the except if the line is not a compound AND not the starting of a block
                output += (!this.isCompoundStatement(line,spaces) && !line.endsWith(":"))?
                    spaces  + conditionalIndent + "except:\n" + spaces + INDENT + conditionalIndent + "pass" + "\n"
                    :
                    "" ;
            }

        });

        return output;
    }

    private checkIfFrameHasError(frame: FrameObject): boolean {
        return (frame.error!=="" || Object.values(frame.contentDict).some((slot) => slot.error!=="" ));
    }

    private isCompoundStatement(line: string, spaces: string[]): boolean {
        // it's not a compound statement if
        return line.startsWith(spaces+"try")  ||  // it's a try statement OR
               line.startsWith(spaces+"elif") ||  // it's an elif statement OR
               line.startsWith(spaces+"else") ||  // it's an else statement OR
               line.startsWith(spaces+"finally") // it's a finally statement
    }
}

const operators = ["+","-","/","*","%","//","**","&","|","~","^",">>","<<",
    "+=","-+","*=","/=","%=","//=","**=","&=","|=","^=",">>=","<<=",
    "==","=","!=",">=","<=","<",">"];

const operatorsWithBrackets = [...operators,"(",")","[","]","{","}"];

// Check every time you're in a slot and see how to show the AC
export function getStatementACContext(slotCode: string, frameId: number): {token: string; contextPath: string; showAC: boolean} {
    //check that we are in a literal: here returns nothing
    //in a non terminated string literal
    //writing a number)

    // TODO, does it work for every case?
    if((slotCode.match(/"/g) || []).length % 2 == 1 || !isNaN(parseFloat(slotCode.substr(Math.max(slotCode.lastIndexOf(" "), 0))))){
        console.log("found a string literal or a number, nothing to do for AC")
        return {token: "", contextPath: "", showAC: false};
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

    // the code we're interested in
    const subCode = slotCode.substr(codeIndex).replaceAll(" ","");
    
    // Image.a  -->  context = Image  AND  token = a
    const token = (subCode.indexOf(".") > -1) ? subCode.substr(subCode.lastIndexOf(".") + 1) : subCode;
    const contextPath = (subCode.indexOf(".") > -1) ? subCode.substr(0, subCode.lastIndexOf(".")) : "";

    const parser = new Parser();
    const userCode = parser.getCodeWithoutErrors(frameId);

    // TODO check the Context if it is valid AND see what you can get from it.

    //evaluate the Python user code 
    const userPythonCodeHTMLElt = document.getElementById("userCode");
    if(userPythonCodeHTMLElt){        
        (userPythonCodeHTMLElt as HTMLSpanElement).textContent = userCode;
        const brythonContainer = document.getElementById("brythonContainer");
        // run the code by "clicking" the brythonContainer
        brythonContainer?.click();
    }


    /*
    //remove the nested parts of the statement that we don't need for AC
    closedParenthesisCount = 0;
    let keepCode = true;
    for(codeIndex = contextPath.length-1;  codeIndex >= 0; codeIndex--){
        if(contextPath.charAt(codeIndex) != "(" && contextPath.charAt(codeIndex) != ")"){
            if(!keepCode){
                contextPath = contextPath.substr(0, codeIndex).concat(contextPath.substr(codeIndex + 1));
            }
            else{
                continue;
            }
        
    }
        else{
            closedParenthesisCount+=(contextPath.charAt(codeIndex) === ")") ? 1 : -1;
            if(!keepCode && !(closedParenthesisCount === 0 && contextPath.charAt(codeIndex) === "(")){
                contextPath = contextPath.substr(0, codeIndex).concat(contextPath.substr(codeIndex + 1));
            }
            keepCode = (closedParenthesisCount === 0);
        }
    }
    */

    return {token: token , contextPath: contextPath, showAC: true};
}

export function getCodeForAnalysis(endFrameId: number): string {
    
    return "d"
}

   
