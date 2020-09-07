import { FrameContainersDefinitions, FrameObject, LineAndSlotPositions } from "@/types/types";
import store from "@/store/store";
import { TPyParser, ErrorInfo } from "tigerpython-parser";

const INDENT = "    ";


export default class Parser {

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
                this.parseStatement({} as FrameObject,indent)) // empty bodies are added as empty lines in the code
            + 
            this.parseFrames(
                store.getters.getJointFramesForFrameId(block.id, "all"), 
                indent + INDENT
            );
        
        return output;
    }
    
    private parseStatement(statement: FrameObject, indent = ""): string {
        let output = indent;
        const positions: number[] = [];
        let currSlotIndex = 0;

        statement.frameType.labels.forEach( (label) => {
            
            output += label.label;

            //if there is an editable slot
            if(label.slot && statement.contentDict[currSlotIndex].shown){
                // Record its vertical position
                positions.push(output.length);
                
                // add its code to the output
                output += statement.contentDict[currSlotIndex].code;

                currSlotIndex++
            }
        });
        output += "\n";
    
        this.framePositionMap[this.line] = {frameId: statement.id , slotStarts: positions};
        
        this.line += 1;

        return output;
    }

    private parseFrames(codeUnits: FrameObject[], indent = ""): string {
        let output = "";
        let lineCode = "";

        //if the current frame is a container, we don't parse it as such
        //but parse directly its children (frames that it contains)
        for (const frame of codeUnits) {
            lineCode = frame.frameType.allowChildren ?
                (Object.values(FrameContainersDefinitions).includes(frame.frameType)) ? 
                    this.parseFrames(store.getters.getFramesForParentId(frame.id)) :
                    this.parseBlock(frame, indent) 
                : 
                this.parseStatement(frame,indent);

            output += lineCode;
        }

        return output;
    }

    public parse(): string {
        let output = "";

        console.time();
        output += this.parseFrames(store.getters.getFramesForParentId(0));
        console.timeEnd();

        return output;
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
        
        if (errors.length > 0) {
            errorString = `${errors.map((e: any) => {
                return `\n${e.Ltigerpython_parser_ErrorInfo__f_line}:${e.Ltigerpython_parser_ErrorInfo__f_offset} | ${e.Ltigerpython_parser_ErrorInfo__f_msg}`;
            })}`;
            console.log("code");
            console.log(inputCode);
            console.log(errors);
            console.log(this.framePositionMap);
            // For each error, show red border around its input in the UI
            store.commit("clearAllErrors");
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