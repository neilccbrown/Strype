process.env.npm_config_python = true
global.defaultImports /*: (string | RegExp)[] */ = [
]

global.defaultMyCode /*: (string | RegExp)[] */ = [
    /myString\s+[⇐=]\s+"Hello from Python!"/,
    "print(myString)",
]
