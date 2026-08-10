import type Parser from "web-tree-sitter";

type SyntaxNode = Parser.SyntaxNode;

// Recovers blank lines and comments from a parsed tree-sitter block, per
// docs/replace-skulpt-parser/PLAN.md §2's "derive post-parse" design: unlike Skulpt (which drops
// comments/blanks entirely, requiring them to be disguised as fake statements before parsing and
// decoded back out afterwards), tree-sitter's comment nodes appear in the tree at their real
// source position (confirmed by the migration's spike: plain node.children -- no special cursor
// needed -- already includes them interleaved with statements in source order), and blank lines
// show up as row gaps between consecutive children.
//
// A BlockItem is either a real child node (a statement or a comment) or a synthesized blank-line
// marker for a gap in row numbers between two children (or between `afterRow` and the first child,
// or between the last child and `beforeRow`, if given).
export type BlockItem =
    | { kind: "node"; node: SyntaxNode }
    | { kind: "blank"; count: number; startRow: number };

// `afterRow` is the (zero-based) row immediately before this block's content is expected to start
// -- typically the row of the compound statement's own header (e.g. the "if x:" line), so a blank
// line right after the colon is detected. `beforeRow`, if given, is the row immediately after this
// block's content is expected to end -- e.g. the row of a following "elif"/"else"/"except" clause,
// so a blank line right before a joint continuation is still attributed to this block rather than
// silently dropped (tree-sitter's own block node has no way to know about that following sibling on
// its own, since it only spans its own statements).
export function getBlockItems(containerNode: SyntaxNode, afterRow: number, beforeRow?: number) : BlockItem[] {
    const items: BlockItem[] = [];
    let prevEndRow = afterRow;
    for (let i = 0; i < containerNode.childCount; i++) {
        const child = containerNode.child(i) as SyntaxNode;
        const gap = child.startPosition.row - prevEndRow - 1;
        if (gap > 0) {
            items.push({kind: "blank", count: gap, startRow: prevEndRow + 1});
        }
        items.push({kind: "node", node: child});
        prevEndRow = child.endPosition.row;
    }
    if (beforeRow !== undefined) {
        const gap = beforeRow - prevEndRow - 1;
        if (gap > 0) {
            items.push({kind: "blank", count: gap, startRow: prevEndRow + 1});
        }
    }
    return items;
}
