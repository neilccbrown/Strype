def listdir():
    return ["",""]
def remove(_filename_):
    return
def size(_filename_):
    return 0
def uname():
    import collections
    __OSInf = collections.namedtuple("type",("sysname","nodename","release","version","machine"))
    return __OSInf("","","","","")