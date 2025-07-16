/**
 * These types are used with Cloud Drive related things.
 */

import { StrypeSyncTarget } from "./types";

export interface SaveExistingCloudProjectInfos {
    existingFileId: string,
    existingFileName: string
    isCopyFileRequested: boolean,
    resumeProcessCallback: VoidFunction,
}

// State of the API loading for a Cloud Drive.
// Since all Cloud Drive would have an API to handle identification 
// we can have one generic state description for all of them.
export enum CloudDriveAPIState {
    UNLOADED, // default state : the API hasn't been loaded yet
    LOADED, // when the API has been loaded
    FAILED, // when the API failed to load
}

/* Types used in FileIO */
// We maintain a list of files for operability between Skulpt and the Cloud Drives
// so we can easily work with file ID in the Drives.
// This is a per-project object, therefore the file paths in this object are unique.
export interface CloudDriveFile {
    name: string, // The file name (not including path)
    id: string, // The file ID on the Drive
    content: string | Uint8Array, // The file content when opened
}
// Specifics for Google Drive
export interface GDFile extends CloudDriveFile {
    // Capabilities used to evaluate readonly status
    capabilities: { canEdit: boolean, canModifyContent: boolean }, contentRestrictions?: { readOnly?: boolean }
}

// A simple Drive folder typing for the Strype project's location folder tree structure
export interface CloudFolder {
    id: string,
    name: string,
    children: CloudFolder[],
}
// end specifics for Google Drive

export interface CloudFileWithMetaData extends GDFile {
    filePath: string, // The file path as specified in the user code, and "visually" represented in the Drive
    locationId: string, // The file location's Drive folder ID
    readOnly: boolean, // Readonly status of the file in the Drive
}
/* end types for FileIO */

/* The template typing of a Cloud Drive component */
// Ensures some of the specific props, data and methods of the component are included in CloudDriveComponent.
// I don't know how to work it out so we get errrors for missing parts within each specific drive's component,
// I've been trying without success and the only way I found to be working and still manageable is to *not* have
// checking working within the component but when the component is used in the caller (in CloudDriveHandler).
// It's not ideal but at least it still allow detecting missing parts during development and allow TS working everywhere.
export interface CloudDriveComponent {
    // Props
    driveName: string,
    apiName: string,
    onFileToLoadPicked: (cloudTarget: StrypeSyncTarget, fileId: string, fileName?: string) => Promise<void>,
    onFolderToSaveFilePicked: (cloudTarget: StrypeSyncTarget) => void,
    onUnsupportedByStrypeFilePicked: VoidFunction,

    // Data
    isFileLocked: boolean;

    // Methods
    signIn: (signInCalBack: (cloudTarget: StrypeSyncTarget) => void) => void,
    resetOAuthToken: () => void,
    isOAuthTokenNotSet: () => boolean,
    testCloudConnection: (onSuccessCallBack: VoidFunction, onFailureCallBack: VoidFunction) => void,
    getFolderNameFromId: (folderId: string) => Promise<string>,
    checkDriveStrypeOrOtherFolder: (createIfNone: boolean, checkStrypeFolder: boolean, checkFolderDoneCallBack: (strypeFolderId: string | null) => Promise<void>, failedConnectionCallBack?: () => Promise<void>) => Promise<void>,
    checkIsCloudFileReadonly: (id: string, onGettingReadonlyStatus: (isReadonly: boolean) => void) => void,
    pickFolderForSave: VoidFunction,
    lookForAvailableProjectFileName: (fileLocation: string|undefined, fileName: string, onFileAlreadyExists: (existingFileId: string) => void, onSuccess: VoidFunction, onFailure: VoidFunction) => void,
    doLoadFile: (openSharedProjectFileId: string) => Promise<void>,
    loadPickedFileId: (id: string, otherParams: {fileName?: string}, onGettingFileMetadataSucces: (fileNameFromDrive: string, fileModifiedDateTime: string) => void,
        onGettingFileContentSuccess: (fileContent: string) => void, onGettingFileContentFailure: (errorRespStatus: number) => void) => void,
    checkIsFileLocked: (existingFileId: string, onSuccess: VoidFunction, onFailure: VoidFunction) => void,
    doSaveFile: (saveFileId: string|undefined, projetLocation: string, fullFileName: string, fileContent: string, isExplictSave: boolean, onSuccess: (savedFileId: string) => void, onFailure: (errRespStatus: number) => void) => void,
    getCloudAPIStatusWhenLoadedOrFailed: () => Promise<CloudDriveAPIState>,
    getPublicSharedProjectContent: (sharedFileId: string) => Promise<{isSuccess: boolean, encodedURIFileContent: string, errorMsg: string}>,
    shareCloudDriveFile: (saveFileId: string) =>  Promise<boolean>,
    getPublicShareLink: (saveFileId: string) => Promise<{respStatus: number, webLink: string}>,
    searchCloudDriveElements: (elementName: string, elementLocationId: string, searchAllSPYFiles: boolean, searchOptions: Record<string, string>) => Promise<CloudDriveFile[]>,
    //FileIO
    readFileContentForIO: (fileId: string, isBinaryMode: boolean, filePath: string) => Promise<string | Uint8Array | {success: boolean, errorMsg: string}>,
    writeFileContentForIO: (fileContent: string|Uint8Array, fileInfos: {filePath: string, fileName?: string, fileId?: string, folderId?: string}) => Promise<string>,
}