import { FrameObject } from "@/types/types";
import store from "@/store/store";
import { TPyParser, ErrorInfo } from "tigerpython-parser";

const INDENT = "    ";

export default class Parser {
    private parseIf(frame: FrameObject, indent: string): string {
        let output = indent;

        output +=
            `if ${frame.contentDict[0]}:\n` +
            this.parseFrames(
                store.getters.getFramesForParentId(frame.id),
                indent + INDENT
            );

        return output;
    }

    private parseWhile(frame: FrameObject, indent: string): string {
        let output = indent;

        output += `while ${frame.contentDict[0]}:\n` + this.parseFrames(
            store.getters.getFramesForParentId(frame.id),
            indent + INDENT
        );

        return output;
    }

    private parseFor(frame: FrameObject, indent: string): string {
        let output = indent;

        output +=
            `for ${frame.contentDict[0]} in ${frame.contentDict[1]}:\n` +
            this.parseFrames(
                store.getters.getFramesForParentId(frame.id),
                indent + INDENT
            );

        return output;
    }

    private parseFuncDef(frame: FrameObject, indent: string): string {
        let output = indent;

        output += `def ${frame.contentDict[0]}(${frame.contentDict[1]}):\n` + this.parseFrames(
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

        return output;
    }

    private parseWith(frame: FrameObject, indent: string): string {
        let output = indent;

        output += `with ${frame.contentDict[0]} as ${frame.contentDict[1]}:\n` + this.parseFrames(
            store.getters.getFramesForParentId(frame.id),
            indent + INDENT
        );

        return output;
    }

    private parseBlock(block: FrameObject, indent: string): string {
        let output = "";

        switch (block.frameType?.type) {
        case "if":
            output += this.parseIf(
                block,
                indent
            );
            break;
        case "while":
            output += this.parseWhile(
                block,
                indent
            );
            break;
        case "for":
            output += this.parseFor(
                block,
                indent
            );
            break;
        case "funcdef":
            output += this.parseFuncDef(
                block,
                indent
            );
            break;
        case "try":
            output += this.parseTry(
                block,
                indent
            );
            break;
        case "with":
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

        switch (statement.frameType?.type) {
        case "empty":
            output += `${statement.contentDict[0]}\n`;
            break;
        case "varassign":
            output += `${statement.contentDict[0]} = ${statement.contentDict[1]}\n`;
            break;
        case "return":
            output += `return ${statement.contentDict[0]}\n`
            break;
        case "comment":
            output += `# ${statement.contentDict[0]}\n`
            break;
        case "fromimport":
            output += `from ${statement.contentDict[0]} import ${statement.contentDict[1]}\n`
            break;
        case "import":
            output += `import ${statement.contentDict[0]}\n`
            break;
        }

        return output;
    }

    private parseFrames(codeUnits: FrameObject[], indent = ""): string {
        let output = "";

        for (const frame of codeUnits) {
            output += frame.frameType?.allowChildren
                ? this.parseBlock(
                    frame,
                    indent
                )
                : this.parseStatement(
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
        console.log(TPyParser.findAllErrors(code));
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
