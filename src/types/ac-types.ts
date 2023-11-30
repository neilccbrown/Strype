// Types for the autocomplete.  These are in a separate file because they are imported
// by the process-skulpt-api.ts script, which cannot import the full types.ts file.
export interface AcResultType {
    acResult: string;
    documentation: string;
    type: string;
    version: number;
}

export interface IndexedAcResult extends AcResultType {
    index: number;
}

export interface IndexedAcResultWithModule {
    [module: string]: IndexedAcResult[];
}
export interface AcResultsWithModule {
    [module: string]: AcResultType[];
}
