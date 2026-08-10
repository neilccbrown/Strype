import { describe, expect, test } from "vitest";
import { preprocessBeforeParse } from "@/helpers/pythonToFramesPreprocess";

describe("preprocessBeforeParse", () => {
    test("leaves ordinary code untouched", () => {
        const result = preprocessBeforeParse(["x = 1", "y = 2"]);
        expect(result.source).toBe("x = 1\ny = 2");
        expect(result.disabledLines).toEqual([]);
    });

    test("strips the Disabled: prefix and records the line number", () => {
        // Matches the real format written by parser.ts (indentation + "#(=> Disabled:" + code,
        // no separating space):
        const result = preprocessBeforeParse(["x = 1", "#(=> Disabled:y = 2", "z = 3"]);
        expect(result.source).toBe("x = 1\ny = 2\nz = 3");
        expect(result.disabledLines).toEqual([2]);
    });

    test("preserves indentation on a disabled line", () => {
        const result = preprocessBeforeParse(["if x:", "    #(=> Disabled:y = 2"]);
        expect(result.source).toBe("if x:\n    y = 2");
        expect(result.disabledLines).toEqual([2]);
    });

    test("leaves Library/LibraryDisabled/FrameState directive comments as plain comments", () => {
        const result = preprocessBeforeParse(["#(=> Library: foo", "x = 1"]);
        expect(result.source).toBe("#(=> Library: foo\nx = 1");
        expect(result.disabledLines).toEqual([]);
    });

    test("handles multiple disabled lines", () => {
        const result = preprocessBeforeParse([
            "#(=> Disabled:a = 1",
            "b = 2",
            "#(=> Disabled:c = 3",
        ]);
        expect(result.source).toBe("a = 1\nb = 2\nc = 3");
        expect(result.disabledLines).toEqual([1, 3]);
    });
});
