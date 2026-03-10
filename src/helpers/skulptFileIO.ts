/**
 * This helper file contains the handling of file IO to be used by Skulpt
 * on user code specified files (in Python: open()).
 * At the moment, we only support file IO in the cloud (due to restrictions on 
 * the browser's access to the host file system).
 */
import { vm } from "@/helpers/appContext";
import path from "path-browserify";
import { getCloudDriveHandlerComponentRefId, getMenuLeftPaneUID } from "./editor";
import CloudDriveHandlerComponent from "@/components/CloudDriveHandler.vue";
import MenuComponent from "@/components/Menu.vue";
import { useStore } from "@/store/store";
import i18n from "@/i18n";
import { CloudDriveComponent, CloudDriveFile, CloudFileWithMetaData, CloudFolder, isSyncTargetCloudDrive } from "@/types/cloud-drive-types";
import {CloudFileId, CloudFileInfo} from "@/stryperuntime/worker_bridge_type";

declare const Sk: any;
// Will be set later as we need to make sure Vue application has started...
let cloudDriveHandlerComponent: InstanceType<typeof CloudDriveHandlerComponent>;

function getCloud() : CloudDriveHandlerComponent {
    // Initialisator of the variable
    if(cloudDriveHandlerComponent == undefined){
        cloudDriveHandlerComponent = ((vm.$children[0].$refs[getMenuLeftPaneUID()] as InstanceType<typeof MenuComponent>).$refs[getCloudDriveHandlerComponentRefId()] as InstanceType<typeof CloudDriveHandlerComponent>);
    }
    // TODO VUE3 will need fix
    // I think ideally under Vue 3 we should be able to remove the "as unknown"
    return cloudDriveHandlerComponent as unknown as CloudDriveHandlerComponent;
}

const cloudFilesMap: CloudFileWithMetaData[] = [];

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

// The cached tree of the Strype's project folder descendants (children their children etc).
// The tree is constructed "on demand", that is we only add the folders when they are referenced in a file path
// that we want to resolve; we don't retrieve all the descendants at once.
const currentStrypeProjectCloudFolderTree: CloudFolder[] =  [];

// Clearing method for cached elements (need to be called externally by the code runner)
export function clearFileIOCaches(): void {
    cloudFilesMap.splice(0);
    currentStrypeProjectCloudFolderTree.splice(0);
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


export function cloudLookupFile(parent: CloudFileId, name: string) : Promise<{fileId: CloudFileId, isDir: boolean} | undefined> {
    // If we are not connected to a cloud file system, then we raise an error:
    if(!isSyncTargetCloudDrive(useStore().syncTarget)){
        // TODO VUE3 will need fix
        return Promise.reject(i18n.t("errorMessage.fileIO.notConnectedToCloud") as string);
    }
    
    const cloud : CloudDriveHandlerComponent = getCloud();

    return cloud.searchCloudDriveElements(useStore().syncTarget, name, parent.cloudFileId, false, {orderBy: cloud.modifiedDataSearchOptionName, fileFields: cloud.fileMoreFieldsForIO})
        .then((cloudFolderFiles : CloudDriveFile[]) => {
            // The search succeeded and we expect only one folder to be found (if any, so we'll use the first one returned).
            // We can save that folder in the cache and either return it's ID if we don't have other folder to resolve, or continue resolving otherwise.
            if(cloudFolderFiles.length > 0){
                return Promise.resolve({fileId: {cloudFileId: cloudFolderFiles[0].id}, isDir: cloudFolderFiles[0].isDir, fileSize: cloudFolderFiles[0].fileSize});
            }
            else{
                return Promise.resolve(undefined);
            }
        },
        (error) => Promise.reject(error.result));
}

export function cloudListDir(parent: CloudFileId) : Promise<CloudFileInfo[]> {
    // If we are not connected to a cloud file system, then we raise an error:
    if(!isSyncTargetCloudDrive(useStore().syncTarget)){
        // TODO VUE3 will need fix
        return Promise.reject(i18n.t("errorMessage.fileIO.notConnectedToCloud") as string);
    }
    const cloud : CloudDriveHandlerComponent = getCloud();

    return cloud.searchCloudDriveElements(useStore().syncTarget, undefined, parent.cloudFileId, false, {})
        .then((cloudFolderFiles : CloudDriveFile[]) => {
            return Promise.resolve(cloudFolderFiles.map((cloudFolderFile) => {
                return {
                    fileId: {cloudFileId: cloudFolderFile.id},
                    name: cloudFolderFile.name,
                    isDir: cloudFolderFile.isDir,
                    fileSize: cloudFolderFile.fileSize,
                };
            }));
        },
        (error) => Promise.reject(error.result));
}


export function cloudOpenFile(file: CloudFileId, flags: number) : Promise<boolean> {
    // There's not actually anything to do here; cloud files are generally read/written
    // in their entirety, so there's not really a concept of holding them open.
    // We don't read the content yet; we wait for first read or write for that.
    // But it's nice to have functions that mirror the Pyodide API in case of future changes.
    return Promise.resolve(true);
}

export async function cloudCloseFile(file: CloudFileId) : Promise<boolean> {
    const details = cloudFileContent.get(file.cloudFileId);
    if (details) {
        // We need to force flush.  First await any pending write, which might
        // have been writing stale data:
        if (details.pendingWrite) {
            await details.pendingWrite;
        }
        if (details.content.sequence > details.lastWritePerformed) {
            // Then do one last write if there is new content to write:
            await cloudWriteFile(file, details.content.bytes, 0, details.filePath, true);
            // This should always exist now, because we have just forced a write:
            if (details.pendingWrite) {
                await details.pendingWrite;
            }
        }
        // Delete from cache now we're closing:
        cloudFileContent.delete(file.cloudFileId);
    }
    return true;
}

// We know if there is still something to be written by comparing
// content.sequence to lastWritePerformed.  If they are equal, nothing to write.
// If we only read and never wrote, they will both be zero, so that will stop writing
// to files we only read from.
interface CloudFileContent {
    content: {bytes: Uint8Array, sequence: number};
    filePath: string;
    lastWritePerformed: number;
    // If this is undefined, no pending error:
    pendingError: Error | undefined;
    // If this is undefined, there are no pending writes:
    pendingWrite: Promise<void> | undefined;
    lastWrittenTime: number; // A date, e.g. from Date.now()
}

// Originally we used the LRU cache for this to limit the number of held files.
// But in that case when we added a file we could evict an old one, and fail to write,
// and leave to the odd circumstance that read("bar.txt") needs to give an error that
// writing foo.txt (an old pending write) has failed.  So we instead allow an arbitrary
// unlimited number of open files, and only flush writes when that file is written
// or closed.
// The key in the cache is the CloudFileId
const cloudFileContent = new Map<string, CloudFileContent>();

export async function cloudTruncateFile(id: CloudFileId, size: number, filePath: string) : Promise<number> {
    const fullContent = await fetchAndCacheContentFor(id, filePath);
    // Don't need to truncate unless it's longer than wanted:
    if (fullContent.content.bytes.length > size) {
        fullContent.content.bytes = fullContent.content.bytes.slice(0, size);
        fullContent.content.sequence = fullContent.content.sequence + 1;
        // Now queue a write of the bytes at position 0.  You'd think this wouldn't do any truncation,
        // just an overwrite, but because we have truncated the bytes above in the cached object, and we always
        // write the full file content to the cloud, this will overwrite the whole file with 
        // the newly truncated bytes we've stored:
        await cloudWriteFile(id, fullContent.content.bytes, 0, filePath);
    }
    return fullContent.content.bytes.length;
}

// Note: the writes are queued for async, it won't necessarily have written by the time the Promise succeeds.
// Because of this, the force parameter doesn't await, it just force queues.  Awaiting pendingWrite after if you want.
export async function cloudWriteFile(file: CloudFileId, content: Uint8Array | Uint8ClampedArray, atPosition: number, filePath: string, force = false) : Promise<void>  {
    // First get the full file content:
    const fullContent = await fetchAndCacheContentFor(file, filePath);
    // Now we must copy in our written portion, which might involve re-allocating the array:
    fullContent.content.bytes = copyBetweenUint8Array(fullContent.content.bytes, atPosition, content);
    fullContent.content.sequence = fullContent.content.sequence + 1;
    // If a previous error, throw it now:
    if (fullContent.pendingError) {
        const e = fullContent.pendingError;
        fullContent.pendingError = undefined; // Clear it so that we can potentially try again
        throw e;
    }
    
    // Now we either write (if it's been long enough since last write) or setup a pending write:
    if (!fullContent.pendingWrite || force) {
        // 5 seconds since last write:
        if (Date.now() > fullContent.lastWrittenTime + 5000 || force) {
            const seq = fullContent.content.sequence;
            const bytes = fullContent.content.bytes;
            fullContent.pendingWrite = (async () => {
                try {
                    await getCloud().writeFileContentForIO(useStore().syncTarget, bytes, {filePath,fileId: file.cloudFileId});
                    fullContent.lastWritePerformed = seq;
                }
                catch (e) {
                    fullContent.pendingError = e instanceof Error ? e : new Error(String(e));
                }
                finally {
                    fullContent.pendingWrite = undefined;
                    fullContent.lastWrittenTime = Date.now();
                }
            })();
        }
    }
}

// Returns dest array, which might be a re-allocated copy if it was not long enough to fit complete source.
function copyBetweenUint8Array(
    dest: Uint8Array,
    destPos: number,
    src: Uint8Array | Uint8ClampedArray,
    srcStart = 0,
    srcEnd = src.length
): Uint8Array {
    const sliceLen = srcEnd - srcStart;
    const required = destPos + sliceLen;

    if (required > dest.length) {
        const newDest = new Uint8Array(required);
        newDest.set(dest, 0);
        dest = newDest;
    }

    dest.set(src.subarray(srcStart, srcEnd), destPos);
    return dest;
}


async function fetchAndCacheContentFor(file: CloudFileId, filePath: string) : Promise<CloudFileContent> {
    let fullContent: CloudFileContent | undefined = cloudFileContent.get(file.cloudFileId);
    if (!fullContent) {
        const bytes = await getCloud().readFileContentForIO(useStore().syncTarget, file.cloudFileId, filePath);
        fullContent = {
            content: {bytes, sequence: 0},
            lastWritePerformed: 0,
            filePath,
            pendingWrite: undefined,
            pendingError: undefined,
            lastWrittenTime: Date.now(),
        };
        cloudFileContent.set(file.cloudFileId, fullContent);
    }
    return fullContent;
}

export async function cloudReadFile(file: CloudFileId, fromByte: number, lengthBytes: number, filePath: string) : Promise<Uint8Array> {
    // Try cache first:
    const fullContent = await fetchAndCacheContentFor(file, filePath);
    // Now we have to slice it for the return:
    return fullContent.content.bytes.slice(fromByte, fromByte + lengthBytes);
}

export async function cloudCreate(parent: CloudFileId, name: string, isDir: boolean, filePath: string) : Promise<CloudFileId> {
    // If we are not connected to a cloud file system, then we raise an error:
    if(!isSyncTargetCloudDrive(useStore().syncTarget)){
        // TODO VUE3 will need fix
        return Promise.reject(i18n.t("errorMessage.fileIO.notConnectedToCloud") as string);
    }
    const cloud : CloudDriveHandlerComponent = getCloud();
    
    if (isDir) {
        // TODO VUE3 will need fix
        return Promise.reject(i18n.t("errorMessage.fileIO.cannotCreateDirectory") as string);
    }
    else {
        // Write an empty file (this will be awaited by the caller):
        return cloud.writeFileContentForIO(useStore().syncTarget, new Uint8Array(0), {filePath: filePath, fileName: name, folderId: parent.cloudFileId}).then((id: string) => {
            return {cloudFileId: id};
        });
    }
}

// Entry point for matching a file in the user code to a Cloud Drive.
// This is a promise that returns an object with a property "succeeded", boolean value, and "errorMsg" for passing the error message.
// On success, the file is mapped in cloudFilesMap for future references.
export const skulptOpenFileIO = (skFile: SkulptFile): {succeeded: boolean, errorMsg: string} => {
    // If we are not connected to a cloud file system, then we raise an error.
    if(!isSyncTargetCloudDrive(useStore().syncTarget)){
        return {succeeded: false, errorMsg: i18n.t("errorMessage.fileIO.notConnectedToCloud") as string};
    }

    // Initialisator of the variable
    if(cloudDriveHandlerComponent == undefined){
        cloudDriveHandlerComponent = ((vm.$children[0].$refs[getMenuLeftPaneUID()] as InstanceType<typeof MenuComponent>).$refs[getCloudDriveHandlerComponentRefId()] as InstanceType<typeof CloudDriveHandlerComponent>);
    }

    // We cannot make any assumption on what the file name path separator is.
    // Because the path is written in the user code, and because the project can be open on any platform,
    // the separator can be anything (even if knowing the project looks up file in the Cloud, "/" is more likely).
    // We take the risk of splitting the path using either "/" or "\" and assuming these are not used in folder or file names.
    const filePath = skFile.name;
    const posixPath = filePath.replaceAll("\\", "/"); 
    const posixPathObj = path.parse(posixPath);
    const fileName = posixPathObj.name + posixPathObj.ext;

    // Look up the file on the Cloud Drive in the location:
    // We don't support parent directory references, so if there are any, we can already return in error...
    if(posixPathObj.dir.split("/").includes("..")){
        return {succeeded: false,errorMsg: i18n.t("errorMessage.fileIO.parentDirRefNotSupported") as string};
    }   
    else {
        return new Sk.misceval.promiseToSuspension(
            // First we need to check/retrieve the file's containing folder.
            getCloudFileFolderIdFromPath(posixPathObj)
                .then((fileFolderId) => {
                    // We have a fileFolder Id so we can now get the file itself within that location
                    const modifiedDataSearchOptionName  = (cloudDriveHandlerComponent.getSpecificCloudDriveComponent(useStore().syncTarget) as CloudDriveComponent).modifiedDataSearchOptionName;
                    const fileFields = (cloudDriveHandlerComponent.getSpecificCloudDriveComponent(useStore().syncTarget) as CloudDriveComponent).fileMoreFieldsForIO;
                    return cloudDriveHandlerComponent.searchCloudDriveElements(useStore().syncTarget, fileName, fileFolderId, false, {orderBy: modifiedDataSearchOptionName, fileFields: fileFields})
                        .then((cloudFiles: CloudDriveFile[]) => {
                            if(cloudFiles[0]){
                                const cloudDriveFile = cloudFiles[0];
                                // Before adding the file in the map, we do some basic checks.
                                // Check 1: if the file is in x mode, it can't exist
                                if(skFile.mode.v.startsWith("x")){
                                    return {succeeded: false, errorMsg: i18n.t("errorMessage.fileIO.fileAlreadyExists", {filename: filePath}) as string};

                                }
                                // Check 2: if the file is in write, append, or r+ mode, it can't be readonly.
                                const isReadonly = (cloudDriveHandlerComponent.getSpecificCloudDriveComponent(useStore().syncTarget) as CloudDriveComponent).checkIsCloudDriveFileReadonly(cloudDriveFile);
                                if(isReadonly && /^([wa])|(rb?\+)/.test(skFile.mode.v)) {
                                    return {succeeded: false, errorMsg: i18n.t("errorMessage.fileIO.readonlyFile", {filename: filePath}) as string};
                                }
                                // Can add the matched file to the mapping object unless we are in "x" mode which requires the file not to exist.
                                const fileMapEntry: CloudFileWithMetaData = {...cloudDriveFile, filePath: filePath, locationId: fileFolderId, readOnly: isReadonly};
                                cloudFilesMap.push(fileMapEntry);     
                                
                                // If we are in reading mode or append mode, we need to retrieve the file's content.
                                // This is for internal mechanisms, but if we fail to read the file at this stage, we'll raise an error.
                                // For writing mode, we just set the file content to empty as it will be truncated anyway.
                                if(!skFile.mode.v.startsWith("w")){
                                    return skupltReadFileIO(filePath, skFile.mode.v.includes("b")).then((fileContent) => {                                           
                                        (cloudFilesMap.at(-1)as CloudDriveFile).content = fileContent;
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
                                    return cloudDriveHandlerComponent.writeFileContentForIO(useStore().syncTarget, (skFile.mode.v.includes("b") ? new Uint8Array(0) : ""), {filePath: filePath, fileName: fileName, folderId: fileFolderId})
                                        .then((newFileId) => {
                                            // Since the file has been created we can now keep it's fileId in the map:
                                            cloudFilesMap.push({name: fileName, content: (skFile.mode.v.includes("b")) ? new Uint8Array(0) : "", filePath: filePath, id: newFileId, locationId: fileFolderId,
                                                readOnly: false});
                                            return {succeeded: true, errorMsg: ""};
                                        },
                                        (errorMsg) =>  {
                                            return {succeeded: false, errorMsg: errorMsg};
                                        });                               
                                }
                            }
                        },
                        (reason: any) => {
                            const errorMsg = i18n.t("errorMessage.fileIO.accessToCloudDriveError",
                                {drivename: cloudDriveHandlerComponent.getDriveName(), fileName: filePath, error: (typeof reason == "string") ? reason : (reason.status??"unknown")});
                            return {succeeded:false,errorMsg: errorMsg};
                        });
                },
                (errorMsg) => {
                    return {succeeded: false, errorMsg: errorMsg??i18n.t("errorMessage.fileIO.fileLocationNotFound", {filename: filePath}) as string};
                })     
        );
    }
};

const getCloudFileFolderIdFromPath = (fileFolderPath: path.PathObject): Promise<string> => {
    // We retrieve (and check) the location of the file, specified by fileFolderPath.
    // The base location of the Cloud Drive search is the project's current directory.
    // We do not allow references to parent directories, therefore we can never go "up" the Strype project directory.
    // Also, we resolve the path one folder at a time, and keep it for reference in our folder tree, currentStrypeProjectCloudFolderTree.
    const baseFolderLocationId = useStore().strypeProjectLocation as string;
    if(fileFolderPath.dir && fileFolderPath.dir != "./"){
        // We need to look up the directory/directories from top to bottom, unless it is already cached in currentStrypeProjectCloudFolderTree.
        const cleanedPath = fileFolderPath.dir.replace(/^.\//,"");
        const userGivenFolderParts = cleanedPath.split("/");
        let currentCachedFolder = null as CloudFolder | null;       

        const resolveFilePath = (folderNameToCheck: string, folderChildrenNames: string[]): Promise<string> => {
            const handleFoundFolder = (foundCachedFolder: CloudFolder): Promise<string> => {
                if(folderChildrenNames.length > 0){
                    currentCachedFolder = foundCachedFolder;
                    return resolveFilePath(folderChildrenNames[0], folderChildrenNames.slice(1));
                }
                else{
                    return Promise.resolve(foundCachedFolder.id);
                }
            };

            // When resolving the token ".", we stay where are, move on the next token if needed
            if(folderNameToCheck == "."){                
                if(folderChildrenNames.length > 0){
                    return resolveFilePath(folderChildrenNames[0], folderChildrenNames.slice(1));
                }
                else{
                    // The silly case users would type "./././filename" should be handled.
                    return Promise.resolve((currentCachedFolder?.id)??baseFolderLocationId);
                }
            }

            // Is this path part already cached?
            const toLookIn = (currentCachedFolder) ? currentCachedFolder.children : currentStrypeProjectCloudFolderTree;
            const cachedChildFolder = toLookIn.find((folder: CloudFolder) => folder.name == folderNameToCheck); 
            if(cachedChildFolder){
                // It's cached, we either return the file ID when there is nothing else to resolve, otherwise we change our pointers and keep resolving
                return handleFoundFolder(cachedChildFolder);
            }
            else{
                // It's not cached: we need to look for it against the Cloud Drive.
                const modifiedDataSearchOptionName  = (cloudDriveHandlerComponent.getSpecificCloudDriveComponent(useStore().syncTarget) as CloudDriveComponent).modifiedDataSearchOptionName;
                const fileFields = (cloudDriveHandlerComponent.getSpecificCloudDriveComponent(useStore().syncTarget) as CloudDriveComponent).fileBasicFieldsForIO;
                return cloudDriveHandlerComponent.searchCloudDriveElements(useStore().syncTarget, folderNameToCheck, (currentCachedFolder?.id)??baseFolderLocationId, false, {orderBy: modifiedDataSearchOptionName, fileFields: fileFields})
                    .then((cloudFolderFiles) => {                             
                        // The search succeeded and we expect only one folder to be found (if any, so we'll use the first one returned).
                        // We can save that folder in the cache and either return it's ID if we don't have other folder to resolve, or continue resolving otherwise.
                        if(cloudFolderFiles.length > 0){
                            const toAppendIn = (currentCachedFolder) ? currentCachedFolder.children : currentStrypeProjectCloudFolderTree;
                            toAppendIn.push({id: cloudFolderFiles[0].id, name: cloudFolderFiles[0].name, children: []});
                            currentCachedFolder = toAppendIn.at(-1) as CloudFolder;
                            return handleFoundFolder(currentCachedFolder);
                        }
                        else{
                            return Promise.reject(undefined);
                        }
                    },
                    (error) => Promise.reject(error.result));
            }
        };        
        return resolveFilePath(userGivenFolderParts[0], userGivenFolderParts.slice(1));
    }
    
    // No directory specified, we're in the project location, we can return now.
    return Promise.resolve(baseFolderLocationId as string);
};

// Handling the closing request of a file from Skulpt. In our Cloud Drive context.
// We make sure to make the actual writing of the file on the Drive, and clean up the file map. 
export const skulptCloseFileIO = (skFile: SkulptFile): {succeeded: boolean, errorMsg: string} => {
    const fileEntryIndex = cloudFilesMap.findIndex((entry) => entry.filePath == skFile.name);
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
        cloudFilesMap.splice(fileEntryIndex, 1);
        return {succeeded: true, errorMsg: ""};
    };

    const needWriting = (!skFile.isInError ) && (!/^rb?$/.test(skFile.mode.v));
    // Prepare what to write. 
    if(needWriting){
        const toWrite = (skFile.mode.v.startsWith("a")) ? concatFileContentParts(cloudFilesMap[fileEntryIndex].content, Sk.ffi.remapToJs(skFile.data$)) : Sk.ffi.remapToJs(skFile.data$);
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
    // We retrieve the Cloud Drive file ID - it should be valid as no call to this after a file is closed in Skulpt should happen.
    const fileId = cloudFilesMap.find((mapEntry) => mapEntry.filePath == skFile.name)?.id??"";
    return cloudDriveHandlerComponent.writeFileContentForIO(useStore().syncTarget, toWrite, {filePath: skFile.name, fileId: fileId})
        .then((_) => {
            return {succeeded: true, errorMsg: ""};
        },
        (errorMsg) => {
            // We do not reject here, everything is treated as resolved (for Skulpt to handle the error messages)
            return {succeeded: false, errorMsg: errorMsg};
        });
   
};
