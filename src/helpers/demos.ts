import * as yaml from "js-yaml";
import { z } from "zod";
import {getFileFromLibraries} from "@/helpers/libraryManager";

export interface Demo {
    name: string;
    description: string | undefined;
    // Data URL for third-party, normal URL for our own built-in [trusted] demos:
    image: {dataURL: Promise<string | undefined>} | {imgURL: string | undefined};
    // A function which will asynchronously fetch the SPY file content:
    demoFile: () => Promise<string | undefined>;
}
// Repretentation in YAML:
const DemoSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    image: z.string().min(1).optional(),
    file: z.string().min(1),
});

const DemosSchema = z.array(DemoSchema);

export interface DemoGroup {
    name: string;
    demos: Promise<Demo[]>;
}

// Looks for demos in a given library path (see getFileFromLibraries)
// and returns them; will be an empty list inside if the library has no demos
export function getThirdPartyLibraryDemos(library: string) : DemoGroup {
    return {
        name: "Library " + library,
        demos: getFileFromLibraries([library], "demos/index.yaml").then((r) => {
            if (r != null) {
                if (r.mimeType == null || r.mimeType.startsWith("text")) {
                    // Convert to UTF8 text:
                    const text = new TextDecoder("utf-8").decode(r.buffer);
                    const rawData = yaml.load(text);
                    const demosYAML = DemosSchema.parse(rawData);
                    // We then need to fetch the images:
                    const demos = [];
                    for (const y of demosYAML) {
                        demos.push({
                            name: y.name,
                            description: y.description,
                            image: {dataURL: y.image ? getFileFromLibraries([library], new URL(y.image, "demos/").toString()).then((imgResp) => {
                                // Only allow bitmap images; SVG+XML might have Javascript inside, which we wouldn't want to run:
                                if (!imgResp?.mimeType || !["image/png", "image/jpeg", "image/webp"].includes(imgResp?.mimeType)) {
                                    return undefined;
                                }
                                const binary = String.fromCharCode(...new Uint8Array(imgResp.buffer));
                                const base64 = btoa(binary);
                                const type = imgResp.mimeType;
                                return `data:${type};base64,${base64}`;
                            }) : Promise.resolve(undefined)},
                            demoFile: () => getFileFromLibraries([library], new URL(y.file, "demos/").toString()).then((spyResp) => {
                                if (r.mimeType == null || r.mimeType.startsWith("text")) {
                                    // Convert to UTF8 text:
                                    return new TextDecoder("utf-8").decode(r.buffer);
                                }
                                else {
                                    return undefined;
                                }
                            }),
                        });
                    }
                    return demos;
                }
            }
            return [];
        }),
    };
}

// Gets built-in demos from a given subdirectory
export async function getBuiltinDemos(subdirectory: string) : Promise<Demo[]> {
    const dirSlash = `./demos/${subdirectory}/`;
    const text = await (await fetch(`${dirSlash}index.yaml`)).text();
    const rawData = yaml.load(text);
    const demosYAML = DemosSchema.parse(rawData);
    const demos = [] as Demo[];
    for (const y of demosYAML) {
        demos.push({
            name: y.name,
            description: y.description,
            image: {imgURL: y.image ? dirSlash + y.image : undefined},
            demoFile: () => fetch(dirSlash + y.file).then((res) => res.text()),
        });   
    }
    return demos;
}

