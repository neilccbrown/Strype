import { saveAs } from "file-saver";
import { compileBlob } from "./compile";
import { parseCodeAndGetParseElements } from "@/parser/parser";
import i18n from "@/i18n";
import Vue from "vue";
import { useStore } from "@/store/store"
import { MessageDefinitions } from "@/types/types";

export function downloadHex() : void {
    const parserElements = parseCodeAndGetParseElements(true);
    let succeeded = !parserElements.hasErrors;
    if(succeeded){
        const blob = compileBlob(parserElements.compiler);
        if (blob) {
            saveAs(blob, "main.hex");
        }
        else{
            succeeded = false;
        }
    }

    //We show the image only if the download has succeeded
    if(succeeded){
        useStore().currentMessage = MessageDefinitions.DownloadHex;
    } 
    else{
        //a "fake" confirm, just to use the nicer version from Vue. It really still behaves as an alert.
        Vue.$confirm({
            message: i18n.t("appMessage.preCompiledErrorNeedFix") as string,
            button: {
                yes: i18n.t("buttonLabel.ok"),
            },
        });    
    }
}

export function downloadPython() : void {
    const parserElements = parseCodeAndGetParseElements(false);
    if (parserElements.hasErrors) {
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
        [parserElements.parsedOutput],
        { type: "application/octet-stream" }
    );
    saveAs(
        blob,
        "main.py"
    );
}
