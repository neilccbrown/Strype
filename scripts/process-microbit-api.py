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
        self.content = []
        
    def visit_FunctionDef(self, node):
        self.content.append({"acResult": node.name, "type": "function", "documentation": "", "version": 0})

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
                    found[parent + stem if parent + stem != "builtins" else ""] = walker.content 

processdir("temp-scripts/micropython-microbit-stubs/lang/en/typeshed/stdlib", "")

json.dump(found, sys.stdout, indent=4)
