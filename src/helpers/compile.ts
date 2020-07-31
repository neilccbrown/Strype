import Parser from "@/parser/parser";
import Compiler from "@/compiler/compiler";

function compileCode(): Compiler {
    const parser = new Parser();
    const out = parser.parse();

    const errors = parser.getErrorsFormatted(out);
    console.log(errors);
    if (errors) {
        throw Error(errors);
    }

    const compiler = new Compiler();
    compiler.compile(out);
    return compiler;
}

export function compileHex() {
    try {
        const hex = compileCode().getIntelHex();
        return hex;
    } catch (error) {
        alert(error);
    }
}

export function compileBlob() {
    try {
        const blob = compileCode().getBlob();
        return blob;
    } catch (error) {
        alert(error);
    }
}

export async function compileBuffer() {
    try {
        const buffer = await compileCode().getBuffer();
        return buffer;
    } catch (error) {
        alert(error);
    }
}
