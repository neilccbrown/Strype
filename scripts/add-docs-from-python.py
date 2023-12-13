# Given the a JSON file with autocomplete items on stdin,
# queries the local Python implementation to get the docs wherever possible.
# Outputs the same data but with documentation filled in, to stdout.

import importlib
import inspect
import json
import re
import sys

targetAPI = json.load(sys.stdin)
for mod in targetAPI:
    # If you "import this" it outputs to stdout and messes with our output, so don't do that:
    if mod == "this":
        continue
    try:
        imp_mod = importlib.import_module(mod if mod else "builtins", package=None)
    except:
        # A module that's in Skulpt but not pure Python, like webgl
        continue
    for item in targetAPI[mod]:
        # Each item has an "acResult" with the name
        if not item['documentation']:
            try:
                doc = inspect.getdoc(getattr(imp_mod, item['acResult']))
                # Some functions now have their type signature first, which we will omit by removing up
                # to the first \n\n that follows such signature(s):
                if re.compile("^[A-Za-z0-9]+\\(").match(doc):
                    doubleNL = doc.find("\n\n")
                    if doubleNL > 0:
                        doc = doc[doubleNL:]
                item['documentation'] = doc.strip()
            except:
                # If we get an AttributeError or any other error, we just can't provide the doc:
                pass
        if 'function' in item['type'] and not 'params' in item:
            try:
                 argspec = inspect.getfullargspec(getattr(imp_mod, item['acResult']))
                 # The args item in the tuple is a list of names of positional arguments:
                 numArgs = len(argspec.args)
                 if numArgs > 0:
                    item['params'] = []
                    for i, arg in enumerate(argspec.args):
                        details = {"name": arg}
                        # The defaults item in the tuple is None or a list of default values but it goes backwards
                        # So if you have 5 args, and 2 in the default, they apply to the fifth and fourth arg
                        if argspec.defaults and ((numArgs - i) <= len(argspec.defaults)):
                            try:
                                details['defaultValue'] = str(argspec.defaults[numArgs - i - 1])
                            except:
                                pass
                        item['params'].append(details)
                        
            except:
                pass 

json.dump(targetAPI, sys.stdout, indent=4)
