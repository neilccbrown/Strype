import Compiler from "@/compiler/compiler";
import i18n from "@/i18n";
import store from "@/store/store";
import { FrameContainersDefinitions, FrameObject, LineAndSlotPositions, LoopFrames, ParserElements} from "@/types/types";
import { ErrorInfo, TPyParser } from "tigerpython-parser";

const INDENT = "    ";
const DISABLEDFRAMES_FLAG =  "\"\"\""; 

// Parse the code contained in the editor, and generate a compiler for this code if no error are found.
// The method returns an object containing the output code and the compiler.
export function parseCodeAndGetParseElements(requireCompilation: boolean): ParserElements{
    // Errors in the code (precompiled errors and TigerPython errors) are looked up at code edition.
    // Therefore, we expect the errors to already be found out when this method is called, and we don't need
    // to retrieve them again.

    const parser = new Parser();
    const out = parser.parse();

    // Check if the code contains errors: precompiled errors & TigerPyton errors are all indicated in the editor
    // by an error class on a frame ("frameDiv" + "error"), a frame body ("frame-body-container" + "error") 
    // or an editable slot ("editableslot-input" + "error").
    const hasErrors = (document.getElementsByClassName("framDiv error").length > 0) || 
        (document.getElementsByClassName("frame-body-container error").length > 0) || 
        (document.getElementsByClassName("editableslot-input error").length > 0);
 
    const compiler = new Compiler();
    if(requireCompilation){
        compiler.compile(out);
    }

    return {parsedOutput: out, hasErrors: hasErrors, compiler: compiler};
}

export default class Parser {
    private startAtFrameId = -100; // default value to indicate there is no start
    private stopAtFrameId = -100; // default value to indicate there is no stop
    private exitFlag = false; // becomes true when the stopAtFrameId is reached.
    private framePositionMap: LineAndSlotPositions = {} as LineAndSlotPositions;  // For each line holds the positions the slots start at
    private line = 0;
    private isDisabledFramesTriggered = false; //this flag is used to notify when we enter and leave the disabled frames.
    private disabledBlockIndent = "";
    private excludeLoops = false;
    private ignoreCheckErrors = false;

    constructor(ignoreCheckErrors?: boolean){
        if(ignoreCheckErrors != undefined){
            this.ignoreCheckErrors = ignoreCheckErrors;
        }
    }

    private parseBlock(block: FrameObject, indentation: string): string {
        let output = "";
        const children = store.getters.getFramesForParentId(block.id);

        if(this.checkIfFrameHasError(block)) {
            return "";
        }

        const passBlock = this.excludeLoops && Object.values(LoopFrames).find((t) => t.type === block.frameType.type);
        // on `excludeLoops` the loop frames must not be added to the code and nor should their contents be indented
        const conditionalIndent = (passBlock)? "" : INDENT

        output += 
            ((!passBlock)? this.parseStatement(block, indentation) : "") + 
            ((block.frameType.allowChildren && children.length > 0)?
                this.parseFrames(
                    children,
                    indentation + conditionalIndent
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
                }
            }
            else if(!statement.contentDict[currSlotIndex].shownLabel){
                //even if the label and its slot aren't visible, they need to be logged within the framePositionMap
                //as 0 length elements to line framePositionMap up with the slot indexes
                positions.push(output.length);
                lengths.push(0);
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

    public parse(startAtFrameId?: number, stopAtFrameId?: number, excludeLoops?: boolean): string {
        let output = "";
        if(startAtFrameId){
            this.startAtFrameId = startAtFrameId;
        }
        if(stopAtFrameId){
            this.stopAtFrameId = stopAtFrameId;
        }

        if(excludeLoops){
            this.excludeLoops = excludeLoops;
        }

        //console.time();
        output += this.parseFrames((this.startAtFrameId > -100) ? [store.getters.getFrameObjectFromId(this.startAtFrameId)] : store.getters.getFramesForParentId(0));
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

        //const parsedCode = TPyParser.parse(code);

        return TPyParser.findAllErrors(code);
    }

    public getErrorsFormatted(inputCode = ""): string {
        // We don't consider an empty code as a valid code: generate an error for that and set the main frame container erroneous
        if(inputCode.trim().length == 0){
            return i18n.t("appMessage.emptyCodeError") as string;
        }

        const errors = this.getErrors(inputCode);
        let errorString = "";
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

    public getCodeWithoutErrorsAndLoops(endFrameId: number): string {
        const code = this.parse(undefined, endFrameId, true);

        const errors = this.getErrors(code);

        const lines = code.split(/\r?\n/g);

        // regularExpression to check the number of indentations 
        const regExp = new RegExp(INDENT, "g");

        let filteredCode = "";
    
        // We need to count the num of indentations to remove indented lines who's parent has an error
        let previousIndents = 0;

        // A flag that tells whether an error has open in a line; Used to avoid checking indented
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
        
        let output = "";                     // the code that will go to Brython
        let prevIndentation = 0;             // holds the indentation of the previous line
        const openedTryMap = [] as string[]; // For each try opened, we store the white spaces in front of it.
        let tryFromTheUser = false;          // When the except is open no need to add try catch in it.

        // Now add try/except statements around each statement and block
        // This cannot be done on the previous stage (error removal) as 
        // There may be some blocks with potentially unhandled errors by 
        // try/except, like `for:` or `import 3 from x`
        filteredCode.split(/\r?\n/g).forEach( (line) => {

            // get all the spaces at the beginning of a line
            const spaces = line.match(/^([\s]*[?!\s]){1}/g)??[""];
            // now count the number or indentations at the beginning of the line
            const indentationsInLine = (spaces[0]?.match(regExp) || []).length; 

            // Whenever the indentation count in the line is reduced, we are exiting a block statement
            // At that incidence (and since it is not a compound AND there has been an opened try earlier)
            // we need to close the trys with excepts
            if( indentationsInLine < prevIndentation && !this.isCompoundStatement(line,spaces) && openedTryMap.length>0 && !this.isExcept(line,spaces)) {

                // How many indentations we went left?
                const indentsDiff = prevIndentation - indentationsInLine;

                // For every indentation close the try and remove it from the map
                for (let i = 0; i < indentsDiff; i++) {
                    const tryIndent = openedTryMap.pop();

                    // This case is only for exiting a function, where there is an indent diff
                    // but there is no try opened!
                    if(tryIndent === undefined) { 
                        break;
                    }
                    output += tryIndent + "except:\n" + tryIndent + INDENT + "pass" + "\n";
                }
            }

            // if the line is not empty and not comprised only from white spaces
            if(line && (/\S/.test(line))) {
                // Compound statements do not get an indentation, every other statement in the block does
                const conditionalIndent = (!this.isCompoundStatement(line,spaces) && !this.isTryOrExcept(line,spaces) && !tryFromTheUser ) ? INDENT : "";
                // If we add a try, we need to know how far in we are already from previous trys
                const tryIndentation = INDENT.repeat(openedTryMap.length);
                
                if ( this.isTry(line,spaces) ) {
                    tryFromTheUser = true
                }

                // Add the try only if it's not a compound nor func def nor an except nor a try
                if(!this.isCompoundStatement(line,spaces) && !this.isFunctionDef(line,spaces) && !this.isTryOrExcept(line,spaces) && !tryFromTheUser) {
                    output += (spaces + tryIndentation + "try:\n");
                    openedTryMap.push(spaces + tryIndentation);
                }
                
                // Add the line -- we add indent only if we're not in function declaration line
                output += 
                    ((!this.isFunctionDef(line,spaces)) ? 
                        (tryIndentation + conditionalIndent)
                        :
                        "") 
                    + line + "\n"; // `line` includes `spaces` at its beginning

                // Add the except if the line is not a compound AND not a func def AND not the starting of a block nor an except
                if(!this.isCompoundStatement(line,spaces) && !this.isFunctionDef(line,spaces) && !line.endsWith(":") && !this.isTryOrExcept(line,spaces) && !tryFromTheUser){
                    output += spaces + tryIndentation + "except:\n" + spaces + tryIndentation + INDENT + "pass" + "\n"
                    openedTryMap.pop();
                }
                
                if( tryFromTheUser && !this.isTry(line,spaces) ) {
                    tryFromTheUser = false
                }
            }
            // Before going to the new line, we need to store the indentation of this lines
            prevIndentation = indentationsInLine;
        });

        return output;
    }

    public getFullCode(): string {
        return this.parse(undefined, undefined, false);
    }

    private checkIfFrameHasError(frame: FrameObject): boolean {
        return !this.ignoreCheckErrors && (Object.values(frame.contentDict).some((slot) => slot.error!=="" ));
    }

    private isCompoundStatement(line: string, spaces: string[]): boolean {
        // it's a compound statement if
        return line.startsWith(spaces+"elif ") ||  // it's an elif statement OR
               line.startsWith(spaces+"else:") ||  // it's an else statement OR
               line.startsWith(spaces+"finally:") // it's a finally statement
        
        // We do not have to check try and except here as they are checked by getCodeWithoutErrors       
    }

    private isTryOrExcept(line: string, spaces: string[]): boolean {
        return this.isTry(line,spaces) || this.isExcept(line,spaces)
    }

    private isTry(line: string, spaces: string[]): boolean {
        return line.startsWith(spaces+"try:")  // it's a try statement
    }

    private isExcept(line: string, spaces: string[]): boolean {
        return line.startsWith(spaces+"except ") || line.startsWith(spaces+"except:") // it's an except statement
    }

    private isFunctionDef(line: string, spaces: string[]): boolean {
        // it's not a function definition  if
        return line.startsWith(spaces+"def ")  // it starts with a def
    }
}
