import { saveAs } from "file-saver";
import { compileBlob } from "./compile";
import Parser from "@/parser/parser";
import i18n from "@/i18n";
import Vue from "vue";

export function downloadHex(): boolean {
    const blob = compileBlob();

    if (blob) {
        saveAs(
            blob,
            "main.hex"
        );
        return true;
    }
    return false;
}

export function downloadPython() {
    const parser = new Parser();
    const out = parser.parse();

    const errors = parser.getErrorsFormatted(out);
    if (errors) {
        //a "fake" confirm, just to use the nicer version from Vue. It really still behaves as an alert.
        Vue.$confirm({
            message: i18n.t("appMessage.preCompiledErrorNeedFix") as string,
            button: {
                yes: i18n.t("buttonLabel.ok"),
            },
        });
        return;
    }

    const blob = new Blob(
        [out],
        { type: "application/octet-stream" }
    );
    saveAs(
        blob,
        "main.py"
    );
}
