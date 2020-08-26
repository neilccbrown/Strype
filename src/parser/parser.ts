import { FrameContainersDefinitions, FrameObject, LineAndSlotPositions } from "@/types/types";
import store from "@/store/store";
import { TPyParser, ErrorInfo } from "tigerpython-parser";

const INDENT = "    ";


export default class Parser {

    private framePositionMap: LineAndSlotPositions = {} as LineAndSlotPositions;  // For each line holds the positions the slots start at
    private line = 0;

    private parseBlock(block: FrameObject, indent: string): string {
        let output = "";

        output += this.parseStatement(block,indent) + this.parseFrames(
            store.getters.getFramesForParentId(block.id),
            indent + INDENT
        );
        
        return output;
    }
    
    private parseStatement(statement: FrameObject, indent = ""): string {
        let output = indent;
        const positions: number[] = [];
        // let currPosition = 0;
        let slot = 0;

        statement.frameType.labels.forEach( (label) => {
            
            output += label.label;// + ((label.slot) ? statement.contentDict[slot++].code: "");

            //if there is an editable slot
            if(label.slot){
                // Record its vertical position
                positions.push(output.length);
                
                // add its code to the output
                output += statement.contentDict[slot++].code;
            }
        });
        output += "\n";
        

        this.framePositionMap[this.line] = {frameId: statement.id , slotStarts: positions};

        return output;
    }

    private parseFrames(codeUnits: FrameObject[], indent = ""): string {
        let output = "";
        let lineCode = ""
        //if the current frame is a container, we don't parse it as such
        //but parse directly its children (frames that it contains)
        for (const frame of codeUnits) {
            lineCode = frame.frameType.allowChildren ?
                (Object.values(FrameContainersDefinitions).includes(frame.frameType)) ? 
                    this.parseFrames(store.getters.getFramesForParentId(frame.id)) :
                    this.parseBlock(
                        frame,
                        indent
                    ) : 
                this.parseStatement(
                    frame,
                    indent
                );

            this.line += (lineCode !== "")? 1 : 0;
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

            // For each error, show red border around its input in the UI
            errors.forEach((error) => {
                store.commit("setSlotErroneous", {
                    frameId: this.framePositionMap[error.line].frameId,
                    // Get the slotIndex where the error's offset is ( i.e. slotStart[i]<= offset AND slotStart[i+1]?>offset)
                    slotIndex: this.framePositionMap[error.line].slotStarts.findIndex(
                        (element, index, array) => {
                            return element<=error.offset && 
                                    ((index<array.length-1)? (array[index+1] > error.offset) : true)
                        }
                    ), 
                    value: true,
                })
            });

        }

        return errorString;
    }

}
