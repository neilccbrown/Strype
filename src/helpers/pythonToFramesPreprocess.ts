import { escapeRegExp } from "lodash";
import { AppSPYFullPrefix } from "@/helpers/spyPrefix";

// The much thinner preprocessing pass for the web-tree-sitter based parser (see
// docs/replace-skulpt-parser/PLAN.md §2). Unlike the old Skulpt-era transformCommentsAndBlanks(),
// this only handles the one genuinely non-Python, Strype-specific syntax that must be stripped
// from the source text *before* parsing: the "#(=> Disabled:" prefix, which is not a standalone
// comment but a prefix in front of a real code line. Everything else that transformCommentsAndBlanks()
// used to handle by disguising as fake identifier statements -- comments (including the
// Library:/LibraryDisabled:/FrameState: directive comments), blank lines, and triple-quoted strings
// -- are real, correctly-positioned nodes in tree-sitter's output, so they're recovered by walking
// the parsed tree afterwards instead (in copyFramesFromPython), not here.
export interface PreprocessResult {
    source: string; // The source text, ready to feed to the tree-sitter parser
    disabledLines: number[]; // One-based line numbers (into `source`) that had a Disabled: prefix
}

// Mirrors the general "#(=> Key: value" directive shape (key is trimmed before comparing,
// matching the old transformCommentsAndBlanks() behaviour) rather than assuming no whitespace
// around "Disabled":
const directiveRegex = new RegExp("^( *)" + escapeRegExp(AppSPYFullPrefix) + "([^:]+):(.*)$");

// NB: this is a naive line-by-line scan and doesn't track triple-quoted string context, unlike
// the old transformCommentsAndBlanks() which suppressed directive matching inside strings. A
// "#(=> Disabled:" that happens to appear as literal text inside a triple-quoted string would be
// (mis)treated as a directive. This matches a corner case flagged during the migration as
// low-value to preserve exactly; revisit if real .spy content is found to hit it.
export function preprocessBeforeParse(codeLines: string[]) : PreprocessResult {
    const disabledLines : number[] = [];
    const outLines = codeLines.map((line, i) => {
        const m = directiveRegex.exec(line);
        if (m && m[2].trim() === "Disabled") {
            disabledLines.push(i + 1);
            return m[1] + m[3];
        }
        return line;
    });
    return { source: outLines.join("\n"), disabledLines };
}
