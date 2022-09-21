process.env.npm_config_microbit = true
global.defaultImports /*: (string | RegExp)[] */ = [
    "from microbit import *",
]

global.defaultMyCode /*: (string | RegExp)[] */ = [
    /myString\s+[⇐=]\s+"Hello micro:bit!"/,
    "display.scroll(myString)",
]
