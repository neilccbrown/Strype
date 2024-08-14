def func1 ():
    pass
# Some comment
def func2 ():
    print("Hi")
def func3 ():
    x = 9
    y = 2
    global z
    z = 5
    return x+y+z
# Another comment
def func4 ():
    func1()
    func2()
    return func3()
