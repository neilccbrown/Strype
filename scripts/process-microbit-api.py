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
import re
import subprocess
import sys

# The format is:
# {"full.module.name": [{acResult: "simple_name", documentation: "", type: "function", version: 0]}
found = {}

class TreeWalk(ast.NodeVisitor):
    def __init__(self):
        self.content = {}
        
    def visit_FunctionDef(self, node):
        if not node.name in self.content:
            self.content[node.name] = {"acResult": node.name, "type": [], "documentation": ast.get_docstring(node) or "", "version": 0}
            # Put args together:
            numArgs = len(node.args.args)
            if numArgs > 0:
                self.content[node.name]['params'] = []
                for i, arg in enumerate(node.args.args):
                    # A lot of microbit stubs seem to have __ at the beginning of param names, which we trim:
                    paramName = re.sub(r'^_+', '', arg.arg)
                    details = {"name": paramName}
                    # The defaults item in the tuple is None or a list of default values
                    if node.args.defaults and ((numArgs - i) <= len(node.args.defaults)):
                        defaultValIndex = i - (numArgs - len(node.args.defaults)) 
                        try:
                            if isinstance(node.args.defaults[defaultValIndex], ast.Constant): 
                                details['defaultValue'] = str(node.args.defaults[defaultValIndex].value)
                            elif isinstance(node.args.defaults[defaultValIndex], ast.Name):
                                details['defaultValue'] = node.args.defaults[defaultValIndex].id
                            else:
                                details['defaultValue'] = str(ast.literal_eval(node.args.defaults[defaultValIndex])) 
                        except Exception as e:
                            print("ERROR WHEN TRYING TO PARSE DEFAULT FOR ARG",paramName)
                            print(e)
                    self.content[node.name]['params'].append(details)
            
        self.content[node.name]["type"].append("function")
    def visit_ClassDef(self, node):
        if not node.name in self.content:
            self.content[node.name] = {"acResult": node.name, "type": [], "documentation": ast.get_docstring(node) or "", "version": 0}
        self.content[node.name]["type"].append("type")
        # Classes have a constructor:
        self.content[node.name]["type"].append("function")
    def visit_AnnAssign(self, node):
        # Picks up items like "button_a : Button" which appear in the type stubs.  The target is the LHS
        if node.target.id:
            if not node.target.id in self.content:
                self.content[node.target.id] = {"acResult": node.target.id, "type": [], "documentation": "", "version": 0}
            self.content[node.target.id]["type"].append("variable")
    def visit_ImportFrom(self, node):
        # Picks up items like "from . import compass as compass"
        # not node.module checks for "." in module name:
        if not node.module:
            for alias in node.names:
                if not alias.asname in self.content:
                    self.content[alias.asname] = {"acResult": alias.asname, "type": [], "documentation": "", "version": 0}
                self.content[alias.asname]["type"].append("module")

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
        elif file == "__init__.pyi" and parent.endswith("."):
            with open(dir + "/" + file, 'r', encoding="utf-8") as fileHandle:
                parsed = ast.parse(fileHandle.read())
                walker = TreeWalk()
                walker.visit(parsed)
                topLevelDoc = ast.get_docstring(parsed)
                found[parent[:-1]] = list(walker.content.values()) + ([{"acResult": "__doc__", "type": ["module"], "documentation": topLevelDoc, "version": 0}] if topLevelDoc else [])                  

processdir("temp-scripts/micropython-microbit-stubs/lang/en/typeshed/stdlib", "")

json.dump(found, sys.stdout, indent=4)
