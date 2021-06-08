import Parser from "@/parser/parser";
import Compiler from "@/compiler/compiler";
import Vue from "vue";
import i18n from "@/i18n";

function compileCode(): Compiler {
    const parser = new Parser();
    const out = parser.parse();

    const errors = parser.getErrorsFormatted(out);
    if (errors) {
        throw Error(errors);
    }

    const compiler = new Compiler();
    compiler.compile(out);
    return compiler;
}

export function compileHex() {
    try {
        const hex = compileCode().getUniversalHex();
        return hex;
    }
    catch (error) {
        //a "fake" confirm, just to use the nicer version from Vue. It really still behaves as an alert.
        Vue.$confirm({
            message: error.message,
            button: {
                yes: i18n.t("buttonLabel.ok"),
            },
        });    
    }
}

export function compileBlob() {
    try {
        const blob = compileCode().getBlob();
        return blob;
    }
    catch (error) {
        //a "fake" confirm, just to use the nicer version from Vue. It really still behaves as an alert.
        Vue.$confirm({
            message: i18n.t("appMessage.preCompiledErrorNeedFix") as string,
            button: {
                yes: i18n.t("buttonLabel.ok"),
            },
        });    
    }
}

export async function compileBuffer() {
    try {
        const buffer = await compileCode().getBuffer();
        return buffer;
    }
    catch (error) {
        //a "fake" confirm, just to use the nicer version from Vue. It really still behaves as an alert.
        Vue.$confirm({
            message: error.message,
            button: {
                yes: i18n.t("buttonLabel.ok"),
            },
        });    
    }
}

export function compileFlashAndBuffer(boardId: number): { flash: Uint8Array; buffer: ArrayBufferLike } | undefined {
    try {
        const compiler = compileCode();
        const flashBytes = compiler.getBytesForBoardId(boardId);
        const hexBuffer = compiler.getIntelHexForBoardId(boardId);
        return {flash: flashBytes, buffer: hexBuffer};
    }
    catch (error) {
        //a "fake" confirm, just to use the nicer version from Vue. It really still behaves as an alert.
        Vue.$confirm({
            message: error.message,
            button: {
                yes: i18n.t("buttonLabel.ok"),
            },
        });    
        return undefined
    }
}
