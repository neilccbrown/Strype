import {StrypeLayoutDividerSettings, StrypePEALayoutMode} from "@/types/types";

export function saveDivider(divider: StrypeLayoutDividerSettings | undefined) : string | undefined {
    if (divider === undefined) {
        return undefined;
    }
    const obj: Record<string, number> = {};
    Object.entries(divider).forEach(([key, value]) => {
        if (value !== undefined) {
            obj[key] = Math.round(value * 100) / 100; // round to 2 decimals
        }
    });
    return JSON.stringify(obj);    
}

export function loadDivider(json: string | undefined): StrypeLayoutDividerSettings | undefined {
    if (json === undefined) {
        return undefined;
    }
    const obj = JSON.parse(json) as Record<string, number>;
    const map = {} as StrypeLayoutDividerSettings;
    Object.entries(obj).forEach(([key, value]) => {
        const enumKey = StrypePEALayoutMode[key as keyof typeof StrypePEALayoutMode];
        if (value !== undefined) {
            map[enumKey] = value;
        }
    });
    return map;
}
