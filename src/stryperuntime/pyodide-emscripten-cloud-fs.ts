// This file provides an interface to Emscripten's file system that forwards all the messages to our main
// thread via our communication protocols in worker_bridge_type.  The actual implementation of handling
// these methods is in main_thread_python_handler.ts

import {EmscriptenFileSystemPlugin, FSNode, FSNodeOps, FSStream, FSStreamOps} from "@/types/emscripten-fs-types";
import {syncBridge} from "@/workers/python_execution_type";
import {PyodideAPI} from "pyodide";
import {CloudStreamHandle, decodeStringToUint8} from "@/stryperuntime/worker_bridge_type";

// Gets full file path by stitching together all parent paths:
function getFullFilePath(node: FSNode) : string {
    let s = node.name;
    // The root of the file system has its parent as itself, so stop there:
    if (node.parent && node.parent != node) {
        s = getFullFilePath(node.parent) + s;
    }
    return s;
}

// Pyodide/Emscripten doesn't expose these constants so we must replicate them here:
const S_IFDIR = 0o040000;

// Note that this function is run during Pyodide initialisation and should not actually contact the cloud, yet,
// nor make any syncBridge/asyncBridge calls directly.  All of that should only happen when the file system is
// actually accessed during the user's Python execution.
export function getFSForEmscripten(pyodide: PyodideAPI) : EmscriptenFileSystemPlugin {
    // TODO supply different ops for files and directories
    const STREAM_OPS : FSStreamOps = {
        open(stream: FSStream) {
            // As I understand it, this is the main open call.  What I found confusing is that it takes a FSStream and
            // returns void, where I had expected that it would take a path and a mode, and return an FSStream.  But
            // Pyodide (via Emscripten) has already made the FSStream, given it an id, copied the requested mode from
            // the user's Python open() call.
            syncBridge({request: "file_open", flags: stream.flags, id: stream.node.strypeCloudFileId});
        },
        read(stream: FSStream, buffer: Uint8Array, offset: number, length: number, position: number): number {
            const content = decodeStringToUint8(syncBridge({request: "file_read", id: stream.node.strypeCloudFileId, from: position, length, filePath: getFullFilePath(stream.node)}));
            buffer.set(content, offset);
            return content.length;
        },
        close(stream: FSStream) {
            syncBridge({request: "file_close", id: stream.node.strypeCloudFileId});
        },
        // TODO add write support
    };
    const NODE_OPS : FSNodeOps = {
        lookup(parent: FSNode, name: string): FSNode {
            const r = syncBridge({request: "file_lookup", parent: parent.strypeCloudFileId, name});
            console.log("Looked up " + name + ", got: ", JSON.stringify(r));
            const node = pyodide.FS.createNode(parent, name, (r.isDir ? S_IFDIR : 0) | 0o777, 0);
            node.strypeCloudFileId = r.fileId;
            if (r.isDir) {
            }
            else {
                node.node_ops = NODE_OPS;
                node.stream_ops = STREAM_OPS;
            }
            return node;
        },
        /* TODO
        mknod(parent: FSNode, name: string, mode: number, dev: number): FSNode {
            const fileId = syncBridge({request: "file_createNode", parent: parent.strypeCloudFileId, name, mode, dev});
            const node = pyodide.FS.createNode(parent, name, mode, dev);
            node.strypeCloudFileId = fileId;
            return node;
        },
         */
        // TODO the rest
    };
    
    
    return {
        mount(mount) {
            // Although we are mounted at /cloud, within our own file system it is "/"
            // so we must give that as the root node:
            const root : FSNode = pyodide.FS.createNode(null, "/", S_IFDIR | 0o777, 0);
            root.mount = mount;
            // I know this looks weird but apparently to denote the root node of a file system,
            // Emscripten uses the fact that the root's parent is itself:
            root.parent = root;
            root.strypeCloudFileId = syncBridge({request: "file_getRoot"});
            root.node_ops = NODE_OPS;
            return root;
        },
        createNode(parent: FSNode | null, name: string, mode: number, dev: number): FSNode {
            const node = pyodide.FS.createNode(parent, name, mode, dev);
            // Note that this doesn't actually make a file, it just makes an FSNode
            // object that reflects an existing file.
            // Making a file/directory is done by mknod in the node ops.
            // TODO set different ops for files and directories:
            node.node_ops = NODE_OPS;
            node.stream_ops = STREAM_OPS;
            return node;
        },
        node_ops: NODE_OPS,
        stream_ops: STREAM_OPS,
    };
}
