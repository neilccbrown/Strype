import * as DAPjs from "dapjs";
import { compileBuffer } from "./compile";

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

export async function flashData() {
    const daplink = await connectUSB();

    daplink.on(
        DAPjs.DAPLink.EVENT_PROGRESS,
        (progress) => {
            console.log(Math.ceil(progress * 100));
        }
    );

    try {
        const buffer = await compileBuffer();
        if (buffer) {
            await daplink.connect();

            await daplink.flash(buffer);

            await daplink.disconnect();
            alert("done");
        }
    }
    catch (error) {
        console.error(error.message || error);
    }
}
