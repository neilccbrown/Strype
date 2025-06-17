/**
 * This helper file contains the handling of file IO to be used by Skulpt
 * on user code specified files (in Python: open()).
 * At the moment, we only support file IO in the cloud (due to restrictions on 
 * the browser's access to the host file system).
 */
import { vm } from "@/main";
import path from "path-browserify";
import { getGoogleDriveComponentRefId, getMenuLeftPaneUID } from "./editor";
import GoogleDriveComponent from "@/components/GoogleDrive.vue";
import MenuComponent from "@/components/Menu.vue";
import { useStore } from "@/store/store";
import {arrayToTree, TreeItem}  from "performant-array-to-tree";
import { StrypeSyncTarget } from "@/types/types";
import i18n from "@/i18n";

declare const Sk: any;
// Will be set later as we need to make sure Vue application has started...
let googleDriveComponent: InstanceType<typeof GoogleDriveComponent>;

// We maintain a list of files for operability between Skulpt and Google Drive
// so we can easily work with file ID in Google Drive.
// This is per-project object, therefore the file paths in this object are unique.
interface GDFile  {
    name: string, // The file name (not including path)
    id: string, // The file ID on Google Drive
    content: string | Uint8Array, // The file content when opened
    // Capabilities used to evaluate readonly status
    capabilities: {canEdit: boolean, canModifyContent: boolean}, contentRestrictions?: {readOnly?: boolean}
}
interface GDFileWithMetaData extends GDFile{
    filePath: string, // The file path as specified in the user code, and "visually" represented in Google Drive
    locationId: string, // The file location's Google Drive folder ID
    readOnly: boolean, // Readonly status of the file in Google Drive
}
const gdFilesMap: GDFileWithMetaData[] = [];
export function clearGDFileIOMap(): void {
    gdFilesMap.splice(0);
}

// The TS typing to describe the file object implemented by Skulpt
// it depends on Skulpt implementation of course, but having it here is just for ease of using TS.
interface SkulptFile {
    name: string,
    mode: {
        v: string,
        // we don't need the other values
    }, 
    data$: string|Uint8Array,
    pos$: number,
    lineList: string[],
    currentLine: number,
    closed: boolean,
    fileno: number, // internal file number used by Skulpt, external files are number 11
    isInError?: boolean, // custom flag to indicate an error state, we need to know that when closing files.
}

// This small helper method is used during writing operations (either for Skulpt internally or for us in the cloud)
// Since we can either write strings or bytes arrays depending on the file mode, we just check the type of the first argument.
const concatFileContentParts = (part1: string | Uint8Array, part2: string | Uint8Array): string | Uint8Array => {
    if(typeof part1 == "string"){
        return part1 + part2;
    }
    else{
        const newConcatArray = new Uint8Array(part1.length + part2.length);
        newConcatArray.set(part1, 0);
        newConcatArray.set(part2 as Uint8Array, part1.length);
        return newConcatArray;
    }
};

// Entry point for matching a file in the user code to Google Drive.
// This is a promise that returns an object with a property "succeeded", boolean value, and "errorMsg" for passing the error message.
// On success, the file is mapped in gdFilesMap for future references.
export const skulptOpenFileIO = (skFile: SkulptFile): {succeeded: boolean, errorMsg: string} => {
    // If we are not connected to a cloud file system, then we raise an error.
    if(useStore().syncTarget != StrypeSyncTarget.gd){
        return {succeeded: false, errorMsg: i18n.t("errorMessage.fileIO.notConnectedToCloud") as string};
    }

    // Initialisator of the variable
    if(googleDriveComponent == undefined){
        googleDriveComponent = ((vm.$children[0].$refs[getMenuLeftPaneUID()] as InstanceType<typeof MenuComponent>).$refs[getGoogleDriveComponentRefId()] as InstanceType<typeof GoogleDriveComponent>);
    }

    // We cannot make any assumption on what the file name path separator is.
    // Because the path is written in the user code, and because the project can be open on any platform,
    // the separator can be anything (even if knowing the project looks up file in the Cloud, "/" is more likely).
    // We take the risk of splitting the path using either "/" or "\" and assuming these are not used in folder or file names.
    const filePath = skFile.name;
    const posixPath = filePath.replaceAll("\\", "/"); 
    const posixPathObj = path.parse(posixPath);
    const fileName = posixPathObj.name + posixPathObj.ext;

    // Look up the file on Google Drive in the location:      
    let gdFile: GDFile;
    return new Sk.misceval.promiseToSuspension(
        // First we need to check/retrieve the file's containing folder.
        getgdFileFolderIdFromPath(posixPathObj)
            .then((fileFolderId) => {
                // We have a fileFolder Id so we can now get the file itself within that location
                return googleDriveComponent.searchGoogleDriveElement(`name='${fileName}' and parents='${fileFolderId}' and trashed=false`, {orderBy: "modifiedTime", fileFields: "files(id,name,capabilities,contentRestrictions)"})
                    .then((response) => {      
                        const filesArray: GDFile[] = JSON.parse(response.body).files;
                        // See GoogleDrive.vue: the results are not always what expected, so double check is required.
                        // Files are ordered by ascending modified date, we always use the most recent one if there duplicated names.
                        filesArray.forEach((file) => {
                            if(file.name == fileName){
                                gdFile = file;
                            }
                        });

                        if(gdFile){
                            // Before adding the file in the map, we do some basic checks.
                            // Check 1: if the file is in x mode, it can't exist
                            if(skFile.mode.v.startsWith("x")){
                                return {succeeded: false, errorMsg: i18n.t("errorMessage.fileIO.fileAlreadyExists", {filename: filePath}) as string};

                            }
                            // Check 2: if the file is in write, append, or r+ mode, it can't be readonly. 
                            const isReadonly = !(gdFile.capabilities.canEdit??true) || !(gdFile.capabilities.canModifyContent??true) || !!(gdFile.contentRestrictions?.readOnly);
                            if(isReadonly && /^([wa])|(rb?\+)/.test(skFile.mode.v)) {
                                return {succeeded: false, errorMsg: i18n.t("errorMessage.fileIO.readonlyFile", {filename: filePath}) as string};
                            }
                            // Can add the matched file to the mapping object unless we are in "x" mode which requires the file not to exist.
                            const fileMapEntry: GDFileWithMetaData = {...gdFile, filePath: filePath, locationId: fileFolderId, readOnly: isReadonly};
                            gdFilesMap.push(fileMapEntry);     
                                
                            // If we are in reading mode or append mode, we need to retrieve the file's content.
                            // This is for internal mechanisms, but if we fail to read the file at this stage, we'll raise an error.
                            // For writing mode, we just set the file content to empty as it will be truncated anyway.
                            if(!skFile.mode.v.startsWith("w")){
                                return skupltReadFileIO(filePath, skFile.mode.v.includes("b")).then((fileContent) => {                                           
                                    (gdFilesMap.at(-1)as GDFile).content = fileContent;
                                    // Very importantly, the Skulpt internal data buffer is updated here for reading mode:
                                    if(skFile.mode.v.startsWith("r")){
                                        skFile.data$ = Sk.ffi.remapToPy(fileContent);
                                    }
                                    return {succeeded: true, errorMsg: ""};
                                },
                                () => {
                                    return {succeeded: false, errorMsg: i18n.t("errorMessage.fileIO.openReadingError", {filename: filePath}) as string};
                                });
                            }
                            else{
                                // At this stage everythig is fine, we can return success
                                return {succeeded: true, errorMsg: ""};
                            }
                        }
                        else{
                            // The file may have not be found, which is a stopper in read mode.
                            // However, in write, append and exclusive creation mode, we can create a file. 
                            // Python creates the file right at the call to open().
                            // So we try that first.
                            if(skFile.mode.v.startsWith("r")){
                                return {succeeded: false, errorMsg: i18n.t("errorMessage.fileIO.fileNotFound", {filename: filePath}) as string};
                            }
                            else if(skFile.mode.v.startsWith("w") || skFile.mode.v.startsWith("a") || skFile.mode.v.startsWith("x")){
                                return googleDriveComponent.writeFileContentForIO((skFile.mode.v.includes("b") ? new Uint8Array(0) : ""), {filePath: filePath, fileName: fileName, folderId: fileFolderId})
                                    .then((newFileId) => {
                                        // Since the file has been created we can now keep it's fileId in the map:
                                        gdFilesMap.push({name: fileName, content: "", filePath: filePath, id: newFileId, locationId: fileFolderId,
                                            readOnly: false, capabilities: {canEdit: true, canModifyContent: true}});
                                        return {succeeded: true, errorMsg: ""};
                                    },
                                    (errorMsg) =>  {
                                        return {succeeded: false, errorMsg: errorMsg};
                                    });                               
                            }
                        }
                    },
                    (reason) => {
                        const errorMsg = i18n.t("errorMessage.fileIO.accessToGDError", {fileName: filePath, error: (typeof reason == "string") ? reason : (reason.status??"unknown")});
                        return {succeeded:false,errorMsg: errorMsg};
                    });
            },
            (errorMsg) => {
                return {succeeded: false, errorMsg: errorMsg??i18n.t("errorMessage.fileIO.fileLocationNotFound", {filename: filePath}) as string};
            })     
    );
};

const getgdFileFolderIdFromPath = (fileFolderPath: path.PathObject): Promise<string> => {
    // We retrieve (and check) the location of the file, specified by fileFolderPath.
    // The base location of the Google Drive search is the project's current directory.
    // (Note: the root of the Google Drive folders, the drive itself is identified in Google Drive by "root".)
    return new Promise<string>((resolve, reject) => {
        const baseFolderLocationId = useStore().strypeProjectLocation as string;
        if(fileFolderPath.dir && fileFolderPath.dir != "./"){
            // We need to look up the directory/directories from top to bottom.
            // When there is some folder retrieve to do, we only do one query to "search" the folders under "root" and use that to walk the path given by the user.
            const cleanedPath = fileFolderPath.dir.replace(/^.\//,"");
            const userGivenFolderParts = cleanedPath.split("/");
            //let gdFoldersInRoot: TreeItem[];
            //const childrenLookUpBaseFolderId = fileLocationId;            
            return googleDriveComponent.searchGoogleDriveElement("mimeType = 'application/vnd.google-apps.folder' and 'me' in owners and trashed=false", 
                {orderBy: "modifiedTime", fileFields: "files(id,name,parents)"})
                .then((response) => {         
                    const folderArray: {id: string, name: string, parents: string[], parentId?: string}[] = JSON.parse(response.body).files;
                    // We transform the response to a tree so we can navigate it later.
                    // The folder's  parent is an array of 1 element, it is an array for historical reasons of the Google Drive API.
                    // Even if "root" is used as an ID alias by Google Drive, there is a "real" ID returned by the search query, we need to find it...
                    // Unfortunaltely, that means calling twice the arrayToTre method: once to get the "missing" entry, the other to make the tree proper.
                    // It's still better than calling the Google API twice.
                    folderArray.forEach((value) => value.parentId = value.parents[0]);
                    try{
                        arrayToTree(folderArray, {throwIfOrphans: true})??"didnt work :(";
                    }
                    catch(orphanError) {
                        const rootId = /\[(.+)\]/.exec((orphanError as Error).message)?.[1];
                        if(!rootId){
                            // Something went wrong, we should not have issue, but if we do we need to raise an error and let the users know.
                            reject(i18n.t("errorMessage.fileIO.fileLocationCheckingError"));
                        }
                        else{
                            // We generate the tree again, providing the root ID this time 
                            // (the root isn't included in arrayToTree since it's not return as an element by the Google Drive API query, we add it manually)
                            const gdRootFoldersTree = [{data: {id: rootId, parentId: null}, children: arrayToTree(folderArray, {rootParentIds: {[rootId]: true}})}];
                            // The base is the Strype's project folder, which we need to retrieve and set as current base.
                            const findNodeInGDRootFolderTree = (folderId: string, folderNode: TreeItem = gdRootFoldersTree[0]): TreeItem | undefined => {
                                // No need to look if the node given is the right one: we look *in* the tree
                                let nodeToReturn = undefined;    
                                for (const childNode of folderNode.children){
                                    if(childNode.data.id == folderId){
                                        nodeToReturn = childNode;
                                        break;
                                    }
                                    else{
                                        nodeToReturn = findNodeInGDRootFolderTree(folderId, childNode);
                                        if(nodeToReturn) {
                                            break;
                                        }

                                    }
                                }
                                return nodeToReturn;
                            };
                            // Now we walk the user's given path to check it is valid, and retrieve the file's location.
                            //for (const [index, pathBit] of userGivenFolderParts.entries()){
                            let currentBaseTreeItem = (baseFolderLocationId == rootId || baseFolderLocationId == "root") ? gdRootFoldersTree[0] :  findNodeInGDRootFolderTree(baseFolderLocationId);                            
                            const erroneousPathPart = userGivenFolderParts.some((pathPart, index) => {
                                if(pathPart == "."){
                                    // Stay where we are
                                    return false;
                                }
                                if(pathPart == ".."){
                                    // Look up the parent of the current's position.
                                    // Usually, we need to find the parent of the Strype project's folder (i.e. ".." is at the start of the path),
                                    // but if ".." appears somewhere else, that's relative to where we were before.
                                    if(currentBaseTreeItem?.data.id == rootId){
                                        // We are already at the root of the drive: there can't be a level up.
                                        return true;
                                    }
                                    currentBaseTreeItem = (currentBaseTreeItem?.data.parentId == rootId) ? gdRootFoldersTree[0] : findNodeInGDRootFolderTree(currentBaseTreeItem?.data.parentId);
                                    return false;                                    
                                }
                                if(pathPart.length == 0){
                                    // The case we meet "/" as the start of the path (absolute path), the current reference is the root of the drive, we continue.
                                    if(index == 0){
                                        //childrenLookUpBaseFolderId = rootId;
                                        currentBaseTreeItem = gdRootFoldersTree[0];
                                    }
                                    return false;
                                }
                                
                                // Check the folder exist under the current base: if it does, we reset the currentBaseTreeItem, and continue walking the path.
                                // If it doesn't exist, we stop walking the path and reject the promise (error).
                                const subFolderNode = currentBaseTreeItem?.children.find((folderNode: TreeItem) => folderNode.data.name == pathPart);
                                if(subFolderNode){
                                    currentBaseTreeItem = subFolderNode;                                    
                                    return false;
                                }
                                else{
                                    return true;
                                }
                            });
                            if(erroneousPathPart){
                                // The path couldn't be resolved, we reject the promise                                
                                reject();
                            }
                            else{
                                resolve(currentBaseTreeItem?.data.id);
                            }
                        }
                    }                    
                },
                (error) => reject(error.result));
        }
    
        // No directory specified, we're in the project location, we can return now.
        resolve(baseFolderLocationId as string);
    });
};

// Handling the closing request of a file from Skulpt. In our Google Drive context.
// We make sure to make the actual writing of the file on the Drive, and clean up the file map. 
export const skulptCloseFileIO = (skFile: SkulptFile): {succeeded: boolean, errorMsg: string} => {
    const fileEntryIndex = gdFilesMap.findIndex((entry) => entry.filePath == skFile.name);
    if(fileEntryIndex == -1){
        return {succeeded: false, errorMsg: i18n.t("errorMessage.fileIO.closeInternalError") as string};
    }
    // If we are in strict reading mode OR in error*, we don't need to do any async part.
    // Otherise, we need to make the actual writing to the file. (* an error may be raised 
    // in Skulpt on something from the user code, but close() is called to clean things.
    // When this situation happens, we set a flag on the file object from Skulpt.)
    // In all cases when we need to write something, we just write the buffer content.
    // One exception to this: append mode will write at the end of the file.
    const finaliseClose = (): {succeeded: boolean, errorMsg: string} => {
        gdFilesMap.splice(fileEntryIndex, 1);
        return {succeeded: true, errorMsg: ""};
    };

    const needWriting = (!skFile.isInError ) && (!/^rb?$/.test(skFile.mode.v));
    // Prepare what to write. 
    if(needWriting){
        const toWrite = (skFile.mode.v.startsWith("a")) ? concatFileContentParts(gdFilesMap[fileEntryIndex].content, Sk.ffi.remapToJs(skFile.data$)) : Sk.ffi.remapToJs(skFile.data$);
        return new Sk.misceval.promiseToSuspension(
            skulptWriteFileIO(skFile, toWrite)
                .then((successData: {succeeded: boolean, errorMsg: string}) => {
                    if(successData.succeeded){
                        return finaliseClose();
                    }
                    else {
                        return successData;
                    }
                })
        );
    }
    else{
        return finaliseClose();
    }
};

// Read method, with retrieves the content of a file on Google Drive.
// The content is either a string content for text modes, bytes for binary modes.
// On failure, the content contains the error message.
const skupltReadFileIO = (filePath: string, isBinary: boolean): Promise<string|Uint8Array> => {
    // We retrieve the Google Drive file ID - it should be valid as no call to this when a file is closed in Skulpt should happen.
    const fileId = gdFilesMap.find((mapEntry) => mapEntry.filePath == filePath)?.id??"";
    return new Promise<string|Uint8Array>((resolve, reject) => {
        googleDriveComponent.readFileContentForIO(fileId, isBinary, filePath)
            .then((fileContent) => {
                resolve(fileContent as string|Uint8Array);
            }, (error) => {
                reject(error);
            });       
    });
};

// This method is a handler for the internal Skulpt write (to external file).
// It doens't actually write in the external file, but update the Skulpt's internal buffer of the Skulpt file object.
// It concatenates toWrite to the current buffer, excpet for "r+" (see details)
export const skulptInteralFileWrite = (skFile: SkulptFile, toWrite: string | Uint8Array): void => {
    if(/^rb?\+$/.test(skFile.mode.v)){
        // This weird mode is handled by us. 
        // We replace every part of the buffer for the given towrite content, at the current pointer position.
        const bufferPos = Sk.ffi.remapToJs(skFile.pos$);
        let newData;
        if(skFile.mode.v.includes("b")){
            newData = Sk.ffi.remapToJs(skFile.data$) as Uint8Array;
            // First write what we can in the existing array
            const writeUpToInclWritePos = Math.min(newData.length - bufferPos, toWrite.length);
            newData.set(toWrite.slice(0, writeUpToInclWritePos + 1) as Uint8Array, bufferPos);
            if(writeUpToInclWritePos < toWrite.length - 1){
                // The reminder to write, we need to create a new buffer.
                newData = concatFileContentParts(newData, toWrite.slice(writeUpToInclWritePos + 1)) as Uint8Array;
            }
        }
        else{
            const strData = Sk.ffi.remapToJs(skFile.data$) as string;
            newData = strData.substring(0, bufferPos) + toWrite + ((strData.length - bufferPos > toWrite.length) ? strData.substring(bufferPos + toWrite.length) : "");
        }
        // Set the new buffer and position to the file. We take the rule to move the position on write.
        skFile.data$ = Sk.ffi.remapToPy(newData);
        skFile.pos$ = Sk.ffi.remapToPy(bufferPos + toWrite.length);
    }
    else{
        skFile.data$ = Sk.ffi.remapToPy(concatFileContentParts(Sk.ffi.remapToJs(skFile.data$), toWrite));
    }
};

// This write method is internally called by the the closing method (see skulptCloseFileIO) when the latter is called by Skulpt.
// All intermediate buffer writing is done by Skulpt which calls skulptInteralFileWrite above.
// Note: we write a full file content every time. That means that sometimes we need to write more than the internal buffer content,
// for example in append mode. It is the job of skulptCloseFileIO to check all that - this methods just writes.
const skulptWriteFileIO = (skFile: SkulptFile, toWrite: string|Uint8Array): Promise<{succeeded: boolean, errorMsg: string}> => {
    // We retrieve the Google Drive file ID - it should be valid as no call to this after a file is closed in Skulpt should happen.
    const fileId = gdFilesMap.find((mapEntry) => mapEntry.filePath == skFile.name)?.id??"";
    return googleDriveComponent.writeFileContentForIO(toWrite, {filePath: skFile.name, fileId: fileId})
        .then((_) => {
            return {succeeded: true, errorMsg: ""};
        },
        (errorMsg) => {
            // We do not reject here, everything is treated as resolved (for Skulpt to handle the error messages)
            return {succeeded: false, errorMsg: errorMsg};
        });
   
};
