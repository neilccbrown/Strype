import Parser from "web-tree-sitter";

// Loaded eagerly at app startup (see main.ts) so parsing is ready immediately when a paste/load
// happens, matching how skulpt.min.js/skulpt-stdlib.js were loaded eagerly before this migration.
// Both .wasm files are vendored under public/js/ (never fetched from a CDN) per the project's
// no-runtime-server-contact-for-JS/wasm principle -- see CLAUDE.md.
const pythonLanguagePromise: Promise<Parser.Language> = (async () => {
    await Parser.init({
        locateFile: () => `${import.meta.env.BASE_URL}js/tree-sitter.wasm`,
    });
    return await Parser.Language.load(`${import.meta.env.BASE_URL}js/tree-sitter-python.wasm`);
})();

export async function getPythonParser(): Promise<Parser> {
    const language = await pythonLanguagePromise;
    const parser = new Parser();
    parser.setLanguage(language);
    return parser;
}

// Kick the load off immediately at module load time (eager, not on first use).
export function startEagerLoad(): void {
    pythonLanguagePromise.catch((err) => {
        console.error("Failed to load tree-sitter Python grammar:", err);
    });
}
