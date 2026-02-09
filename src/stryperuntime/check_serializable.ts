// All the types in our Pyodide web worker <-> main thread protocol must be serialisable via JSON, so we verify this
// using helpers in this file.
// Typescript can almost do this, but not quite as cleanly as you'd like.  First we give whitelisted
// definitely-serialisable items:
type SerializablePrimitive =
    | string
    | number
    | boolean
    | null
    | undefined;

// We have to blacklist object types because of the way Typescript's types work
// (all of these extend object and hide their properties as native properties/magic, so
// Typescript will think all of its [non-native] properties are serialisable).  A pain,
// but let's list some ones we're likely to try to accidentally send:
type NonSerializableObject =
    | Function
    | Date
    | ImageBitmap
    | OffscreenCanvas
    | Uint8ClampedArray // This is serializable but it serializes as number[] so we should use that type instead    
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

// Checks if type is whitelisted, and if so it's fine, otherwise blacklisted is definitely bad, otherwise
// check if it's an object that all its members are serialisable (which will recurse if necessary).
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

export type IsSerializable<T> = [T] extends [VerifySerializable<T>] ? true : false;
export type Expect<T extends true> = T;
// You can write Expect<IsSerializable<..>> and it will give an error if not serializable.
