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

json.dump(targetAPI, sys.stdout, indent=4)
