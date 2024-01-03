import {CaretPosition, AllFrameTypesIdentifier, FrameObject, LabelSlotsContent, getFrameDefType, SlotsStructure} from "@/types/types";
import {useStore} from "@/store/store";
import {operators, trimmedKeywordOperators} from "@/helpers/editor";

export interface ParsedConcreteTree {
    type: number;
    value: null | string;
    lineno? : number;
    col_offset?: number;
    children: null | ParsedConcreteTree[];
}

interface CopyState {
    nextId: number;
}

declare const Sk: any;

// Simplifies a tree (by collapsing all single-child nodes into the child) in order to make
// it easier to read while debugging
function debugSimplify(p : ParsedConcreteTree) : ParsedConcreteTree {
    if (p.children == null || p.children.length == 0) {
        return p;
    }
    else if (p.children.length == 1) {
        return debugSimplify(p.children[0]);
    }
    else {
        return {...p, children: p.children.map(debugSimplify)}; 
    }
}

function addFrame(frame: FrameObject, s: CopyState) : CopyState {
    console.log("Added frame: " + JSON.stringify(frame));
    const id = s.nextId;
    frame.id = id;
    useStore().copiedFrames[id] = frame;
    useStore().copiedSelectionFrameIds.push(id);
    return {...s, nextId: s.nextId + 1};
}

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
        parentId: -100,
        runTimeError: "",
    };
}

export function copyFramesFromParsedPython(parsedBySkulpt: ParsedConcreteTree) : boolean {
    useStore().copiedFrames = {};
    useStore().copiedSelectionFrameIds = [];
    try {
        // To avoid problems, choose an ID way outside the existing frames:
        copyFramesFromPython(parsedBySkulpt, {nextId: 1000000});
        return true;
    }
    catch (e) {
        console.error(e, "On: " + JSON.stringify(debugSimplify(parsedBySkulpt)));
        // Don't leave partial content:
        useStore().copiedFrames = {};
        useStore().copiedSelectionFrameIds = [];
        return false;
    }
}

function concatSlots(lhs: SlotsStructure, operator: string, rhs: SlotsStructure) : SlotsStructure {
    return {fields: [...lhs.fields, ...rhs.fields], operators: [...lhs.operators, {code: operator}, ...rhs.operators]};
}

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
        throw new Error("Can't find single operator in " + JSON.stringify(debugSimplify(p)));
    }
}

function toSlots(p: ParsedConcreteTree) : SlotsStructure {
    // Handle terminal nodes by just plonking them into a single-field slot:
    if (!p.children && p.value != null) {
        return {fields: [{code: p.value}], operators: []};
    }
    else if (p.children == null) {
        throw new Error("Node with no value and no children");
    }
    
    // Skulpt's parser seems to output a huge amount of dummy nodes with one child,
    // e.g. an OR inside an AND.  We have a catch-all that just descends if there's only one child:
    if (p.children.length == 1) {
        return toSlots(p.children[0]);
    }
    
    // Watch out for unary expressions:
    if (p.children[0].value === "-") {
        return concatSlots({fields: [{code: ""}], operators: []}, p.children[0].value, toSlots(p.children[1]));
    }
    
    // Check for brackets:
    if (p.children[0].value === "(" || p.children[0].value === "[" || p.children[0].value === "{") {
        const bracketed =  toSlots({...p, children: p.children.slice(1, p.children.length - 1)});
        // Bracketed items must be surrounded by empty slot and empty operator each side:
        return {fields: [{code: ""},{...bracketed, openingBracketValue: p.children[0].value}, {code: ""}], operators: [{code: ""}, {code: ""}]};
    }
    
    let cur = toSlots(p.children[0]);
    for (let i = 1; i < p.children.length; i += 2) {
        const op = digValue(p.children[i]);
        if (op != null && (operators.includes(op) || trimmedKeywordOperators.includes(op))) {
            cur = concatSlots(cur, op, toSlots(p.children[i + 1]));
        }
        else {
            throw new Error("Unknown operator: " + p.children[i].type + " \"" + op + "\"");
        }
    }
    return cur;
    
    //throw new Error("Unknown expression type: " + p.type);
}

function children(p : ParsedConcreteTree) : ParsedConcreteTree[] {
    if (p.children == null) {
        throw new Error("Null children on node " + JSON.stringify(p));
    }
    return p.children;
}

// Returns the frame ID of the next insertion point for any following statements
function copyFramesFromPython(parsedBySkulpt: ParsedConcreteTree, s : CopyState) : CopyState {
    console.log("Processing type: " + parsedBySkulpt.type);
    switch (parsedBySkulpt.type) {
    case Sk.ParseTables.sym.file_input:
        // The outer wrapper for the whole file, just dig in:
        for (const child of children(parsedBySkulpt)) {
            s = copyFramesFromPython(child, s);
        }
        break;
    case Sk.ParseTables.sym.stmt:
    case Sk.ParseTables.sym.simple_stmt:
    case Sk.ParseTables.sym.small_stmt:
    case Sk.ParseTables.sym.flow_stmt:
        // Wrappers where we just skip to the children:
        for (const child of children(parsedBySkulpt)) {
            s = copyFramesFromPython(child, s);
        }
        break;
    case Sk.ParseTables.sym.pass_stmt:
        // We do not insert pass frames
        break;
    case Sk.ParseTables.sym.raise_stmt:
        s = addFrame(makeFrame(AllFrameTypesIdentifier.raise, {0: {slotStructures: toSlots(children(parsedBySkulpt)[1])}}), s);
        break;
    }
    return s;
}
