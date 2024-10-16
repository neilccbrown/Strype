import strype_input_internal as _strype_input_internal
from collections import defaultdict

def consume_last_click():
    return _strype_input_internal.consumeLastClick()

def pressed_keys():
    return defaultdict(lambda: False, _strype_input_internal.getPressedKeys())
