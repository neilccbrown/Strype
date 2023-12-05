# Given the path of a JSON file with autocomplete items by module but no docs,
# queries the local Python implementation to get the docs wherever possible.
# Outputs the same data but with documentation filled in, to stdout.

import importlib
import inspect
import json
import re
import sys

skulptAPI = json.load(sys.stdin)
for mod in skulptAPI:
    try:
        imp_mod = importlib.import_module(mod, package=None)
    except:
        # A module that's in Skulpt but not pure Python, like webgl
        continue
    for item in skulptAPI[mod]:
        # Each item has an "acResult" with the name
        if not item['acResult'].startswith("_"):
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
                pass

json.dump(skulptAPI, sys.stdout, indent=4)
