import * as strype_graphics_input_internal from "./strype_graphics_input_internal";
import * as strype_graphics_internal from "./strype_graphics_internal";
import * as strype_sound_internal from "./strype_sound_internal";
import * as strype_turtle_internal from "./strype_turtle_internal";

// A simple file needed by Pyodide to export all our Strype implementation modules in one object:

export const strype_bridge = {
    strype_graphics_input_internal,
    strype_graphics_internal,
    strype_sound_internal,
    strype_turtle_internal,
};
