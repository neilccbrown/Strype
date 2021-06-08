import * as DAPjs from "dapjs";
import { compileFlashAndBuffer } from "./compile";
import {WebUSBListener} from "@/types/types"
import * as PartialFlashingJS from "./partial-flashing"
import store from "@/store/store"; 


async function getUSBAccess() {
    const device = await navigator.usb.requestDevice({
        filters: [{ vendorId: 0x0d28, productId: 0x0204 }],
    });
    return device;
}

export async function connectUSB() {
    const device = await getUSBAccess();

    const transport = new DAPjs.WebUSB(device);
    const daplink = new DAPjs.DAPLink(transport);

    return daplink;
}

export async function flashData(listener: WebUSBListener) {
    let progressValue = 0;

    const updateProgress = function(progress: number) {
        const currProgressValue = Math.ceil(progress * 100);
        //only trigger actions when a change is notified
        if(currProgressValue !== progressValue){
            listener.onUploadProgressHandler(currProgressValue);
            progressValue = currProgressValue;
        }
    };

    return PartialFlashingJS.PartialFlashing.connectDapAsync()
        .then(function() {
            // Collect data to flash, partial flashing can use just the flash bytes,
            // but full flashing needs the entire Intel Hex to include the UICR data
            const dapWrapper: PartialFlashingJS.DAPWrapper = store.getters.getDAPWrapper();
            // Warning: the boardID from DAPWrapper is a string, and in hex format, so we need to convert it 
            const boardId = parseInt(dapWrapper.boardId, 16);
            const flashAndBufferArray: {flash: Uint8Array; buffer: ArrayBufferLike} | undefined = compileFlashAndBuffer(boardId);
            if(flashAndBufferArray){
                const flashBytes = flashAndBufferArray.flash;
                const hexBuffer = flashAndBufferArray.buffer;
                return PartialFlashingJS.PartialFlashing.flashAsync(dapWrapper, flashBytes, hexBuffer, updateProgress)
            }        
        }).then(()=>listener.onUploadSuccessHandler(), (error) => listener.onUploadFailureHandler(error.message));
}