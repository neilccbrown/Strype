// Types for the autocomplete.  These are in a separate file because they are imported
// by the process-skulpt-api.ts script, which cannot import the full types.ts file.
export interface AcResultType {
    // The text of the result, like "len" or "upper" or "time:
    acResult: string;
    // The documentation of the result, or empty string if unavailable
    documentation: string;
    // In Python, one name might have many "types", e.g. str is a type and function,
    // so we use a list of types.
    // Empty list means unknown.  
    type: ("function" | "module" | "variable" | "type")[];
    // The version.  Only used on microbit to distinguish v2 and v3:
    version: number;
}

export interface IndexedAcResult extends AcResultType {
    index: number;
}

// A category can be "Python" for built-in items, it can be a module
// name (like "time" or "microbit") for things imported from a module,
// or it can be "My Variables" or "My Functions" (or the translation thereof)

export interface IndexedAcResultWithCategory {
    [category: string]: IndexedAcResult[];
}
export interface AcResultsWithCategory {
    [category: string]: AcResultType[];
}
