import { FrameContainersDefinitions, FrameObject, LineAndSlotPositions } from "@/types/types";
import store from "@/store/store";
import { TPyParser, ErrorInfo } from "tigerpython-parser";

const INDENT = "    ";
const DISABLEDFRAMES_FLAG =  "\"\"\"";
let isDisabledFramesTriggered = false; //this flag is used to notify when we enter and leave the disabled frames.
let disabledBlockIndent = "";
export default class Parser {
    private stopAtFrameId = -100; //default aalue to indicate there is no stop

    private framePositionMap: LineAndSlotPositions = {} as LineAndSlotPositions;  // For each line holds the positions the slots start at
    private line = 0;

    private parseBlock(block: FrameObject, indent: string): string {
        let output = "";
        const children = store.getters.getFramesForParentId(block.id);

        output += 
            this.parseStatement(block,indent) + 
            ((block.frameType.allowChildren && children.length > 0)?
                this.parseFrames(
                    store.getters.getFramesForParentId(block.id),
                    indent + INDENT
                ) :
                "") // empty bodies are added as empty lines in the code
            + 
            this.parseFrames(
                store.getters.getJointFramesForFrameId(block.id, "all"), 
                indent
            );
        
        return output;
    }
    
    private parseStatement(statement: FrameObject, indent = ""): string {
        let output = indent;
        const positions: number[] = [];
        let currSlotIndex = 0;
            
        statement.frameType.labels.forEach( (label) => {
            if(!label.slot || statement.contentDict[currSlotIndex].shownLabel) {
                output += label.label;

                //if there is an editable slot
                if(label.slot){
                    // Record its vertical position
                    positions.push(output.length);
                    
                    // add its code to the output
                    console.log("print: " + statement.contentDict[currSlotIndex].code)
                    output += statement.contentDict[currSlotIndex].code + " ";
                }
            }
            currSlotIndex++;
        });
        
        output += "\n";
    
        this.framePositionMap[this.line] =  {frameId: statement.id, slotStarts: positions};
        
        this.line += 1;

        return output;
    }

    private parseFrames(codeUnits: FrameObject[], indent = ""): string {
        let output = "";
        let lineCode = "";

        //if the current frame is a container, we don't parse it as such
        //but parse directly its children (frames that it contains)
        for (const frame of codeUnits) {
            if(frame.id === this.stopAtFrameId){
                break;
            }
            //if the frame is disabled and we were not in a disabled group of frames, add the comments flag
            let disabledFrameBlockFlag = "";
            if(frame.isDisabled ? !isDisabledFramesTriggered : isDisabledFramesTriggered) {
                isDisabledFramesTriggered = !isDisabledFramesTriggered;
                if(frame.isDisabled) {
                    disabledBlockIndent = indent;
                }
                disabledFrameBlockFlag = disabledBlockIndent + DISABLEDFRAMES_FLAG +"\n";
            }

            lineCode = frame.frameType.allowChildren ?
                (Object.values(FrameContainersDefinitions).includes(frame.frameType)) ? 
                    this.parseFrames(store.getters.getFramesForParentId(frame.id)) :
                    this.parseBlock(frame, indent) 
                : 
                this.parseStatement(frame,indent);

            output += disabledFrameBlockFlag + lineCode;
        }

        return output;
    }

    public parse(stopAtFrameId?: number): string {
        let output = "";
        if(stopAtFrameId){
            this.stopAtFrameId = stopAtFrameId;
        }

        console.time();
        output += this.parseFrames(store.getters.getFramesForParentId(0));
        // We could have disabled frame(s) just at the end of the code. 
        // Since no further frame would be used in the parse to close the ongoing comment block we need to check
        // if there are disabled frames being rendered when reaching the end of the editor's code.
        let disabledFrameBlockFlag = "";
        if(isDisabledFramesTriggered) {
            isDisabledFramesTriggered = !isDisabledFramesTriggered;
            disabledFrameBlockFlag = disabledBlockIndent + DISABLEDFRAMES_FLAG ;
        }
        console.timeEnd();

        console.log(TPyParser.parse(output))

        return output + disabledFrameBlockFlag;
    }

    public getErrors(inputCode = ""): ErrorInfo[] {
        TPyParser.setLanguage("en");
        TPyParser.warningAsErrors = false;
        let code: string = inputCode;
        if (!inputCode) {
            code = this.parse();
        }
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
                if( this.framePositionMap[error.line] !== undefined && (error.offset < this.framePositionMap[error.line].slotStarts[0] || error.offset >= inputCode.split(/\n/)[error.line].length)) {
                    store.commit("setFrameErroneous", {
                        frameId: this.framePositionMap[error.line].frameId,
                        error: error.msg,
                    });
                }
                else {
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
            });

        }
        

        return errorString;
    }

}

const operators = ["+","-","/","*","%","//","**","&","|","~","^",">>","<<",
    "+=","-+","*=","/=","%=","//=","**=","&=","|=","^=",">>=","<<=",
    "==","=","!=",">=","<=","<",">"];

const operatorsWithBrackets = [...operators,"(",")","[","]","{","}"];


export function getStatementACContext(code: string, frameId: number): {token: string; contextPath: string; showAC: boolean} {
    //check that we are in a literal: here returns nothing
    //in a non terminated string literal
    //writing a number)
    if((code.match(/"/g) || []).length % 2 == 1 || !isNaN(parseFloat(code.substr(Math.max(code.lastIndexOf(" "), 0))))){
        console.log("found a string literal or a number, nothing to do for AC")
        return {token: "", contextPath: "", showAC: false};
    }

    //We search for a smaller unit to work with, meaning we look at:
    //- any opened and non closed parenthesis
    //- the presence of an operator
    //- the presence of an argument separator
    let closedParenthesisCount = 0, closedSqBracketCount = 0, closedCurBracketCount = 0;
    let codeIndex = code.length;
    let breakShortCodeSearch = false;
    while(codeIndex > 0 && !breakShortCodeSearch) {
        codeIndex--;
        const codeChar = code.charAt(codeIndex);
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

    const subCode = code.substr(codeIndex).replaceAll(" ","");
    const token = (subCode.indexOf(".") > -1) ? subCode.substr(subCode.lastIndexOf(".") + 1) : subCode;
    let contextPath = (subCode.indexOf(".") > -1) ? subCode.substr(0, subCode.lastIndexOf(".")) : "";

    //evaluate the Python user code 
    const userPythonCodeHTMLElt = document.getElementById("userCode");
    if(userPythonCodeHTMLElt){
        (userPythonCodeHTMLElt as HTMLSpanElement).textContent = "(1,2)";
        userPythonCodeHTMLElt.click();
    }
    contextPath = "ffsdfds";
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

    return  {token: token , contextPath: contextPath, showAC: true};
}