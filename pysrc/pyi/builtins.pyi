# Originally I used Typeshed's builtins.pyi but it's much too complicated so
# TigerPython can't follow all the overloads.  So instead I just list those items here
# which TigerPython doesn't have, or doesn't have correctly:

def input(prompt: object = "", /) -> str: ...
