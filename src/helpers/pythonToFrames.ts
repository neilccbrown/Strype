import {CaretPosition, AllFrameTypesIdentifier, FrameObject, LabelSlotsContent, getFrameDefType, SlotsStructure, StringSlot, BaseSlot} from "@/types/types";
import {useStore} from "@/store/store";
import {operators, trimmedKeywordOperators} from "@/helpers/editor";

// Type for the things we get from the Skulpt parser:
export interface ParsedConcreteTree {
    type: number;
    value: null | string;
    lineno? : number;
    col_offset?: number;
    children: null | ParsedConcreteTree[];
}
// A comment or blank line, plus a line number location in the original Python:
interface LocatedCommentOrBlankLine {
    lineNumber: number;
    content: string | null; // If null, it's a blank line (not a blank comment!)
}
// The state passed around while copying from Python code into frames
interface CopyState {
    nextId: number; // The next ID to use for a new frame
    addTo: number[]; // List to add frames to
    parent: FrameObject | null; // The parent, if any, for borrowing the parent ID
    pendingComments: LocatedCommentOrBlankLine[]; // Modified in-place
}

// Declare Skulpt:
declare const Sk: any;

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
function addFrame(frame: FrameObject, s: CopyState) : CopyState {
    const id = s.nextId;
    frame.id = id;
    useStore().copiedFrames[id] = frame;
    s.addTo.push(id);
    if (!frame.frameType.isJointFrame) {
        if (s.parent != null) {
            frame.parentId = s.parent.id;
            // Don't need to add to children because that will already be the addTo array
        }
        else {
            // The pasting code relies on parent being set to non-zero for non-joint frames,
            // so we just set it to an invalid integer:
            frame.parentId = -999;
        }
    }
    return {...s, nextId: s.nextId + 1};
}

// Makes a basic frame object with the given type and slots, and dummy/default values for all other fields
function makeFrame(type: string, slots: { [index: number]: LabelSlotsContent}) : FrameObject {
    return {
        frameType : getFrameDefType(type),
        caretVisibility: CaretPosition.none,
        childrenIds: [],
        id: -100, // Will be set during addFrame
        isCollapsed: false,
        isDisabled: false,
        isSelected: false,
        isVisible: true,
        jointFrameIds: [],
        jointParentId: 0,
        labelSlotsDict: slots,
        multiDragPosition: "",
        parentId: 0,
        runTimeError: "",
    };
}

// The main entry point to this module.  Given a string of Python code that the user
// has pasted in, copy it to the store's copiedFrames/copiedSelectionFrameIds fields,
// ready to be pasted immediately afterwards.
// Returns a boolean indicating whether we were successful.  A return of false
// usually indicates that the string wasn't valid Python (e.g. syntactically invalid)
export function copyFramesFromParsedPython(code: string) : boolean {
    // Preprocess; first take off trailing whitespace:
    code = code.trimEnd();
    const codeLines = code.split(/\r?\n/);
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
            const indent = (codeLine.match(/^\s*/) as RegExpMatchArray)[0].length;
            if (indent < lowestIndent) {
                lowestIndent = indent;
            }
        }
    }
    // Now remove that indent if it exists:
    if (lowestIndent > 0) {
        for (let i = 0; i < codeLines.length; i++) {
            codeLines[i] = codeLines[i].slice(lowestIndent);
        }
    }
        
    // Have to configure Skulpt even though we're only using it for parsing:
    Sk.configure({});
    const parsed = Sk.parse("pasted_content.py", codeLines.join("\n"));
    const parsedBySkulpt = parsed["cst"];
    
    // Skulpt doesn't preserve blanks or comments so we must find them then later reinsert them
    // ourselves at the right points:
    // Find all comments.  This isn't quite perfect (with respect to # in strings) but it will do:
    const comments : LocatedCommentOrBlankLine[] = [];
    for (let i = 0; i < codeLines.length; i++) {
        // Look for # with only space before them, or a # with no quote after:
        const match = /^ +#(.*)$/.exec(codeLines[i]) ?? /#([^"]+)$/.exec(codeLines[i]);
        if (match) {
            comments.push({lineNumber: i + 1, content: match[1]});
        }
        else if (codeLines[i].trim() === "") {
            // Blank line:
            comments.push({lineNumber: i + 1, content: null});
        }
    }
    
    useStore().copiedFrames = {};
    useStore().copiedSelectionFrameIds = [];
    try {
        // To avoid problems, choose an ID way outside the existing frames:
        copyFramesFromPython(parsedBySkulpt, {nextId: 1000000, addTo: useStore().copiedSelectionFrameIds, pendingComments: comments, parent: null});
        return true;
    }
    catch (e) {
        console.error(e, "On:\n" + debugToString(parsedBySkulpt, "  "));
        // Don't leave partial content:
        useStore().copiedFrames = {};
        useStore().copiedSelectionFrameIds = [];
        return false;
    }
}

// Concatenates two slot structures with the given operator.
// Eliminates any redundant blank operators.
function concatSlots(lhs: SlotsStructure, operator: string, rhs: SlotsStructure) : SlotsStructure {
    const joined = {fields: [...lhs.fields, ...rhs.fields], operators: [...lhs.operators, {code: operator}, ...rhs.operators]};
    // Eliminate any redundant blank operators (i.e. those where the RHS or RHS is a non-bracketed blank:
    for (let i = 0; i < joined.operators.length; i++) {
        if (joined.operators[i].code === "") {
            // Check LHS and RHS:
            if (!(joined.fields[i] as SlotsStructure)?.openingBracketValue && !(joined.fields[i] as StringSlot)?.quote && !(joined.fields[i+1] as SlotsStructure)?.openingBracketValue && !(joined.fields[i+1] as StringSlot)?.quote) {
                // We can join the two:
                joined.fields[i] = {code: (joined.fields[i] as BaseSlot).code + (joined.fields[i+1] as BaseSlot).code};
                joined.fields.splice(i + 1, 1);
                joined.operators.splice(i, 1);
                // Make us re-examine operator i:
                i -= 1;
                continue;
            }
        }
    }
    return joined;
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
        catch (e) {
            // Not an integer then...
        }
        
        ps.nextIndex += 1;
        return concatSlots({fields: [{code: ""}], operators: []}, nextVal, parseNextTerm(ps));
    }
    if (nextVal === "not") {
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
        const val = p.value ?? "";
        if (val.startsWith("\"") || val.startsWith("'")) {
            const str : StringSlot = {code: val.slice(1, val.length - 1), quote: val.slice(0, 1)};
            return {fields: [{code: ""}, str, {code: ""}], operators: [{code: ""}, {code: ""}]};
        }
        else {
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
        if (p.children[ps.nextIndex].type === Sk.ParseTables.sym.trailer) {
            // A suffix, like an array index lookup.  Join it and move forward only by one:
            const grandchildren = p.children[ps.nextIndex].children;
            if (grandchildren != null && grandchildren[0].value === ".") {
                latest = concatSlots(latest, ".", toSlots(grandchildren[1]));
            }
            else {
                // Something bracketed:
                latest = concatSlots(latest, "", toSlots(p.children[ps.nextIndex]));
            }
            ps.nextIndex += 1;
            continue;
        }
        // Now we expect a binary operator:        
        let op;
        try {
            op = digValue(p.children[ps.nextIndex]);
            ps.nextIndex += 1;
        }
        catch (err) {
            throw new Error("Cannot find operator " + ps.nextIndex + " in:\n" + debugToString(p, ""), {cause: err});
        }
        if (op != null && (operators.includes(op) || trimmedKeywordOperators.includes(op))) {
            latest = concatSlots(latest, op, parseNextTerm(ps));
        }
        else {
            throw new Error("Unknown operator: " + p.children[ps.nextIndex].type + " \"" + op + "\"");
        }
    }
    return latest;
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
// the given index for the body, and call addFrame on it.
function makeAndAddFrameWithBody(p: ParsedConcreteTree, frameType: string, childrenIndicesForSlots: (number | number[])[], childIndexForBody: number, s : CopyState, afterwards? : ((f : FrameObject) => void)) : CopyState {
    const slots : { [index: number]: LabelSlotsContent} = {};
    for (let slotIndex = 0; slotIndex < childrenIndicesForSlots.length; slotIndex++) {
        slots[slotIndex] = {slotStructures : toSlots(applyIndex(p, childrenIndicesForSlots[slotIndex]))};
    }
    const frame = makeFrame(frameType, slots);
    s = addFrame(frame, s);
    const nextId = copyFramesFromPython(children(p)[childIndexForBody], {...s, addTo: frame.childrenIds, parent: frame}).nextId;
    if (afterwards !== undefined) {
        afterwards(frame);
    }
    return {...s, nextId: nextId};
}

// Check if there any comments/blanks in s.pendingComments that appear at or before the given line number,
// and insert them as blanks/comment frames at the given point 
function flushComments(lineno: number, s: CopyState) {
    while (s.pendingComments.length > 0 && s.pendingComments[0].lineNumber <= lineno) {
        if (s.pendingComments[0].content === null) {
            s = addFrame(makeFrame(AllFrameTypesIdentifier.blank, {}), s);
        }
        else {
            s = addFrame(makeFrame(AllFrameTypesIdentifier.comment, {0: {slotStructures: {fields: [{code: s.pendingComments[0].content}], operators: []}}}), s);
        }
        // Remove first item:
        s.pendingComments.splice(0, 1);
    }
    return s;
}

// Process the given node in the tree at the current point designed by CopyState 
// Returns a copy state, including the frame ID of the next insertion point for any following statements
function copyFramesFromPython(p: ParsedConcreteTree, s : CopyState) : CopyState {
    //console.log("Processing type: " + (Sk.ParseTables.number2symbol[p.type] || ("#" + p.type)));
    if (p.lineno) {
        s = flushComments(p.lineno, s);
    }
    
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
        // Wrappers where we just skip to the children:
        for (const child of children(p)) {
            s = copyFramesFromPython(child, s);
        }
        break;
    case Sk.ParseTables.sym.expr_stmt:
        if (p.children) {
            const index = p.children.findIndex((x) => x.value === "=");
            if (index >= 0) {
                // An assignment
                const lhs = toSlots({...p, children: p.children.slice(0, index)});
                const rhs = toSlots({...p, children: p.children.slice(index + 1)});
                s = addFrame(makeFrame(AllFrameTypesIdentifier.varassign, {0: {slotStructures: lhs}, 1: {slotStructures: rhs}}), s);
            }
            else {
                // Everything else goes in method call:
                s = addFrame(makeFrame(AllFrameTypesIdentifier.funccall, {0: {slotStructures: toSlots(p)}}), s);
            }
        }
        break;
    case Sk.ParseTables.sym.pass_stmt:
        // We do not insert pass frames
        break;
    case Sk.ParseTables.sym.break_stmt:
        s = addFrame(makeFrame(AllFrameTypesIdentifier.break, {}), s);
        break;
    case Sk.ParseTables.sym.continue_stmt:
        s = addFrame(makeFrame(AllFrameTypesIdentifier.continue, {}), s);
        break;
    case Sk.ParseTables.sym.global_stmt:
        s = addFrame(makeFrame(AllFrameTypesIdentifier.global, {0: {slotStructures: toSlots(children(p)[1])}}), s);
        break;
    case Sk.ParseTables.sym.import_name:
        s = addFrame(makeFrame(AllFrameTypesIdentifier.import, {0: {slotStructures: toSlots(children(p)[1])}}), s);
        break;
    case Sk.ParseTables.sym.import_from:
        s = addFrame(makeFrame(AllFrameTypesIdentifier.fromimport, {0: {slotStructures: toSlots(children(p)[1])}, 1: {slotStructures: toSlots(children(p)[3])}}), s);
        break;
    case Sk.ParseTables.sym.raise_stmt:
        s = addFrame(makeFrame(AllFrameTypesIdentifier.raise, {0: {slotStructures: toSlots(children(p)[1])}}), s);
        break;
    case Sk.ParseTables.sym.return_stmt:
        s = addFrame(makeFrame(AllFrameTypesIdentifier.return, {0: {slotStructures: toSlots(children(p)[1])}}), s);
        break;
    case Sk.ParseTables.sym.if_stmt: {
        // First child is keyword, second is the condition, third is colon, fourth is body
        const ifFrame: FrameObject[] = [];
        s = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.if, [1], 3, s, (f : FrameObject) => ifFrame.push(f));
        // If can have elif, else, so keep going to check for that:
        for (let i = 4; i < children(p).length; i++) {
            if (children(p)[i].value === "else") {
                // Skip the else and the colon, which are separate tokens:
                i += 2;
                s.nextId = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.else, [], i, {...s, addTo: ifFrame[0].jointFrameIds, parent: null}, (f) => {
                    f.jointParentId = ifFrame[0].id;
                }).nextId;
            }
            else if (children(p)[i].value === "elif") {
                // Skip the elif:
                i += 1;
                s.nextId = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.elif, [i], i + 2, {...s, addTo: ifFrame[0].jointFrameIds, parent: null}, (f) => {
                    f.jointParentId = ifFrame[0].id;
                }).nextId;
                // Skip the condition and the colon:
                i += 2;
            }
        }
        break;
    }
    case Sk.ParseTables.sym.while_stmt:
        // First child is keyword, second is the condition, third is colon, fourth is body
        s = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.while, [1], 3, s);
        break;
    case Sk.ParseTables.sym.for_stmt:
        // First child is keyword, second is the loop var, third is keyword, fourth is collection, fifth is colon, sixth is body
        s = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.for, [1, 3], 5, s);
        break;
    case Sk.ParseTables.sym.try_stmt: {
        // First is keyword, second is colon, third is body
        const tryFrame : FrameObject[] = [];
        s = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.try, [], 2, s, (f) => tryFrame.push(f));
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
                    exceptFrame = makeFrame(AllFrameTypesIdentifier.except, {0: {slotStructures:
                                concatSlots(toSlots(grandchildren[1]), "as", toSlots(grandchildren[3])),
                    }});
                }
                else if (grandchildren.length == 2) {
                    exceptFrame = makeFrame(AllFrameTypesIdentifier.except, {0: {slotStructures: toSlots(grandchildren[1])}});
                }
                else {
                    // Shouldn't happen, but skip if so:
                    continue;
                }
                exceptFrame.jointParentId = tryFrame[0].id;
                s.nextId = addFrame(exceptFrame, {...s, addTo: tryFrame[0].jointFrameIds, parent: null}).nextId;
                // The children of the except actually follow as a sibling of the clause, after the colon (hence i + 2):
                s.nextId = copyFramesFromPython(children(p)[i+2], {...s, parent: exceptFrame, addTo: exceptFrame.childrenIds}).nextId;
            }
            else if (child.value === "finally") {
                // Weirdly, finally doesn't seem to have a proper node type, it's just a normal child
                // followed by a colon followed by a body
                s.nextId = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.finally, [], i + 2, {...s, addTo: tryFrame[0].jointFrameIds, parent: null}, (f) => f.jointParentId = tryFrame[0].id).nextId;
            }
        }
        break;
    }
    case Sk.ParseTables.sym.with_stmt:
        // First child is keyword, second is with_item that has [LHS, "as", RHS] as children, third is colon, fourth is body
        s = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.with, [[1, 0], [1, 2]], 3, s);
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
    case Sk.ParseTables.sym.funcdef:
        // First child is keyword, second is the name, third is params, fourth is colon, fifth is body
        s = makeAndAddFrameWithBody(p, AllFrameTypesIdentifier.funcdef, [1, 2], 4, s);
        break;
    }
    return s;
}
