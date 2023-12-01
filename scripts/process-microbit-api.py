# This script is used as a preprocessing step.  It is NOT run live by Strype,
# but instead run manually via the preprocess:update-microbit-api NPM task.
# It checks out the microbit foundation's stubs for the microbit API
# then processes them into a JSON file with all the API details for Strype's
# autocomplete.  It thus only needs to be re-run if their microbit API
# has changed.  The resulting file is checked in to Git since it won't change
# often.  (This script just outputs on stdout; the path of the resulting
# file is set in package.json where the NPM task is defined.)

import ast
import json
import os
from pathlib import Path
import subprocess
import sys

# The format is:
# {"full.module.name": [{acResult: "simple_name", documentation: "", type: "function", version: 0]}
found = {}

class TreeWalk(ast.NodeVisitor):
    def __init__(self):
        self.content = {}
        
    def visit_FunctionDef(self, node):
        self.content[node.name] = {"acResult": node.name, "type": "function", "documentation": "", "version": 0}
    def visit_ClassDef(self, node):
        self.content[node.name] = {"acResult": node.name, "type": "type", "documentation": "", "version": 0}

# Either checkout https://github.com/microbit-foundation/micropython-microbit-stubs or do a git pull if directory exists
if os.path.isdir("temp-scripts/micropython-microbit-stubs"):
    subprocess.run(["git", "pull"], cwd="temp-scripts/micropython-microbit-stubs", stdout=subprocess.DEVNULL)
else:
    Path("temp-scripts").mkdir(exist_ok=True)
    subprocess.run(["git", "clone", "https://github.com/microbit-foundation/micropython-microbit-stubs"], cwd="temp-scripts", stdout=subprocess.DEVNULL)

def processdir(dir, parent):
    for file in os.listdir(dir):
        if os.path.isdir(dir + "/" + file):
            processdir(dir + "/" + file, parent + file + ".")
        elif not file.startswith("_") and len(file.split(".")) == 2:
            [stem, ext] = file.split(".")
            if ext == "pyi":
                with open(dir + "/" + file, 'r', encoding="utf-8") as fileHandle:
                    parsed = ast.parse(fileHandle.read())
                    walker = TreeWalk()
                    walker.visit(parsed)
                    found[parent + stem if parent + stem != "builtins" else ""] = list(walker.content.values()) 

processdir("temp-scripts/micropython-microbit-stubs/lang/en/typeshed/stdlib", "")

json.dump(found, sys.stdout, indent=4)
