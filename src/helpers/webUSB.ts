import * as DAPjs from "dapjs";
import { compileBuffer } from "./compile";
import {WebUSBListener} from "@/types/types"

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
    const daplink = await connectUSB();

    let progressValue = 0;

    daplink.on(
        DAPjs.DAPLink.EVENT_PROGRESS,
        (progress) => {
            const currProgressValue = Math.ceil(progress * 100);
            //only trigger actions when a change is notified
            if(currProgressValue !== progressValue){
                listener.onUploadProgressHandler(currProgressValue);
                progressValue = currProgressValue;
            }
        }
    );

    try {
        const buffer = await compileBuffer();
        if (buffer) {
            await daplink.connect();

            await daplink.flash(buffer);

            await daplink.disconnect();

            listener.onUploadSuccessHandler();
        }
    }
    catch (error) { 
        console.error(error.message || error);

        listener.onUploadFailureHandler(error.message);
    }
}
