/*
 The architecture in Strype for execution is as follows.  There are two "threads": the main thread and the Pyodide web worker thread.
 The communication from the main thread to Pyodide is generally very limited: it starts execution, and may interrupt it.
 The communication is almost entirely from the Pyodide worker to the main thread.
 
 There are two main ways to communicate from Pyodide to main thread:
   - Synchronous communication (Pyodide web worker sends request, then waits for an answer, blocking Pyodide execution)
   - Asynchronous communication (Pyodide web worker sends request, but doesn't wait for an answer because one isn't needed).

 The particular issue in our situation is that Sync communication sends its reply via a service worker (which is a hack, but because it's
 the only way to block on waiting for a message in non-async code) and is very slow.  It can take 1-2 milliseconds, which is
 a lot if you want performance (you can only do maybe 20 such calls per animation frame if you are aiming for 30 frames per second).
 So ideally we want to use Async communication whenever we can.   
 
 Thankfully, most calls can be done Async.  If you want to draw a line on a canvas, you don't need a response or for it to happen immediately,
 as long as the requests remain ordered.  So if you say "draw line, draw circle", it can happen later just so long as the circle
 is drawn after the line.  The only calls that strictly need to be Sync are those which send a meaningful reply.  Two obvious cases
 are loading sounds and loading images.  So they are Sync.
 
 A potentially troublesome pair of commands are reading pixel values or reading sound values.  They need a reply, but if 
 we do it one request at a time (users will usually do many such reads in a loop) it's potentially very slow.  So it's
 actually quicker that we do one Sync call to cache the entire set of values, rather than one Sync call per individual
 value.  If the user sets an individual value we can update the cache and send an Async update to the main thread.  The
 only awkward case is if the user does a complex operation (e.g. a draw circle) which means we will need to discard cache.
 But it seems rarer that they will do a lot of "draw a shape, read a pixel" in alternation.
 
 There is a similar case for checking if keys are pressed.  We cache the full set of pressed keys for a limited time, then
 discard the cache and fetch it again. 

 So: below there are protocols for Sync messages (and their return value) and Async messages.  Note that we keep
 sprite updates (which use a dedicated channel) separate from other graphics/sound APIs to keep organisation neater.
 
 The Sync and Async channels can only support a limited number of primitive types to be sent, so we enforce that using
 a bit of Typescript magic (the Expect<IsSerializable<...>> lines). 
 */

// Ideally we'd have a separate function for each request, but it's
// a pain to try to proxy multiple functions between the threads, so
// we combine it all into one mega function with a request data type.
// All of these have a corresponding entry in SyncStrypePyodideWorkerResponse, below.
import { Expect, IsSerializable } from "@/stryperuntime/check_serializable";

export type SyncStrypePyodideWorkerRequest =
    | { request: "loadImage"; url: string }
    | { request: "loadLibraryAsset"; libraryShortName: string; fileName: string }
    | { request: "makeOffscreenCanvas"; width: number; height: number }
    | { request: "getPressedKeys"}
    | { request: "loadSound"; url: string }
;

// All types above should map into this type:
export type SyncStrypePyodideWorkerResponse =
    | { request: "loadImage"; response: RemoteImage;}
    | { request: "loadLibraryAsset"; response: string | undefined; }
    | { request: "makeOffscreenCanvas"; response: RemoteCanvas; }
    | { request: "getPressedKeys"; response: {[key: string]: boolean} }
    | { request: "loadSound"; response: RemoteSound;}
;

// Wraps the response field of a type in a promise:
type PromisedResponse<T> = T extends {request: infer REQ; response: infer RESP } ? {request: REQ; response: Promise<RESP>} : never;

export type AsyncStrypePyodideWorkerRequest =
    | { request: "canvas_drawImagePart"; dest: RemoteCanvas, src : RemoteImage | RemoteCanvas, dx : number, dy : number, sx : number, sy : number, sw: number, sh : number, scale : number }
    | { request: "canvas_clearRect"; img: RemoteCanvas, x: number; y: number; width: number; height: number }
    | { request: "canvas_drawRect"; img: RemoteCanvas, x: number; y: number; width: number; height: number }
    | { request: "canvas_drawArc"; img: RemoteCanvas, x: number; y: number; width: number; height: number; angleStartRad: number; angleDeltaRad: number; }
    | { request: "canvas_drawLine"; img: RemoteCanvas, x: number; y: number; x2: number; y2: number }
    | { request: "canvas_drawPolygon"; img: RemoteCanvas, xyPairs: number[][] }
    | { request: "canvas_setFill"; img: RemoteCanvas, fill: string }
    | { request: "canvas_setStroke"; img: RemoteCanvas, stroke: string }
    | { request: "canvas_drawPixels", img: RemoteCanvas, x: number; y: number; width: number; height: number; pixelRGBA: Uint8ClampedArray }
    | { request: "startSound"; sound: RemoteSound }
;

// These are not used so we need to disable warnings, but they give errors if we've messed up above and tried
// to send a type we are not allowed to send:
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type CheckSyncStrypePyodideWorkerRequest = Expect<IsSerializable<SyncStrypePyodideWorkerRequest>>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type CheckSyncStrypePyodideWorkerResponse = Expect<IsSerializable<SyncStrypePyodideWorkerResponse>>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type CheckAsyncStrypePyodideWorkerRequest = Expect<IsSerializable<AsyncStrypePyodideWorkerRequest>>;

// A Handle type which is used to refer to something on the other thread using a simple number
// (typically an index into an array).  We also need to store the type of the handle because:
//   (a) sometimes we need to dynamically distinguish, e.g. CanvasHandle vs ImageHandle
//   (b) it also stops us accidentally sending e.g. an ImageHandle when a SpriteHandle is expected.
type Handle<B extends string> = { handleKind: B, handle: number };
export type ImageHandle = Handle<"Image">;
export type CanvasHandle = Handle<"Canvas">;
export type SoundHandle = Handle<"Sound">;
// A Sprite is used for anything that needs rendering, i.e. actors but also backgrounds, say() bubbles.
export type SpriteHandle = Handle<"Sprite">;

// Simple constructor functions:
export function makeImageHandle(n: number): ImageHandle {
    return {handle: n, handleKind: "Image"};
}
export function makeCanvasHandle(n: number): CanvasHandle {
    return {handle: n, handleKind: "Canvas"};
}
export function makeSoundHandle(n: number): SoundHandle {
    return {handle: n, handleKind: "Sound"};
}
export function makeSpriteHandle(n: number): SpriteHandle {
    return {handle: n, handleKind: "Sprite"};
}

// Sometimes we store not only the handle for the remote item, but also cache some other
// useful information which can never change.  E.g. images cannot change size after creation
// so if we cache the width and height we can answer get_width() without needing to ask the other thread.
// Similarly for sounds with their length and sample rate.
export type RemoteImage = {
    handle: ImageHandle;
    width: number;
    height: number;
};

export type RemoteCanvas = {
    handle: CanvasHandle;
    width: number;
    height: number;
};

export type RemoteSound = {
    handle: SoundHandle;
    sampleRate: number;
    numSamples: number;
};

export type ResponseFor<R extends SyncStrypePyodideWorkerRequest> =
    Extract<
        SyncStrypePyodideWorkerResponse,
        { request: R["request"] }
    >

// This is the type of a standard function which takes a Sync request and directly returns the response
// This is used on the Pyodide thread as the handler for such requests, as it looks "normal" (no promises etc)
// even though under the hood it will use messaging to the other thread
export type SyncStrypePyodideHandlerFunction = <R extends SyncStrypePyodideWorkerRequest> (req: R) => ResponseFor<R>;

// This is the type of the function on the main thread, which usually deals with the requests by
// doing some async work and returning a promise with the result.
export type SyncPromiseStrypePyodideHandlerFunction = (req: SyncStrypePyodideWorkerRequest) => PromisedResponse<SyncStrypePyodideWorkerResponse>;

export type AsyncStrypePyodideHandlerFunction = (req : AsyncStrypePyodideWorkerRequest) => void;

// These updates are sent from the Pyodide-thread SpriteManager to the renderer so it can render the sprite state when it wants.
// Note that this is separate to the image drawing calls, so it is possible that the user could do e.g.
//   move actor position, draw circle on actor image 
// and then see it with the circle position but without the moved position.  However, this would only typically be for one animation frame
// before it catches up, so I don't think it matters particularly.  We could revisit the design if it becomes a problem in practice
export type StrypeSpriteStateUpdate =
    | {request: "clear"}
    | {request: "add", id: SpriteHandle, x: number, y: number, rotation: number, scale: number, image: ImageHandle | CanvasHandle}
    | {request: "remove", id: SpriteHandle}
    | {request: "update", id: SpriteHandle, x: number, y: number, rotation: number, scale: number, image: ImageHandle | CanvasHandle}
;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type CheckStrypeSpriteStateUpdate = Expect<IsSerializable<StrypeSpriteStateUpdate>>;
