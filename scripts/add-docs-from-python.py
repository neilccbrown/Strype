# Given the a JSON file with autocomplete items on stdin,
# queries the local Python implementation to get the docs wherever possible.
# Outputs the same data but with documentation filled in, to stdout.

import importlib
import inspect
import json
import pydoc
import re
import sys
from operator import attrgetter
import traceback

sys.path.append("../public/public_libraries")
sys.path.append("./stubs")

def make_default(v):
    defValStr = str(v)
    if defValStr.startswith("<"):
        defValStr = "..."
    if isinstance(v, str):
        defValStr = "'" + defValStr + "'"
    return defValStr


def convert_argspec_to_signature(func, argspec, owner_class):
    def make_arg(name, default_value, arg_type):
        return {
            "name": name,
            "defaultValue": default_value,
            "argType": str(arg_type)
        }

    def make_vararg(name, arg_type):
        return {"name": name, "argType": str(arg_type)} if name else None

    args = argspec.args or []
    posonlyargs = getattr(argspec, "posonlyargs", [])  # Python 3.8+
    kwonlyargs = argspec.kwonlyargs or []
    defaults = argspec.defaults or []
    kw_defaults = argspec.kwonlydefaults or {}


    # Determine if the method is a static method
    is_static = owner_class is not None and isinstance(
        getattr(owner_class, func.__name__, None),
        staticmethod
    )

    # Check if first param is 'self' or 'cls' and it's not a static method
    first_param_is_self_or_cls = (
        bool(args)
        and (owner_class is not None
             # This section part checks for bound methods, e.g. in random, randint = _inst.randint
             or (hasattr(func, '__self__') and hasattr(func, '__func__'))
             # Check for constructors:
             or (getattr(func, '__name__', None) in {'__init__', '__new__'})
             or inspect.isclass(func))
        and not is_static
    )
    
    if len(posonlyargs) == 0 and len(args) > 0 and first_param_is_self_or_cls:
        posonlyargs.append(args.pop(0))

    all_pos_args = posonlyargs + [arg for arg in args if arg not in posonlyargs]
    num_pos_defaults = len(defaults)
    default_start_index = len(all_pos_args) - num_pos_defaults

    def get_default(i):
        return make_default(defaults[i - default_start_index]) if i >= default_start_index else None


    return {
        "positionalOnlyArgs": [
            make_arg(name, get_default(i), None)
            for i, name in enumerate(posonlyargs)
        ],
        "positionalOrKeywordArgs": [
            make_arg(name, get_default(i + len(posonlyargs)), None)
            for i, name in enumerate(args) if name not in posonlyargs
        ],
        "varArgs": make_vararg(argspec.varargs, None),
        "keywordOnlyArgs": [
            make_arg(name, make_default(kw_defaults.get(name)), None)
            for name in kwonlyargs
        ],
        "varKwargs": make_vararg(argspec.varkw, None),
        "firstParamIsSelfOrCls": first_param_is_self_or_cls
    }

def convert_inspect_signature_to_signature(sig):
    params = list(sig.parameters.values())

    positional_only_args = []
    positional_or_keyword_args = []
    keyword_only_args = []
    varargs = None
    varkwargs = None

    for param in params:
        param_info = {
            "name": param.name,
            "defaultValue": None if param.default is inspect.Parameter.empty else make_default(param.default),
            "argType": None  # type annotations can be added if needed
        }

        if param.kind == inspect.Parameter.POSITIONAL_ONLY:
            positional_only_args.append(param_info)
        elif param.kind == inspect.Parameter.POSITIONAL_OR_KEYWORD:
            positional_or_keyword_args.append(param_info)
        elif param.kind == inspect.Parameter.KEYWORD_ONLY:
            keyword_only_args.append(param_info)
        elif param.kind == inspect.Parameter.VAR_POSITIONAL:
            varargs = {"name": param.name, "argType": None}
        elif param.kind == inspect.Parameter.VAR_KEYWORD:
            varkwargs = {"name": param.name, "argType": None}

    return {
        "positionalOnlyArgs": positional_only_args,
        "positionalOrKeywordArgs": positional_or_keyword_args,
        "varArgs": varargs,
        "keywordOnlyArgs": keyword_only_args,
        "varKwargs": varkwargs,
        "firstParamIsSelf": False
    }


def get_class_and_func(ac_result, imp_mod):
    parts = ac_result.split('.')
    for i in range(len(parts) - 1, 0, -1):
        class_path = parts[:i]
        method_name = parts[i]
        try:
            cls = attrgetter('.'.join(class_path))(imp_mod)
            func = inspect.getfullargspec(attrgetter(ac_result)(imp_mod))
            return cls, func
        except AttributeError:
            continue
    return None, inspect.getfullargspec(attrgetter(ac_result)(imp_mod))  # fallback

def parse_arguments(text, func_name):
    # Split the text into lines
    lines = text.splitlines()
    
    # Find the first line that (ignoring whitespace) starts with func_name + "("
    for line in lines:
        stripped_line = line.strip()
        if stripped_line.startswith(func_name + "("):
            # Extract the part after func_name + "("
            argument_part = stripped_line[len(func_name + "("):]
            # Initialize variables to store arguments
            arguments = []
            current_arg = ''
            in_quotes = False
            quote_char = ''
            
            # Parse the argument part
            just_had_square_bracket = False
            for char in argument_part:
                if char in ('"', "'") and not in_quotes:
                    in_quotes = True
                    quote_char = char
                elif char == quote_char and in_quotes:
                    in_quotes = False
                    quote_char = ''
                elif char == '[' and not in_quotes:
                    just_had_square_bracket = True
                    continue
                elif char == ',' and just_had_square_bracket and not in_quotes:
                    # Square bracket can be used like this: 
                    # foo(required [, optional])
                    # So we treat it like a comma followed by )
                    # i.e. we add the current arg and stop
                    arguments.append(current_arg.strip())
                    current_arg = ''
                    break
                elif (char == ')' or char == '*' or (char == '.' and current_arg.isspace())) and not in_quotes:
                    # * is special args, leading dot is part of "..." and we stop at that too.
                    current_arg = ''
                    break
                elif char == ',' and not in_quotes:
                    arguments.append(current_arg.strip())
                    current_arg = ''
                else:
                    current_arg += char
                just_had_square_bracket = False
            
            # Append the last argument if any
            if current_arg:
                arguments.append(current_arg.strip())
            
            # Filter out arguments containing '='
            filtered_arguments = [{"name": arg} for arg in arguments if '=' not in arg]
            
            return filtered_arguments
    
    return None  # Return None if no suitable line is found


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
                doc = inspect.getdoc(attrgetter(item['acResult'])(imp_mod))
                # Some functions now have their type signature first, which we will omit by removing up
                # to the first \n\n that follows such signature(s):
                if re.compile("^[A-Za-z0-9]+\\(").match(doc):
                    doubleNL = doc.find("\n\n")
                    if doubleNL > 0:
                        doc = doc[doubleNL:]
                item['documentation'] = doc.strip().replace('\r\n', '\n')
            except:
                # If we get an AttributeError or any other error, we just can't provide the doc:
                pass
        if 'function' in item['type']:
            try:
                 cls, argspec = get_class_and_func(item['acResult'], imp_mod)
                 # The args item in the tuple is a list of names of positional arguments:
                 numArgs = len(argspec.args)
                 if numArgs > 0:
                     item['signature'] = convert_argspec_to_signature(attrgetter(item['acResult'])(imp_mod), argspec, cls)                        
            except Exception as e:
                error_desc = str(e) + traceback.format_exc()
                try:
                    # print is a weird case because the docs say it has a mandatory argument,
                    # but actually you can call it without any args
                    if item['acResult'] == "print" and (mod == "builtins" or not mod):
                        del item['signature']
                    else:
                        try:
                            item['signature'] = convert_inspect_signature_to_signature(inspect.signature(mod + "." + item['acResult']))
                            item['first_errors'] = error_desc 
                        except Exception as e2:
                            error_desc += str(e2) + traceback.format_exc()
                            rendered_doc = pydoc.render_doc(mod + "." + item['acResult'])
                            args = parse_arguments(rendered_doc, item['acResult'])
                            if args:
                                item['params'] = args
                            else:
                                item['errors'] = "Fellback through everything and parse_arguments failed on " + rendered_doc + " earlier errs: " + error_desc
                except Exception as e3:
                    error_desc += str(e3) + traceback.format_exc()
                    item['errors'] = error_desc
                pass 


json.dump(targetAPI, sys.stdout, indent=4)
