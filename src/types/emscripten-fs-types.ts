// This file is an AI-generated Typescript types for Emscripten's filesystem types (which have no publicly available type)
// Emscripten underpins Pyodide, so these are the file system hooks we have to provide for Pyodide.

import {CloudFileId, CloudFileOrDirHandle, CloudStreamHandle} from "@/stryperuntime/worker_bridge_type";

export interface FSNode {
    id: number;
    name: string;
    mode: number;
    parent: FSNode | null;
    mount: any;
    node_ops: any;
    stream_ops: any;
    size?: number;
    contents?: Uint8Array;
    // These are not part of Emscripten's type but we add them and use them:
    strypeCloudFileId: CloudFileId;
    //strypeCloudCachedChildren: Map<string, CloudFileOrDirHandle>;
}

export interface FSStream {
    node: FSNode;           // the file/directory node
    position: number;       // current file pointer (seek position)
    flags: number;          // O_RDONLY | O_WRONLY | O_RDWR etc.
    mode: number;           // permission bits
    seekable: boolean;
    isTTY?: boolean;        // for device streams
    error?: number;         // errno if stream fails
    
    // optional custom data can go here
    [key: string]: any;
}


export interface FSNodeOps {
    getattr(node: FSNode): any;
    lookup(parent: FSNode, name: string): FSNode;
    mknod(parent: FSNode, name: string, mode: number, dev: number): FSNode;
    unlink(parent: FSNode, name: string): void;
    readdir(node: FSNode): string[];
}

export interface FSStreamOps {
    open(stream: FSStream): void;
    read(
        stream: FSStream,
        buffer: Uint8Array,
        offset: number,
        length: number,
        position: number
    ): number;
    write(
        stream: FSStream,
        buffer: Uint8Array,
        offset: number,
        length: number,
        position: number
    ): number;
    close(stream: FSStream): void;
}

export interface EmscriptenFileSystemPlugin {
    mount(mount: any): FSNode;
    createNode(
        parent: FSNode | null,
        name: string,
        mode: number,
        dev: number
    ): FSNode;
    node_ops: FSNodeOps;
    stream_ops: FSStreamOps;
}
