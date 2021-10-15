import Compiler from "@/compiler/compiler";
import Vue from "vue";
import i18n from "@/i18n";

export function compileHex(compiler: Compiler) {
    try {
        const hex = compiler.getUniversalHex();
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

export function compileBlob(compiler: Compiler) {
    try {
        const blob = compiler.getBlob();
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

export async function compileBuffer(compiler: Compiler) {
    try {
        const buffer = await compiler.getBuffer();
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

// The content of this method is based on the microbit python editor (python-main.js)
export function compileFlashAndBuffer(compiler: Compiler, boardId: number): { flash: Uint8Array; buffer: ArrayBufferLike } | undefined {
    try {
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
