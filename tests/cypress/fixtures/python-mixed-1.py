# Comment before imports should go in the imports
import random
# As should comment inbetween
import py
# This one should end up in the func defs
def foo ():
    pass
# And this one
# def commented_out():
# pass
def bar ():
    pass
def more ():
    if True:
        return 9
    else:
        pass
    return -1
Some_main_code_here = 10
foo()

bar()
more()

if True:
    foo()
    bar()
    if False:
        more()
# A final comment
