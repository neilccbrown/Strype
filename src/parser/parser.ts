import { FrameObject, IfDefinition, WhileDefinition, ForDefinition, FuncDefDefinition, TryDefinition, WithDefinition, EmptyDefinition, VarAssignDefinition, ReturnDefinition, CommentDefinition, FromImportDefinition, ImportDefinition, FrameContainersDefinitions, ElifDefinition, ElseDefinition, ExceptDefinition, FinallyDefinition } from "@/types/types";
import store from "@/store/store";
import { TPyParser, ErrorInfo } from "tigerpython-parser";

const INDENT = "    ";

export default class Parser {
    private parseIf(frame: FrameObject, indent: string): string {
        let output = indent;

        output +=
            `if ${frame.contentDict[0].code}:\n` +
            this.parseFrames(
                store.getters.getFramesForParentId(frame.id),
                indent + INDENT
            );

        //joint frames
        output += 
            this.parseFrames(
                store.getters.getJointFramesForFrameId(frame.id),
                indent
            );

        return output;
    }

    private parseElif(frame: FrameObject, indent: string): string {
        let output = indent;

        output +=
            `elif ${frame.contentDict[0].code}:\n` +
            this.parseFrames(
                store.getters.getFramesForParentId(frame.id),
                indent + INDENT
            );

        return output;
    }

    private parseElse(frame: FrameObject, indent: string): string {
        let output = indent;

        output +=
            "else:\n" +
            this.parseFrames(
                store.getters.getFramesForParentId(frame.id),
                indent + INDENT
            );

        return output;
    }

    private parseWhile(frame: FrameObject, indent: string): string {
        let output = indent;

        output += `while ${frame.contentDict[0].code}:\n` + this.parseFrames(
            store.getters.getFramesForParentId(frame.id),
            indent + INDENT
        );

        return output;
    }

    private parseFor(frame: FrameObject, indent: string): string {
        let output = indent;

        output +=
            `for ${frame.contentDict[0].code} in ${frame.contentDict[1].code}:\n` +
            this.parseFrames(
                store.getters.getFramesForParentId(frame.id),
                indent + INDENT
            );

        //joint frames
        output += 
          this.parseFrames(
              store.getters.getJointFramesForFrameId(frame.id),
              indent
          )    
        return output;
    }

    private parseFuncDef(frame: FrameObject, indent: string): string {
        let output = indent;

        output += `def ${frame.contentDict[0].code}(${frame.contentDict[1].code}):\n` + this.parseFrames(
            store.getters.getFramesForParentId(frame.id),
            indent + INDENT
        );

        return output;
    }

    private parseTry(frame: FrameObject, indent: string): string {
        let output = indent;

        output += "try:\n" + this.parseFrames(
            store.getters.getFramesForParentId(frame.id),
            indent + INDENT
        );

        //joint frames
        output += 
            this.parseFrames(
                store.getters.getJointFramesForFrameId(frame.id),
                indent
            )    

        return output;
    }

    private parseExcept(frame: FrameObject, indent: string): string {
        let output = indent;

        const exceptDetail = (frame.contentDict[0].code !== undefined) ?
            " " + frame.contentDict[0].code:
            "";

        output +=
            `except${exceptDetail}:\n` +
            this.parseFrames(
                store.getters.getFramesForParentId(frame.id),
                indent + INDENT
            );

        return output;
    }

    private parseFinally(frame: FrameObject, indent: string): string {
        let output = indent;

        output +=
            "finally:\n" +
            this.parseFrames(
                store.getters.getFramesForParentId(frame.id),
                indent + INDENT
            );

        return output;
    }

    private parseWith(frame: FrameObject, indent: string): string {
        let output = indent;

        output += `with ${frame.contentDict[0].code} as ${frame.contentDict[1].code}:\n` + this.parseFrames(
            store.getters.getFramesForParentId(frame.id),
            indent + INDENT
        );

        return output;
    }

    private parseBlock(block: FrameObject, indent: string): string {
        let output = "";

        switch (block.frameType.type) {
        case IfDefinition.type:
            output += this.parseIf(
                block,
                indent
            );
            break;
        case ElifDefinition.type:
            output += this.parseElif(
                block,
                indent
            );
            break;
        case ElseDefinition.type:
            output += this.parseElse(
                block,
                indent
            );
            break;
        case WhileDefinition.type:
            output += this.parseWhile(
                block,
                indent
            );
            break;
        case ForDefinition.type:
            output += this.parseFor(
                block,
                indent
            );
            break;
        case FuncDefDefinition.type:
            output += this.parseFuncDef(
                block,
                indent
            );
            break;
        case TryDefinition.type:
            output += this.parseTry(
                block,
                indent
            );
            break;
        case ExceptDefinition.type:
            output += this.parseExcept(
                block,
                indent
            );
            break;
        case FinallyDefinition.type:
            output += this.parseFinally(
                block,
                indent
            );
            break;
        case WithDefinition.type:
            output += this.parseWith(
                block,
                indent
            );
            break;
        }

        return output;
    }

    private parseStatement(statement: FrameObject, indent = ""): string {
        let output = indent;

        switch (statement.frameType.type) {
        case EmptyDefinition.type:
            output += `${statement.contentDict[0].code}\n`;
            break;
        case VarAssignDefinition.type:
            output += `${statement.contentDict[0].code} = ${statement.contentDict[1].code}\n`;
            break;
        case ReturnDefinition.type:
            output += `return ${statement.contentDict[0].code}\n`
            break;
        case CommentDefinition.type:
            output += `# ${statement.contentDict[0].code}\n`
            break;
        case FromImportDefinition.type:
            output += `from ${statement.contentDict[0].code} import ${statement.contentDict[1].code}\n`
            break;
        case ImportDefinition.type:
            output += `import ${statement.contentDict[0].code}\n`
            break;
        }

        return output;
    }

    private parseFrames(codeUnits: FrameObject[], indent = ""): string {
        let output = "";

        //if the current frame is a container, we don't parse it as such
        //but parse directly its chidren (frames that it contains)
        for (const frame of codeUnits) {
            output += frame.frameType.allowChildren ?
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
        }
        return errorString;
    }

}
