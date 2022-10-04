import Compiler from "@/compiler/compiler";
import Vue from "vue";
import i18n from "@/i18n";

export function compileBlob(compiler: Compiler): Blob | undefined {
    try {
        const blob = compiler.getBlob();
        return blob;
    }
    catch (error: any) {
        //a "fake" confirm, just to use the nicer version from Vue. It really still behaves as an alert.
        Vue.$confirm({
            message: i18n.t("appMessage.preCompiledErrorNeedFix") as string,
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
    catch (error: any) {
        //a "fake" confirm, just to use the nicer version from Vue. It really still behaves as an alert.
        Vue.$confirm({
            message: error.message,
            button: {
                yes: i18n.t("buttonLabel.ok"),
            },
        });    
        return undefined;
    }
}
