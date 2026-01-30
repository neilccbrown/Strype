// All the types must be serialisable via JSON, so we verify this:
type SerializablePrimitive =
    | string
    | number
    | boolean
    | null
    | undefined;

// We have to blacklist object types because of the way Typescript's types work...
type NonSerializableObject =
    | Function
    | Date
    | ImageBitmap
    | OffscreenCanvas
    | Blob
    | File
    | Map<any, any>
    | Set<any>
    | WeakMap<any, any>
    | WeakSet<any>
    | Promise<any>;


type NotSerializable<T> = {
    ERROR: "Type is not serializable";
    TYPE: T;
};

type VerifySerializable<T> =
    T extends SerializablePrimitive
        ? T
        : T extends readonly (infer U)[]
            ? VerifySerializable<U>[]
            : T extends NonSerializableObject
                ? NotSerializable<T>
                : T extends object
                    ? {
                        [K in keyof T]: VerifySerializable<T[K]>
                    }
                    : NotSerializable<T>;

type IsSerializable<T> = [T] extends [VerifySerializable<T>] ? true : false;
type Expect<T extends true> = T;

// Ideally we'd have a separate function for each request, but it's
// a pain to try to proxy multiple functions between the threads, so
// we combine it all into one mega function:
export type StrypePyodideWorkerRequestInput =
    | { request: "loadImage"; url: string }
    | { request: "loadLibraryAsset"; libraryShortName: string; fileName: string }
    | { request: "makeOffscreenCanvas"; width: number; height: number }
    | { request: "canvas_drawImagePart"; dest: RemoteCanvas, src : RemoteImage | RemoteCanvas, dx : number, dy : number, sx : number, sy : number, sw: number, sh : number, scale : number }
    | { request: "canvas_clearRect"; img: RemoteCanvas, x: number; y: number; width: number; height: number }
    | { request: "canvas_setFill"; img: RemoteCanvas, fill: string }
    | { request: "canvas_setStroke"; img: RemoteCanvas, stroke: string }
;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type CheckStrypePyodideWorkerRequestInput = Expect<IsSerializable<StrypePyodideWorkerRequestInput>>;

// Make a type like a number but not assignable to number (or each other)
// to avoid confusion between handle types and passing numbers:
type Handle<B extends string> = { handleKind: B, handle: number };
export type ImageHandle = Handle<"Image">;
export type CanvasHandle = Handle<"Canvas">;
// A PersistentImage is used for anything that needs rendering, i.e. actors but also backgrounds, say bubbles.
export type PersistentImageHandle = Handle<"PersistentImage">;

export function makeImageHandle(n: number): ImageHandle {
    return {handle: n, handleKind: "Image"};
}
export function makeCanvasHandle(n: number): CanvasHandle {
    return {handle: n, handleKind: "Canvas"};
}
export function makePersistentImageHandle(n: number): PersistentImageHandle {
    return {handle: n, handleKind: "PersistentImage"};
}

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

export type StrypePyodideWorkerRequestOutput = {
    loadImage: RemoteImage;
    loadLibraryAsset: string | undefined;
    makeOffscreenCanvas: RemoteCanvas;
    canvas_drawImagePart: undefined; // Really, void, but we can't have that type here
    canvas_clearRect: undefined; // Really, void, but we can't have that type here
    canvas_setFill: undefined; // Really, void, but we can't have that type here
    canvas_setStroke: undefined; // Really, void, but we can't have that type here
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type CheckStrypePyodideWorkerRequestOutput = Expect<IsSerializable<StrypePyodideWorkerRequestOutput>>;

export type StrypePyodideHandlerFunctionSync = <K extends StrypePyodideWorkerRequestInput["request"]>(
    req: Extract<StrypePyodideWorkerRequestInput, { request: K }>
) => StrypePyodideWorkerRequestOutput[K];


export type StrypePyodideHandlerFunctionAsync =
    (req: StrypePyodideWorkerRequestInput) => Promise<
        StrypePyodideWorkerRequestOutput[StrypePyodideWorkerRequestInput["request"]]
    >;

export type StrypePyodideHandlerFunctionVoid = (req: StrypePyodideWorkerRequestInput) => void;

// These updates are sent from the Pyodide-thread PersistentImageManager to the renderer so it can render the state when it wants
export type StrypePersistentImageStateUpdate =
    | {request: "clear"}
    | {request: "add", id: PersistentImageHandle, x: number, y: number, rotation: number, scale: number, image: ImageHandle | CanvasHandle}
    | {request: "remove", id: PersistentImageHandle}
    | {request: "update", id: PersistentImageHandle, x: number, y: number, rotation: number, scale: number, image: ImageHandle | CanvasHandle}
;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type CheckStrypePersistentImageStateUpdate = Expect<IsSerializable<StrypePersistentImageStateUpdate>>;
