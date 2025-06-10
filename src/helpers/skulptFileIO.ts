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

declare const Sk: any;
// Will be set later as we need to make sure Vue application has started...
let googleDriveComponent: InstanceType<typeof GoogleDriveComponent>;

// We maintain a list of files for operability between Skulpt and Google Drive
// so we can easily work with file ID in Google Drive.
// This is per-project object, therefore the file paths in this object are unique.
export interface GoogleDriveFileIOMap {
    filePath: string, // The file path as specified in the user code, and "visually" represented in Google Drive
    gdLocationId: string, // The file location's Google Drive folder ID
    gdFileId: string, // The file's id in Google Drive
    gdReadOnly: boolean, // Readonly status of the file in Google Drive
}
export const gdFilesMap: GoogleDriveFileIOMap[] = [];
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
    data$: string,
    lineList: string[],
    currentLine: number,
    closed: boolean,
    fileno: number, // internal file number used by Skulpt, external files are number 11
}

// The TS typing to describe a Google Drive file
interface GDFile {name: string, id: string, capabilities: {canEdit: boolean, canModifyContent: boolean}, contentRestrictions?: {readOnly?: boolean}}
/*
// Entry point for matching a file in the user code to Google Drive.
// This is a promise that returns the file content on fulfillment (and add the mapping in gdFilesMap),
// and returns the error on failure (on failure no entry is added in gdFilesMap).
export const fetchGoogleDriveFile = (filePath: string): Promise<string> => {
    // We cannot make any assumption on what the file name path separator is.
    // Because the path is written in the user code, and because the project can be open on any platform,
    // the separator can be anything (even if knowing the project looks up file in the Cloud, "/" is more likely).
    // We take the risk of splitting the path using either "/" or "\" and assuming these are not used in folder or file names.
    const posixPath = filePath.replaceAll("\\", "/"); 
    const posixPathObj = path.parse(posixPath);
    //TODO: resolve location path
    const fileName = posixPathObj.name + posixPathObj.ext;

    return new Promise<string>((resolve, reject) => {
        // Look up the file on Google Drive in the location:
        const googleDriveComponent =  ((vm.$children[0].$refs[getMenuLeftPaneUID()] as InstanceType<typeof MenuComponent>).$refs[getGoogleDriveComponentRefId()] as InstanceType<typeof GoogleDriveComponent>);
       
        //TODO: most likely we need to URL-encode the file/folder name
        googleDriveComponent.searchGoogleDriveElement(`name='${fileName}' and parents='${useStore().strypeProjectLocation}' and trashed=false`, {orderBy: "modifiedTime desc", fileFields: "files(id,name,capabilities,contentRestrictions)"})
            .then((response) => {         
                const filesArray: {name: string, id: string, capabilities: {canEdit: boolean, canModifyContent: boolean}, contentRestrictions?: {readOnly?: boolean}}[] = JSON.parse(response.body).files;
                // See GoogleDrive.vue: the results are not always what expected, so double check is required
                let fileId = "";
                filesArray.forEach((file) => {
                    if(file.name == fileName){
                        fileId = file.id;
                        const fileMapEntry: GoogleDriveFileIOMap = {filePath: filePath, gdFileId: fileId, gdLocationId: useStore().strypeProjectLocation as string, 
                            gdReadOnly: !(file.capabilities.canEdit??true) || !(file.capabilities.canModifyContent??true) || !!(file.contentRestrictions?.readOnly)};
                        const fileMapIndex = gdFilesMap.findIndex((mapObj) =>  mapObj.filePath == filePath);
                        if(fileMapIndex > -1){
                            gdFilesMap[fileMapIndex] = fileMapEntry;
                        }
                        else{
                            gdFilesMap.push(fileMapEntry);
                        }
                    }
                });

                if(fileId.length > 0){
                    // Now we need to get the file content...
                    googleDriveComponent.getFileContentForIO(fileId, filePath, (fileContent) => {
                        resolve(fileContent);
                    }, (error) => {
                        reject(error);
                    });                    
                }
                else{
                    reject(i18n.t("errorMessage.fileIO.fileNotFound", {filename: filePath}) as string);
                }
            },
            (reason) => {
                const errorMsg = i18n.t("errorMessage.fileIO.accessToGDError", {fileName: filePath, error: (typeof reason == "string") ? reason : (reason.status??"unknown")});
                reject(errorMsg);
            });        
    });
};
*/

// Entry point for matching a file in the user code to Google Drive.
// This is a promise that returns an object with a property "succeeded", boolean value, and
// "errorMsg" for passing the error message.
// On success, the file is mapped in gdFilesMap for future references.
export const skulptOpenFileIO = (fileObj: SkulptFile): {succeeded: boolean, errorMsg: string} => {
    // If we are not connected to a cloud file system, then we raise an error.
    if(useStore().syncTarget != StrypeSyncTarget.gd){
        return {succeeded: false, errorMsg: i18n.t("errorMessage.fileIO.notConnectedToCloud") as string};
    }

    // Initialistor for the variable
    if(googleDriveComponent == undefined){
        googleDriveComponent = ((vm.$children[0].$refs[getMenuLeftPaneUID()] as InstanceType<typeof MenuComponent>).$refs[getGoogleDriveComponentRefId()] as InstanceType<typeof GoogleDriveComponent>);
    }

    // We cannot make any assumption on what the file name path separator is.
    // Because the path is written in the user code, and because the project can be open on any platform,
    // the separator can be anything (even if knowing the project looks up file in the Cloud, "/" is more likely).
    // We take the risk of splitting the path using either "/" or "\" and assuming these are not used in folder or file names.
    const filePath = fileObj.name;
    const posixPath = filePath.replaceAll("\\", "/"); 
    const posixPathObj = path.parse(posixPath);
    //TODO: resolve location path
    const fileName = posixPathObj.name + posixPathObj.ext;

    // Look up the file on Google Drive in the location:      
    //TODO: most likely we need to URL-encode the file/folder name
    let gdFile: GDFile;
    return new Sk.misceval.promiseToSuspension(
        googleDriveComponent.searchGoogleDriveElement(`name='${fileName}' and parents='${useStore().strypeProjectLocation}' and trashed=false`, {orderBy: "modifiedTime", fileFields: "files(id,name,capabilities,contentRestrictions)"})
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
                    // Found a file to match, we can add it to the mapping object unless we are in "x" mode which requires the file not to exist.
                    if(fileObj.mode.v != "x"){
                        const fileMapEntry: GoogleDriveFileIOMap = {filePath: filePath, gdFileId: gdFile.id, gdLocationId: useStore().strypeProjectLocation as string, 
                            gdReadOnly: !(gdFile.capabilities.canEdit??true) || !(gdFile.capabilities.canModifyContent??true) || !!(gdFile.contentRestrictions?.readOnly)};
                        gdFilesMap.push(fileMapEntry);                   

                        // We can return already with success if we are in read mode.
                        if(fileObj.mode.v == "r"){
                            return {succeeded: true, errorMsg: ""};       
                        }
                        // If we are in write mode, we first need to "clear" the file as in Python, a call to open(xxx,"w") truncates the file.
                        // In write or append the file is readonly, we are already in error.            
                        else if(fileObj.mode.v == "w" || fileObj.mode.v == "a") {
                            if(fileMapEntry.gdReadOnly){
                                return {succeeded: false, errorMsg: i18n.t("errorMessage.fileIO.readonlyFile", {filename: filePath}) as string};
                            }
                            else if(fileObj.mode.v == "w") {
                                return skulptWriteFileIO(fileObj, "");
                            }
                            else {
                                return {succeeded: true, errorMsg: ""};                               
                            }
                        }
                    }
                    else{
                        // If the file exists, then, we are in error state for "x" mode
                        return {succeeded: false, errorMsg: i18n.t("errorMessage.fileIO.fileAlreadyExists", {filename: filePath}) as string}; 
                    }
                }
                else{
                    // The file may have not be found, which is a stopper in read mode.
                    // However, in write, append and exclusive creation mode, we can create a file. So we try that first.
                    if(fileObj.mode.v == "r"){
                        return {succeeded: false, errorMsg: i18n.t("errorMessage.fileIO.fileNotFound", {filename: filePath}) as string};
                    }
                    else if(fileObj.mode.v == "w" || fileObj.mode.v == "a" || fileObj.mode.v == "x"){
                        return createEmptyFile(filePath, fileName, useStore().strypeProjectLocation as string).then((fileId) => {
                            // Since the file has been created we can now keep it's fileId in the map:
                            gdFilesMap.push({filePath: filePath, gdFileId: fileId, gdLocationId: useStore().strypeProjectLocation as string, gdReadOnly: false});
                            return {succeeded: true, errorMsg: ""};
                        }, (error) => {
                            return {succeeded: false, errorMsg: error};
                        });
                    }
                }
            },
            (reason) => {
                const errorMsg = i18n.t("errorMessage.fileIO.accessToGDError", {fileName: filePath, error: (typeof reason == "string") ? reason : (reason.status??"unknown")});
                return {succeeded:false,errorMsg: errorMsg};
            })
    );
};

// Handling the closing request of a file from Skulpt. In our Google Drive context, there is nothing special to do
// except cleaning up the file map. (Actual potential writing to the file is handled in Skulpt.)
export const skulptCloseFileIO = (file: SkulptFile): void => {
    const fileEntryIndex = gdFilesMap.findIndex((entry) => entry.filePath == file.name);
    if(fileEntryIndex > -1){
        console.log("Removed #"+fileEntryIndex+" from the file map....");
        gdFilesMap.splice(fileEntryIndex, 1);
    }
};

// This method is only called by the file opening mechanism when a file needs to be created, for example, when opening in write mode.
// The returned promise contains the fileId, or empty in case of error.
const createEmptyFile = (filePath: string, fileName: string, folderId: string): Promise<string> => {
    return googleDriveComponent.writeFileContentForIO("", {filePath: filePath, fileName: fileName, folderId: folderId});
}; 

// Read method, with retrieves the content of a file on Google Drive.
// On failure, the content contains the error message.
// (This method isn't called directly, but it is called by skulptReadPythonLib() in ac-skulpt.ts)
export const skupltReadFileIO = (filePath: string): Promise<string> => {
    // We retrieve the Google Drive file ID - it should be valid as no call to this when a file is closed in Skulpt should happen.
    const fileId = gdFilesMap.find((mapEntry) => mapEntry.filePath == filePath)?.gdFileId??"";
    return new Promise<string>((resolve, reject) => {
        googleDriveComponent.readFileContentForIO(fileId, filePath, (fileContent) => {
            resolve(fileContent);
        }, (error) => {
            reject(error);
        });       
    });
};

// Write method, which doesn't do much actually, it only updates the Skulpt file object's content.
// The *actual* file writing is only perform when a file is closed.
export const skulptWriteFileIO = (fileObj: SkulptFile, toWrite: string): Promise<{succeeded: boolean, errorMsg: string}> => {
    // We retrieve the Google Drive file ID - it should be valid as no call to this when a file is closed in Skulpt should happen.
    const fileId = gdFilesMap.find((mapEntry) => mapEntry.filePath == fileObj.name)?.gdFileId??"";
    return new Promise<{succeeded: boolean, errorMsg: string}>((resolve, reject) => {
        const callWrite = (toWrite: string) => {
            googleDriveComponent.writeFileContentForIO(toWrite, {filePath: fileObj.name, fileId: fileId})
                .then((_) => {
                    resolve({succeeded: true, errorMsg: ""});
                },
                (error) => {
                    reject({succedeed: false, errorMsg: error});
                });
        };

        // Because of having issues doing that from Skulpt, one particular case that does a bit more is for files opened with append mode:
        // since the content is to be appened to the end of the file, we read the file.
        if(fileObj.mode.v == "a"){
            return skupltReadFileIO(fileObj.name).then((fileContent) => callWrite(fileContent+toWrite), (error)=>reject({succedeed: false, errorMsg: error}));
        }
        else{
            callWrite(toWrite);
        }
    });
};

/* eslint-disable @typescript-eslint/explicit-module-boundary-types, no-shadow */

import { readFileContent } from "./common";
import i18n from "@/i18n";
import { StrypeSyncTarget } from "@/types/types";

// Helper containing the methods to be fed to Skulpt to simulate Python's file IO.
// Depending on the location of the Strype project, the file IO works on the clound 
// or on the file system.
// On the cloud, authentication is assumed to be already done, and we work at the project's location.
// On the file system, we need to "interrupt" the workflow with basic file IO from Javascript.
// Since the File System API isn't implemented by all browsers, we go to the most basic approach.

// FileObject wrapper
export class FileObject{
    fileName: string;
    private mode: string;
  private pointer: number;
  private closed: boolean;
  private buffer: string;
  // extra
  private sk: any;

  constructor(filename: string, mode: string, sk: any) {   
      this.fileName = filename;
      this.mode = mode;
      this.pointer = 0;
      this.closed = false;
      this.sk = sk;
      // Buffer is set asynchronously, we just make it empty for now
      this.buffer = "";

      //Retrieve file content:
      document.getElementById("pyIOFileInput")?.click();
  }

  static async create(fileName: string, mode: string, sk: any): Promise<FileObject> {
      const instance = new FileObject(fileName, mode, sk);
      await instance.waitForDocumentEvent("PyFileIOChanged").then((fileContent) => instance.buffer = fileContent,
          (reason) => {
              throw new sk.builtin.IOError("COULD NOT READ FILE, " + reason);
          });
      return instance;
  }

  private waitForDocumentEvent(eventName: string): Promise<string> {

      return  new Promise((resolve, reject) => {
          const handler = (event: Event) => {
              // Clean up listener after firing
              document.removeEventListener(eventName, handler);
              const files = (document.getElementById("pyIOFileInput") as HTMLInputElement)?.files;
              if(files){
                  readFileContent(files[0])
                      .then(
                          (content) => {
                              resolve(content);                                
                          }, 
                          (reason) => reject(reason)
                      );  
              }
              reject("No File found in input");
          };
          document.addEventListener(eventName, handler);
      });
  }

  read(): any {
      if (this.closed) {
          throw new this.sk.builtin.ValueError("I/O operation on closed file.");
      }
      const result = this.buffer.slice(this.pointer);
      this.pointer = this.buffer.length;
      return new this.sk.builtin.str(result);
  }

  close(): any {
      this.closed = true;
      return this.sk.builtin.none.none$;
  }
}


/*
FileObject.prototype.read = function () {
    if (this.closed) {
        throw new this.sk.builtin.ValueError("I/O operation on closed file.");
    }
    const result = this.buffer.slice(this.pointer);
    this.pointer = this.buffer.length;
    return new this.sk.builtin.str(result);
};

// NOTES : write or append; and all actions close the stream (???? it looks like it doesn't within the with... block)
// 2 writes within a with block will be concatenated (because the pointer start at 0 then follow)

FileObject.prototype.write = function (text: any) {
    if (this.closed) {
        throw new this.sk.builtin.ValueError("I/O operation on closed file.");
    }
    const str = text.v || text;  // support Python str or JS string
    this.buffer += str;
    fileSystem[this.filename] = this.buffer;
    return this.sk.builtin.none.none$;
};


FileObject.prototype.write = function (text: any) {
    if (this.closed) {
        throw new this.sk.builtin.ValueError("File already closed."); // check that's useful at all?
    }
    this.closed = true;
    // If we had opened the file as write/append, we need to update it

};

*/

// Wrap it as a Python object
export function makeFileWrapper(fileObj: FileObject, sk: any) {
    return sk.misceval.buildClass({}, function (mod: any) {
        mod.read = new sk.builtin.func(() => fileObj.read());
        //mod.readline = new fileObj.sk.builtin.func(() => fileObj.readline());
        //mod.write = new fileObj.sk.builtin.func((text) => fileObj.write(text));
        //mod.seek = new fileObj.sk.builtin.func((pos) => fileObj.seek(pos));
        mod.close = new sk.builtin.func(() => fileObj.close());
    }, fileObj.fileName, []);
}
