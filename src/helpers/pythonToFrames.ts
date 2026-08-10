import { AllFrameTypesIdentifier, BaseSlot, CaretPosition, CollapsedState, ContainerTypesIdentifiers, CurrentFrame, EditorFrameObjects, FrameObject, getFrameDefType, isFieldBaseSlot, isFieldBracketedSlot, isFieldStringSlot, LabelSlotsContent, SlotsStructure, StringSlot, MessageDefinitions, FormattedMessage, FormattedMessageArgKeyValuePlaceholders, FrozenState } from "@/types/types";
import {useStore} from "@/store/store";
import {checkCodeErrors} from "@/helpers/storeMethods";
import {CustomEventTypes, getLastCaretPosInsideParent, operators, trimmedKeywordOperators} from "@/helpers/editor";
import i18n from "@/i18n";
import {cloneDeep, escapeRegExp} from "lodash";
import {AppName, AppSPYFullPrefix, eventBus, projectDocumentationFrameId} from "@/helpers/appContext";
import {stringToCollapsed, stringToFrozen} from "@/parser/parser";
import {nextTick} from "vue";
import type Parser from "web-tree-sitter";
import {nodeToSlots, flattenChildren, UnsupportedConstructError} from "@/helpers/pythonToFramesExpr";
import {getBlockItems} from "@/helpers/pythonToFramesBlockWalk";
import {preprocessBeforeParse} from "@/helpers/pythonToFramesPreprocess";
import {getPythonParserSync} from "@/helpers/treeSitterPython";

type TSSyntaxNode = Parser.SyntaxNode;

const TOP_LEVEL_TEMP_ID = -999;

// These regexes are used to find triple single quotes strings within Strype's slots.
// Once parsed to frames, such strings will be created as single or double quoted literals in Strype,
// and the 2 remaining single or double quotes are included at the start and the end of the literal.
// Therefore, we look for the string content starting with '' or "" and finishing with '' or "".
const parsedTripleSingleQuotesStrRegex = /^''.*''$/s, parsedTripleDoubleQuotesStrRegex = /^"".*""$/s;


// Type for the things we get from the Skulpt parser:
export interface ParsedConcreteTree {
    type: number;
    value: null | string;
    lineno? : number;
    //col_offset?: number;  -- Don't use this as it seems to have surprising values
    children: null | ParsedConcreteTree[];
}
// The state passed around while copying from Python code into frames
interface CopyState {
    nextId: number; // The next ID to use for a new frame
    lastLineProcessed: number | undefined; // The number of the last line we processed
    addToJoint: number[] | undefined; // List to add frames to
    addToNonJoint: number[]; // List to add frames to
    loadedFrames: EditorFrameObjects; // Map to put all loaded frames into
    parent: FrameObject | null; // The parent, if any, for borrowing the parent ID
    jointParent: FrameObject | null; // The joint parent, if any, for borrowing the parent ID
    disabledLines: number[]; // The line numbers which had a Disabled: prefix
    frameStateLines: Map<number, SavedFrameState>; // The line numbers which had a Collapsed: prefix
    lineNumberToIndentation: Map<number, string>; // Maps a line number to a string of indentation
    transformTopComment: ((content: SlotsStructure) => void) | undefined; // If defined, consumes the top docstring-style comment rather than adding it as a frame.
    isSPY: boolean;
}

// Declare Skulpt:
declare const Sk: any;

// The different "locations" in Strype 
export enum STRYPE_LOCATION {
    UNKNOWN,
    PROJECT_DOC_SECTION,
    MAIN_CODE_SECTION,
    IN_FUNCDEF,
    IN_CLASSDEF,
    DEFS_SECTION,
    IMPORTS_SECTION
}

// Copies nextId and lastLineProcessed from src to dest
function updateFrom(dest : CopyState, src : CopyState) {
    dest.nextId = src.nextId;
    dest.lastLineProcessed = src.lastLineProcessed;
}

// Simplifies a tree (by collapsing all single-child nodes into the child) in order to make
// it easier to read while debugging error messages
function debugToString(p : ParsedConcreteTree, curIndent: string) : string {
    let s = curIndent + (Sk.ParseTables.number2symbol[p.type] || ("#" + p.type));
    if (p.value) {
        s += " {{" + p.value + "}}";
    }
    if (p.children != null && p.children.length > 0) {
        s += ":\n";
        for (const child of p.children) {
            s += debugToString(child, curIndent + "  ");
        }
        return s;
    }
    else {
        return s + "\n";
    }
}

// Given a frame, assigns it a new ID and adds it to the list specified in the CopyState
// If it is not a joint frame, set its parent.
function addFrame(frame: FrameObject, lineno: number | undefined, s: CopyState) : CopyState {
    const id = s.nextId;
    frame.id = id;
    s.loadedFrames[id] = frame;
    frame.isDisabled = lineno != undefined && s.disabledLines.includes(lineno);
    frame.collapsedState = lineno != undefined ? s.frameStateLines.get(lineno)?.collapsed : undefined;
    frame.frozenState = lineno != undefined ? s.frameStateLines.get(lineno)?.frozen : undefined;
    if (!frame.frameType.isJointFrame) {
        s.addToNonJoint?.push(id);
        if (s.parent != null) {
            frame.parentId = s.parent.id;
            // Don't need to add to children because that will already be the addTo array
        }
        else {
            // The pasting code relies on parent being set to non-zero for non-joint frames,
            // so we just set it to an invalid integer:
            frame.parentId = TOP_LEVEL_TEMP_ID;
        }
    }
    else {
        s.addToJoint?.push(id);
        if (s.jointParent) {
            frame.jointParentId = s.jointParent.id;
        }
    }
    return {...s, nextId: s.nextId + 1, lastLineProcessed: lineno};
}

// Makes a basic frame object with the given type and slots, and dummy/default values for all other fields
function makeFrame(type: string, slots: { [index: number]: LabelSlotsContent}, isSPY: boolean) : FrameObject {
    // We have one special case to consider before "pushing" the frame: we left all triple quotes string
    // being parsed as is by Skulpt. That means that all of them will be put inside a string slot, 
    // either wrappped by a single quote token with literal content starting and ending by <''>, 
    // or wrapped by a double quote token with literal content starting and ending by <"">.
    // If such slot is found in SPY or, for Python, is inside a function call frame that ONLY contains it
    // (i.e. empty slots on the sides and empty operators between) then we transform the frame to a multi lines comment frame.
    // Otherwise, for Python only since SPY wouldn't have that situation, we fix the quotes by removing the extra quotes inside
    // the literal, and replace all line breaks by explicit line break indications ("\\n").
    if(type == AllFrameTypesIdentifier.funccall && slots[0].slotStructures.fields.length == 3 
        && isFieldStringSlot(slots[0].slotStructures.fields[1]) 
        && ((slots[0].slotStructures.fields[1].quote == "'" && parsedTripleSingleQuotesStrRegex.test(slots[0].slotStructures.fields[1].code))
            || (slots[0].slotStructures.fields[1].quote == "\"" && parsedTripleDoubleQuotesStrRegex.test(slots[0].slotStructures.fields[1].code)))
        && isFieldBaseSlot(slots[0].slotStructures.fields[0]) && isFieldBaseSlot(slots[0].slotStructures.fields[2])
        && (slots[0].slotStructures.fields[0] as BaseSlot).code.length == 0 && (slots[0].slotStructures.fields[2] as BaseSlot).code.length == 0
    ){
        // A multilines comment is detected, we transform the frame.
        const stringFieldContent = (slots[0].slotStructures.fields[1] as BaseSlot).code;
        // When we save these items we add extra escapes to all the quotes and backslashes, so we must reverse that here: 
        slots[0].slotStructures.fields.splice(0, 3, {code: stringFieldContent.slice(2,-2)
            .replaceAll(STRYPE_DOC_NEWLINE, "\n")
            .replaceAll("\\'", "'")
            .replaceAll("\\\"", "\"")
            .replaceAll("\\\\", "\\"),
        });
        slots[0].slotStructures.operators.splice(0);
        type = AllFrameTypesIdentifier.comment;
    }
    else if(!isSPY){
        // Replace any potential triple quotes strings to single quote strings (and replaced line breaks)
        transformTripleQuotesStrings(slots);
    }
    return {
        frameType : getFrameDefType(type),
        caretVisibility: CaretPosition.none,
        childrenIds: [],
        id: -100, // Will be set during addFrame
        collapsedState: CollapsedState.FULLY_VISIBLE,
        isDisabled: false,
        isSelected: false,
        isVisible: true,
        jointFrameIds: [],
        jointParentId: 0,
        labelSlotsDict: slots,
        parentId: 0,
        runTimeError: "",
    };
}

// Same joint-frame gluing trick that the old, now-deleted Skulpt-based parseWithSkulpt() used, ported to build a plain codeLines
// array (rather than mutating one in place with embedded "\n"s, which parseWithSkulpt's version
// does -- that's harmless for Skulpt's Sk.parse(codeLines.join("\n")) call, since it just produces
// harmless extra blank lines, but tree-sitter is far more literal about row positions, so this
// version is careful to add exactly 2 (elif) or 4 (else/except/finally) real lines, matching the
// "2 lines per fake-parent unit" assumption used by the line-offset math in parseWithTreeSitter()
// below): parser-agnostic in principle, kept as a separate copy rather than shared code because
// parseWithSkulpt() is deleted once this migration's cutover is complete.
function glueJointFrameHeader(codeLines: string[]) : { codeLines: string[], addedFakeJoinParent: number } {
    let addedFakeJoinParent = 0;
    const firstNonBlank = codeLines.find((l) => l.trim() != "");
    if (firstNonBlank) {
        const leadingIndent = firstNonBlank.replace(/[^ ].*/, "");
        const firstWord = firstNonBlank.replace(/[^a-z].*/, "").trim();
        switch (firstWord) {
        case "elif":
            codeLines = [leadingIndent + "if True:", leadingIndent + "    pass", ...codeLines];
            addedFakeJoinParent = 1;
            break;
        case "else":
        case "except":
        case "finally":
            codeLines = [leadingIndent + "try:", leadingIndent + "    pass", leadingIndent + "except:", leadingIndent + "    pass", ...codeLines];
            addedFakeJoinParent = 2;
            break;
        }
    }
    return {codeLines, addedFakeJoinParent};
}

// Depth-first search for the first ERROR or MISSING node in a parsed tree -- tree-sitter never
// throws on invalid input (unlike Sk.parse()), it always returns a complete tree with these
// error-marker nodes standing in for the unparseable part. See PLAN.md §5 for why the resulting
// user-facing message is deliberately generic ("Invalid Python code at line N") rather than trying
// to synthesise a specific reason from the error node's grammar context.
function findFirstErrorNode(node: TSSyntaxNode) : TSSyntaxNode | null {
    if (node.type === "ERROR" || node.isMissing) {
        return node;
    }
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
            const found = findFirstErrorNode(child);
            if (found) {
                return found;
            }
        }
    }
    return null;
}

// The tree-sitter-based replacement for parseWithSkulpt() above. `mapErrorLineno` is expected to
// operate on plain, un-glued codeLines line numbers (1-based) -- this function itself subtracts
// the fake-join-parent glue offset before calling it, so callers don't need to know about gluing.
function parseWithTreeSitter(codeLines: string[], mapErrorLineno : (lineno : number) => number) : string | { tree: Parser.Tree, disabledLines: number[], addedFakeJoinParent: number } {
    const glued = glueJointFrameHeader(codeLines);
    const preprocessed = preprocessBeforeParse(glued.codeLines);
    const parser = getPythonParserSync();
    const tree = parser.parse(preprocessed.source);
    if (tree.rootNode.hasError) {
        const errorNode = findFirstErrorNode(tree.rootNode);
        const gluedLineno = errorNode ? errorNode.startPosition.row + 1 : 1;
        const glueOffsetLines = glued.addedFakeJoinParent * 2;
        const originalLineno = Math.max(1, gluedLineno - glueOffsetLines);
        return i18n.global.t("messageBannerMessage.invalidPythonCodeSyntax") + " line: " + mapErrorLineno(originalLineno);
    }
    return {tree, disabledLines: preprocessed.disabledLines, addedFakeJoinParent: glued.addedFakeJoinParent};
}

// Gets the leading indent of a string
function getIndent(codeLine: string) {
    return (codeLine.match(/^\s*/) as RegExpMatchArray)[0];
}

const STRYPE_COMMENT_PREFIX = "___strype_comment_";
const STRYPE_LIBRARY_PREFIX = "___strype_library_";

const STRYPE_DOC_NEWLINE = "___strype_doc_newline";
const STRYPE_WHOLE_LINE_BLANK = "___strype_whole_line_blank";

// Defined in pythonSlotsShared.ts (a dependency-free leaf module, along with concatSlots(),
// replaceMediaLiteralsAndInvalidOps() and fromUnicodeEscapes() below) and re-exported here so
// existing importers of pythonToFrames.ts are unaffected:
import { STRYPE_DUMMY_FIELD, STRYPE_EXPRESSION_BLANK, STRYPE_INVALID_SLOT, STRYPE_INVALID_OPS_WRAPPER, STRYPE_INVALID_OP, STRYPE_INVALID_FSTRING_WRAPPER, concatSlots, replaceMediaLiteralsAndInvalidOps, fromUnicodeEscapes, escapeForPlainStringLiteral } from "@/helpers/pythonSlotsShared";
export { STRYPE_DUMMY_FIELD, STRYPE_EXPRESSION_BLANK, STRYPE_INVALID_SLOT, STRYPE_INVALID_OPS_WRAPPER, STRYPE_INVALID_OP, STRYPE_INVALID_FSTRING_WRAPPER, concatSlots, replaceMediaLiteralsAndInvalidOps, fromUnicodeEscapes, escapeForPlainStringLiteral };

export interface SavedFrameState {
    collapsed?: CollapsedState;
    frozen?: FrozenState;
    // Could be more in future, potentially
}

// findStringEnd() and transformCommentsAndBlanks() (the old Skulpt-era preprocessing pass,
// replaced by preprocessBeforeParse() in pythonToFramesPreprocess.ts -- see PLAN.md §2 for the
// design rationale) used to live here. Deleted outright rather than left as dead code: both had
// zero remaining references once copyFramesFromParsedPython() was rewired to the new tree-sitter
// pipeline, and `npm run lint:check`'s no-unused-vars rule doesn't allow genuinely unreferenced
// functions to linger -- unlike the rest of the old Skulpt-based cluster below
// (copyFramesFromPython() and its own helpers), which is still self-referentially "used" (they
// call each other) and so stays for now, to be deleted together once the new pipeline is proven
// via the e2e suite (PLAN.md §3 step 6).

// Information about a set of "copied" frames.  This is the result of parsing
// Python into a set of frame objects.
interface CopiedFrames {
    frameIds: number[];
    frames: EditorFrameObjects;
    // The project documentation is special because it's a singleton frame, so its content is recorded separately:
    docSlots: SlotsStructure | undefined;
}

class CopyFailure extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CopyFailure";
    }
}

// Offsets all IDs by the given amount, ready for insertion into real frames
// Modifies in-place and returns the modified item
export function offsetAllIds(frames: CopiedFrames, offset: number) : CopiedFrames {
    for (let i = 0; i < frames.frameIds.length; i++) {
        frames.frameIds[i] += offset;
    }
    // Can't modify keys while iterating so take a copy, remove them all, put them all back offset:
    const entries = Object.entries(frames.frames);
    for (const key in frames.frames) {
        delete frames.frames[Number(key)];
    }
    for (const [id, frame] of entries) {
        frames.frames[Number(id) + offset] = frame;
        
        // We also have to modify all child IDs etc:
        // Don't add the offset if the parent or joint parent is -1:
        frame.parentId = frame.parentId <= 0 ? frame.parentId : frame.parentId + offset;
        frame.jointParentId = frame.jointParentId <= 0 ? frame.jointParentId : frame.jointParentId + offset;
        // No such issues with our ID or child IDs:
        frame.id += offset;
        for (let i = 0; i < frame.childrenIds.length; i++) {
            frame.childrenIds[i] += offset;
        }
        for (let i = 0; i < frame.jointFrameIds.length; i++) {
            frame.jointFrameIds[i] += offset;
        }        
    }
    return frames;
}

// The main entry point to this module.  Given a string of Python code that the user
// has pasted in, return the string after turning it into frames.
// If unsuccessful, throws CopyFailure with a string with some info about where the Python parse failed.
// The main entry point to this module. Given a string of Python code that the user has pasted in
// (already split into lines), return the frames after parsing with tree-sitter. If unsuccessful,
// throws CopyFailure with a string with some info about where the Python parse failed.
// This now calls the new tree-sitter-based parse/walk pipeline (parseWithTreeSitter() +
// processBlockItems()) instead of the Skulpt-based parseWithSkulpt() + copyFramesFromPython() it
// used before -- those (and transformCommentsAndBlanks()) are now unreachable dead code, left in
// place for one more commit to keep this diff reviewable, and deleted next (PLAN.md §3 step 6).
function copyFramesFromParsedPython(codeLines: string[], currentStrypeLocation: STRYPE_LOCATION, format: "py" | "spy", linenoMapping?: Record<number, number>) : CopiedFrames {
    const indents = new Map<number, string>();

    // Then find the common amount of indentation on non-blank lines and remove it:
    // This way if the user parses in something like this from the middle of some Python:
    // "    if x > 8:"
    // "      x = 10"
    // "    else:"
    // "      x = 12"
    // (which is invalid in Python because you can't have a leading indent on the first line),
    // we interpret it as :
    // "if x > 8:"
    // "  x = 10"
    // "else:"
    // "  x = 12"
    // (note that just removing indent on first line wouldn't make the else line up correctly)
    let lowestIndent = 999999;
    for (const codeLine of codeLines) {
        if (codeLine.trim() != "") {
            // Is bound to match because even the empty line matches:
            const indent = getIndent(codeLine).length;
            if (indent < lowestIndent) {
                lowestIndent = indent;
            }
        }
    }
    // Now remove that indent if it exists, and record remaining indent:
    for (let i = 0; i < codeLines.length; i++) {
        codeLines[i] = codeLines[i].slice(lowestIndent);
        indents.set(i + 1, getIndent(codeLines[i]));
    }

    // Unlike Skulpt's transformCommentsAndBlanks(), preprocessBeforeParse() (called inside
    // parseWithTreeSitter()) never changes the line count, so -- unlike the old mapLineno, which
    // had to go via transformedLineOrigin to undo that -- codeLines line numbers already line up
    // directly with what parseWithTreeSitter() reports (once it's undone its own glue offset):
    const mapLineno = (lineno : number) : number => linenoMapping ? linenoMapping[lineno] : lineno;

    const parsed = parseWithTreeSitter(codeLines, mapLineno);
    if (typeof parsed === "string") {
        throw new CopyFailure(parsed);
    }
    const addedFakeJoinParent = parsed.addedFakeJoinParent;

    try {
        const result : CopiedFrames = {frameIds: [], frames: {}, docSlots: undefined};
        // We assign new IDs starting from 1, later on they are offset:
        processBlockItems(parsed.tree.rootNode, -1, undefined, {nextId: 1, addToNonJoint: result.frameIds, addToJoint: undefined, loadedFrames: result.frames, disabledLines: parsed.disabledLines, frameStateLines: new Map<number, SavedFrameState>(), parent: null, jointParent: null, lastLineProcessed: 0, lineNumberToIndentation: indents, isSPY: format === "spy", transformTopComment: (c) => {
            result.docSlots = c;
        }});
        // At this stage, we can make a sanity check that we can copy the given Python code in the current position in Strype (for example, no "import" in a function definition section)
        if(!canPastePythonAtStrypeLocation(currentStrypeLocation, result)){
            throw new CopyFailure(i18n.global.t("messageBannerMessage.incompatiblePythonStrypeSection"));
        }

        if (addedFakeJoinParent > 0) {
            // Now have to detach that parent again.  If it was joint frames only, there should be one parent on the list:
            if (result.frameIds.length == 1) {
                // Clone the list to avoid modification issues:
                result.frameIds = [...result.frames[result.frameIds[0]].jointFrameIds.slice(addedFakeJoinParent - 1)];
            }
            else {
                // Uh-oh, they had other things after the else, etc.  We can't handle that, so abandon:
                throw new CopyFailure(i18n.global.t("messageBannerMessage.wrongPythonStructCopied"));
            }
        }
        return result;
    }
    catch (e) {
        console.warn(e);
        if (e instanceof CopyFailure) {
            throw e;
        }
        throw new CopyFailure(e instanceof Error ? e.message : String(e));
    }
}

// Whether a parsed expression is "simple" enough that re-using it as an operand
// (as we do when expanding an augmented assignment like "a += b" into "a = a + b")
// doesn't need extra brackets to stay unambiguous: a single token, a single function
// call, or a single member/method-call chain. All of those only ever join sub-parts
// with a blank ("") or a "." operator; anything else (a real binary/unary operator)
// means brackets are needed to preserve the original semantics.
function isSimpleAugAssignOperand(slots: SlotsStructure) : boolean {
    return slots.operators.every((op) => op.code === "" || op.code === ".");
}

// Dig down the tree and find the actual value.  Skips down through
// all parents with a single child.  If there is no value or no children,
// an error will be thrown.  This shouldn't happen for the items we are
// calling it on (operators, numeric literals).
function digValue(p : ParsedConcreteTree) : string {
    if (p.value) {
        return p.value;
    }
    else if (p.children == null) {
        throw new Error("Node with no value and no children");
    }
    else if (p.children.length == 1) {
        return digValue(p.children[0]);
    }
    else if (p.type == Sk.ParseTables.sym.comp_op && p.children.length == 2) {
        // "is not" and "not in" show up as this type, with two children:
        return digValue(p.children[0]) + " " + digValue(p.children[1]);
    }
    else {
        throw new Error("Can't find single value in:\n" + debugToString(p, "  "));
    }
}

// The state while parsing a long expression with multiple operands and operators:
interface ParseState {
    seq: ParsedConcreteTree[];
    nextIndex: number;
}

// The index of ParseState will be modified in the given item:
function parseNextTerm(ps : ParseState) : SlotsStructure {
    // Check for unary operator:
    const nextVal = ps.seq[ps.nextIndex].value;
    if (nextVal === "-" || nextVal === "+") {
        // Unary numbers just go in their own field:
        try {
            const valAfterThat = digValue(ps.seq[ps.nextIndex + 1]);
            if (/^\d+(\.\d+)?([eE][+-]?\d+)?$/.test(valAfterThat)) {
                ps.nextIndex += 2;
                return {fields: [{code: nextVal + valAfterThat}], operators: []};
            }
        }
        catch {
            // Not an integer then...
        }
        
        ps.nextIndex += 1;
        return concatSlots({fields: [{code: ""}], operators: []}, nextVal, parseNextTerm(ps));
    }
    if (nextVal === "not" || nextVal === ":" || nextVal === "*" || nextVal === "~" || nextVal === "lambda") {
        ps.nextIndex += 1;
        return concatSlots({fields: [{code: ""}], operators: []}, nextVal, parseNextTerm(ps));
    }
    const term = ps.seq[ps.nextIndex];
    ps.nextIndex += 1;
    return toSlots(term);
}


function toSlots(p: ParsedConcreteTree) : SlotsStructure {
    // Handle terminal nodes by just plonking them into a single-field slot:
    if (p.children == null || p.children.length == 0) {
        let val = p.value ?? "";
        // Strings can be prefixed by combinations of rbf (case insensitive):
        // The regex doesn't enforce that the quotes match,
        // but the parser will have already made sure that is the case:
        // ([\s\S] matches any char, including newlines, which might be present if it's triple quoted):
        const strMatch = /^([rbfRBF]*)(["'])([\s\S]+)$/.exec(val);
        if (strMatch) {
            const str : StringSlot = {code: strMatch[3].slice(0, strMatch[3].length - strMatch[2].length), quote: strMatch[2]};
            return {fields: [{code: strMatch[1]}, str, {code: ""}], operators: [{code: ""}, {code: ""}]};
        }
        else {
            if (val == STRYPE_EXPRESSION_BLANK) {
                val = "";
            }
            else if (val.startsWith(STRYPE_INVALID_SLOT)) {
                val = fromUnicodeEscapes(val.slice(STRYPE_INVALID_SLOT.length));
            }
            return {fields: [{code: val}], operators: []};
        }
    }
    
    // Skulpt's parser seems to output a huge amount of dummy nodes with one child,
    // e.g. an OR inside an AND.  We have a catch-all that just descends if there's only one child:
    if (p.children.length == 1) {
        return toSlots(p.children[0]);
    }

    // Check for brackets:
    if (p.children[0].value === "(" || p.children[0].value === "[" || p.children[0].value === "{") {
        const bracketed =  toSlots({...p, children: p.children.slice(1, p.children.length - 1)});
        // For parameters, we drop the brackets and keep the content:
        if (p.type == Sk.ParseTables.sym.parameters) {
            return bracketed;
        }
        // Bracketed items must be surrounded by empty slot and empty operator each side:
        return {fields: [{code: ""},{...bracketed, openingBracketValue: p.children[0].value}, {code: ""}], operators: [{code: ""}, {code: ""}]};
    }

    const ps = {seq: p.children, nextIndex: 0};
    let latest = parseNextTerm(ps);
    while (ps.nextIndex < p.children.length) {
        const child = p.children[ps.nextIndex];
        if (child.type === Sk.ParseTables.sym.trailer) {
            // A suffix, like an array index lookup.  Join it and move forward only by one:
            const grandchildren = child.children;
            if (grandchildren != null && grandchildren[0].value === ".") {
                latest = concatSlots(latest, ".", toSlots(grandchildren[1]));
            }
            else {
                // Something bracketed:
                latest = concatSlots(latest, "", toSlots(child));
            }
            ps.nextIndex += 1;
            continue;
        }

        if (child.type === Sk.ParseTables.sym.sliceop && child.children && child.children?.length >= 1) {
            // The a:b:c syntax has a slice_op child for the :c part which includes the operator and operand:
            const op = digValue(child.children[0]);
            if (op == ":" && child.children?.length == 1) {
                // Can be blank on RHS of colon
                latest = concatSlots(latest, op, {fields: [{code: ""}], operators: []});
                ps.nextIndex += 1;
                continue;
            }
            else if (child.children?.length == 2) {
                latest = concatSlots(latest, op, toSlots(child.children[1]));
                ps.nextIndex += 1;
                continue;
            }
        }
        
        if (child.type === Sk.ParseTables.sym.comp_for && child.children && child.children?.length >= 4) {
            // A list comprehension; this will be:
            //   for
            //   <expression>
            //   in
            //   <expression>
            // Optionally followed by:
            //   comp_iter:
            //     comp_if:
            //       if
            //       <expression>
            latest = concatSlots(latest, "for", concatSlots(toSlots(child.children[1]), "in", toSlots(child.children[3])));
            if (child.children.length >= 5 
                && child.children[4].type === Sk.ParseTables.sym.comp_iter
                && (child.children[4].children?.length ?? 0) >= 1
                && child.children[4].children?.[0]?.type === Sk.ParseTables.sym.comp_if) {
                const ifNode = child.children[4]?.children?.[0];
                if (ifNode && ifNode.children && ifNode.children.length >= 2) {
                    // First child is if keyword, second child is the expression:
                    latest = concatSlots(latest, "if", toSlots(ifNode.children[1]));
                }
            }
            ps.nextIndex += 1;
            continue;
        }
        
        // Now we expect a binary operator:        
        let op;
        try {
            op = digValue(child);
            ps.nextIndex += 1;
        }
        catch (err) {
            throw new Error("Cannot find operator " + ps.nextIndex + " in:\n" + debugToString(p, ""), {cause: err});
        }
        if (op != null && (operators.includes(op) || trimmedKeywordOperators.includes(op))) {
            if ((op == ":" || op == ",") && ps.nextIndex == ps.seq.length) {
                // Can be blank on RHS of colon or comma
                latest = concatSlots(latest, op, {fields: [{code: ""}], operators: []});
            }
            else {
                latest = concatSlots(latest, op, parseNextTerm(ps));
            }
        }
        else {
            throw new Sk.builtin.SyntaxError("Unknown operator: " + child.type + " \"" + op + "\"", null, p.lineno);
        }
    }
    return replaceMediaLiteralsAndInvalidOps(latest);
}

// Get the children of the node, and throw an error if they are null.  This
// should never happen, but if we use p.children then Typescript complains everywhere
// that it could be null, whereas children(p) satisfies Typescript and gives a useful
// error if it does turn out to be null.
function children(p : ParsedConcreteTree) : ParsedConcreteTree[] {
    if (p.children == null) {
        throw new Error("Null children on node " + JSON.stringify(p));
    }
    return p.children;
}

// Given an index into the children (or a sequence of indexes), apply that and get the appropriate child.
function applyIndex(p : ParsedConcreteTree, index: number | number[]) : ParsedConcreteTree {
    if (typeof(index) === "number") {
        return children(p)[index];
    }
    else {
        const initial = index[0];
        const rest = index.slice(1);
        return applyIndex(children(p)[initial], rest.length == 1 ? rest[0] : rest);
    }
}

// Make a frame using the given frame type, the given index/indices of p's children for the slots,
function getRealLineNo(p: ParsedConcreteTree) : number | undefined {
    if (p.type == Sk.ParseTables.sym.suite) {
        // I don't really understand what this item is (it seems to have the raw content as extra children),
        // but it seems if we ignore these extra children we can proceed and it will all work:
        for (const child of children(p)) {
            if (child.type > 250) { // Only count the non-expression nodes
                return child.lineno;
            }
        }
    }
    return p.lineno;
}

// the given index for the body, and call addFrame on it.
function makeAndAddFrameWithBody(p: ParsedConcreteTree, frameType: string, keywordIndexForLineno: number, childrenIndicesForSlots: (number | number[])[] | { [index: number]: LabelSlotsContent}, childIndexForBody: number, s : CopyState, transformTopComment?: (content: SlotsStructure, frame: FrameObject) => void) : {s: CopyState, frame: FrameObject} {
    let slots : { [index: number]: LabelSlotsContent} = {};
    if (Array.isArray(childrenIndicesForSlots)) {
        for (let slotIndex = 0; slotIndex < childrenIndicesForSlots.length; slotIndex++) {
            slots[slotIndex] = {slotStructures : toSlots(applyIndex(p, childrenIndicesForSlots[slotIndex]))};
        }
    }
    else {
        slots = childrenIndicesForSlots;
    }
    
    // When we parse an "if" guarded case pattern, we don't want 2 slots structures, we have only 1 and the operator between them is "if"
    if(frameType == AllFrameTypesIdentifier.case && Array.isArray(childrenIndicesForSlots) && childrenIndicesForSlots.length > 1){
        slots[0].slotStructures.fields.push(...slots[1].slotStructures.fields);
        slots[0].slotStructures.operators.push({code: "if"}, ...slots[1].slotStructures.operators);
    }

    const frame = makeFrame(frameType, slots, s.isSPY);    
    s = addFrame(frame, applyIndex(p, keywordIndexForLineno).lineno, s);
    const frameChildren = children(p);
    const afterChild = copyFramesFromPython(frameChildren[childIndexForBody], {...s, addToNonJoint: frame.childrenIds, addToJoint: undefined, parent: frame, transformTopComment: transformTopComment ? ((s) => transformTopComment(s, frame)) : undefined});
    s = {...s, nextId: afterChild.nextId, lastLineProcessed: afterChild.lastLineProcessed};
    return {s: s, frame: frame};
}

// Process the given node in the tree at the current point designed by CopyState
function removeFirstFuncParam(params: LabelSlotsContent) {
    if (params && params.slotStructures.fields.length == 1) {
        // We need to keep a field, but we blank the content:
        (params.slotStructures.fields[0] as BaseSlot).code = "";
    }
    else if (params && params.slotStructures.fields.length > 1) {
        // We can just delete the first item and first operator, and rest can stay:
        params.slotStructures.fields.splice(0, 1);
        params.slotStructures.operators.splice(0, 1);
    }
}

// Returns a copy state, including the frame ID of the next insertion point for any following statements
function copyFramesFromPython(p: ParsedConcreteTree, s : CopyState) : CopyState {
    switch (p.type) {
    case Sk.ParseTables.sym.file_input:
        // The outer wrapper for the whole file, just dig in:
        for (const child of children(p)) {
            s = copyFramesFromPython(child, s);
        }
        break;
    case Sk.ParseTables.sym.stmt:
    case Sk.ParseTables.sym.simple_stmt:
    case Sk.ParseTables.sym.small_stmt:
    case Sk.ParseTables.sym.flow_stmt:
    case Sk.ParseTables.sym.compound_stmt:
    case Sk.ParseTables.sym.import_stmt:
    case Sk.ParseTables.sym.case_stmt:        
        // Wrappers where we just skip to the children:
        for (const child of children(p)) {
            s = copyFramesFromPython(child, s);
            // After the first, it's no longer the top comment:
            s.transformTopComment = undefined;
        }
        break;
    case Sk.ParseTables.sym.expr_stmt:
        if (p.children) {
            const index = p.children.findIndex((x) => x.value === "=");
            const augIndex = p.children.findIndex((x) => x.type === Sk.ParseTables.sym.augassign);
            if (index >= 0) {
                checkValidMatchContent(s.parent?.frameType.type, p.lineno);
                // An assignment
                const lhs = toSlots({...p, children: p.children.slice(0, index)});
                const rhs = toSlots({...p, children: p.children.slice(index + 1)});
                s = addFrame(makeFrame(AllFrameTypesIdentifier.varassign, {0: {slotStructures: lhs}, 1: {slotStructures: rhs}}, s.isSPY), p.lineno, s);
            }
            else if (augIndex >= 0) {
                checkValidMatchContent(s.parent?.frameType.type, p.lineno);
                // Strype has no dedicated frame for augmented assignment (e.g. "a += b"), so we
                // expand it into the equivalent "a = a + b" instead. This isn't behaviour-compliant
                // for targets with side effects (e.g. "a().x += b" would evaluate "a()" twice) but
                // that's an accepted, unlikely-to-occur limitation.
                const lhs = toSlots({...p, children: p.children.slice(0, augIndex)});
                const rhsOperand = toSlots({...p, children: p.children.slice(augIndex + 1)});
                // Strip the trailing "=" from e.g. "+=" to get the underlying operator "+":
                const op = digValue(p.children[augIndex]).slice(0, -1);
                const bracketedRhsOperand = isSimpleAugAssignOperand(rhsOperand) ? rhsOperand :
                    {fields: [{code: ""}, {...rhsOperand, openingBracketValue: "("}, {code: ""}], operators: [{code: ""}, {code: ""}]};
                const rhs = concatSlots(cloneDeep(lhs), op, bracketedRhsOperand);
                s = addFrame(makeFrame(AllFrameTypesIdentifier.varassign, {0: {slotStructures: lhs}, 1: {slotStructures: rhs}}, s.isSPY), p.lineno, s);
            }
            else {
                const slots = toSlots(p);
                if (slots.fields.length == 1 && (slots.fields[0] as BaseSlot)?.code && (slots.fields[0] as BaseSlot).code.startsWith(STRYPE_COMMENT_PREFIX)) {
                    // A single line comment: we retrieve and decode the comment part following the STRYPE_COMMENT_PREFIX placeholder.
                    const comment = fromUnicodeEscapes((slots.fields[0] as BaseSlot).code.slice(STRYPE_COMMENT_PREFIX.length));
                    s = addFrame(makeFrame(AllFrameTypesIdentifier.comment, {0: {slotStructures: {fields: [{code: comment}], operators: []}}}, s.isSPY), p.lineno, s);    
                }
                else if (slots.fields.length == 1 && (slots.fields[0] as BaseSlot)?.code && (slots.fields[0] as BaseSlot).code.startsWith(STRYPE_LIBRARY_PREFIX)) {
                    checkValidMatchContent(s.parent?.frameType.type, p.lineno);
                    const library = fromUnicodeEscapes((slots.fields[0] as BaseSlot).code.slice(STRYPE_LIBRARY_PREFIX.length));
                    s = addFrame(makeFrame(AllFrameTypesIdentifier.library, {0: {slotStructures: {fields: [{code: library}], operators: []}}}, s.isSPY), p.lineno, s);
                }
                else if (slots.fields.length == 1 && (slots.fields[0] as BaseSlot)?.code && (slots.fields[0] as BaseSlot).code === STRYPE_WHOLE_LINE_BLANK) {
                    // Blanks are not allowed directly inside class defs:
                    if (s.parent?.frameType.type != AllFrameTypesIdentifier.classdef) {
                        s = addFrame(makeFrame(AllFrameTypesIdentifier.blank, {}, s.isSPY), p.lineno, s);
                    }
                }
                else {
                    // Everything else goes in method call:
                    checkValidMatchContent(s.parent?.frameType.type, p.lineno);
                    const misc = makeFrame(AllFrameTypesIdentifier.funccall, {0: {slotStructures: slots}}, s.isSPY);
                    if (misc.frameType.type == AllFrameTypesIdentifier.comment && s.transformTopComment) {
                        s.transformTopComment(misc.labelSlotsDict[0].slotStructures);
                        s = {...s, transformTopComment: undefined};
                    }
                    else {
                        s = addFrame(misc, p.lineno, s);
                    }
                }
            }
        }
        break;
    case Sk.ParseTables.sym.pass_stmt:
        // We do not insert pass frames.  But we do record the line number
        // because it may matter for processing following comments:
        s = {...s, lastLineProcessed: p.lineno};
        break;
    case Sk.ParseTables.sym.break_stmt:
        s = addFrame(makeFrame(AllFrameTypesIdentifier.break, {}, s.isSPY), p.lineno, s);
        break;
    case Sk.ParseTables.sym.continue_stmt:
        s = addFrame(makeFrame(AllFrameTypesIdentifier.continue, {}, s.isSPY), p.lineno, s);
        break;
    case Sk.ParseTables.sym.global_stmt:
        // Global construct can include several comma-separated variables
        // (first child at index 0 is "global" itself)
        const globalVarsStruct = toSlots({...p, children: p.children?.slice(1)??null});
        s = addFrame(makeFrame(AllFrameTypesIdentifier.global, {0: {slotStructures: globalVarsStruct}}, s.isSPY), p.lineno, s);
        break;
    case Sk.ParseTables.sym.import_name:
        s = addFrame(makeFrame(AllFrameTypesIdentifier.import, {0: {slotStructures: toSlots(children(p)[1])}}, s.isSPY), p.lineno, s);
        break;
    case Sk.ParseTables.sym.import_from:
        s = addFrame(makeFrame(AllFrameTypesIdentifier.fromimport, {0: {slotStructures: toSlots(children(p)[1])}, 1: {slotStructures: toSlots(children(p)[3])}}, s.isSPY), p.lineno, s);
        break;
    case Sk.ParseTables.sym.raise_stmt:
        // Raise may or may not have an expression child after it:
        if (children(p).length >= 2) {
            s = addFrame(makeFrame(AllFrameTypesIdentifier.raise, {0: {slotStructures: toSlots(children(p)[1])}}, s.isSPY), p.lineno, s);
        }
        else {
            s = addFrame(makeFrame(AllFrameTypesIdentifier.raise, {0: {slotStructures: {fields: [{code: ""}], operators: []}}}, s.isSPY), p.lineno, s);
        }
        break;
    case Sk.ParseTables.sym.return_stmt:
        // Return may or may not have an expression child after it:
        if (children(p).length >= 2) {
            s = addFrame(makeFrame(AllFrameTypesIdentifier.return, {0: {slotStructures: toSlots(children(p)[1])}}, s.isSPY), p.lineno, s);
        }
        else {
            s = addFrame(makeFrame(AllFrameTypesIdentifier.return, {0: {slotStructures: {fields: [{code: ""}], operators: []}}}, s.isSPY), p.lineno, s);
        }
        break;
    case Sk.ParseTables.sym.if_stmt: {
        // First child is keyword, second is the condition, third is colon, fourth is body
        const r = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.if, 0,[1], 3, s);
        s = r.s;
        const ifFrame = r.frame;
        
        // If can have elif, else, so keep going to check for that:
        for (let i = 4; i < children(p).length; i++) {
            if (children(p)[i].value === "else") {
                // Skip the else and the colon, which are separate tokens:
                i += 2;
                updateFrom(s, makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.else, i - 2,[], i, {...s, addToJoint: ifFrame.jointFrameIds, jointParent: ifFrame}).s);
            }
            else if (children(p)[i].value === "elif") {
                // Skip the elif:
                i += 1;
                updateFrom(s, makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.elif, i - 1,[i], i + 2, {...s, addToJoint: ifFrame.jointFrameIds, jointParent: ifFrame}).s);
                // Skip the condition and the colon:
                i += 2;
            }
        }
        break;
    }
    case Sk.ParseTables.sym.while_stmt: {
        // First child is keyword, second is the condition, third is colon, fourth is body
        const r = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.while, 0, [1], 3, s);
        s = r.s;
        let i = 3;
        if (children(p).length >= 5 && children(p)[4].value === "else") {
            // Skip the else and the colon, which are separate tokens:
            i += 3;
            updateFrom(s, makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.else, 4,[], i, {
                ...s,
                addToJoint: r.frame.jointFrameIds,
                jointParent: r.frame,
            }).s);
        }
        break;
    }
    case Sk.ParseTables.sym.for_stmt: {
        // First child is keyword, second is the loop var, third is keyword, fourth is collection, fifth is colon, sixth is body
        const r = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.for, 0, [1, 3], 5, s);
        s = r.s;
        let i = 5;
        if (children(p).length >= 7 && children(p)[6].value === "else") {
            // Skip the else and the colon, which are separate tokens:
            i += 3;
            updateFrom(s, makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.else, 6,[], i, {
                ...s,
                addToJoint: r.frame.jointFrameIds,
                jointParent: r.frame,
            }).s);
        }
        break;
    }
    case Sk.ParseTables.sym.try_stmt: {
        // First is keyword, second is colon, third is body
        const r = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.try, 0, [], 2, s);
        const tryFrame = r.frame;
        s = r.s;
        
        // The except clauses are descendants of the try block, so we must iterate through later children:
        for (let i = 3; i < children(p).length; i++) {
            const child = children(p)[i];
            if (child.type === Sk.ParseTables.sym.except_clause) {
                // The first child is except keyword.  Everything else is optional, so we have three options:
                // - Blank except
                // - Except with single argument
                // - Except with "x as y" (which we shove into one slot)
                const grandchildren = children(child);
                let exceptFrame;
                if (grandchildren.length == 4 && grandchildren[2].value === "as") {
                    // except ErrorType as varName:
                    exceptFrame = makeFrame(AllFrameTypesIdentifier.except, {0: {slotStructures:
                                concatSlots(toSlots(grandchildren[1]), "as", toSlots(grandchildren[3])),
                    }}, s.isSPY);
                }
                else if (grandchildren.length == 2) {
                    // except varName:
                    const asSlots = toSlots(grandchildren[1]);
                    if (asSlots.fields.length == 1 && (asSlots.fields[0] as BaseSlot)?.code == STRYPE_DUMMY_FIELD) {
                        exceptFrame = null;
                    }
                    else {
                        exceptFrame = makeFrame(AllFrameTypesIdentifier.except, {0: {slotStructures: asSlots}}, s.isSPY);
                    }
                }
                else if (grandchildren.length == 1) {
                    // Just the except keyword, i.e. blank except:
                    exceptFrame = makeFrame(AllFrameTypesIdentifier.except, {0: {slotStructures: {fields: [{code: ""}], operators: []}}}, s.isSPY);
                }
                else {
                    // Shouldn't happen, but skip if so:
                    continue;
                }
                if (exceptFrame) {
                    updateFrom(s, addFrame(exceptFrame, getRealLineNo(child), {...s, addToJoint: tryFrame.jointFrameIds, jointParent: tryFrame}));
                    // The children of the except actually follow as a sibling of the clause, after the colon (hence i + 2):
                    if (s.lastLineProcessed != undefined) {
                        updateFrom(s, copyFramesFromPython(children(p)[i + 2], {...s, addToNonJoint: exceptFrame.childrenIds, parent: exceptFrame}));
                    }
                }
                else if (s.lastLineProcessed) {
                    // We know it's dummy header + pass body, so just add two:
                    s.lastLineProcessed += 2;
                }
            }
            else if (child.value === "finally") {
                // Weirdly, finally doesn't seem to have a proper node type, it's just a normal child
                // followed by a colon followed by a body
                updateFrom(s, makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.finally, i, [], i + 2, {...s, addToJoint: tryFrame.jointFrameIds, jointParent: tryFrame}).s);
            }
            else if (child.value === "else") {
                // else is the same as finally, a normal child then colon then body:
                updateFrom(s, makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.else, i, [], i + 2, {...s, addToJoint: tryFrame.jointFrameIds, jointParent: tryFrame}).s);
            }
        }
        break;
    }
    case Sk.ParseTables.sym.with_stmt:
        // First child is keyword, second is with_item that has [LHS, "as", RHS] as children, third is colon, fourth is body
        s = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.with, 0, [[1, 0], [1, 2]], 3, s).s;
        break;
    case Sk.ParseTables.sym.suite:
        // I don't really understand what this item is (it seems to have the raw content as extra children),
        // but it seems if we ignore these extra children we can proceed and it will all work:
        for (const child of children(p)) {
            if (child.type > 250) { // Only count the non-expression nodes
                s = copyFramesFromPython(child, s);
            }
        }
        break;
    case Sk.ParseTables.sym.funcdef: {
        // First child is keyword, second is the name, third is params, fourth is colon, fifth is body
        const r = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.funcdef, 0, [1, 2], 4, s, (comment : SlotsStructure, frame : FrameObject) => {
            frame.labelSlotsDict[3] = {slotStructures: comment};
        });
        s = r.s;
        // If we didn't find a top comment, add blank:
        if (!(3 in r.frame.labelSlotsDict)) {
            r.frame.labelSlotsDict[3] = {slotStructures: {operators: [], fields: [{code: ""}]}};
        }
        if (s.parent?.frameType.type == AllFrameTypesIdentifier.classdef) {
            // We remove the first param from the start of function params,
            // assuming it is the self parameter that we add automatically.
            const params = r.frame.labelSlotsDict[1];

            removeFirstFuncParam(params);
        }
        break;
    }
    case Sk.ParseTables.sym.classdef: {
        // First child is keyword, second is the name, penultimate is colon, last is body.
        // If there are parent classes, third is open-bracket, fourth is content, fifth is close bracket
        // However, this doesn't work with makeAndAddFrameWithBody because the way we deal with parent classes
        // is to add them as a bracketed item inside the single name slot.  So we need to do some custom work:
        const numChildren = children(p).length;
        const slots : { [index: number]: LabelSlotsContent} = {};
        if (numChildren == 4) {
            // No parent, just the name:
            slots[0] = {slotStructures: toSlots(applyIndex(p, 1))};
        }
        else {
            // There are brackets with parent names:
            const name = toSlots(applyIndex(p, 1));
            const parent = toSlots(applyIndex(p, 3));
            parent.openingBracketValue = "(";
            // Now we need to combine them:
            name.fields.push(parent, {code: ""});
            name.operators.push({code: ""}, {code: ""});
            slots[0] = {slotStructures: name};
        }
        const r = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.classdef, 0, slots, numChildren - 1, s, (comment : SlotsStructure, frame : FrameObject) => {
            frame.labelSlotsDict[2] = {slotStructures: comment};
        });
        s = r.s;
        // If we didn't find a top comment, add blank:
        if (!(2 in r.frame.labelSlotsDict)) {
            r.frame.labelSlotsDict[2] = {slotStructures: {operators: [], fields: [{code: ""}]}};
        }
        break;
    }
    case Sk.ParseTables.sym.match_stmt: {
        // First child is keyword, second is the expression to evaluate, third is colon, forth is body.
        // This case not supported by original Skulpt version - so to limit the changes in Skulpt, the Skulpt parser
        // is permissive and allows cases (normal) + pass (for us) + simple statements (for us).
        // The simple statements are therefore limiting the accepted content to things like "a", "a()", "a=b", but not if or while etc.
        // So we make a check in checkValidMatchContent() when parsing the children of a match statement to cover the permissive Skupt version.
        const r = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.match, 0, [1], 3, s);
        s = r.s;
        break;
    }
    case Sk.ParseTables.sym.case_block: {
        // (case not supported by upstream Skulpt version)
        // First child is keyword, second is the pattern expression, then the remaining parts depends whether we have an "if" guard:
        let r;
        if((p.children?.length??0) > 5){
            // There is an "if" guard:
            // third is the "if" keyword, 
            // forth the guard expression,
            // fifth is the colon
            // sixth is the body (of "case")
            r = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.case, 0, [1, 3], 5, s);
        }
        else{
            // There is not an "if" guard:
            // third is the colon, 
            // forth is the body
            r = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.case, 0, [1], 3, s);
        }
        s = r.s;
        break;
    }
    }
    return s;
}

// ---------------------------------------------------------------------------------------------
// New tree-sitter-based statement walker (replaces copyFramesFromPython() above once complete
// and validated -- see docs/replace-skulpt-parser/PLAN.md §3 step 4). Not wired into
// copyFramesFromParsedPython() yet: that still calls the Skulpt-based version above. Driven by
// tree-sitter's field API instead of positional child indices, and by nodeToSlots()/
// flattenChildren() (pythonToFramesExpr.ts) for expression content and getBlockItems()
// (pythonToFramesBlockWalk.ts) for blank-line/comment recovery -- see those modules' own doc
// comments for the design rationale. Can't be unit-tested standalone the way those two modules
// are (it needs makeFrame()/addFrame(), which need real FrameObject/i18n machinery), so -- like
// the Skulpt-based version it replaces -- its correctness is validated via the existing e2e
// paste/load suites once wired in, not via Playwright-as-unit-test specs.
// ---------------------------------------------------------------------------------------------

const spyDirectiveRegex = new RegExp("^" + escapeRegExp(AppSPYFullPrefix) + "([^:]+):(.*)$");

function tsLineno(node: TSSyntaxNode) : number {
    return node.startPosition.row + 1;
}

// Given an expression node, returns its SlotsStructure, or a single blank field if the node is
// undefined (mirrors the old code's handling of e.g. a bare "return"/"raise" with no value).
function tsSlotsOrBlank(node: TSSyntaxNode | null) : SlotsStructure {
    return node ? nodeToSlots(node) : {fields: [{code: ""}], operators: []};
}

// Processes a single comment node: either a plain comment, a Library:/LibraryDisabled: directive
// (-> library frame), or a FrameState: directive (-> recorded against the following line, no frame
// produced), or (if s.transformTopComment is set, i.e. this is the first item directly inside a
// funcdef/classdef body) consumed as that def's doc "comment".
function processCommentNode(node: TSSyntaxNode, s: CopyState) : CopyState {
    const text = node.text; // includes the leading "#"
    const m = spyDirectiveRegex.exec(text);
    if (m) {
        const key = m[1].trim();
        const value = m[2];
        if (key == "Library" || key == "LibraryDisabled") {
            const frame = makeFrame(AllFrameTypesIdentifier.library, {0: {slotStructures: {fields: [{code: value}], operators: []}}}, s.isSPY);
            if (key == "LibraryDisabled") {
                // Unlike the "#(=> Disabled:" prefix on a real code line (stripped and recorded in
                // preprocessBeforeParse()'s disabledLines before parsing even starts), a disabled
                // library is a distinct directive keyword recognised only here, post-parse -- so
                // mark it disabled directly rather than relying on the disabledLines lookup in
                // addFrame():
                frame.isDisabled = true;
            }
            return addFrame(frame, tsLineno(node), s);
        }
        if (key == "FrameState") {
            const states = value.trim().split(";");
            const composite = {} as SavedFrameState;
            for (const st of states) {
                if (st.trim() in stringToCollapsed) {
                    composite.collapsed = stringToCollapsed[st.trim()];
                }
                if (st.trim() in stringToFrozen) {
                    composite.frozen = stringToFrozen[st.trim()];
                }
            }
            // Applies to the line immediately following this comment (matching the old code's "+1"
            // semantics), regardless of any further blanks/comments between here and the next real
            // frame -- frameStateLines is a Map reference shared via CopyState, so mutating it here
            // is visible to the addFrame() call for that following frame:
            s.frameStateLines.set(node.startPosition.row + 2, composite);
            return s;
        }
        // Any other directive (e.g. a stray/malformed one) -- Section:* headers are already
        // stripped out before parsing by splitLinesToSections(), so there's nothing else
        // recognised here; fall through and treat it as a plain comment rather than erroring, to
        // stay lenient with malformed SPY metadata (matches the old code's "not one we have to
        // deal with during parsing" fallback).
    }
    const commentText = text.slice(1); // drop the leading "#"; no unicode-escape decoding needed
    // -- unlike the old disguised-as-identifier comments, this is the real source text already.
    if (s.transformTopComment) {
        s.transformTopComment({fields: [{code: commentText}], operators: []});
        return {...s, transformTopComment: undefined};
    }
    return addFrame(makeFrame(AllFrameTypesIdentifier.comment, {0: {slotStructures: {fields: [{code: commentText}], operators: []}}}, s.isSPY), tsLineno(node), s);
}

// Processes every item (statement, comment, or blank-line run) directly inside a block-like
// container (a `block` node, or the top-level `module` node), in source order. `afterRow`/
// `beforeRow` are passed straight through to getBlockItems() -- see its doc comment.
function processBlockItems(container: TSSyntaxNode, afterRow: number, beforeRow: number | undefined, s: CopyState) : CopyState {
    for (const item of getBlockItems(container, afterRow, beforeRow)) {
        if (item.kind === "blank") {
            for (let i = 0; i < item.count; i++) {
                // Blanks are not allowed directly inside class defs (matching old behaviour):
                if (s.parent?.frameType.type != AllFrameTypesIdentifier.classdef) {
                    s = addFrame(makeFrame(AllFrameTypesIdentifier.blank, {}, s.isSPY), item.startRow + i + 1, s);
                }
            }
        }
        else if (item.node.type === "comment") {
            s = processCommentNode(item.node, s);
        }
        else {
            s = copyFramesFromTreeSitterNode(item.node, s);
        }
        // Only the very first item in a block can be a def's doc "comment" -- once anything at all
        // has been processed (even a blank or an ordinary comment), that possibility is gone:
        s = {...s, transformTopComment: undefined};
    }
    return s;
}

// Handles an expr_stmt-equivalent's inner "assignment" node specially (splitting into separate
// target/value slots) rather than going through nodeToSlots() generically -- a chained assignment
// like "a = b = 1" still works, since nodeToSlots() on the nested "right" assignment node falls
// through to its generic flattenChildren() case (treating the nested "=" as an ordinary operator),
// matching the old Skulpt-based code's behaviour for the same input.
function copyAssignmentStatement(node: TSSyntaxNode, s: CopyState) : CopyState {
    const left = node.childForFieldName("left");
    const right = node.childForFieldName("right");
    if (!left || !right) {
        throw new Error("Malformed assignment node: " + node.text);
    }
    const lhs = nodeToSlots(left);
    const rhs = nodeToSlots(right);
    return addFrame(makeFrame(AllFrameTypesIdentifier.varassign, {0: {slotStructures: lhs}, 1: {slotStructures: rhs}}, s.isSPY), tsLineno(node), s);
}

// Strype has no dedicated frame for augmented assignment (e.g. "a += b"), so -- matching the old
// code -- it's expanded into the equivalent "a = a + b" instead. This isn't behaviour-compliant
// for targets with side effects (e.g. "a().x += b" would evaluate "a()" twice) but that's an
// accepted, unlikely-to-occur limitation, carried over unchanged.
function copyAugmentedAssignmentStatement(node: TSSyntaxNode, s: CopyState) : CopyState {
    const left = node.childForFieldName("left");
    const opNode = node.childForFieldName("operator");
    const right = node.childForFieldName("right");
    if (!left || !opNode || !right) {
        throw new Error("Malformed augmented_assignment node: " + node.text);
    }
    const lhs = nodeToSlots(left);
    const rhsOperand = nodeToSlots(right);
    const op = opNode.text.slice(0, -1); // strip the trailing "=" from e.g. "+=" to get "+"
    const bracketedRhsOperand = isSimpleAugAssignOperand(rhsOperand) ? rhsOperand :
        {fields: [{code: ""}, {...rhsOperand, openingBracketValue: "("}, {code: ""}], operators: [{code: ""}, {code: ""}]};
    const rhs = concatSlots(cloneDeep(lhs), op, bracketedRhsOperand);
    return addFrame(makeFrame(AllFrameTypesIdentifier.varassign, {0: {slotStructures: lhs}, 1: {slotStructures: rhs}}, s.isSPY), tsLineno(node), s);
}

function copyExpressionStatement(node: TSSyntaxNode, s: CopyState) : CopyState {
    const inner = node.child(0);
    if (!inner) {
        throw new Error("Empty expression_statement");
    }
    if (inner.type === "assignment") {
        return copyAssignmentStatement(inner, s);
    }
    if (inner.type === "augmented_assignment") {
        return copyAugmentedAssignmentStatement(inner, s);
    }
    // Everything else (a bare call, attribute access, identifier, etc.) goes in a "misc" frame --
    // makeFrame() itself detects the standalone-triple-quoted-string special case and converts it
    // to a comment frame, same as the old code:
    const slots = nodeToSlots(inner);
    const misc = makeFrame(AllFrameTypesIdentifier.funccall, {0: {slotStructures: slots}}, s.isSPY);
    if (misc.frameType.type == AllFrameTypesIdentifier.comment && s.transformTopComment) {
        s.transformTopComment(misc.labelSlotsDict[0].slotStructures);
        return {...s, transformTopComment: undefined};
    }
    return addFrame(misc, tsLineno(node), s);
}

// A block-like container's own startPosition/endPosition only span its actual statements (no
// visibility of the header line before it or a following elif/else/except sibling after it), so
// callers must pass in the right row bounds explicitly -- see getBlockItems()'s doc comment.
function copyBlockBody(blockNode: TSSyntaxNode, headerNode: TSSyntaxNode, s: CopyState, beforeRow?: number) : CopyState {
    return processBlockItems(blockNode, headerNode.startPosition.row, beforeRow, s);
}

function copyIfStatement(node: TSSyntaxNode, s: CopyState) : CopyState {
    const condition = node.childForFieldName("condition");
    const consequence = node.childForFieldName("consequence");
    if (!condition || !consequence) {
        throw new Error("Malformed if_statement: " + node.text);
    }
    const ifFrame = makeFrame(AllFrameTypesIdentifier.if, {0: {slotStructures: nodeToSlots(condition)}}, s.isSPY);
    s = addFrame(ifFrame, tsLineno(node), s);
    const clauses = node.children.filter((c) => c.type === "elif_clause" || c.type === "else_clause");
    const firstClauseRow = clauses.length > 0 ? clauses[0].startPosition.row : undefined;
    // Only pull nextId/lastLineProcessed back from the recursive body walk (via updateFrom()),
    // never reassign `s` wholesale to its return value -- that would clobber s.parent/addToJoint/
    // etc. with whatever the deepest-processed nested item's state happened to be, which is
    // exactly the bug this comment is here to stop from reappearing (found by manually smoke-
    // testing this code in a real browser before wiring it in further -- an `if` statement's own
    // body was silently coming out empty because of it). Matches the old Skulpt-based code's own
    // makeAndAddFrameWithBody(), which does the same for exactly this reason.
    updateFrom(s, copyBlockBody(consequence, node, {...s, addToNonJoint: ifFrame.childrenIds, addToJoint: undefined, parent: ifFrame}, firstClauseRow));
    for (let i = 0; i < clauses.length; i++) {
        const clause = clauses[i];
        const nextClauseRow = i + 1 < clauses.length ? clauses[i + 1].startPosition.row : undefined;
        const body = clause.childForFieldName("consequence") ?? clause.childForFieldName("body");
        if (!body) {
            throw new Error("Malformed elif/else clause: " + clause.text);
        }
        if (clause.type === "elif_clause") {
            const cond = clause.childForFieldName("condition");
            if (!cond) {
                throw new Error("Malformed elif_clause: " + clause.text);
            }
            const elifFrame = makeFrame(AllFrameTypesIdentifier.elif, {0: {slotStructures: nodeToSlots(cond)}}, s.isSPY);
            const elifState = addFrame(elifFrame, tsLineno(clause), {...s, addToJoint: ifFrame.jointFrameIds, jointParent: ifFrame});
            updateFrom(s, copyBlockBody(body, clause, {...elifState, addToNonJoint: elifFrame.childrenIds, addToJoint: undefined, parent: elifFrame}, nextClauseRow));
        }
        else {
            const elseFrame = makeFrame(AllFrameTypesIdentifier.else, {}, s.isSPY);
            const elseState = addFrame(elseFrame, tsLineno(clause), {...s, addToJoint: ifFrame.jointFrameIds, jointParent: ifFrame});
            updateFrom(s, copyBlockBody(body, clause, {...elseState, addToNonJoint: elseFrame.childrenIds, addToJoint: undefined, parent: elseFrame}, nextClauseRow));
        }
    }
    return s;
}

function copyWhileStatement(node: TSSyntaxNode, s: CopyState) : CopyState {
    const condition = node.childForFieldName("condition");
    const body = node.childForFieldName("body");
    const alternative = node.childForFieldName("alternative"); // else_clause, if present
    if (!condition || !body) {
        throw new Error("Malformed while_statement: " + node.text);
    }
    const whileFrame = makeFrame(AllFrameTypesIdentifier.while, {0: {slotStructures: nodeToSlots(condition)}}, s.isSPY);
    s = addFrame(whileFrame, tsLineno(node), s);
    updateFrom(s, copyBlockBody(body, node, {...s, addToNonJoint: whileFrame.childrenIds, addToJoint: undefined, parent: whileFrame}, alternative?.startPosition.row));
    if (alternative) {
        const elseBody = alternative.childForFieldName("body");
        if (!elseBody) {
            throw new Error("Malformed else_clause: " + alternative.text);
        }
        const elseFrame = makeFrame(AllFrameTypesIdentifier.else, {}, s.isSPY);
        const elseState = addFrame(elseFrame, tsLineno(alternative), {...s, addToJoint: whileFrame.jointFrameIds, jointParent: whileFrame});
        updateFrom(s, copyBlockBody(elseBody, alternative, {...elseState, addToNonJoint: elseFrame.childrenIds, addToJoint: undefined, parent: elseFrame}));
    }
    return s;
}

function copyForStatement(node: TSSyntaxNode, s: CopyState) : CopyState {
    const left = node.childForFieldName("left");
    const right = node.childForFieldName("right");
    const body = node.childForFieldName("body");
    const alternative = node.childForFieldName("alternative"); // else_clause, if present
    if (!left || !right || !body) {
        throw new Error("Malformed for_statement: " + node.text);
    }
    const forFrame = makeFrame(AllFrameTypesIdentifier.for, {0: {slotStructures: nodeToSlots(left)}, 1: {slotStructures: nodeToSlots(right)}}, s.isSPY);
    s = addFrame(forFrame, tsLineno(node), s);
    updateFrom(s, copyBlockBody(body, node, {...s, addToNonJoint: forFrame.childrenIds, addToJoint: undefined, parent: forFrame}, alternative?.startPosition.row));
    if (alternative) {
        const elseBody = alternative.childForFieldName("body");
        if (!elseBody) {
            throw new Error("Malformed else_clause: " + alternative.text);
        }
        const elseFrame = makeFrame(AllFrameTypesIdentifier.else, {}, s.isSPY);
        const elseState = addFrame(elseFrame, tsLineno(alternative), {...s, addToJoint: forFrame.jointFrameIds, jointParent: forFrame});
        updateFrom(s, copyBlockBody(elseBody, alternative, {...elseState, addToNonJoint: elseFrame.childrenIds, addToJoint: undefined, parent: elseFrame}));
    }
    return s;
}

function copyTryStatement(node: TSSyntaxNode, s: CopyState) : CopyState {
    const body = node.childForFieldName("body");
    if (!body) {
        throw new Error("Malformed try_statement: " + node.text);
    }
    const clauses = node.children.filter((c) => c.type === "except_clause" || c.type === "else_clause" || c.type === "finally_clause");
    const firstClauseRow = clauses.length > 0 ? clauses[0].startPosition.row : undefined;
    const tryFrame = makeFrame(AllFrameTypesIdentifier.try, {}, s.isSPY);
    s = addFrame(tryFrame, tsLineno(node), s);
    updateFrom(s, copyBlockBody(body, node, {...s, addToNonJoint: tryFrame.childrenIds, addToJoint: undefined, parent: tryFrame}, firstClauseRow));

    for (let i = 0; i < clauses.length; i++) {
        const clause = clauses[i];
        const nextClauseRow = i + 1 < clauses.length ? clauses[i + 1].startPosition.row : undefined;
        if (clause.type === "except_clause") {
            // The except clause's own value/pattern is everything between "except" and ":" -- it
            // may be absent (blank except), a plain expression, or an "X as y" as_pattern:
            const valueChild = clause.child(1);
            let exceptFrame: FrameObject;
            if (!valueChild || valueChild.type === ":") {
                exceptFrame = makeFrame(AllFrameTypesIdentifier.except, {0: {slotStructures: {fields: [{code: ""}], operators: []}}}, s.isSPY);
            }
            else if (valueChild.type === "as_pattern") {
                const exceptType = valueChild.child(0);
                const alias = valueChild.childForFieldName("alias");
                if (!exceptType || !alias) {
                    throw new Error("Malformed except-as clause: " + clause.text);
                }
                exceptFrame = makeFrame(AllFrameTypesIdentifier.except, {0: {slotStructures: concatSlots(nodeToSlots(exceptType), "as", nodeToSlots(alias))}}, s.isSPY);
            }
            else {
                exceptFrame = makeFrame(AllFrameTypesIdentifier.except, {0: {slotStructures: nodeToSlots(valueChild)}}, s.isSPY);
            }
            const exceptBody = clause.childForFieldName("block") ?? clause.child(clause.childCount - 1);
            if (!exceptBody) {
                throw new Error("Malformed except_clause: " + clause.text);
            }
            const exceptState = addFrame(exceptFrame, tsLineno(clause), {...s, addToJoint: tryFrame.jointFrameIds, jointParent: tryFrame});
            updateFrom(s, copyBlockBody(exceptBody, clause, {...exceptState, addToNonJoint: exceptFrame.childrenIds, addToJoint: undefined, parent: exceptFrame}, nextClauseRow));
        }
        else if (clause.type === "finally_clause") {
            const finallyBody = clause.childForFieldName("block") ?? clause.child(clause.childCount - 1);
            if (!finallyBody) {
                throw new Error("Malformed finally_clause: " + clause.text);
            }
            const finallyFrame = makeFrame(AllFrameTypesIdentifier.finally, {}, s.isSPY);
            const finallyState = addFrame(finallyFrame, tsLineno(clause), {...s, addToJoint: tryFrame.jointFrameIds, jointParent: tryFrame});
            updateFrom(s, copyBlockBody(finallyBody, clause, {...finallyState, addToNonJoint: finallyFrame.childrenIds, addToJoint: undefined, parent: finallyFrame}, nextClauseRow));
        }
        else {
            // else_clause
            const elseBody = clause.childForFieldName("body");
            if (!elseBody) {
                throw new Error("Malformed else_clause: " + clause.text);
            }
            const elseFrame = makeFrame(AllFrameTypesIdentifier.else, {}, s.isSPY);
            const elseState = addFrame(elseFrame, tsLineno(clause), {...s, addToJoint: tryFrame.jointFrameIds, jointParent: tryFrame});
            updateFrom(s, copyBlockBody(elseBody, clause, {...elseState, addToNonJoint: elseFrame.childrenIds, addToJoint: undefined, parent: elseFrame}, nextClauseRow));
        }
    }
    return s;
}

function copyWithStatement(node: TSSyntaxNode, s: CopyState) : CopyState {
    const withClause = node.child(1);
    const body = node.childForFieldName("body");
    if (!withClause || withClause.type !== "with_clause" || !body) {
        throw new Error("Malformed with_statement: " + node.text);
    }
    const withItems = withClause.children.filter((c) => c.type === "with_item");
    if (withItems.length !== 1) {
        // Strype's "with" frame only has slots for a single context-manager/target pair -- the old
        // Skulpt-based grammar only ever exposed one with_item too, so this isn't a new gap, but
        // unlike that old code (which would have just silently used/dropped whichever items it
        // happened to index into), reject explicitly:
        throw new UnsupportedConstructError("Only a single 'with ... as ...' item is supported");
    }
    const value = withItems[0].childForFieldName("value");
    if (!value) {
        throw new Error("Malformed with_item: " + withItems[0].text);
    }
    let target: TSSyntaxNode | null = null;
    let contextManager = value;
    if (value.type === "as_pattern") {
        contextManager = value.child(0) as TSSyntaxNode;
        const alias = value.childForFieldName("alias");
        target = alias ? alias.child(0) ?? alias : null;
    }
    const withFrame = makeFrame(AllFrameTypesIdentifier.with, {0: {slotStructures: nodeToSlots(contextManager)}, 1: {slotStructures: tsSlotsOrBlank(target)}}, s.isSPY);
    s = addFrame(withFrame, tsLineno(node), s);
    // Must pull nextId/lastLineProcessed back via updateFrom() rather than returning the nested
    // body walk's state directly -- that state's `parent` is withFrame, not this statement's own
    // outer parent, and returning it as-is would leak into whatever sibling statement gets
    // processed next (processBlockItems() does `s = copyFramesFromTreeSitterNode(...)`, so any
    // handler that returns a body-walk's raw result corrupts every later sibling's parent too, not
    // just its own). See copyIfStatement()'s comment for how this was actually found.
    updateFrom(s, copyBlockBody(body, node, {...s, addToNonJoint: withFrame.childrenIds, addToJoint: undefined, parent: withFrame}));
    return s;
}

function copyFunctionDefinition(node: TSSyntaxNode, s: CopyState) : CopyState {
    const name = node.childForFieldName("name");
    const parameters = node.childForFieldName("parameters");
    const body = node.childForFieldName("body");
    const returnType = node.childForFieldName("return_type");
    if (!name || !parameters || !body) {
        throw new Error("Malformed function_definition: " + node.text);
    }
    if (returnType) {
        throw new UnsupportedConstructError("Return type annotations are not supported");
    }
    if (parameters.children.some((c) => c.type === "typed_parameter" || c.type === "typed_default_parameter")) {
        throw new UnsupportedConstructError("Parameter type annotations are not supported");
    }
    const funcdefFrame = makeFrame(AllFrameTypesIdentifier.funcdef, {0: {slotStructures: nodeToSlots(name)}, 1: {slotStructures: nodeToSlots(parameters)}}, s.isSPY);
    s = addFrame(funcdefFrame, tsLineno(node), s);
    // Check this *before* the recursive body walk, not after -- s.parent must still be the
    // outer/enclosing frame at that point (whether this def is directly inside a class), not
    // whatever the body walk's nested state last set parent to (see copyIfStatement()'s comment
    // for the general hazard this avoids -- this was the other bug it caught: a method's own
    // params ended up with a literal duplicate "self" typed into them, because this check read
    // s.parent *after* it had already been clobbered to funcdefFrame by the reassignment that
    // used to be here, so it was always false and removeFirstFuncParam() never ran):
    const isMethod = s.parent?.frameType.type == AllFrameTypesIdentifier.classdef;
    updateFrom(s, copyBlockBody(body, node, {
        ...s,
        addToNonJoint: funcdefFrame.childrenIds,
        addToJoint: undefined,
        parent: funcdefFrame,
        transformTopComment: (comment) => {
            funcdefFrame.labelSlotsDict[3] = {slotStructures: comment};
        },
    }));
    if (!(3 in funcdefFrame.labelSlotsDict)) {
        funcdefFrame.labelSlotsDict[3] = {slotStructures: {operators: [], fields: [{code: ""}]}};
    }
    if (isMethod) {
        // Remove the first param, assuming it is the "self" parameter that Strype adds automatically:
        removeFirstFuncParam(funcdefFrame.labelSlotsDict[1]);
    }
    return s;
}

function copyClassDefinition(node: TSSyntaxNode, s: CopyState) : CopyState {
    const name = node.childForFieldName("name");
    const body = node.childForFieldName("body");
    const superclasses = node.childForFieldName("superclasses"); // an argument_list, if present
    if (!name || !body) {
        throw new Error("Malformed class_definition: " + node.text);
    }
    let nameSlots = nodeToSlots(name);
    if (superclasses) {
        // Strype represents the parent-class list as a bracketed sub-structure appended directly
        // into the single "name" slot (matching the old code's approach), rather than as a
        // separate slot of its own:
        const parents = nodeToSlots(superclasses);
        parents.openingBracketValue = "(";
        nameSlots = {fields: [...nameSlots.fields, parents, {code: ""}], operators: [...nameSlots.operators, {code: ""}, {code: ""}]};
    }
    const classdefFrame = makeFrame(AllFrameTypesIdentifier.classdef, {0: {slotStructures: nameSlots}}, s.isSPY);
    s = addFrame(classdefFrame, tsLineno(node), s);
    updateFrom(s, copyBlockBody(body, node, {
        ...s,
        addToNonJoint: classdefFrame.childrenIds,
        addToJoint: undefined,
        parent: classdefFrame,
        transformTopComment: (comment) => {
            classdefFrame.labelSlotsDict[2] = {slotStructures: comment};
        },
    }));
    if (!(2 in classdefFrame.labelSlotsDict)) {
        classdefFrame.labelSlotsDict[2] = {slotStructures: {operators: [], fields: [{code: ""}]}};
    }
    return s;
}

function copyMatchStatement(node: TSSyntaxNode, s: CopyState) : CopyState {
    const subject = node.childForFieldName("subject");
    const body = node.childForFieldName("body");
    if (!subject || !body) {
        throw new Error("Malformed match_statement: " + node.text);
    }
    // Unlike the old code's customised, permissive Skulpt grammar (which allowed bare simple
    // statements directly under a match block, requiring checkValidMatchContent() to reject them
    // after the fact), standard tree-sitter-python's match_statement.body structurally only
    // accepts case_clauses -- anything else comes back as an ERROR node, which the (not yet
    // written) error-reporting step will surface, so no equivalent check is needed here.
    const matchFrame = makeFrame(AllFrameTypesIdentifier.match, {0: {slotStructures: nodeToSlots(subject)}}, s.isSPY);
    s = addFrame(matchFrame, tsLineno(node), s);
    updateFrom(s, copyBlockBody(body, node, {...s, addToNonJoint: matchFrame.childrenIds, addToJoint: undefined, parent: matchFrame}));
    return s;
}

function copyCaseClause(node: TSSyntaxNode, s: CopyState) : CopyState {
    const pattern = node.childForFieldName("pattern") ?? node.child(1);
    const body = node.childForFieldName("consequence") ?? node.childForFieldName("body") ?? node.child(node.childCount - 1);
    // The "guard" field is an if_clause node ([if, <condition>], the same shape used inside
    // comprehensions -- see comprehensionToSlots()), not the bare condition, so its "if" keyword
    // child must be skipped here to avoid it appearing twice: once as part of nodeToSlots(guard)
    // itself, and once more from the explicit "if" operator below (found via the same real-browser
    // smoke test that caught the state-clobbering bugs above -- "case 2 if x > 0:" was rendering
    // as "case 2 if if x > 0:"):
    const guard = node.childForFieldName("guard");
    const guardCondition = guard?.child(1);
    if (!pattern || !body) {
        throw new Error("Malformed case_clause: " + node.text);
    }
    const patternSlots = guardCondition ? concatSlots(nodeToSlots(pattern), "if", nodeToSlots(guardCondition)) : nodeToSlots(pattern);
    const caseFrame = makeFrame(AllFrameTypesIdentifier.case, {0: {slotStructures: patternSlots}}, s.isSPY);
    s = addFrame(caseFrame, tsLineno(node), s);
    updateFrom(s, copyBlockBody(body, node, {...s, addToNonJoint: caseFrame.childrenIds, addToJoint: undefined, parent: caseFrame}));
    return s;
}

function copyFramesFromTreeSitterNode(node: TSSyntaxNode, s: CopyState) : CopyState {
    switch (node.type) {
    case "expression_statement":
        return copyExpressionStatement(node, s);
    case "pass_statement":
        return {...s, lastLineProcessed: tsLineno(node)};
    case "break_statement":
        return addFrame(makeFrame(AllFrameTypesIdentifier.break, {}, s.isSPY), tsLineno(node), s);
    case "continue_statement":
        return addFrame(makeFrame(AllFrameTypesIdentifier.continue, {}, s.isSPY), tsLineno(node), s);
    case "global_statement":
        return addFrame(makeFrame(AllFrameTypesIdentifier.global, {0: {slotStructures: flattenChildren(node.children.slice(1))}}, s.isSPY), tsLineno(node), s);
    case "import_statement":
        return addFrame(makeFrame(AllFrameTypesIdentifier.import, {0: {slotStructures: flattenChildren(node.children.slice(1))}}, s.isSPY), tsLineno(node), s);
    case "import_from_statement": {
        const moduleNode = node.childForFieldName("module_name");
        const importIdx = node.children.findIndex((c) => c.type === "import" && c.childCount === 0);
        if (!moduleNode || importIdx < 0) {
            throw new Error("Malformed import_from_statement: " + node.text);
        }
        const names = flattenChildren(node.children.slice(importIdx + 1));
        return addFrame(makeFrame(AllFrameTypesIdentifier.fromimport, {0: {slotStructures: nodeToSlots(moduleNode)}, 1: {slotStructures: names}}, s.isSPY), tsLineno(node), s);
    }
    case "raise_statement": {
        if (node.childCount > 2) {
            // "raise X from Y" -- the old Skulpt-based grammar's raise_stmt never had more than one
            // value child, so this is a genuinely new case, not previously exercised; reject
            // explicitly rather than silently dropping the "from" clause:
            throw new UnsupportedConstructError("'raise ... from ...' is not supported");
        }
        return addFrame(makeFrame(AllFrameTypesIdentifier.raise, {0: {slotStructures: tsSlotsOrBlank(node.child(1))}}, s.isSPY), tsLineno(node), s);
    }
    case "return_statement":
        return addFrame(makeFrame(AllFrameTypesIdentifier.return, {0: {slotStructures: tsSlotsOrBlank(node.child(1))}}, s.isSPY), tsLineno(node), s);
    case "if_statement":
        return copyIfStatement(node, s);
    case "while_statement":
        return copyWhileStatement(node, s);
    case "for_statement":
        return copyForStatement(node, s);
    case "try_statement":
        return copyTryStatement(node, s);
    case "with_statement":
        return copyWithStatement(node, s);
    case "function_definition":
        return copyFunctionDefinition(node, s);
    case "class_definition":
        return copyClassDefinition(node, s);
    case "match_statement":
        return copyMatchStatement(node, s);
    case "case_clause":
        return copyCaseClause(node, s);
    case "decorated_definition":
        // Decorators are confirmed unsupported -- see PLAN.md §1:
        throw new UnsupportedConstructError("Decorators are not supported");
    default:
        // Anything else (del, assert, nonlocal, a module-level yield/await, etc.) is grammatically
        // parseable by tree-sitter but has no corresponding Strype frame -- reject explicitly
        // rather than silently dropping the statement, which is what the old code's switch (with
        // no matching case) would otherwise have done:
        throw new UnsupportedConstructError("Unsupported Python construct: " + node.type);
    }
}

// Function to check the current position in Strype.
// If a specific frame is given, we look for the position of this frame instead of the current frame.
export function findCurrentStrypeLocation(options?: {lookForGivenFramePosition?: {id: number, caretPosition: CaretPosition}}): {strypeLocation: STRYPE_LOCATION, locationFrameId: number} {
    // We detect the location by nativagating to the parents of the current Strype location (blue cursor) until we reach a significant parent type (see enum STRYPE_LOCATION)
    // If are below a frame, we look for its parent right away, otheriwse we can use that frame.
    let {id: navigFrameId, caretPosition: navigFrameCaretPos} = (options?.lookForGivenFramePosition)??useStore().currentFrame;
    do{
        const frameType = useStore().frameObjects[navigFrameId].frameType;
        switch(frameType.type){
        case ContainerTypesIdentifiers.framesMainContainer:
            return {strypeLocation: STRYPE_LOCATION.MAIN_CODE_SECTION, locationFrameId: navigFrameId};
        case AllFrameTypesIdentifier.classdef:
            return {strypeLocation: (navigFrameCaretPos == CaretPosition.body) ? STRYPE_LOCATION.IN_CLASSDEF : STRYPE_LOCATION.DEFS_SECTION, locationFrameId: navigFrameId};
        case AllFrameTypesIdentifier.funcdef:
            // We are at the body of a function definition, or at the bottom: in the first case, we are
            // inside a function definition; in the second, we are inside the definitions section.
            return {strypeLocation: (navigFrameCaretPos == CaretPosition.body) ? STRYPE_LOCATION.IN_FUNCDEF : STRYPE_LOCATION.DEFS_SECTION, locationFrameId: navigFrameId};
        case ContainerTypesIdentifiers.defsContainer:
            return {strypeLocation: STRYPE_LOCATION.DEFS_SECTION, locationFrameId: navigFrameId};
        case ContainerTypesIdentifiers.importsContainer:
            return {strypeLocation: STRYPE_LOCATION.IMPORTS_SECTION, locationFrameId: navigFrameId};
        default:
            if (useStore().frameObjects[navigFrameId].jointParentId > 0) {
                navigFrameId = useStore().frameObjects[navigFrameId].jointParentId;
            }
            else {
                navigFrameId = useStore().frameObjects[navigFrameId].parentId;
            }
            navigFrameCaretPos = CaretPosition.body; // since the frame is contained in something else.
            break;
        }
    }while(navigFrameId != 0);
    return {strypeLocation: STRYPE_LOCATION.UNKNOWN, locationFrameId: -100};
}

// This function makes a simple sanity check on the copied Python code (as frames then): we make sure that it "fits" the current Strype location
function canPastePythonAtStrypeLocation(currentStrypeLocation : STRYPE_LOCATION, frames: CopiedFrames): boolean {
    // In more details, we check the same-leve (top level) frames in the copy:
    // - in the "import" section, only imports can be copied,
    // - in the "function definition" section, only function definitions can be copied
    // - in the "main code" section or inside a function definition frame, only code that doesn't contain imports or function definitions can be copied (and "global" for main code)
    // Comments can also be imported in all sections. 
    // We remove any blank frames that could exist for an imports or function definitions section top frames: they are not required in the editor.
    // Nevertheless, for this test method to complete, we still need to accept blanks to be inside imports and function definitions for validation.
    
    const copiedPythonToFrames = Object.values(frames.frames);
    const topLevelCopiedFrames = copiedPythonToFrames.filter((frame) => frame.parentId == TOP_LEVEL_TEMP_ID);
    const topLevelCopiedFrameIds = topLevelCopiedFrames.flatMap((frame) => frame.id);
    // Check if the match between the current Strype location and the copied Python code frames is possible
    switch(currentStrypeLocation){
    case STRYPE_LOCATION.MAIN_CODE_SECTION:
        return !copiedPythonToFrames.some((frame) => [AllFrameTypesIdentifier.import, AllFrameTypesIdentifier.fromimport, AllFrameTypesIdentifier.classdef, AllFrameTypesIdentifier.funcdef, AllFrameTypesIdentifier.global].includes(frame.frameType.type));
    case STRYPE_LOCATION.IN_FUNCDEF:
        return !copiedPythonToFrames.some((frame) => [AllFrameTypesIdentifier.import, AllFrameTypesIdentifier.fromimport, AllFrameTypesIdentifier.classdef, AllFrameTypesIdentifier.funcdef].includes(frame.frameType.type));
    case STRYPE_LOCATION.DEFS_SECTION:
        frames = removeTopLevelBlankFrames(frames);
        // We are checking if we can paste; the not at the beginning means everything inside the ensuing bracket is actually the cases
        // where we *cannot* paste, then we invert this to get all the cases we can paste
        return !(topLevelCopiedFrames.some((frame) => ![AllFrameTypesIdentifier.funcdef, AllFrameTypesIdentifier.classdef, AllFrameTypesIdentifier.varassign, AllFrameTypesIdentifier.comment, AllFrameTypesIdentifier.blank].includes(frame.frameType.type))
            || copiedPythonToFrames.some((frame) =>
                // Look only at non-top-level (i.e. child) frames    
                !topLevelCopiedFrameIds.includes(frame.id) &&
                // Look for frames which are outright banned as children: 
                ([AllFrameTypesIdentifier.import, AllFrameTypesIdentifier.fromimport, AllFrameTypesIdentifier.classdef].includes(frame.frameType.type)
                // Funcdefs are a special case; they can be children, but only inside classes:
                ||
                (frame.frameType.type === AllFrameTypesIdentifier.funcdef
                    // Forbidden if either their parent is not top-level,
                    && (!topLevelCopiedFrameIds.includes(frame.parentId)
                        // Or if that parent is not a class:
                        || !topLevelCopiedFrames.some((p) => p.id == frame.parentId && p.frameType.type == AllFrameTypesIdentifier.classdef)))
                )));
    case  STRYPE_LOCATION.IMPORTS_SECTION:
        frames = removeTopLevelBlankFrames(frames);
        return !topLevelCopiedFrames.some((frame) => ![AllFrameTypesIdentifier.import, AllFrameTypesIdentifier.fromimport, AllFrameTypesIdentifier.library, AllFrameTypesIdentifier.comment, AllFrameTypesIdentifier.blank].includes(frame.frameType.type));
    case STRYPE_LOCATION.PROJECT_DOC_SECTION:
        frames = removeTopLevelBlankFrames(frames);
        // Given we transform top comment, shouldn't be anything left:
        return topLevelCopiedFrames.length == 0;
    default:
        // We shouldn't reach this but for safety we return false
        return false;
    }
}

// Note: modifies in-place, but for convenience returns its parameter
function removeTopLevelBlankFrames(frames: CopiedFrames): CopiedFrames {
    // Remove blank frames in the first level of the copied frames. T
    // This is useful when copying Python code that had line breaks between the function defs or the imports:
    // our editor do not allow adding blank frames, so they shouldn't be kept when pasted.
    const copiedPythonToFrames = Object.values(frames.frames);
    const topLevelCopiedFrames = copiedPythonToFrames.filter((frame) => frame.parentId == TOP_LEVEL_TEMP_ID);
    const topLevelBlankFramesIds = topLevelCopiedFrames.filter((frame) => frame.frameType.type === AllFrameTypesIdentifier.blank)
        .map((frame) => frame.id);
    topLevelBlankFramesIds.forEach((frameId) => {
        delete frames.frames[frameId];
        frames.frameIds.splice(frames.frameIds.indexOf(frameId), 1);
    });
    return frames;
}

interface NumberedLine {
    lineno: number;
    text: string;
}

function makeMapping(section: NumberedLine[]) : Record<number, number> {
    return section.reduce((acc, item, index) => {
        acc[index + 1] = item.lineno;
        return acc;
    }, {} as Record<number, number>);
}

// Takes a list of lines of Python code and splits them into four sections: imports, function definitions, class definitions, and main code.
// Each line of the original will end up in exactly one of the four parts of the return.
// With Python's indentation rules, this operation is actually easier at line level than it is post-parse.
// The mappings map line numbers in the returned sections to line numbers in the original
function splitLinesToSections(allLines : string[], leadingAssignmentsGoInDefs: boolean) : {projectDoc: string[], imports: string[]; funcDefs: string[]; classDefs: string[]; main: string[], importsMapping: Record<number, number>, funcDefsMapping: Record<number, number>, classDefsMapping: Record<number, number>, mainMapping: Record<number, number>, headers: Record<string, string>, format: "py" | "spy"} {
    // There's two possibilities:
    //  - we're loading a .spy with section headings, or
    //  - we're loading a .py where we must infer it.
    // Easy way to find out: check if the first line is a .spy header:
    if (allLines.length > 0 && allLines[0].match(new RegExp("^" + escapeRegExp(AppSPYFullPrefix) + " *" + AppName + " *:"))) {
        // It's a .spy!  Easy street, let's find the headings:
        let line = 1;
        const r = {
            projectDoc: [] as string[],
            imports: [] as string[],
            funcDefs: [] as string[],
            classDefs: [] as string[],
            main: [] as string[],
            importsMapping: {} as Record<number, number>,
            funcDefsMapping: {} as Record<number, number>,
            classDefsMapping: {} as Record<number, number>,
            mainMapping: {} as Record<number, number>,
            headers: {} as Record<string, string>,
            format: "spy" as "py" | "spy",
        };
        while (line < allLines.length && !allLines[line].match(new RegExp("^" + escapeRegExp(AppSPYFullPrefix) + " *Section *:Imports"))) {
            // Everything here should be metadata, add it to headers:
            const m = allLines[line].match(new RegExp("^" + escapeRegExp(AppSPYFullPrefix) + "([^:]+):(.*)"));
            if (m) {
                // Note: we only trim left-hand side, right-hand side is as-is:
                r.headers[m[1].trim()] = m[2];
            }
            else {
                r.projectDoc.push(allLines[line]);
            }
            line += 1;
        }
        line += 1;
        const firstImportLine = line;
        while (line < allLines.length && !allLines[line].match(new RegExp("^" + escapeRegExp(AppSPYFullPrefix) + " *Section *:Definitions"))) {
            r.imports.push(allLines[line]);
            r.importsMapping[line - firstImportLine] = line;
            line += 1;
        }
        line += 1;
        const firstDefsLine = line;
        while (line < allLines.length && !allLines[line].match(new RegExp("^" + escapeRegExp(AppSPYFullPrefix) + " *Section *:Main"))) {
            // Since it's an SPY we just say it's all class defs so it all ends up at top level:
            r.classDefs.push(allLines[line]);
            r.classDefsMapping[line - firstDefsLine] = line;
            line += 1;
        }
        line += 1;
        const firstMainLine = line;
        while (line < allLines.length && !allLines[line].match(new RegExp("^" + escapeRegExp(AppSPYFullPrefix) + " *Section *:Main"))) {
            r.main.push(allLines[line]);
            r.mainMapping[line - firstMainLine] = line;
            line += 1;
        }

        return r;
    }
    
    // We associate comments with the line immediately following them, so we keep a list of the most recent comments:
    let latestComments: NumberedLine[] = [];
    let latestAssignments: NumberedLine[] = [];
    const projectDoc: NumberedLine[] = [];
    const imports: NumberedLine[] = [];
    const funcDefs: NumberedLine[] = [];
    const classDefs: NumberedLine[] = [];
    const main: NumberedLine[] = [];
    // -1 if we're not in a def
    let outermostDefIndentLevel = -1;
    let curDefTypeIsClass = false;
    allLines.forEach((line : string, zeroBasedLine : number) => {
        const lineWithNum : NumberedLine = {text: line, lineno: zeroBasedLine + 1};
        const indentLevel = line.length - line.trimStart().length;
        if (line.trim() != "" && indentLevel <= outermostDefIndentLevel) {
            outermostDefIndentLevel = -1;
        }
        if (line.match(/^\s*["'].*/) && imports.length + funcDefs.length + classDefs.length + main.length == 0) {
            projectDoc.push(lineWithNum);
        }
        else if (line.match(/^\s*(import|from)\s+/)) {
            // Import:
            imports.push(...latestComments);
            latestComments = [];
            imports.push(lineWithNum);
        }
        // We're only the new outermost if there is no current outermost:
        else if (line.match(/^\s*class\s+/) && outermostDefIndentLevel == -1) {
            classDefs.push(...latestComments.map((l) => ({...l, text: l.text.trimStart() + " ".repeat(indentLevel)})));
            latestComments = [];
            classDefs.push(...latestAssignments);
            latestAssignments = [];
            classDefs.push({...lineWithNum, text: line.trimStart()});
            outermostDefIndentLevel = indentLevel;
            curDefTypeIsClass = true;
        }
        else if (line.match(/^\s*def\s+/) && outermostDefIndentLevel == -1) {
            funcDefs.push(...latestComments.map((l) => ({...l, text: l.text.trimStart() + " ".repeat(indentLevel)})));
            latestComments = [];
            funcDefs.push(...latestAssignments);
            latestAssignments = [];
            funcDefs.push({...lineWithNum, text: line.trimStart()});
            outermostDefIndentLevel = indentLevel;
            curDefTypeIsClass = false;
        }
        else if (line.match(/^\s*#/)) {
            latestComments.push(lineWithNum);
        }
        else if (outermostDefIndentLevel >= 0) {
            // Keep adding to defs until we see a non-comment non-blank line with less or equal indent:
            (curDefTypeIsClass ? classDefs : funcDefs).push(...latestComments);
            latestComments = [];
            (curDefTypeIsClass ? classDefs : funcDefs).push({...lineWithNum, text: line.slice(outermostDefIndentLevel)});
        }
        // Does it look like an assignment:
        else if (line.match(/^\s*[A-Za-z_][A-Za-z0-9_.,\[\]()\s]*?(?<![!<>=:])=(?!=)/)) {
            if (main.length == 0) {
                latestAssignments.push(lineWithNum);
            }
            else {
                main.push(lineWithNum);
            }
        }
        else {
            const mainWasEmpty = main.length == 0;
            main.push(...latestComments);
            latestComments = [];
            // We don't push leading blanks to main (i.e. blank lines while main is empty), otherwise all the blanks before/between imports and defs end up there:
            if (line.trim() != "" || !mainWasEmpty) {
                if (latestAssignments.length > 0) {
                    if (mainWasEmpty && leadingAssignmentsGoInDefs) {
                        funcDefs.push(...latestAssignments);
                    }
                    else {
                        main.push(...latestAssignments);
                    }
                    latestAssignments = [];
                }
                main.push(lineWithNum);
            }
        }
    });
    // Add any trailing comments and assignments:
    if (main.length == 0 && leadingAssignmentsGoInDefs) {
        funcDefs.push(...latestAssignments);
    }
    else {
        main.push(...latestAssignments);
    }
    main.push(...latestComments);
    
    return {
        projectDoc: projectDoc.sort((a, b) => a.lineno - b.lineno).map((l) => l.text), 
        imports: imports.sort((a, b) => a.lineno - b.lineno).map((l) => l.text),
        funcDefs: funcDefs.sort((a, b) => a.lineno - b.lineno).map((l) => l.text),
        classDefs: classDefs.sort((a, b) => a.lineno - b.lineno).map((l) => l.text),
        main: main.sort((a, b) => a.lineno - b.lineno).map((l) => l.text),
        importsMapping : makeMapping(imports),
        funcDefsMapping : makeMapping(funcDefs),
        classDefsMapping : makeMapping(classDefs),
        mainMapping : makeMapping(main),
        headers: {} as Record<string, string>,
        format: "py",
    };
}

// Returns headers if successful, or null if there was an error (which will already have been shown in the UI)
export function pasteMixedPython(completeSource: string, at: CurrentFrame, clearExisting: boolean = false, dontSetCaretAfter: boolean = false, ignoreStateBackup: boolean = false) : { headers: Record<string, string> } | null {
    const allLines = completeSource.split(/\r?\n/);
    // Split can make an extra blank line at the end which we don't want:
    if (allLines.length > 0 && allLines[allLines.length - 1] === "") {
        allLines.pop();
    }
    // If we are clearing all, we are effectively pasting into the main section,
    // no matter where the frame cursor happens to be:
    const curLocation = clearExisting ? STRYPE_LOCATION.MAIN_CODE_SECTION : findCurrentStrypeLocation({lookForGivenFramePosition: at}).strypeLocation;
    const s = splitLinesToSections(allLines, curLocation == STRYPE_LOCATION.DEFS_SECTION || curLocation == STRYPE_LOCATION.IMPORTS_SECTION);


    let importFrames : CopiedFrames;
    let funcDefFrames : CopiedFrames;
    let classDefFrames : CopiedFrames;
    let mainFrames : CopiedFrames;
    let docFrames : CopiedFrames;
    try {
        importFrames = copyFramesFromParsedPython(s.imports, STRYPE_LOCATION.IMPORTS_SECTION, s.format, s.importsMapping);
        funcDefFrames = copyFramesFromParsedPython(s.funcDefs, STRYPE_LOCATION.DEFS_SECTION, s.format, s.funcDefsMapping);
        classDefFrames = copyFramesFromParsedPython(s.classDefs, STRYPE_LOCATION.DEFS_SECTION, s.format, s.classDefsMapping);
        // We may be trying to paste something inside a function defintion.
        // The "content" to paste is seen as if it was to paste in the main section,
        // however the rules are slightly different: we use the current location to decide
        // what container we should check the code against.
        const pastingSectionTarget = (curLocation == STRYPE_LOCATION.IN_FUNCDEF) ? STRYPE_LOCATION.IN_FUNCDEF : STRYPE_LOCATION.MAIN_CODE_SECTION;
        mainFrames = copyFramesFromParsedPython(s.main, pastingSectionTarget, s.format, s.mainMapping);
        docFrames = copyFramesFromParsedPython(s.projectDoc, STRYPE_LOCATION.PROJECT_DOC_SECTION, s.format, s.mainMapping);
    }
    catch (err : any) {
        const msg = cloneDeep(MessageDefinitions.InvalidPythonParseImport);
        const msgObj = msg.message as FormattedMessage;
        msgObj.args[FormattedMessageArgKeyValuePlaceholders.error.key] = msgObj.args.errorMsg.replace(FormattedMessageArgKeyValuePlaceholders.error.placeholderName, err?.message);

        useStore().showMessage(msg, 10000);
        return null;
    }
    if (clearExisting) {
        // Clear the current existing code (i.e. frames) of the editor
        useStore().clearAllFrames();
    }
    
    // The logic for pasting is: every frame that are allowed at the current cursor's position are added.
    // Frames that are related to another section where the caret is not present are added in that section.
    if (docFrames.docSlots) {
        const docFrame = useStore().frameObjects[projectDocumentationFrameId] as FrameObject;
        docFrame.labelSlotsDict[0].slotStructures = docFrames.docSlots;
    }
    
    let posAfter = at;
    // Set to true if the main-code paste was rejected by insertFramesAtPosition (e.g. pasting a
    // joint frame like "else" at a position where it wouldn't form legal code).  Only mainFrames
    // can trigger this: imports/classDefs/funcDefs are never joint frames themselves, and a joint
    // frame pasted without its parent if/try can only ever land in mainFrames (see
    // splitLinesToSections), so insertFramesAtPosition's non-joint branch -- which never rejects --
    // is the only one those three other groups can hit. In that case the frames were never
    // actually added to the store, so we must not treat them as pasted below.
    let pasteRejected = false;

    // The rule for cursor positions for pasting in other sections is the point closest to the frame cursor;
    // see individual comments below

    if (importFrames.frameIds.length > 0) {
        const currentCaretContainerPosition = (curLocation == STRYPE_LOCATION.IMPORTS_SECTION)
            ? {...at}
            // If we're not in the imports, we know we're below it:
            : getLastCaretPosInsideParent(useStore().getImportsFrameContainerId);
        offsetAllIds(importFrames, useStore().nextAvailableId);
        const adjusted = useStore().insertFramesAtPosition({target: currentCaretContainerPosition, sourceFrames: importFrames, ignoreStateBackup});
        if (curLocation == STRYPE_LOCATION.IMPORTS_SECTION) {
            posAfter = adjusted ?? posAfter;
        }
    }
    if (classDefFrames.frameIds.length > 0) {
        let currentCaretContainerPosition: { id: number; caretPosition: CaretPosition };
        if (curLocation == STRYPE_LOCATION.DEFS_SECTION) {
            currentCaretContainerPosition = {...at};
        }
        else if (curLocation == STRYPE_LOCATION.IMPORTS_SECTION || curLocation == STRYPE_LOCATION.IN_FUNCDEF || curLocation == STRYPE_LOCATION.IN_CLASSDEF) {
            // Closest to imports is top of defs:
            // And for defs... we could find the closest cursor in the defs but it's quite fiddly so let's just add at the beginning:
            currentCaretContainerPosition = {id: useStore().getDefsFrameContainerId, caretPosition: CaretPosition.body};
        }
        else {
            // We are in main, use the bottom:
            currentCaretContainerPosition = getLastCaretPosInsideParent(useStore().getDefsFrameContainerId);
        }
        offsetAllIds(classDefFrames, useStore().nextAvailableId);
        const adjusted = useStore().insertFramesAtPosition({target: currentCaretContainerPosition, sourceFrames: classDefFrames, ignoreStateBackup});
        if (curLocation == STRYPE_LOCATION.DEFS_SECTION) {
            posAfter = adjusted ?? posAfter;
            // Adjust in case we also paste more in the defs:
            at = adjusted ?? at;
        }

    }
    if (funcDefFrames.frameIds.length > 0) {
        let currentCaretContainerPosition: { id: number; caretPosition: CaretPosition };
        if (curLocation == STRYPE_LOCATION.DEFS_SECTION || curLocation == STRYPE_LOCATION.IN_CLASSDEF) {
            currentCaretContainerPosition = {...at};
        }
        else if (curLocation == STRYPE_LOCATION.IMPORTS_SECTION || curLocation == STRYPE_LOCATION.IN_FUNCDEF) {
            // Closest to imports is top of defs:
            // And for defs... we could find the closest cursor in the defs but it's quite fiddly so let's just add at the beginning:
            currentCaretContainerPosition = {id: useStore().getDefsFrameContainerId, caretPosition: CaretPosition.body};
        }
        else {
            // We are in main, use the bottom:
            currentCaretContainerPosition = getLastCaretPosInsideParent(useStore().getDefsFrameContainerId);
        }
        offsetAllIds(funcDefFrames, useStore().nextAvailableId);
        // There is one awkward case.  If we copy a function from a class, it gets copied as "def foo(self)"
        // because the user might be pasting it externally.  But when we paste back in to Strype, because we add self
        // automatically, the function becomes "def foo(self, self)".  We strip it whether we're pasting into a class
        // (where we add self automatically) or as a top-level function (where a leading "self" almost certainly came
        // from copying a method, and doesn't belong on a plain function either way):
        Object.values(funcDefFrames.frames).forEach((frame: FrameObject) => {
            if (frame.frameType.type == AllFrameTypesIdentifier.funcdef) {
                const params = frame.labelSlotsDict[1];
                // We have to spot it by name as it may be a plain function:
                if (isFieldBaseSlot(params.slotStructures.fields[0]) && params.slotStructures.fields[0].code === "self") {
                    removeFirstFuncParam(params);
                }
            }
        });

        const adjusted = useStore().insertFramesAtPosition({target: currentCaretContainerPosition, sourceFrames: funcDefFrames, ignoreStateBackup});
        if (curLocation == STRYPE_LOCATION.DEFS_SECTION || curLocation == STRYPE_LOCATION.IN_CLASSDEF) {
            posAfter = adjusted ?? posAfter;
        }
    }
    if (mainFrames.frameIds.length > 0) {
        // If we're not in the main section, closest cursor will be the top:
        const currentCaretContainerPosition = (curLocation == STRYPE_LOCATION.IN_FUNCDEF || curLocation == STRYPE_LOCATION.MAIN_CODE_SECTION)
            ? {...at}
            : {id : useStore().getMainCodeFrameContainerId, caretPosition: CaretPosition.body};
        offsetAllIds(mainFrames, useStore().nextAvailableId);
        const adjusted = useStore().insertFramesAtPosition({target: currentCaretContainerPosition, sourceFrames: mainFrames, ignoreStateBackup});
        if (adjusted == null) {
            pasteRejected = true;
            // Nothing was actually inserted, so make sure it's not treated as pasted below:
            mainFrames.frames = {};
        }
        else if (curLocation == STRYPE_LOCATION.IN_FUNCDEF || curLocation == STRYPE_LOCATION.MAIN_CODE_SECTION) {
            posAfter = adjusted;
        }
    }
    if (pasteRejected) {
        useStore().showMessage(MessageDefinitions.ForbiddenFramePaste, 10000);
    }
    if (!dontSetCaretAfter) {
        useStore().setCurrentFrame(posAfter, true);
    }
    const framesAdded = [
        Object.keys(importFrames.frames),
        Object.keys(classDefFrames.frames),
        Object.keys(funcDefFrames.frames),
        Object.keys(mainFrames.frames),
    ].flat().map(Number);
    void nextTick(() => {
        eventBus.emit(CustomEventTypes.updateParamPrompts, framesAdded);
        framesAdded.forEach((pastedFrameId) => checkCodeErrors(pastedFrameId));
    });
    
    return {headers: s.headers};
}

const transformTripleQuotesStrings = (slots: {[index: number]: LabelSlotsContent}): void => {
    // This helper function replaces all strings content in slots that came up from parsing triple quotes strings literals.
    // It keeps the single or double quote string token (resulting from the parsing) and deletes the remaining 2 extra quotes on each ends
    // of the string literal. It also replaces line breaks by literal "\n".
    const doTransformTripleQuotesStringsOnSlotStructs = (slotsStruct: SlotsStructure) => {
        slotsStruct.fields.forEach((fieldSlot) => {
            if(isFieldBracketedSlot(fieldSlot)){
                // Bracket slots have a deeper level, we need to check inside
                doTransformTripleQuotesStringsOnSlotStructs(fieldSlot);
            }
            else if(isFieldStringSlot(fieldSlot)){
                // A string: we check if it has been generated from a triple quotes string parsing
                const stringSlotLiteralValue = fieldSlot.code;
                if((fieldSlot.quote == "'" && parsedTripleSingleQuotesStrRegex.test(stringSlotLiteralValue)) 
                    || (fieldSlot.quote == "\"" && parsedTripleDoubleQuotesStrRegex.test(stringSlotLiteralValue))){
                    fieldSlot.code = stringSlotLiteralValue.slice(2, -2).replaceAll(/\r?\n/g, STRYPE_DOC_NEWLINE);
                }
            }
            // Else, there is nothing to transform
        });
        
    };
    Object.values(slots).forEach((slotsStruct) => doTransformTripleQuotesStringsOnSlotStructs(slotsStruct.slotStructures));
};

const checkValidMatchContent = (parentType?: string, lineno?: number): void => {
    // See copyFramesToPyton() - case Sk.ParseTables.sym.match_stmt - for why we need this.
    // This method is only to be called on ambigious cases allowed by Skulpt permissibilty :
    // normal cases or handled Strype comments or handled Strype blank lines are parsed anyway.
    // If we are in a match statement (parentType is set and is for "match"), we return an error.
    if(parentType == AllFrameTypesIdentifier.match){
        // Error format to match what's expected in copyFramesFromParsedPython        
        throw {$msg: {$mangled: i18n.global.t("messageBannerMessage.invalidMatchStmtContent")}, traceback: [{lineno: lineno}]};
    }
};
