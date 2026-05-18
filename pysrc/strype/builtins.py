from strype_bridge import strype_graphics_input_internal as _strype_input_internal

def clear_console():
    """
    Clears the console.
    
    All previous output will be cleared (and will not appear in the scroll history either),
    including any errors that might have occurred.
    """
    _strype_input_internal.clearConsole()

