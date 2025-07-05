function getCaretScreenPosition() : { x: number; y: number } | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.focusNode) {
        return null;
    }

    const range = document.createRange();
    try {
        range.setStart(sel.focusNode, sel.focusOffset);
        range.collapse(true);
    }
    catch {
        return null;
    }
    const rect = range.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
}

type SpanRect = { span: HTMLSpanElement, offset: number, x: number, y: number };

function getCharRects(span : HTMLSpanElement) : SpanRect[] {
    const rects : SpanRect[] = [];
    const text = span.textContent || "";
    const node = span.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) {
        return rects;
    }

    for (let i = 0; i <= text.length; i++) {
        // Don't consider positioning after a final zero-width space:
        if (i === text.length && text[i - 1] == "\u200B") {
            break;
        }
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
            rects.push({ span, offset: i, x: rect.left, y: rect.top });
        }
        range.detach();
    }
    return rects;
}

type LineInfo = { y: number, rects: SpanRect[] };

function groupRectsByLine(rects : SpanRect[], lineTolerance = 5) : LineInfo[] {
    const lines : LineInfo[] = [];
    rects.sort((a, b) => a.y - b.y);

    for (const rect of rects) {
        const line = lines.find((line) => Math.abs(line.y - rect.y) <= lineTolerance);
        if (line) {
            line.rects.push(rect);
        }
        else {
            lines.push({ y: rect.y, rects: [rect] });
        }
    }

    return lines;
}

function moveCaretToPosition(span : HTMLSpanElement, offset : number) : void {
    const range = document.createRange();
    const node = span.firstChild;
    if (!node) {
        return;
    }
    range.setStart(node, offset);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
}

function findClosestRectInLine(lineRects : SpanRect[], targetX : number) : SpanRect | null {
    let closest = null;
    let minDx = Infinity;
    for (const r of lineRects) {
        const dx = Math.abs(r.x - targetX);
        if (dx < minDx) {
            minDx = dx;
            closest = r;
        }
    }
    return closest;
}

// Moves the caret up or down within the given list of spans, by finding the vertical
// position that is closest to being directly above the current cursor position.
// If there was such a position, it is returned; if there was nowhere above to move to, null is returned.
export function handleVerticalCaretMove(spans: HTMLSpanElement[], direction : "up" | "down") : { span: HTMLSpanElement, offset: number } | null {
    const caretPos = getCaretScreenPosition();
    if (!caretPos) {
        return null;
    }

    //const spans = Array.from(document.querySelectorAll("span[contenteditable=\"true\"]"));
    const allRects = spans.flatMap(getCharRects);
    const lines = groupRectsByLine(allRects);

    const currentLineIndex = lines.findIndex((line) => Math.abs(line.y - caretPos.y) < 5);
    if (currentLineIndex === -1) {
        return null;
    }

    const targetIndex = direction === "up" ? currentLineIndex - 1 : currentLineIndex + 1;
    if (targetIndex < 0 || targetIndex >= lines.length) {
        return null;
    }

    const targetLine = lines[targetIndex];
    const closest = findClosestRectInLine(targetLine.rects, caretPos.x);
    if (closest) {
        moveCaretToPosition(closest.span, closest.offset);
    }
    return closest;
}
