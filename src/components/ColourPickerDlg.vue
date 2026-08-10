<template>
    <ModalDlg dlgId="colourPickerDlg" :dlgTitle="$t('media.colourPickerTitle')" :okDisabled="okDisabled">
        <div class="ColourPickerDlg-content">
            <div class="ColourPickerDlg-view-area">
                <div v-if="view === 'grid'" class="ColourPickerDlg-family-grid">
                    <button
                        v-for="family in families"
                        :key="family.key"
                        type="button"
                        class="ColourPickerDlg-family-btn"
                        @click="selectFamily(family)"
                    >
                        <span class="ColourPickerDlg-family-swatch" :style="{background: familySwatchHex(family)}"></span>
                        <span class="ColourPickerDlg-family-name">{{ $t(family.nameKey) }}</span>
                    </button>
                </div>

                <div v-else-if="view === 'tinker' && currentFamily">
                    <div v-if="hasHue">
                        <p class="ColourPickerDlg-section-label">{{ $t("colourPicker.hue") }}</p>
                        <div class="ColourPickerDlg-hue-strip">
                            <button
                                v-for="chip in hueChips"
                                :key="chip.hue"
                                type="button"
                                class="ColourPickerDlg-chip"
                                :class="{'ColourPickerDlg-chip-selected': chip.selected}"
                                :style="{background: chip.hex}"
                                @click="selectHueChip(chip.hue)"
                            ></button>
                        </div>
                    </div>

                    <p class="ColourPickerDlg-section-label">{{ $t("colourPicker.shade") }}</p>
                    <div class="ColourPickerDlg-shade-grid">
                        <div v-for="(row, rowIndex) in shadeRows" :key="rowIndex" class="ColourPickerDlg-shade-row">
                            <button
                                v-for="cell in row"
                                :key="cell.sat + '-' + cell.light"
                                type="button"
                                class="ColourPickerDlg-shade-cell"
                                :class="{'ColourPickerDlg-shade-cell-selected': cell.selected}"
                                :style="{background: cell.hex}"
                                @click="selectShadeCell(cell.sat, cell.light)"
                                @dblclick="selectShadeCellAndConfirm(cell.sat, cell.light)"
                            ></button>
                        </div>
                    </div>
                </div>

                <div v-else-if="view === 'classic'" class="ColourPickerDlg-classic">
                    <p class="ColourPickerDlg-section-label">{{ $t("colourPicker.fineGrainedSelector") }}</p>
                    <input
                        type="range"
                        class="ColourPickerDlg-hue-slider"
                        min="0"
                        max="359"
                        v-model.number="classicHue"
                        @input="updateHexFromClassic"
                    />
                    <div ref="svSquare" class="ColourPickerDlg-sv-square" :style="svSquareStyle" @pointerdown="onSvPointerDown">
                        <div class="ColourPickerDlg-sv-cursor" :style="{left: classicSat + '%', top: (100 - classicVal) + '%'}"></div>
                    </div>
                </div>
            </div>

            <div class="ColourPickerDlg-hex-row">
                <span class="ColourPickerDlg-swatch" :style="{background: currentHex}"></span>
                <input
                    id="ColourPickerDlg-hex-input"
                    type="text"
                    class="ColourPickerDlg-hex-input"
                    :class="{'ColourPickerDlg-hex-input-invalid': !isClassicHexValid}"
                    v-model="hexText"
                    spellcheck="false"
                    @input="onHexTextEdited"
                />
            </div>

            <div class="ColourPickerDlg-bottom-row" :class="{'ColourPickerDlg-bottom-row-split': view === 'tinker'}">
                <button
                    v-if="view === 'tinker'"
                    type="button"
                    class="btn EditSoundImageDlg-info-btn ColourPickerDlg-bottom-btn"
                    @click="backToGrid"
                >
                    &#8249; {{ $t("colourPicker.allColours") }}
                </button>
                <button
                    type="button"
                    class="btn EditSoundImageDlg-info-btn ColourPickerDlg-bottom-btn"
                    :class="{'ColourPickerDlg-bottom-btn-right': view === 'grid', 'ColourPickerDlg-bottom-btn-half': view === 'classic'}"
                    @click="toggleFineGrained"
                >
                    {{ view === "classic" ? $t("colourPicker.tiles") : $t("colourPicker.fineGrainedSelector") }}
                </button>
            </div>
        </div>
    </ModalDlg>
</template>

<script lang="ts">
import { defineComponent, nextTick, PropType } from "vue";
import ModalDlg from "@/components/ModalDlg.vue";
import { vueComponentsAPIHandler } from "@/helpers/vueComponentAPI";
import { eventBus } from "@/helpers/appContext";
import { CustomEventTypes } from "@/helpers/editor";
// #v-ifdef STRYPE_PLATFORM == VITE_STANDARD_PYTHON_MODE
// getPEAGraphicsContainerDivId() only exists in standard mode -- micro:bit mode has no "Graphics"
// PEA tab/canvas for the live colour preview to dim a hole over (see punchBackdropHoleOverGraphics
// below), so this whole live-preview mechanism is standard-mode-only.
import { getPEAGraphicsContainerDivId } from "@/helpers/editor";
// #v-endif
import { BvTriggerableEvent } from "bootstrap-vue-next";
import {
    parseColourToHex, hexToHsv, hsvToHex, hexToHsl, hslToHex,
    ColourFamily, COLOUR_FAMILIES, HUE_CHIP_COUNT, GOOD_CHIP_SAT, GOOD_CHIP_LIGHT,
    SHADE_ROW_SAT_COUNTS, GREY_SHADE_BANDS, familyHasHueChoice, midOfRange,
} from "@/helpers/colour";

const DEFAULT_HEX = "#ff0000";

// Only ever one instance of this dialog (see App.vue), so its id is fixed rather than a prop.
const DLG_ID = "colourPickerDlg";

function clamp(x: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, x));
}

// Squared Euclidean ("Pythagoras") distance between two hex colours in RGB space, for finding the
// closest of a set of candidate swatches to a target colour.
function hexColourDistance(a: string, b: string): number {
    const ar = parseInt(a.substring(1, 3), 16), ag = parseInt(a.substring(3, 5), 16), ab = parseInt(a.substring(5, 7), 16);
    const br = parseInt(b.substring(1, 3), 16), bg = parseInt(b.substring(3, 5), 16), bb = parseInt(b.substring(5, 7), 16);
    return (ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2;
}

// A single tile in the shade grid. No hue field: the grid always shows shades of whichever hue is
// currently selected (or of the family's fixed hue for hue-less families like grey), so hue lives
// on the component's own state rather than per-cell.
interface ShadeCell {
    sat: number;
    light: number;
    hex: string;
    selected: boolean;
}

export default defineComponent({
    name: "ColourPickerDlg",

    components: {
        ModalDlg,
    },

    props: {
        // A hex code or recognised CSS colour name to seed the picker with; null/unparseable
        // falls back to a default colour.
        initialColour: {type: String as PropType<string | null>, default: null},
    },

    data: function () {
        return {
            // "grid" is the family-swatch overview; "tinker" is the hue/shade tile picker for a
            // chosen family; "classic" is the free-form HSV square-and-slider fine-grained selector.
            view: "grid" as "grid" | "tinker" | "classic",
            // The family currently open in the tinker view, or null while on the grid.
            currentFamilyKey: null as string | null,
            // The "current colour" while browsing the family grid/shade grid, as HSL:
            hue: 0,
            sat: 0,
            light: 0,
            // The fine-grained selector's own state, as HSV, plus its hex text field:
            classicHue: 0,
            classicSat: 100,
            classicVal: 100,
            hexText: DEFAULT_HEX,
            // Whether the dialog is currently visible; gates the graphics-area colour preview so we
            // don't try to touch it while the dialog (and hence this component's reactive state) is
            // just sitting there unshown.
            isShown: false,
            // Whether the user has actually picked a colour yet this time the dialog is open --
            // gates the graphics-area preview so a fresh "insert a new colour" doesn't flood-fill
            // with a colour the user hasn't chosen (the family grid's own default HSL/HSV starting
            // state shouldn't count). Always true when editing an existing string, since there's
            // already a real colour to preview there.
            hasSelectedColour: false,
        };
    },

    created() {
        vueComponentsAPIHandler.colourPickerDlgComponentAPI = {
            getHexValue: () => (this.view !== "classic" || this.isClassicHexValid) ? this.currentHex : null,
        };

        eventBus.on(CustomEventTypes.strypeModalShown, this.onShownModalDlg);
        eventBus.on(CustomEventTypes.strypeModalHidden, this.onHiddenModalDlg);
    },

    beforeUnmount() {
        eventBus.off(CustomEventTypes.strypeModalShown, this.onShownModalDlg);
        eventBus.off(CustomEventTypes.strypeModalHidden, this.onHiddenModalDlg);
    },

    computed: {
        families(): ColourFamily[] {
            return COLOUR_FAMILIES;
        },

        currentFamily(): ColourFamily | null {
            return this.families.find((f) => f.key == this.currentFamilyKey) ?? null;
        },

        hasHue(): boolean {
            return this.currentFamily != null && familyHasHueChoice(this.currentFamily);
        },

        // The row of selectable hue swatches shown above the shade grid for families with a hue choice.
        hueChips(): {hue: number, hex: string, selected: boolean}[] {
            if (!this.currentFamily || !this.hasHue) {
                return [];
            }
            const family = this.currentFamily;
            const chipSat = family.chipSat ?? GOOD_CHIP_SAT;
            const chipLight = family.chipLight ?? GOOD_CHIP_LIGHT;
            const chips = [];
            for (let i = 0; i < HUE_CHIP_COUNT; i++) {
                const h = family.hue[0] + (family.hue[1] - family.hue[0]) * (i / (HUE_CHIP_COUNT - 1));
                chips.push({hue: h, hex: hslToHex(h, chipSat, chipLight), selected: Math.abs(h - this.hue) < 0.01});
            }
            return chips;
        },

        // The grid of shade tiles for the current family, at the currently selected hue: rows spaced
        // evenly across the family's lightness range, columns across its saturation range (with a
        // fixed number of columns per row, from SHADE_ROW_SAT_COUNTS -- fewer near the light/dark
        // ends, where saturation differences are barely visible). Hue-less families (grey) instead
        // use fixed-hue/zero-saturation bands spaced across their lightness range.
        shadeRows(): ShadeCell[][] {
            if (!this.currentFamily) {
                return [];
            }
            const family = this.currentFamily;
            if (this.hasHue) {
                const [s0, s1] = family.sat;
                const [l0, l1] = family.light;
                const rows = SHADE_ROW_SAT_COUNTS.length;
                const result: ShadeCell[][] = [];
                for (let row = 0; row < rows; row++) {
                    const l = l1 - (l1 - l0) * (row / (rows - 1));
                    const cols = SHADE_ROW_SAT_COUNTS[row];
                    const rowCells: ShadeCell[] = [];
                    for (let col = 0; col < cols; col++) {
                        const s = cols == 1 ? midOfRange(family.sat) : s0 + (s1 - s0) * (col / (cols - 1));
                        rowCells.push(this.makeShadeCell(this.hue, s, l));
                    }
                    result.push(rowCells);
                }
                return result;
            }
            else {
                return GREY_SHADE_BANDS.map((band) => {
                    const [lo, hi] = band.light;
                    const rowCells: ShadeCell[] = [];
                    for (let col = 0; col < band.count; col++) {
                        const l = band.count == 1 ? lo : lo + (hi - lo) * (col / (band.count - 1));
                        rowCells.push(this.makeShadeCell(0, 0, l));
                    }
                    return rowCells;
                });
            }
        },

        // The tile views (grid/tinker) use HSL because the family/hue/shade data (COLOUR_FAMILIES,
        // GOOD_CHIP_SAT/LIGHT etc.) is authored as hue/saturation/lightness ranges, which is the
        // natural way to describe families like "pale pastels" or "dark shades" as fixed bands.
        // The fine-grained selector uses HSV instead because its square-plus-hue-slider widget is
        // the standard colour-picker UI, and that widget is inherently a saturation/value square
        // (S on one axis, V on the other) rather than an HSL shape -- so the two views are kept on
        // their own natural models and converted at the boundary (see toggleFineGrained) rather
        // than forcing one view's data to fit the other's model.
        currentHex(): string {
            return this.view == "classic"
                ? hsvToHex(this.classicHue, this.classicSat, this.classicVal)
                : hslToHex(this.hue, this.sat, this.light);
        },

        isClassicHexValid(): boolean {
            return parseColourToHex(this.hexText) !== null;
        },

        okDisabled(): boolean {
            return !this.isClassicHexValid;
        },

        svSquareStyle(): Record<string, string> {
            return {background: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(" + this.classicHue + ", 100%, 50%)"};
        },
    },

    watch: {
        currentHex(newHex: string) {
            if (this.isShown && this.hasSelectedColour) {
                this.showGraphicsColourPreview(newHex);
            }
        },
    },

    methods: {
        familySwatchHex(family: ColourFamily): string {
            return hslToHex(midOfRange(family.hue), midOfRange(family.sat), midOfRange(family.light));
        },

        makeShadeCell(h: number, s: number, l: number): ShadeCell {
            return {
                sat: s,
                light: l,
                hex: hslToHex(h, s, l),
                selected: Math.abs(s - this.sat) < 0.01 && Math.abs(l - this.light) < 0.01,
            };
        },

        selectFamily(family: ColourFamily) {
            this.hasSelectedColour = true;
            this.currentFamilyKey = family.key;
            this.hue = midOfRange(family.hue);
            // The shade grid's rows/columns sit at fixed fractions of the family's sat/light ranges
            // (see SHADE_ROW_SAT_COUNTS), so there's no single "middle" cell -- pick whichever real
            // cell renders closest (in RGB terms) to whatever's shown at the top of the tinker view
            // the user's just landed on: the selected hue chip when the family has one (which uses
            // GOOD_CHIP_SAT/LIGHT, not the family's own sat/light range), or the family's grid swatch
            // for hue-less families like grey (which have no chip strip to compare against).
            const targetHex = familyHasHueChoice(family)
                ? hslToHex(this.hue, family.chipSat ?? GOOD_CHIP_SAT, family.chipLight ?? GOOD_CHIP_LIGHT)
                : this.familySwatchHex(family);
            let nearest: ShadeCell | null = null;
            let nearestDist = Infinity;
            for (const row of this.shadeRows) {
                for (const cell of row) {
                    const dist = hexColourDistance(cell.hex, targetHex);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearest = cell;
                    }
                }
            }
            this.sat = nearest ? nearest.sat : midOfRange(family.sat);
            this.light = nearest ? nearest.light : midOfRange(family.light);
            this.view = "tinker";
            this.hexText = this.currentHex;
        },

        backToGrid() {
            this.view = "grid";
        },

        selectHueChip(hue: number) {
            this.hasSelectedColour = true;
            this.hue = hue;
            this.hexText = this.currentHex;
        },

        selectShadeCell(sat: number, light: number) {
            this.hasSelectedColour = true;
            this.sat = sat;
            this.light = light;
            this.hexText = this.currentHex;
        },

        // Double-clicking a shade tile picks it and immediately confirms the dialog, same as
        // clicking it then clicking OK -- getHexValue() (see created() above) reads currentHex,
        // which is already reactive to the assignments just below, so no need to wait a tick.
        selectShadeCellAndConfirm(sat: number, light: number) {
            this.selectShadeCell(sat, light);
            eventBus.emit(CustomEventTypes.hideStrypeModal, {trigger: "ok", componentId: DLG_ID});
        },

        toggleFineGrained() {
            if (this.view == "classic") {
                // Leaving the fine-grained selector: fold the classic HSV colour back into
                // hue/sat/light, clamped into the active family's ranges (if any) so the shade
                // grid's selection stays sensible; otherwise just carry the colour over as-is.
                const hex = hsvToHex(this.classicHue, this.classicSat, this.classicVal);
                const {h, s, l} = hexToHsl(hex);
                if (this.currentFamily) {
                    this.hue = clamp(h, this.currentFamily.hue[0], this.currentFamily.hue[1]);
                    this.sat = clamp(s, this.currentFamily.sat[0], this.currentFamily.sat[1]);
                    this.light = clamp(l, this.currentFamily.light[0], this.currentFamily.light[1]);
                    this.view = "tinker";
                }
                else {
                    this.hue = h;
                    this.sat = s;
                    this.light = l;
                    this.view = "grid";
                }
                this.hexText = this.currentHex;
            }
            else {
                // Entering the fine-grained selector: seed its HSV state from whatever's currently picked.
                const {h, s, v} = hexToHsv(this.currentHex);
                this.classicHue = h;
                this.classicSat = s;
                this.classicVal = v;
                this.hexText = this.currentHex;
                this.view = "classic";
            }
        },

        updateHexFromClassic() {
            this.hasSelectedColour = true;
            this.hexText = hsvToHex(this.classicHue, this.classicSat, this.classicVal);
        },

        // If the given colour lands exactly on a tile swatch, jump to that tile selected in the
        // tinker view; otherwise fall through to the fine-grained selector with the colour in
        // place. Used both for user edits to the hex text field and, in onShownModalDlg below,
        // when the dialog is first opened with an existing colour.
        applyHexColour(hex: string) {
            const match = this.findExactSwatchMatch(hex);
            if (match) {
                this.currentFamilyKey = match.family.key;
                this.hue = match.hue;
                this.sat = match.sat;
                this.light = match.light;
                this.view = "tinker";
            }
            else {
                const {h, s, v} = hexToHsv(hex);
                this.classicHue = h;
                this.classicSat = s;
                this.classicVal = v;
                this.currentFamilyKey = null;
                this.view = "classic";
            }
        },

        // Called on user input into the always-visible hex text field.
        onHexTextEdited() {
            const hex = parseColourToHex(this.hexText);
            if (!hex) {
                return;
            }
            this.hasSelectedColour = true;
            this.applyHexColour(hex);
        },

        onSvPointerDown(event: PointerEvent) {
            const square = this.$refs.svSquare as HTMLDivElement;
            square.setPointerCapture(event.pointerId);
            const moveTo = (e: PointerEvent) => {
                const rect = square.getBoundingClientRect();
                const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
                const y = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
                this.classicSat = (x / rect.width) * 100;
                this.classicVal = 100 - (y / rect.height) * 100;
                this.updateHexFromClassic();
            };
            const onMove = (e: PointerEvent) => moveTo(e);
            const onUp = (e: PointerEvent) => {
                square.releasePointerCapture(e.pointerId);
                square.removeEventListener("pointermove", onMove);
                square.removeEventListener("pointerup", onUp);
            };
            square.addEventListener("pointermove", onMove);
            square.addEventListener("pointerup", onUp);
            moveTo(event);
        },

        // Searches every family's hue chips x shade grid (and the greyscale bands) for a swatch
        // that renders to exactly this hex, so we can start the dialog already on that swatch
        // instead of making the user hunt for the closest match themselves.
        findExactSwatchMatch(hex: string): {family: ColourFamily, hue: number, sat: number, light: number} | null {
            for (const family of this.families) {
                if (familyHasHueChoice(family)) {
                    for (let i = 0; i < HUE_CHIP_COUNT; i++) {
                        const h = family.hue[0] + (family.hue[1] - family.hue[0]) * (i / (HUE_CHIP_COUNT - 1));
                        const [s0, s1] = family.sat, [l0, l1] = family.light;
                        const rows = SHADE_ROW_SAT_COUNTS.length;
                        for (let row = 0; row < rows; row++) {
                            const l = l1 - (l1 - l0) * (row / (rows - 1));
                            const cols = SHADE_ROW_SAT_COUNTS[row];
                            for (let col = 0; col < cols; col++) {
                                const s = cols == 1 ? midOfRange(family.sat) : s0 + (s1 - s0) * (col / (cols - 1));
                                if (hslToHex(h, s, l) == hex) {
                                    return {family, hue: h, sat: s, light: l};
                                }
                            }
                        }
                    }
                }
                else {
                    for (const band of GREY_SHADE_BANDS) {
                        const [lo, hi] = band.light;
                        for (let col = 0; col < band.count; col++) {
                            const l = band.count == 1 ? lo : lo + (hi - lo) * (col / (band.count - 1));
                            if (hslToHex(0, 0, l) == hex) {
                                return {family, hue: 0, sat: 0, light: l};
                            }
                        }
                    }
                }
            }
            return null;
        },

        onShownModalDlg(event: BvTriggerableEvent) {
            if (event.componentId != DLG_ID) {
                return;
            }
            // initialColour is only ever passed (non-null) when we're editing an existing string's
            // content, even if that content isn't a valid colour -- see triggerColourPicker in
            // LabelSlot.vue, which always passes the current string text there and only passes null
            // for the "not inside a string" insertion case.
            if (this.initialColour !== null) {
                const parsedInitial = parseColourToHex(this.initialColour);
                const seededHex = parsedInitial ?? DEFAULT_HEX;
                // If it lands exactly on a swatch, start there with it selected; otherwise (including
                // when the existing content wasn't a valid colour at all) there's no sensible swatch
                // to preselect, so go straight to the fine-grained selector with the colour in place.
                if (parsedInitial) {
                    this.applyHexColour(parsedInitial);
                }
                else {
                    const {h, s, v} = hexToHsv(seededHex);
                    this.classicHue = h;
                    this.classicSat = s;
                    this.classicVal = v;
                    this.currentFamilyKey = null;
                    this.view = "classic";
                }
                this.hexText = seededHex;
                this.isShown = true;
                this.hasSelectedColour = true;
                this.showGraphicsColourPreview(seededHex);
                return;
            }

            // Fresh insert (not editing an existing string): start at the family grid, with no
            // colour selected yet -- don't flood-fill the graphics preview until the user actually
            // picks something (see the currentHex watcher, and hasSelectedColour being set to true
            // in selectFamily/selectHueChip/selectShadeCell/updateHexFromClassic below).
            this.hasSelectedColour = false;
            this.currentFamilyKey = null;
            const {h, s, l} = hexToHsl(DEFAULT_HEX);
            this.hue = h;
            this.sat = s;
            this.light = l;
            this.view = "grid";
            this.hexText = DEFAULT_HEX;
            this.isShown = true;
        },

        onHiddenModalDlg(event: BvTriggerableEvent) {
            if (event.componentId != DLG_ID) {
                return;
            }
            this.isShown = false;
            this.clearGraphicsColourPreview();
            window.removeEventListener("resize", this.punchBackdropHoleOverGraphics);
        },

        // While the dialog is open, flood-fill the whole graphics execution area with the currently
        // selected colour -- the same live-preview mechanism the image-literal editor uses (see
        // MediaPreviewPopup.vue's doPreviewImage), just filling the "background" canvas with a solid
        // colour instead of drawing an image into it. Both overrideGraphics() params are required
        // together to activate the override, so we pass the same filled canvas for both.
        showGraphicsColourPreview(hex: string) {
            document.getElementById("strypeGraphicsPEATab")?.click();
            const canvas = new OffscreenCanvas(800, 600);
            const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
            ctx.fillStyle = hex;
            ctx.fillRect(0, 0, 800, 600);
            vueComponentsAPIHandler.peaComponentAPI?.overrideGraphics(canvas, canvas);
            vueComponentsAPIHandler.peaComponentAPI?.redrawCanvas();
            // Switching to the Graphics tab (above) may not have finished laying out the panel yet
            // -- if it was hidden a moment ago, getBoundingClientRect() on it here would still
            // measure its old (zero-sized) box. Deferring to nextTick lets that layout settle first.
            nextTick(() => this.punchBackdropHoleOverGraphics());
            window.addEventListener("resize", this.punchBackdropHoleOverGraphics);
        },

        // The modal backdrop sits on top of the whole page -- including the graphics panel, which
        // isn't actually underneath the modal box itself -- so without this the preview would just
        // look like a dimmed/greyed version of the real colour. We want the backdrop to keep dimming
        // everywhere else, so instead of hiding it entirely we cut a rectangular hole in it over the
        // graphics panel using a "keyhole" clip-path: trace the full-viewport rectangle, then a
        // slit straight up to the hole's top edge, around the hole, and back out along the same
        // slit. The slit is traversed twice along an identical line, so it has zero visible width --
        // the net result is a plain rectangle with a rectangular hole, without needing an evenodd
        // fill rule (which the plain CSS polygon() function doesn't support).
        punchBackdropHoleOverGraphics() {
            // #v-ifdef STRYPE_PLATFORM == VITE_STANDARD_PYTHON_MODE
            const backdrop = document.querySelector(".modal-backdrop") as HTMLElement | null;
            const graphicsEl = document.getElementById(getPEAGraphicsContainerDivId());
            if (!backdrop || !graphicsEl) {
                return;
            }
            const rect = graphicsEl.getBoundingClientRect();
            const w = window.innerWidth;
            const h = window.innerHeight;
            const points = [
                "0px 0px", `${w}px 0px`, `${w}px ${h}px`, `0px ${h}px`, `0px ${rect.top}px`,
                `${rect.left}px ${rect.top}px`, `${rect.left}px ${rect.bottom}px`,
                `${rect.right}px ${rect.bottom}px`, `${rect.right}px ${rect.top}px`,
                `${rect.left}px ${rect.top}px`, `0px ${rect.top}px`,
            ].join(", ");
            backdrop.style.clipPath = `polygon(${points})`;
            // #v-endif
        },

        clearGraphicsColourPreview() {
            vueComponentsAPIHandler.peaComponentAPI?.overrideGraphics(null, null);
            vueComponentsAPIHandler.peaComponentAPI?.redrawCanvas();
            const backdrop = document.querySelector(".modal-backdrop") as HTMLElement | null;
            if (backdrop) {
                backdrop.style.clipPath = "";
            }
        },
    },
});
</script>

<style lang="scss">
.ColourPickerDlg-content {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
    width: 450px;
    margin: 0 auto;
}

.ColourPickerDlg-family-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
}
.ColourPickerDlg-family-btn {
    all: unset;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    padding: 3px;
    border-radius: 6px;
}
.ColourPickerDlg-family-btn:hover .ColourPickerDlg-family-swatch {
    transform: scale(1.08);
}
.ColourPickerDlg-family-btn:focus-visible {
    outline: 2px solid var(--bs-primary);
    outline-offset: 2px;
}
.ColourPickerDlg-family-swatch {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 8px;
    box-shadow: inset 0 0 0 1px var(--bs-border-color);
    transition: transform 120ms ease;
}
.ColourPickerDlg-family-name {
    font-size: 105%;
    font-weight: 600;
    color: var(--bs-secondary-color);
    text-align: center;
}

// Reserves enough height for the tallest view (the tinker view, hue chips + shade trapezoid) so
// switching between the family grid / tinker / fine-grained selector doesn't resize the dialog.
.ColourPickerDlg-view-area {
    min-height: 350px;
}

.ColourPickerDlg-section-label {
    font-size: 102%;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bs-secondary-color);
    margin: 0 0 7px;
}

.ColourPickerDlg-hue-strip {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    margin-bottom: 16px;
}
.ColourPickerDlg-chip {
    all: unset;
    aspect-ratio: 1.5;
    border-radius: 5px;
    box-shadow: inset 0 0 0 1px var(--bs-border-color);
    cursor: pointer;
    position: relative;
    transition: transform 120ms ease;
}
.ColourPickerDlg-chip:hover {
    transform: scale(1.05);
}
.ColourPickerDlg-chip:focus-visible {
    outline: 2px solid var(--bs-primary);
    outline-offset: 2px;
}
.ColourPickerDlg-chip-selected::after {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: 8px;
    border: 2px solid var(--bs-primary);
}

.ColourPickerDlg-shade-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.ColourPickerDlg-shade-row {
    display: flex;
    justify-content: center;
    gap: 6px;
}
.ColourPickerDlg-shade-cell {
    all: unset;
    width: 66px;
    height: 46px;
    border-radius: 5px;
    box-shadow: inset 0 0 0 1px var(--bs-border-color);
    cursor: pointer;
    position: relative;
    flex-shrink: 0;
    transition: transform 120ms ease;
}
.ColourPickerDlg-shade-cell:hover {
    transform: scale(1.06);
}
.ColourPickerDlg-shade-cell:focus-visible {
    outline: 2px solid var(--bs-primary);
    outline-offset: 2px;
}
.ColourPickerDlg-shade-cell-selected::after {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: 8px;
    border: 2px solid var(--bs-primary);
}

.ColourPickerDlg-sv-square {
    position: relative;
    width: 100%;
    height: 240px;
    touch-action: none;
    cursor: crosshair;
    box-shadow: inset 0 0 0 1px var(--bs-border-color);
    margin-top: 10px;
}
.ColourPickerDlg-sv-cursor {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
    transform: translate(-50%, -50%);
    pointer-events: none;
}
.ColourPickerDlg-hue-slider {
    width: 100%;
    -webkit-appearance: none;
    height: 14px;
    border-radius: 7px;
    background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
}
.ColourPickerDlg-hue-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    border: 2px solid #555;
    cursor: pointer;
}
.ColourPickerDlg-hue-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    border: 2px solid #555;
    cursor: pointer;
}
.ColourPickerDlg-hex-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-top: 12px;
}
.ColourPickerDlg-hex-input {
    font-family: monospace;
    font-size: 100%;
    padding: 4px 8px;
    width: 120px;
    border: 1px solid var(--bs-border-color);
    border-radius: 4px;
}
.ColourPickerDlg-hex-input-invalid {
    border-color: var(--bs-danger);
    color: var(--bs-danger);
}

.ColourPickerDlg-swatch {
    display: inline-block;
    width: 30px;
    height: 30px;
    border-radius: 5px;
    box-shadow: inset 0 0 0 1px var(--bs-border-color);
    flex-shrink: 0;
}

.ColourPickerDlg-bottom-row {
    display: flex;
    margin-top: 8px;
}
.ColourPickerDlg-bottom-row-split {
    gap: 20px;
}
.ColourPickerDlg-bottom-row-split .btn {
    flex: 1;
}
.ColourPickerDlg-bottom-btn-right {
    margin-left: auto;
}
.ColourPickerDlg-bottom-btn-half {
    width: calc(50% - 10px);
}
.btn.ColourPickerDlg-bottom-btn {
    color: #fff;
}

</style>
