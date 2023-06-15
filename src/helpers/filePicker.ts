
import { MIMEDesc, ProjectLocation } from "@/types/types";

/**
 * This helper file provides access to the file picker (File System Access API: https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API).
 * Currently, not all browsers support this API, therefore to bypass the Typescript errors using the methods on (the JS object) window, we use a non-typed
 * alias instead (cf. noTypedWindow below).
 * This helper DOES NOT propose alternatives if the API isn't supported, so that's the caller to handle this case. 
 * The API support can be tested via the values of the 2 flags canBrowserOpenFilePicker and canBrowserSaveFilePicker.
 */

const noTypedWindow = window as any; 
export const canBrowserOpenFilePicker = (noTypedWindow.showOpenFilePicker != undefined);
export const canBrowserSaveFilePicker = (noTypedWindow.showSaveFilePicker != undefined);

export function saveFile(suggestedFileName: string, mimeTypesArray: MIMEDesc[], startInFolder: ProjectLocation, onSuccess: (fileHandle: FileSystemFileHandle) => void): void{
    const options = {
        suggestedName: suggestedFileName,
        types: mimeTypesArray,
        startInFolder: startInFolder,
    };

    noTypedWindow.showSaveFilePicker(options).then((fileSysHandle: FileSystemFileHandle) => onSuccess(fileSysHandle), () => console.log("failed..."));
}

export function openFile(mimeTypesArray: MIMEDesc[], startInFolder: ProjectLocation, onSuccess: (fileHandles: FileSystemFileHandle[]) => void): void{
    const options = {
        types: mimeTypesArray,  
        startInFolder: startInFolder,
    };
 
    noTypedWindow.showOpenFilePicker(options).then((fileSysHandles: FileSystemFileHandle[]) => onSuccess(fileSysHandles), () => console.log("failed..."));
}