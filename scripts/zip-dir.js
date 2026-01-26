import fs from "fs";
import path from "path";
import archiver from "archiver";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function zipDir({ rootDir, subdirs, outFile }) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });

    const output = fs.createWriteStream(outFile);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);

    for (const dir of subdirs) {
        const fullPath = path.join(rootDir, dir);
        archive.directory(fullPath, dir);
    }

    // wrap in a promise to await both close and any errors
    await new Promise((resolve, reject) => {
        output.on("close", resolve);
        archive.on("error", reject);
        archive.finalize().catch(reject);
    });
}

