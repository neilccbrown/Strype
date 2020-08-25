import { ImportsContainerDefinition, FuncDefContainerDefinition, MainFramesContainerDefinition, FrameObject, IfDefinition, WhileDefinition, ForDefinition, FuncDefDefinition, TryDefinition, WithDefinition, EmptyDefinition, VarAssignDefinition, ReturnDefinition, CommentDefinition, FromImportDefinition, ImportDefinition, FrameContainersDefinitions, ElifDefinition, ElseDefinition, ExceptDefinition, FinallyDefinition, LineAndSlotPositions } from "@/types/types";
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
        
        let slot = 0;
        statement.frameType.labels.forEach( (label) => {
            output += label.label + ((label.slot) ? statement.contentDict[slot++].code: "");
        });

        output += "\n";
        // let positions: number[] = [];

        // this.framePositionMap[this.line] = {id: statement.id , slotStarts: positions};

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
        // console.log(TPyParser.parse(code));
        console.log("errors");
        console.log(TPyParser.findAllErrors(code));
        console.log("positions");
        console.log(this.framePositionMap);
        console.log("code");
        console.log(code);
        return TPyParser.findAllErrors(code);
    }

    public getErrorsFormatted(inputCode = ""): string {
        const errors = this.getErrors(inputCode);
        let errorString = "";
        if (errors.length > 0) {
            errorString = `${errors.map((e: any) => {
                return `\n${e.Ltigerpython_parser_ErrorInfo__f_line}:${e.Ltigerpython_parser_ErrorInfo__f_offset} | ${e.Ltigerpython_parser_ErrorInfo__f_msg}`;
            })}`;
        }
        return errorString;
    }

}
